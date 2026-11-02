import useOrionStore from '../../store/useOrionStore';
import { DEVICE_TYPES, LIGHT_DEVICE_TYPES } from '../../data/mockData';

/**
 * Contenu des widgets du tableau de bord. Chaque corps s'adapte à la place
 * disponible (`w` × `bh` en px) : on masque le secondaire plutôt que d'ajouter
 * un défilement. Les widgets « proposed » du catalogue sont des aperçus.
 */

const CARD = 'rounded-xl border border-white/10 bg-white/[0.02]';

const fmtTemp = (v) => (v != null ? `${Math.round(v * 10) / 10}°` : '--');
const fmtPct = (v) => (v != null ? `${Math.round(v)}%` : '--');
const rowsFit = (bh, h, gap) => Math.max(1, Math.floor((bh + gap) / (h + gap)));

/** Température ressentie (Steadman simplifiée, comme l'ancien panneau Air & climat). */
function feelsLike(tempC, humidityPct) {
  if (tempC == null || humidityPct == null) return null;
  const e = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return Math.round((tempC + 0.33 * e - 4) * 10) / 10;
}

function co2Label(ppm) {
  if (ppm == null) return { text: '—', tone: 'text-slate-400' };
  if (ppm < 1000) return { text: 'Bon', tone: 'text-emerald-300' };
  if (ppm < 1500) return { text: 'Moyen', tone: 'text-amber-300' };
  return { text: 'Élevé', tone: 'text-rose-300' };
}

