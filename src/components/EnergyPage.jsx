import { useEffect, useMemo, useRef, useState } from 'react';
import DeviceOverlay from './DeviceOverlay';
import { Switch } from './widgets/WidgetBody';
import useOrionStore from '../store/useOrionStore';
import useLayoutStore from '../store/useLayoutStore';
import useEnergyStore from '../store/useEnergyStore';
import { APARTMENT_NAME, APARTMENT_REF } from '../data/mockData';
import {
  ELECTRICITY_PRICE_PER_KWH,
  formatCost,
  formatEnergy,
  formatWatts,
  isMeasuredPlug,
  measuredWatts,
} from '../data/energy';

const CARD =
  'orion-card rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--orion-card-from)] to-[var(--orion-card-to)]';

const PERIODS = [
  { id: '1h', label: '1 h', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6 h', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', label: '24 h', ms: 24 * 60 * 60 * 1000 },
];
// Au-delà de cet écart entre deux relevés, on considère que l'appli était fermée : on coupe la courbe.
const GAP_MS = 5 * 60 * 1000;
const CHART_W = 1000;
const CHART_H = 300;

const TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtTime = (t) => TIME.format(new Date(t));

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Découpe les relevés en segments continus et intègre l'énergie (kWh) sur chacun. */
function analyse(points) {
  const segments = [];
  let current = [];
  let kwh = 0;
  let peak = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [t, w] = points[i];
    peak = Math.max(peak, w);
    const prev = points[i - 1];
    if (prev && t - prev[0] > GAP_MS) {
      segments.push(current);
      current = [];
    } else if (prev) {
      kwh += (((prev[1] + w) / 2) * ((t - prev[0]) / 3600000)) / 1000;
    }
    current.push(points[i]);
  }
  if (current.length) segments.push(current);
  return { segments, kwh, peak };
}

const niceMax = (v) => {
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 3000, 5000];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 1000) * 1000;
};

