import { useCallback, useRef } from 'react';
import { Minus, Plus, Snowflake, Wind, Droplets, Zap } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';

const GAUGE_SIZE = 200;
const CENTER = GAUGE_SIZE / 2;
const RADIUS = 80;
const START_ANGLE = 135; // début de l'arc (bas gauche)
const SWEEP = 270; // ouverture totale de l'arc (270°)
const END_ANGLE = START_ANGLE + SWEEP;
const TEMP_MIN = 16;
const TEMP_MAX = 30;

const MODES = [
  { id: 'cool', label: 'Cool', emoji: '❄️', Icon: Snowflake },
  { id: 'fan', label: 'Fan', emoji: '🌪️', Icon: Wind },
  { id: 'dry', label: 'Dry', emoji: '💧', Icon: Droplets },
];

const FAN_SPEEDS = [
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Forte' },
];

function polarToCartesian(angleDeg, radius = RADIUS) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  };
}

function describeArc(startAngle, endAngle, radius = RADIUS) {
  const start = polarToCartesian(startAngle, radius);
  const end = polarToCartesian(endAngle, radius);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function tempToAngle(temp) {
  const fraction = (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
  return START_ANGLE + fraction * SWEEP;
}

function angleToTemp(rawAngle) {
  let angle = rawAngle;
  if (angle < START_ANGLE) angle += 360;
  const clamped = Math.min(END_ANGLE, Math.max(START_ANGLE, angle));
  const fraction = (clamped - START_ANGLE) / SWEEP;
  return TEMP_MIN + fraction * (TEMP_MAX - TEMP_MIN);
}

function formatWatts(watts) {
  if (watts == null || Number.isNaN(Number(watts))) return '—';
  const n = Number(watts);
  if (n >= 100) return `${Math.round(n)} W`;
  return `${n.toFixed(1)} W`;
}

export default function ClimateControlWidget({ deviceId = 'clim-mobile' }) {
  const device = useOrionStore((s) => s.devices[deviceId]);
  const powerPlug = useOrionStore((s) => {
    const clim = s.devices[deviceId];
    return clim?.powerPlugId ? s.devices[clim.powerPlugId] ?? null : null;
  });
  const tuya = useOrionStore((s) => s.tuya);
  const kasa = useOrionStore((s) => s.kasa);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const adjustTargetTemp = useOrionStore((s) => s.adjustTargetTemp);
  const setTargetTemp = useOrionStore((s) => s.setTargetTemp);
  const setClimateMode = useOrionStore((s) => s.setClimateMode);
  const setFanSpeed = useOrionStore((s) => s.setFanSpeed);

  const svgRef = useRef(null);
  const dragging = useRef(false);

  const updateFromPointer = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = GAUGE_SIZE / rect.width;
      const scaleY = GAUGE_SIZE / rect.height;
      const x = (clientX - rect.left) * scaleX - CENTER;
      const y = (clientY - rect.top) * scaleY - CENTER;
      const rawAngle = (Math.atan2(y, x) * 180) / Math.PI + 90;
      const angle = rawAngle < 0 ? rawAngle + 360 : rawAngle;
      const temp = angleToTemp(angle);
      setTargetTemp(deviceId, Math.round(temp));
    },
    [deviceId, setTargetTemp]
  );

  const handlePointerDown = (e) => {
    dragging.current = true;
    e.target.setPointerCapture?.(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    updateFromPointer(e.clientX, e.clientY);
  };
  const handlePointerUp = () => {
    dragging.current = false;
  };

  if (!device) return null;

  const targetTemp = device.targetTemp ?? 21;
  const knobAngle = tempToAngle(targetTemp);
  const knobPos = polarToCartesian(knobAngle);
  const trackPath = describeArc(START_ANGLE, END_ANGLE);
  const progressPath = describeArc(START_ANGLE, knobAngle);

  return (
    <div className="orion-fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{device.name}</h3>
            {device.tuyaId && (
              <span
                title={tuya.connected ? 'Tuya connecté' : tuya.error || 'Tuya hors ligne'}
                className={`inline-block h-2 w-2 rounded-full ${
                  tuya.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
                }`}
              />
            )}
          </div>
          <p className="text-[11px] text-slate-400">Climatisation mobile · Séjour</p>
        </div>
        <button
          onClick={() => toggleDevice(deviceId)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
            device.on
              ? 'bg-sky-400/20 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
              : 'bg-white/5 text-slate-400'
          }`}
        >
          {device.on ? 'Marche' : 'Arrêt'}
        </button>
      </div>

      {powerPlug && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Zap size={14} className={powerPlug.on ? 'text-amber-300' : 'text-slate-500'} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-white">{powerPlug.name}</p>
              <p className="text-[10px] text-slate-400">
                {powerPlug.on ? 'Alimentation ON' : 'Alimentation OFF'}
                {kasa.connected ? ' · live' : ''}
                {' · '}
                <span className="tabular-nums text-amber-300/90">
                  {powerPlug.on ? formatWatts(powerPlug.watts) : '0 W'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleDevice(powerPlug.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
              powerPlug.on
                ? 'bg-amber-400/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            {powerPlug.on ? 'Prise ON' : 'Prise OFF'}
          </button>
        </div>
      )}

      <div className="relative mx-auto flex h-[200px] w-[200px] items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
          className="h-full w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <path d={trackPath} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth={10} strokeLinecap="round" />
          <path
            d={progressPath}
            fill="none"
            stroke={device.on ? '#38bdf8' : '#64748b'}
            strokeWidth={10}
            strokeLinecap="round"
            style={device.on ? { filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.7))' } : undefined}
          />
          <circle
            cx={knobPos.x}
            cy={knobPos.y}
            r={9}
            fill="#0b1120"
            stroke={device.on ? '#38bdf8' : '#64748b'}
            strokeWidth={3}
          />
        </svg>

        <div className="pointer-events-none absolute flex flex-col items-center">
          <span className="font-display text-4xl font-bold tabular-nums text-white">{targetTemp}°</span>
          <span className="mt-1 text-[11px] text-slate-400">
            Ressenti {device.currentTemp != null ? `${device.currentTemp}°C` : '--'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-6">
        <button
          onClick={() => adjustTargetTemp(deviceId, -1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => adjustTargetTemp(deviceId, 1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ id, label, Icon }) => {
            const active = device.mode === id;
            return (
              <button
                key={id}
                onClick={() => setClimateMode(deviceId, id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition ${
                  active
                    ? 'border-sky-400/50 bg-sky-400/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Ventilation</p>
        <div className="grid grid-cols-3 gap-2">
          {FAN_SPEEDS.map(({ value, label }) => {
            const active = device.fanSpeed === value;
            return (
              <button
                key={value}
                onClick={() => setFanSpeed(deviceId, value)}
                className={`rounded-xl border px-2 py-2 text-[11px] font-medium transition ${
                  active
                    ? 'border-sky-400/50 bg-sky-400/15 text-sky-300'
                    : 'border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