function Tile({ label, value, unit, sub, showSub, tone = 'text-white' }) {
  return (
    <div className={`${CARD} orion-tile min-w-0 flex-1 overflow-hidden px-2.5 py-1.5`}>
      <p className="truncate text-[9px] uppercase leading-3 tracking-wide text-slate-500">{label}</p>
      <p className={`orion-tile-value truncate font-display text-[15px] font-bold leading-5 tabular-nums ${tone}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] font-semibold text-slate-500">{unit}</span>}
      </p>
      {showSub && sub && <p className="truncate text-[9px] leading-3 text-emerald-300/90">{sub}</p>}
    </div>
  );
}

export function Switch({ on, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`orion-switch relative h-[18px] w-8 shrink-0 rounded-full transition ${on ? 'bg-sky-400/80' : 'bg-white/15'}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-3.5' : ''
        }`}
      />
    </button>
  );
}

export function Row({ children, h = 28 }) {
  return (
    <div
      className="orion-row flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
      style={{ height: h }}
    >
      {children}
    </div>
  );
}

const Empty = ({ children }) => <p className="text-[11px] text-slate-500">{children}</p>;

/* ───────── Widgets disponibles ───────── */

function Summary({ bh }) {
  const devices = useOrionStore((s) => s.devices);
  const list = Object.values(devices);
  const lights = list.filter((d) => LIGHT_DEVICE_TYPES.has(d.type) && d.on).length;
  const plugs = list.filter((d) => d.type === DEVICE_TYPES.TPLINK && !d.hiddenOnMap && d.on).length;
  const watts = Math.round(list.reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0));
  return (
    <div className="flex gap-2">
      <Tile label="Lumières" value={lights} tone="text-amber-300" showSub={bh >= 60} sub="allumées" />
      <Tile label="Prises" value={plugs} tone="text-orange-300" showSub={bh >= 60} sub="actives" />
      <Tile label="Puissance" value={watts} unit="W" tone="text-sky-300" />
    </div>
  );
}

function Air({ bh }) {
  const netatmo = useOrionStore((s) => s.netatmo);
  const feels = feelsLike(netatmo.outdoorTemp, netatmo.outdoorHumidity);
  const co2 = co2Label(netatmo.co2);
  return (
    <>
      <div className="flex gap-2">
        <Tile
          label={`Intérieur · ${fmtPct(netatmo.indoorHumidity)}`}
          value={fmtTemp(netatmo.indoorTemp)}
          showSub={bh >= 60}
          sub={netatmo.connected ? 'Netatmo · à jour' : 'Valeurs simulées'}
        />
        <Tile
          label={`Extérieur · ${fmtPct(netatmo.outdoorHumidity)}`}
          value={fmtTemp(netatmo.outdoorTemp)}
          showSub={bh >= 60}
          sub={feels != null ? `Ressenti ${fmtTemp(feels)}` : ''}
        />
      </div>
      {bh >= 92 && (
        <Row h={26}>
          <span className="text-slate-400">CO₂ · {netatmo.co2 != null ? `${Math.round(netatmo.co2)} ppm` : '--'}</span>
          <b className={`ml-auto ${co2.tone}`}>{co2.text}</b>
          {netatmo.noise != null && <span className="text-slate-500">{Math.round(netatmo.noise)} dB</span>}
        </Row>
      )}
    </>
  );
}

function Climate({ bh }) {
  const clim = useOrionStore((s) => s.devices['clim-mobile']);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  if (!clim) return <Empty>Climatisation indisponible</Empty>;
  const modeLabel = { cool: 'Froid', fan: 'Ventilation', dry: 'Déshumidification' }[clim.mode] ?? clim.mode;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => selectDevice(clim.id)}
        className="min-w-0 flex-1 text-left"
        aria-label="Ouvrir le détail de la climatisation"
      >
        <div className="flex">
          <Tile
            label={`Clim · actuel ${fmtTemp(clim.currentTemp)}`}
            value={`${clim.targetTemp}°`}
            unit="consigne"
            showSub={bh >= 60}
            sub={`Mode ${modeLabel}`}
          />
        </div>
      </button>
      <Switch on={clim.on} onClick={() => toggleDevice(clim.id)} label="Climatisation" />
    </div>
  );
}

function Scenes({ w, bh, mobile }) {
  const scenes = useOrionStore((s) => s.scenes);
  const activeScene = useOrionStore((s) => s.activeScene);
  const applyScene = useOrionStore((s) => s.applyScene);
  const cols = Math.max(2, Math.min(mobile ? 3 : 4, Math.floor(w / 92)));
  const rows = Math.max(1, Math.floor((bh + 6) / 46));
  const shown = mobile ? scenes : scenes.slice(0, cols * rows);
  return (
    <div
      className={mobile ? 'grid gap-1.5' : 'grid min-h-0 flex-1 gap-1.5'}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        ...(mobile ? { gridAutoRows: 'minmax(46px, auto)' } : { gridTemplateRows: `repeat(${rows}, minmax(0,1fr))` }),
      }}
    >
      {shown.map((scene) => (
        <button
          key={scene.id}
          type="button"
          onClick={() => applyScene(scene.id)}
          data-active={activeScene === scene.id}
          className={`orion-chip flex min-h-0 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1.5 text-[10px] font-semibold uppercase tracking-wide transition active:scale-95 ${mobile ? 'min-h-[46px]' : ''} ${
            activeScene === scene.id
              ? 'border-sky-400/50 bg-sky-400/15 text-white shadow-[0_0_14px_rgba(56,189,248,0.25)]'
              : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
          }`}
        >
          <span className="text-base leading-none">{scene.emoji}</span>
          <span className="truncate">{scene.label}</span>
        </button>
      ))}
    </div>
  );
}

function Lights({ widget, bh, mobile }) {
  const devices = useOrionStore((s) => s.devices);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  // Ordre stable : ne pas trier par état allumé/éteint, sinon la ligne cliquée
  // saute en haut de la liste à chaque bascule du switch.
  const lights = Object.values(devices).filter(
    (d) => LIGHT_DEVICE_TYPES.has(d.type) && (widget.room === 'all' || d.room === widget.room)
  );
  if (!lights.length) return <Empty>Aucun éclairage dans cette pièce</Empty>;
  return lights.slice(0, mobile ? lights.length : rowsFit(bh, 28, 6)).map((d) => (
    <Row key={d.id}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${d.on ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.8)]' : 'bg-slate-600'}`}
      />
      <button type="button" onClick={() => selectDevice(d.id)} className="min-w-0 flex-1 truncate text-left text-slate-200">
        {d.name}
      </button>
      {d.on && d.brightness != null && <span className="text-[9px] text-slate-500">{d.brightness}%</span>}
      <Switch on={d.on} onClick={() => toggleDevice(d.id)} label={d.name} />
    </Row>
  ));
}

