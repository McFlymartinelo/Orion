import { Lightbulb, Sun } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';
import { DEVICE_TYPES } from '../store/useOrionStore';

const COLOR_PRESETS = [
  '#ffb877', '#ffd9a0', '#7ee787', '#38bdf8',
  '#a855f7', '#dc2626', '#f472b6', '#ffffff',
];

const KELVIN_PRESETS = [
  { value: 2200, color: '#ff9d42', label: 'Bougie' },
  { value: 2700, color: '#ffb877', label: 'Chaud' },
  { value: 4000, color: '#ffe3b0', label: 'Neutre' },
  { value: 5000, color: '#e6f1ff', label: 'Blanc' },
  { value: 6500, color: '#cfe6ff', label: 'Froid' },
];

const TYPE_LABEL = {
  [DEVICE_TYPES.HUE]: 'Philips Hue',
  [DEVICE_TYPES.HUE_PLAY]: 'Philips Hue Play',
  [DEVICE_TYPES.YEELIGHT_STRIP]: 'Yeelight Strip',
  [DEVICE_TYPES.YEELIGHT]: 'Yeelight',
};

export default function LightControlWidget({ deviceId }) {
  const device = useOrionStore((s) => s.devices[deviceId]);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const setBrightness = useOrionStore((s) => s.setBrightness);
  const setColor = useOrionStore((s) => s.setColor);
  const setKelvin = useOrionStore((s) => s.setKelvin);

  if (!device) return null;

  const activeColor = device.color || '#ffb877';

  return (
    <div className="orion-fade-in rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: device.on ? `${activeColor}22` : 'rgba(255,255,255,0.05)',
              color: device.on ? activeColor : '#64748b',
              boxShadow: device.on ? `0 0 16px ${activeColor}55` : 'none',
            }}
          >
            <Lightbulb size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{device.name}</h3>
            <p className="text-[11px] text-slate-400">{TYPE_LABEL[device.type] || 'Éclairage'}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDevice(deviceId)}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition ${
            device.on ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400'
          }`}
          style={device.on ? { boxShadow: `0 0 12px ${activeColor}55` } : undefined}
        >
          {device.on ? 'Allumé' : 'Éteint'}
        </button>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Sun size={12} /> Intensité
          </span>
          <span className="tabular-nums text-slate-200">{device.brightness ?? 0}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={device.brightness ?? 0}
          onChange={(e) => setBrightness(deviceId, Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-current"
          style={{
            accentColor: activeColor,
            background: `linear-gradient(to right, ${activeColor} ${device.brightness ?? 0}%, rgba(255,255,255,0.08) ${device.brightness ?? 0}%)`,
          }}
        />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Couleur</p>
        <div className="flex flex-wrap gap-2.5">
          {COLOR_PRESETS.map((color) => (
            <button
              key={color}
              onClick={() => setColor(deviceId, color)}
              className={`h-8 w-8 rounded-full border-2 transition ${
                device.color === color ? 'scale-110 border-white' : 'border-white/20'
              }`}
              style={{ background: color, boxShadow: device.color === color ? `0 0 10px ${color}` : 'none' }}
            />
          ))}
        </div>
      </div>

      {device.type !== DEVICE_TYPES.HUE_PLAY && (
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Blancs (Kelvin)</p>
          <div className="grid grid-cols-5 gap-2">
            {KELVIN_PRESETS.map(({ value, color, label }) => (
              <button
                key={value}
                onClick={() => setKelvin(deviceId, value)}
                title={label}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                  device.kelvin === value && !device.color
                    ? 'border-white/60 bg-white/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
                }`}
              >
                <span className="h-4 w-4 rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-slate-500">{value}K</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
