import { Plug, Power, Zap } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES } from '../store/useOrionStore';

function formatWatts(watts) {
  if (watts == null || Number.isNaN(Number(watts))) return '—';
  const n = Number(watts);
  if (n >= 100) return `${Math.round(n)} W`;
  return `${n.toFixed(1)} W`;
}

function formatKwh(kwh) {
  if (kwh == null || Number.isNaN(Number(kwh))) return null;
  const n = Number(kwh);
  if (n >= 100) return `${Math.round(n)} kWh`;
  return `${n.toFixed(2)} kWh`;
}

function PlugCard({ device, active, onToggle, onSelect }) {
  const wattsLabel = device.on ? formatWatts(device.watts) : 'Éteint';
  const kwhLabel = device.hasEmeter ? formatKwh(device.energyKwh) : null;

  return (
    <button
      onClick={onSelect}
      className={`relative w-full rounded-2xl border p-4 text-left transition ${
        active
          ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              device.on ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-500'
            }`}
          >
            <Plug size={16} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{device.name}</p>
            <p className="text-[11px] text-slate-400">
              {wattsLabel}
              {device.on && device.hasEmeter && device.voltage != null && (
                <span className="text-slate-500"> · {Math.round(device.voltage)} V</span>
              )}
            </p>
            {kwhLabel && (
              <p className="mt-0.5 text-[10px] text-slate-500">Cumul {kwhLabel}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {device.on && device.hasEmeter && (
            <span className="flex items-center gap-1 rounded-lg bg-amber-400/10 px-2 py-1 font-display text-sm font-bold tabular-nums text-amber-300">
              <Zap size={12} className="opacity-80" />
              {formatWatts(device.watts).replace(' W', '')}
              <span className="text-[10px] font-semibold opacity-70">W</span>
            </span>
          )}
          <div
            role="switch"
            aria-checked={device.on}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`flex h-7 w-12 cursor-pointer items-center rounded-full border transition ${
              device.on ? 'justify-end border-amber-400/60 bg-amber-400/30' : 'justify-start border-white/10 bg-white/5'
            } px-0.5`}
          >
            <span
              className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white shadow transition ${
                device.on ? 'text-amber-500' : 'text-slate-400'
              }`}
            >
              <Power size={12} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PlugControlWidget({ deviceId }) {
  const devices = useOrionStore((s) => s.devices);
  const kasa = useOrionStore((s) => s.kasa);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const selectDevice = useOrionStore((s) => s.selectDevice);

  // Prises visibles sur le plan uniquement (ex. exclut la prise Clim, liée au thermostat).
  const plugs = Object.values(devices).filter(
    (d) => d.type === DEVICE_TYPES.TPLINK && !d.hiddenOnMap
  );
  const totalWatts = plugs.reduce((sum, d) => sum + (d.on ? d.watts || 0 : 0), 0);

  return (
    <div className="orion-fade-in space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Prises connectées</h3>
            <span
              title={kasa.connected ? 'Kasa connecté' : kasa.error || 'Kasa hors ligne'}
              className={`inline-block h-2 w-2 rounded-full ${
                kasa.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'
              }`}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            TP-Link Kasa HS110 · {plugs.length} prises · conso live
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold tabular-nums text-amber-300">
            {formatWatts(totalWatts)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total instantané</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {plugs.map((plug) => (
          <PlugCard
            key={plug.id}
            device={plug}
            active={plug.id === deviceId}
            onToggle={() => toggleDevice(plug.id)}
            onSelect={() => selectDevice(plug.id)}
          />
        ))}
      </div>
    </div>
  );
}