function Plugs({ bh, mobile }) {
  const devices = useOrionStore((s) => s.devices);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const plugs = Object.values(devices).filter((d) => d.type === DEVICE_TYPES.TPLINK);
  const total = Math.round(plugs.reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0));
  const listRows = rowsFit(bh - 28, 26, 5);
  return (
    <>
      <p className="orion-watts shrink-0 font-display text-xl font-bold leading-6 tabular-nums text-white">
        {total} <span className="text-[10px] font-semibold text-slate-500">W · consommation instantanée</span>
      </p>
      {(mobile || bh >= 60) &&
        plugs.slice(0, mobile ? plugs.length : listRows).map((d) => (
          <Row key={d.id} h={26}>
            <button type="button" onClick={() => selectDevice(d.id)} className="min-w-0 flex-1 truncate text-left text-slate-200">
              {d.name}
            </button>
            <span className="text-[10px] tabular-nums text-slate-400">{d.on ? Math.round(d.watts || 0) : 0} W</span>
            <Switch on={d.on} onClick={() => toggleDevice(d.id)} label={d.name} />
          </Row>
        ))}
    </>
  );
}

function Alexa({ bh, mobile }) {
  const devices = useOrionStore((s) => s.devices);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const echoes = Object.values(devices).filter((d) => d.type === DEVICE_TYPES.ALEXA);
  if (!echoes.length) return <Empty>Aucune enceinte Alexa</Empty>;
  return echoes.slice(0, mobile ? echoes.length : rowsFit(bh, 28, 6)).map((d) => (
    <Row key={d.id}>
      <button type="button" onClick={() => selectDevice(d.id)} className="min-w-0 flex-1 truncate text-left text-slate-200">
        {d.name}
      </button>
      <span className="text-[10px] tabular-nums text-slate-400">Vol. {d.volume ?? '--'}%</span>
      <Switch on={d.on} onClick={() => toggleDevice(d.id)} label={d.name} />
    </Row>
  ));
}

function Connections({ bh, mobile }) {
  const hue = useOrionStore((s) => s.hue);
  const netatmo = useOrionStore((s) => s.netatmo);
  const kasa = useOrionStore((s) => s.kasa);
  const tuya = useOrionStore((s) => s.tuya);
  const alexa = useOrionStore((s) => s.alexa);
  const yeelight = useOrionStore((s) => s.yeelight);
  const items = [
    ['Netatmo', netatmo.connected],
    ['Hue', hue.connected],
    ['Kasa', kasa.connected],
    ['Tuya · Clim', tuya.connected],
    ['Alexa', alexa.connected],
    ['Yeelight', yeelight.connected],
  ];
  return items.slice(0, mobile ? items.length : rowsFit(bh, 26, 5)).map(([name, ok]) => (
    <Row key={name} h={26}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'}`} />
      <span className="flex-1 truncate text-slate-200">{name}</span>
      <span className={`text-[10px] ${ok ? 'text-emerald-300/90' : 'text-slate-500'}`}>{ok ? 'Connecté' : 'Hors ligne'}</span>
    </Row>
  ));
}

/* ───────── Aperçus des widgets proposés ───────── */

function StaticList({ items, bh, mobile }) {
  return items.slice(0, mobile ? items.length : rowsFit(bh, 26, 5)).map(([label, value]) => (
    <Row key={label} h={26}>
      <span className="flex-1 truncate text-slate-200">{label}</span>
      <span className="text-[10px] text-slate-500">{value}</span>
    </Row>
  ));
}

function History({ mobile }) {
  const watts = useOrionStore((s) =>
    Math.round(Object.values(s.devices).reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0))
  );
  const path = 'M0 42 L14 36 28 38 43 29 58 34 73 19 88 27 103 20 118 28 133 15 148 22 163 19 178 27 193 12 208 18 223 9 238 22 253 16 270 18 285 7 300 12';
  return (
    <>
      <p className="orion-watts shrink-0 font-display text-xl font-bold leading-6 tabular-nums text-white">
        {watts} <span className="text-[10px] font-semibold text-slate-500">W · historique à connecter</span>
      </p>
      <svg
        viewBox="0 0 300 50"
        preserveAspectRatio="none"
        className={mobile ? 'h-24 w-full overflow-visible' : 'min-h-0 w-full flex-1 overflow-visible'}
      >
        <path d={`${path} L300 50 0 50Z`} fill="rgba(251,191,36,0.14)" />
        <path d={path} fill="none" stroke="#fbbf24" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  );
}

