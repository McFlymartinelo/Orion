import { createPortal } from 'react-dom';
import {
  LayoutGrid,
  Lightbulb,
  Plug,
  Thermometer,
  CloudSun,
  Droplets,
  Wind,
  Gauge,
  Volume2,
  ArrowLeft,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES, LIGHT_DEVICE_TYPES } from '../data/mockData';
import ClimateControlWidget from './ClimateControlWidget';
import PlugControlWidget from './PlugControlWidget';
import LightControlWidget from './LightControlWidget';
import AssistantWidget from './AssistantWidget';
import SceneBar from './SceneBar';

const ROOM_NAMES = {
  chambre1: 'Chambre 1',
  chambre2: 'Chambre 2',
  sdb: 'Salle de Bain',
  wc: 'WC',
  rangement: 'Rangement',
  degagement: 'Dégagement',
  entree: 'Entrée',
  cuisine: 'Cuisine',
  sejour: 'Séjour',
  balcon: 'Balcon',
};

function fmtTemp(value) {
  return value != null ? `${Math.round(value * 10) / 10}°` : '--';
}

/**
 * Température ressentie (apparent temperature, sans vent).
 * Formule Steadman simplifiée à partir de T + humidité — Netatmo outdoor n'envoie pas de "feels like".
 */
function feelsLikeTemp(tempC, humidityPct) {
  if (tempC == null || humidityPct == null) return null;
  const e =
    (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return Math.round((tempC + 0.33 * e - 4) * 10) / 10;
}

function fmtHumidity(value) {
  return value != null ? `${Math.round(value)}%` : '--';
}

function fmtCo2(value) {
  return value != null ? `${Math.round(value)}` : '--';
}

function fmtPressure(value) {
  return value != null ? `${Math.round(value)}` : '--';
}

function fmtNoise(value) {
  return value != null ? `${Math.round(value)}` : '--';
}

function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp size={11} className="text-emerald-400" />;
  if (trend === 'down') return <TrendingDown size={11} className="text-sky-400" />;
  if (trend === 'stable') return <Minus size={11} className="text-slate-500" />;
  return null;
}

function co2Tone(ppm) {
  if (ppm == null) return 'text-slate-400';
  if (ppm < 1000) return 'text-emerald-300';
  if (ppm < 1500) return 'text-amber-300';
  return 'text-rose-300';
}

/** Bandeau maison : lumières / prises / watts. */
function SummaryStrip() {
  const devices = useOrionStore((s) => s.devices);
  const getTotalWatts = useOrionStore((s) => s.getTotalWatts);
  const list = Object.values(devices);

  const lightsOn = list.filter((d) => LIGHT_DEVICE_TYPES.has(d.type) && d.on).length;
  const plugsOn = list.filter(
    (d) => d.type === DEVICE_TYPES.TPLINK && !d.hiddenOnMap && d.on
  ).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center gap-2 text-slate-300">
        <LayoutGrid size={15} />
        <h3 className="text-sm font-semibold text-white">Vue d&apos;ensemble</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5 text-center">
          <Lightbulb size={14} className="mx-auto mb-1 text-amber-300" />
          <p className="font-display text-base font-bold text-white">{lightsOn}</p>
          <p className="text-[9px] uppercase text-slate-500">Lumières</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5 text-center">
          <Plug size={14} className="mx-auto mb-1 text-orange-300" />
          <p className="font-display text-base font-bold text-white">{plugsOn}</p>
          <p className="text-[9px] uppercase text-slate-500">Prises</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2.5 text-center">
          <p className="mb-1 font-display text-[11px] font-semibold text-sky-300/80">W</p>
          <p className="font-display text-base font-bold tabular-nums text-sky-300">
            {getTotalWatts()}
          </p>
          <p className="text-[9px] uppercase text-slate-500">Watts</p>
        </div>
      </div>
    </div>
  );
}