function Stat({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="orion-tile min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
      <p className="truncate text-[9px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-display text-xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="truncate text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}

/** Courbe de puissance : SVG étiré + libellés HTML (texte net), lecture au survol. */
function PowerChart({ points, from, to, segments }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const peak = points.reduce((m, [, w]) => Math.max(m, w), 0);
  const max = niceMax(Math.max(peak * 1.15, 20));
  const x = (t) => ((t - from) / (to - from)) * CHART_W;
  const y = (w) => CHART_H - 8 - (w / max) * (CHART_H - 20);
  const line = (seg) => seg.map(([t, w], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(w).toFixed(1)}`).join(' ');

  const onMove = (e) => {
    if (!points.length) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const t = from + ((e.clientX - rect.left) / rect.width) * (to - from);
    let best = points[0];
    for (const p of points) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    setHover(best);
  };

  return (
    <div className="flex min-h-0 flex-1 gap-2">
      <div className="flex w-10 shrink-0 flex-col justify-between pb-6 text-right text-[9px] tabular-nums text-slate-500">
        <span>{max} W</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={wrapRef}
          className="relative min-h-0 flex-1 cursor-crosshair"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label="Courbe de puissance"
          >
            {[0, 0.5, 1].map((f) => (
              <line
                key={f}
                x1="0"
                x2={CHART_W}
                y1={y(max * f)}
                y2={y(max * f)}
                stroke="currentColor"
                className="text-white/10"
                vectorEffect="non-scaling-stroke"
                strokeDasharray={f ? '4 6' : undefined}
              />
            ))}
            {segments.map((seg, i) =>
              seg.length > 1 ? (
                <g key={i}>
                  <path
                    d={`${line(seg)} L${x(seg[seg.length - 1][0])} ${y(0)} L${x(seg[0][0])} ${y(0)}Z`}
                    className="fill-sky-400/15"
                  />
                  <path
                    d={line(seg)}
                    fill="none"
                    className="stroke-sky-400"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              ) : (
                <circle key={i} cx={x(seg[0][0])} cy={y(seg[0][1])} r="3" className="fill-sky-400" />
              )
            )}
          </svg>
          {hover && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/30"
                style={{ left: `${(x(hover[0]) / CHART_W) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-[var(--orion-modal)] px-2 py-1 text-[10px]"
                style={{ left: `clamp(48px, ${(x(hover[0]) / CHART_W) * 100}%, calc(100% - 48px))` }}
              >
                <b className="text-white">{formatWatts(hover[1])}</b>
                <span className="ml-1.5 text-slate-400">{fmtTime(hover[0])}</span>
              </div>
            </>
          )}
        </div>
        <div className="mt-1.5 flex h-4 justify-between text-[9px] tabular-nums text-slate-500">
          <span>{fmtTime(from)}</span>
          <span>{fmtTime((from + to) / 2)}</span>
          <span>{fmtTime(to)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Page « Énergie » : puissance actuelle, énergie et coût estimés sur la période (calculés depuis
 * l'historique relevé par l'appli), courbe de puissance, détail par prise et par pièce.
 * Seules les prises Kasa à compteur mesurent : le reste est signalé « non mesuré », jamais estimé.
 */
export default function EnergyPage() {
  const devices = useOrionStore((s) => s.devices);
  const rooms = useOrionStore((s) => s.rooms);
  const kasaConnected = useOrionStore((s) => s.kasa.connected);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const samples = useEnergyStore((s) => s.samples);
  const mockup = useLayoutStore((s) => s.theme) === 'mockup';
  const [periodId, setPeriodId] = useState('6h');
  const now = useNow();
  const period = PERIODS.find((p) => p.id === periodId);

  const plugs = useMemo(() => Object.values(devices).filter(isMeasuredPlug), [devices]);
  const nowWatts = measuredWatts(devices);
  const unmeasured = Object.values(devices).filter((d) => !d.hiddenOnMap && !isMeasuredPlug(d)).length;

  const from = now - period.ms;
  const points = useMemo(() => samples.filter(([t]) => t >= from), [samples, from]);
  const { segments, kwh, peak } = useMemo(() => analyse(points), [points]);
  const firstSample = samples[0]?.[0];
  const counterKwh = plugs.reduce((sum, d) => sum + (d.energyKwh || 0), 0);

  const byRoom = useMemo(() => {
    const totals = new Map();
    for (const d of plugs) totals.set(d.room, (totals.get(d.room) || 0) + (d.on ? d.watts || 0 : 0));
    return [...totals.entries()]
      .map(([id, watts]) => ({ name: rooms.find((r) => r.id === id)?.name ?? id, watts }))
      .sort((a, b) => b.watts - a.watts);
  }, [plugs, rooms]);
  const maxPlug = Math.max(1, ...plugs.map((d) => (d.on ? d.watts || 0 : 0)));
  const maxRoom = Math.max(1, ...byRoom.map((r) => r.watts));

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col pb-3 ${mockup ? 'px-4' : 'px-3'}`}>
      {mockup ? (
        <div className="mb-1.5 mt-1 flex h-[50px] shrink-0 flex-col justify-center">
          <div className="text-[9px] font-extrabold tracking-[1.5px] text-[#a6a8c7]">
            ÉNERGIE · {APARTMENT_NAME.toUpperCase()} {APARTMENT_REF}
          </div>
          <h1 className="mt-[3px] text-[18px] font-bold tracking-[-0.3px]">Consommation mesurée</h1>
        </div>
      ) : (
        <div className="flex h-9 shrink-0 items-center">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Énergie</h2>
        </div>
      )}

      <div className="flex shrink-0 gap-2.5">
        <Stat
          label="Puissance actuelle"
          value={formatWatts(nowWatts)}
          sub={`${plugs.filter((d) => d.on).length}/${plugs.length} prises allumées`}
          tone="text-sky-300"
        />
        <Stat label={`Consommé · ${period.label}`} value={formatEnergy(kwh)} sub="d’après l’historique relevé" />
        <Stat
          label={`Coût estimé · ${period.label}`}
          value={formatCost(kwh)}
          sub={`à ${String(ELECTRICITY_PRICE_PER_KWH).replace('.', ',')} €/kWh`}
          tone="text-amber-300"
        />
        <Stat label={`Pic · ${period.label}`} value={points.length ? formatWatts(peak) : '—'} sub="puissance maximale relevée" />
      </div>

      <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-2.5">
        <section className={`${CARD} flex min-h-0 flex-col p-4`} aria-label="Courbe de puissance">
          <div className="mb-3 flex shrink-0 items-center gap-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-200">Puissance mesurée</h3>
            <span className="text-[10px] text-slate-500">
              {firstSample ? `historique depuis ${fmtTime(firstSample)}` : 'aucun relevé pour l’instant'}
            </span>
            <div role="group" aria-label="Période" className="ml-auto flex overflow-hidden rounded-full border border-white/15 text-[10px] font-semibold">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === periodId}
                  onClick={() => setPeriodId(p.id)}
                  className={`px-3 py-1.5 transition ${
                    p.id === periodId ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {points.length > 1 ? (
            <PowerChart points={points} from={from} to={now} segments={segments} />
          ) : (
            <div className="flex flex-1 items-center justify-center px-8 text-center text-xs leading-relaxed text-slate-500">
              {kasaConnected
                ? 'Collecte en cours : la courbe se construit au fil des relevés (toutes les 30 s).'
                : 'Les prises Kasa sont hors ligne : aucune mesure n’est enregistrée tant qu’elles ne répondent pas.'}
            </div>
          )}
          {!kasaConnected && points.length > 1 && (
            <p className="mt-2 shrink-0 text-[10px] text-amber-300/90">Prises Kasa hors ligne : les valeurs affichées sont simulées.</p>
          )}
        </section>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5">
          <section className={`${CARD} p-4`} aria-label="Par prise">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-200">Par prise</h3>
            <div className="space-y-2.5">
              {plugs.map((d) => {
                const watts = d.on ? d.watts || 0 : 0;
                return (
                  <div key={d.id}>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => selectDevice(d.id)}
                        className="min-w-0 flex-1 truncate text-left font-medium text-slate-100"
                        title="Ouvrir le détail"
                      >
                        {d.name}
                      </button>
                      <b className="tabular-nums text-white">{d.on ? formatWatts(d.watts) : 'Éteinte'}</b>
                      <Switch on={d.on} onClick={() => toggleDevice(d.id)} label={d.name} />
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${(watts / maxPlug) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {rooms.find((r) => r.id === d.room)?.name} · compteur {formatEnergy(d.energyKwh)} · {formatCost(d.energyKwh)}
                      {d.voltage != null && ` · ${Math.round(d.voltage)} V`}
                    </p>
                  </div>
                );
              })}
              {!plugs.length && <p className="text-xs text-slate-500">Aucune prise avec compteur.</p>}
            </div>
          </section>

          <section className={`${CARD} flex min-h-0 flex-col p-4`} aria-label="Par pièce">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-200">Par pièce</h3>
            <div className="space-y-2">
              {byRoom.map((r) => (
                <div key={r.name} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 shrink-0 truncate text-slate-300">{r.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${(r.watts / maxRoom) * 100}%` }} />
                  </div>
                  <b className="w-14 shrink-0 text-right tabular-nums text-white">{formatWatts(r.watts)}</b>
                </div>
              ))}
            </div>
            <p className="mt-auto pt-3 text-[10px] leading-relaxed text-slate-500">
              Compteur cumulé des prises : <b className="text-slate-300">{formatEnergy(counterKwh)}</b> ({formatCost(counterKwh)}).{' '}
              {unmeasured} autre{unmeasured > 1 ? 's' : ''} équipement{unmeasured > 1 ? 's' : ''} (éclairage, Alexa…) sans
              compteur : consommation non mesurée.
            </p>
          </section>
        </div>
      </div>

      <DeviceOverlay />
    </div>
  );
}