function Weather({ bh }) {
  const netatmo = useOrionStore((s) => s.netatmo);
  return (
    <div className="flex gap-2">
      <Tile label="Maintenant" value={fmtTemp(netatmo.outdoorTemp)} showSub={bh >= 60} sub="Prévisions à connecter" />
      <Tile label="Demain" value="—" showSub={bh >= 60} sub="Service météo à ajouter" />
    </div>
  );
}

function AirQuality({ bh }) {
  const netatmo = useOrionStore((s) => s.netatmo);
  const co2 = co2Label(netatmo.co2);
  return (
    <div className="flex gap-2">
      <Tile
        label="CO₂ · séjour"
        value={netatmo.co2 != null ? Math.round(netatmo.co2) : '--'}
        unit="ppm"
        tone={co2.tone}
        showSub={bh >= 60}
        sub={`Qualité ${co2.text.toLowerCase()}`}
      />
      <Tile label="Humidité" value={fmtPct(netatmo.indoorHumidity)} showSub={bh >= 60} sub="Plage confort 40–60 %" />
    </div>
  );
}

function RoomTemp({ widget, bh }) {
  const rooms = useOrionStore((s) => s.rooms);
  const netatmo = useOrionStore((s) => s.netatmo);
  const room = rooms.find((r) => r.id === widget.room);
  return (
    <div className="flex gap-2">
      <Tile label={room?.name ?? 'Séjour'} value={fmtTemp(netatmo.indoorTemp)} showSub={bh >= 60} sub="Capteur Netatmo" />
    </div>
  );
}

function Shortcut({ bh, mobile }) {
  const applyScene = useOrionStore((s) => s.applyScene);
  const clim = useOrionStore((s) => s.devices['clim-mobile']);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const actions = [
    ['⏻', 'Tout éteindre', () => applyScene('lights-off')],
    ['❄', clim?.on ? 'Clim off' : 'Clim on', () => clim && toggleDevice(clim.id)],
  ];
  return (
    <div className={mobile ? 'grid grid-cols-2 gap-1.5' : 'grid min-h-0 flex-1 grid-cols-2 gap-1.5'}>
      {actions.map(([icon, label, run]) => (
        <button
          key={label}
          type="button"
          onClick={run}
          className={`orion-chip flex min-h-0 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-white/[0.07] active:scale-95 ${
            mobile ? 'min-h-[64px]' : ''
          } ${bh < 60 ? '' : 'flex-col'}`}
        >
          <span className="text-base leading-none">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

const ACTIVITY = [
  ['Scène « Salon + SAM »', '20:14'],
  ['Lumière Salon 1 allumée', '19:52'],
  ['Prise Verres', '19:30'],
  ['Clim mobile · 21°', '18:05'],
];
const SCHEDULE = [
  ['Lumières off', '23:00'],
  ['Clim off', '07:30'],
  ['Scène « Départ »', '08:15'],
];

export default function WidgetBody({ widget, w, bh, mobile = false }) {
  switch (widget.type) {
    case 'summary':
      return <Summary bh={bh} />;
    case 'air':
      return <Air bh={bh} />;
    case 'climate':
      return <Climate bh={bh} />;
    case 'scenes':
      return <Scenes w={w} bh={bh} mobile={mobile} />;
    case 'lights':
      return <Lights widget={widget} bh={bh} mobile={mobile} />;
    case 'plugs':
      return <Plugs bh={bh} mobile={mobile} />;
    case 'alexa':
      return <Alexa bh={bh} mobile={mobile} />;
    case 'connections':
      return <Connections bh={bh} mobile={mobile} />;
    case 'history':
      return <History mobile={mobile} />;
    case 'activity':
      return <StaticList items={ACTIVITY} bh={bh} mobile={mobile} />;
    case 'schedule':
      return <StaticList items={SCHEDULE} bh={bh} mobile={mobile} />;
    case 'weather':
      return <Weather bh={bh} />;
    case 'airquality':
      return <AirQuality bh={bh} />;
    case 'roomtemp':
      return <RoomTemp widget={widget} bh={bh} />;
    case 'shortcut':
      return <Shortcut bh={bh} mobile={mobile} />;
    default:
      return null;
  }
}