/** Carte Netatmo enrichie : temp, humidité, CO₂, pression, bruit. */
function NetatmoCard() {
  const netatmo = useOrionStore((s) => s.netatmo);
  const outdoorFeels = feelsLikeTemp(netatmo.outdoorTemp, netatmo.outdoorHumidity);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Wind size={15} />
          <h3 className="text-sm font-semibold text-white">Air &amp; climat</h3>
        </div>
        <span
          className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wide ${
            netatmo.connected ? 'text-emerald-400/90' : 'text-slate-500'
          }`}
          title={
            netatmo.connected
              ? `Netatmo${netatmo.moduleName ? ` · ${netatmo.moduleName}` : ''}`
              : netatmo.error || 'Netatmo hors ligne — valeurs simulées'
          }
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              netatmo.connected
                ? `bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] ${netatmo.syncing ? 'orion-pulse' : ''}`
                : 'bg-slate-500'
            }`}
          />
          Netatmo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <Thermometer size={13} className="text-orange-300" />
            <TrendIcon trend={netatmo.tempTrend} />
          </div>
          <p className="font-display text-lg font-bold tabular-nums text-white">
            {fmtTemp(netatmo.indoorTemp)}
          </p>
          <p className="text-[9px] uppercase text-slate-500">Int. · {fmtHumidity(netatmo.indoorHumidity)}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <CloudSun size={13} className="text-sky-300" />
            <TrendIcon trend={netatmo.outdoorTempTrend} />
          </div>
          <p className="font-display text-lg font-bold tabular-nums text-white">
            {fmtTemp(netatmo.outdoorTemp)}
            {outdoorFeels != null && (
              <>
                <span className="mx-0.5 text-[13px] font-medium text-slate-500">/</span>
                <span
                  className="text-[13px] font-semibold tabular-nums text-slate-400"
                  title="Température ressentie"
                >
                  {fmtTemp(outdoorFeels)}
                </span>
              </>
            )}
          </p>
          <p className="text-[9px] uppercase text-slate-500">
            Ext. · {fmtHumidity(netatmo.outdoorHumidity)}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5">
          <div className="mb-1 flex items-center gap-1">
            <Wind size={13} className="text-emerald-300" />
            <span className="text-[9px] uppercase text-slate-500">CO₂</span>
          </div>
          <p className={`font-display text-lg font-bold tabular-nums ${co2Tone(netatmo.co2)}`}>
            {fmtCo2(netatmo.co2)}
            {netatmo.co2 != null && (
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">ppm</span>
            )}
          </p>
          <p className="text-[9px] text-slate-500">
            {netatmo.co2 == null
              ? '—'
              : netatmo.co2 < 1000
                ? 'Bon'
                : netatmo.co2 < 1500
                  ? 'Moyen'
                  : 'Élevé'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <Gauge size={13} className="text-violet-300" />
            <TrendIcon trend={netatmo.pressureTrend} />
          </div>
          <p className="font-display text-lg font-bold tabular-nums text-white">
            {fmtPressure(netatmo.pressure)}
            {netatmo.pressure != null && (
              <span className="ml-0.5 text-[10px] font-semibold text-slate-500">hPa</span>
            )}
          </p>
          <p className="text-[9px] uppercase text-slate-500">Pression</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <Droplets size={14} className="shrink-0 text-sky-400" />
          <div>
            <p className="font-display text-sm font-bold tabular-nums text-white">
              {fmtHumidity(netatmo.indoorHumidity)}
              <span className="ml-1 text-[10px] font-medium text-slate-500">
                / {fmtHumidity(netatmo.outdoorHumidity)} ext
              </span>
            </p>
            <p className="text-[9px] uppercase text-slate-500">Humidité</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <Volume2 size={14} className="shrink-0 text-amber-300" />
          <div>
            <p className="font-display text-sm font-bold tabular-nums text-white">
              {fmtNoise(netatmo.noise)}
              {netatmo.noise != null && (
                <span className="ml-0.5 text-[10px] font-semibold text-slate-500">dB</span>
              )}
            </p>
            <p className="text-[9px] uppercase text-slate-500">Bruit</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Liste rapide des lumières allumées (quand rien n’est sélectionné). */
function ActiveLightsHint() {
  const devices = useOrionStore((s) => s.devices);
  const selectDevice = useOrionStore((s) => s.selectDevice);
  const lightsOn = Object.values(devices).filter(
    (d) => LIGHT_DEVICE_TYPES.has(d.type) && d.on
  );

  if (!lightsOn.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-center">
        <MousePointerClick size={18} className="mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-300">Sélectionnez un équipement sur le plan</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Lumières, prises ou Alexa — le détail s&apos;affiche ici.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="mb-2.5 text-[10px] uppercase tracking-wider text-slate-500">
        Lumières allumées · toucher pour piloter
      </p>
      <div className="flex flex-wrap gap-2">
        {lightsOn.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => selectDevice(d.id)}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-400/20"
          >
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeviceOverlayHeader({ device, onBack }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 text-slate-100 transition hover:bg-white/10 active:scale-95"
        aria-label="Retour"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Retour</span>
      </button>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">
          {ROOM_NAMES[device.room] || 'Orion'}
        </p>
        <h2 className="truncate text-base font-semibold text-white">{device.name}</h2>
      </div>
    </div>
  );
}

function deviceWidget(device) {
  switch (device.type) {
    case DEVICE_TYPES.CLIM_MOBILE:
      return <ClimateControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.TPLINK:
      return <PlugControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.HUE:
    case DEVICE_TYPES.HUE_PLAY:
    case DEVICE_TYPES.YEELIGHT_STRIP:
    case DEVICE_TYPES.YEELIGHT:
      return <LightControlWidget deviceId={device.id} />;
    case DEVICE_TYPES.ALEXA:
      return <AssistantWidget deviceId={device.id} />;
    default:
      return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          Pas de contrôle pour cet équipement.
        </div>
      );
  }
}

function DeviceOverlay({ device, onBack }) {
  return createPortal(
    <div className="orion-slide-in fixed bottom-0 right-0 top-[86px] z-50 flex w-1/2 flex-col border-l border-white/10 bg-[#07080c]">
      <DeviceOverlayHeader device={device} onBack={onBack} />
      <div className="orion-scroll min-h-0 flex-1 overflow-y-auto p-4">{deviceWidget(device)}</div>
    </div>,
    document.body
  );
}

export default function SidePanel() {
  const selectedDeviceId = useOrionStore((s) => s.selectedDeviceId);
  const device = useOrionStore((s) => (selectedDeviceId ? s.devices[selectedDeviceId] : null));
  const clearSelection = useOrionStore((s) => s.clearSelection);

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col border-l border-white/10 bg-white/[0.02] backdrop-blur-md">
      <div className="orion-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <SummaryStrip />
        <NetatmoCard />
        <ClimateControlWidget deviceId="clim-mobile" />
        <ActiveLightsHint />
      </div>
      <SceneBar />

      {device && <DeviceOverlay device={device} onBack={clearSelection} />}
    </aside>
  );
}
