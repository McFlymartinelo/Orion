import { Lightbulb, Sun, Sparkles } from 'lucide-react';
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

const SCENE_LOOK = [
  { match: /détente|relax/i, emoji: '🌅', color: '#ffb877' },
  { match: /lecture|read/i, emoji: '📖', color: '#ffe3b0' },
  { match: /concentrat/i, emoji: '💡', color: '#e6f1ff' },
  { match: /énergie|energie|energize/i, emoji: '⚡', color: '#7dd3fc' },
  { match: /veilleuse|nightlight|nuit/i, emoji: '🌙', color: '#fb923c' },
  { match: /tamisé|tamise|dimmed/i, emoji: '🔅', color: '#94a3b8' },
  { match: /clair|bright|lumineux/i, emoji: '☀️', color: '#f8fafc' },
  { match: /savane|savanna/i, emoji: '🦁', color: '#f59e0b' },
  { match: /tropic/i, emoji: '🌴', color: '#34d399' },
  { match: /arctique|aurora/i, emoji: '❄️', color: '#67e8f9' },
  { match: /ciné|cine|movie/i, emoji: '🎬', color: '#dc2626' },
];

function sceneLook(name) {
  const found = SCENE_LOOK.find((item) => item.match.test(name));
  return found || { emoji: '🎨', color: '#a855f7' };
}

function HueScenesPicker({ hueId, roomName }) {
  const scenes = useOrionStore((s) => s.hue.scenes);
  const connected = useOrionStore((s) => s.hue.connected);
  const error = useOrionStore((s) => s.hue.error);
  const activeSceneId = useOrionStore((s) => s.hue.activeSceneId);
  const applyHueScene = useOrionStore((s) => s.applyHueScene);

  if (!hueId) return null;

  const matching = scenes.filter((scene) => {
    if (scene.lights?.includes(Number(hueId))) return true;
    if (roomName && scene.groupName) {
      return scene.groupName.localeCompare(roomName, 'fr', { sensitivity: 'accent' }) === 0;
    }
    return false;
  });

  if (!matching.length) {
    if (!connected && error) {
      return (
        <p className="mt-4 text-[11px] text-slate-500">
          Scènes Hue indisponibles — {error}
        </p>
      );
    }
    return null;
  }

  const grouped = [];
  const byGroup = new Map();
  for (const scene of matching) {
    const key = scene.groupName || 'Hue';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      grouped.push(key);
    }
    byGroup.get(key).push(scene);
  }
  grouped.sort((a, b) => (byGroup.get(a)?.[0]?.lights.length ?? 99) - (byGroup.get(b)?.[0]?.lights.length ?? 99));

  return (
    <div className="mt-5 space-y-4">
      {grouped.map((groupName) => (
        <div key={groupName}>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            <Sparkles size={12} className="text-violet-300" />
            Scènes Hue · {groupName}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {byGroup.get(groupName).map((scene) => {
              const look = sceneLook(scene.name);
              const active = activeSceneId === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  onClick={() => applyHueScene(scene.id)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${
                    active
                      ? 'border-white/50 bg-white/10'
                      : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                    style={{ background: `${look.color}22`, boxShadow: active ? `0 0 10px ${look.color}55` : 'none' }}
                  >
                    {look.emoji}
                  </span>
                  <span className="min-w-0 truncate text-[12px] font-medium text-slate-100">
                    {scene.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">
        Une scène Hue s&apos;applique à toutes les lampes de cette pièce / zone.
      </p>
    </div>
  );
}

const TYPE_LABEL = {
  [DEVICE_TYPES.HUE]: 'Philips Hue',
  [DEVICE_TYPES.HUE_PLAY]: 'Philips Hue Play',
  [DEVICE_TYPES.YEELIGHT_STRIP]: 'Yeelight Strip',
  [DEVICE_TYPES.YEELIGHT]: 'Yeelight',
};

export default function LightControlWidget({ deviceId }) {
  const device = useOrionStore((s) => s.devices[deviceId]);
  const rooms = useOrionStore((s) => s.rooms);
  const toggleDevice = useOrionStore((s) => s.toggleDevice);
  const setBrightness = useOrionStore((s) => s.setBrightness);
  const setColor = useOrionStore((s) => s.setColor);
  const setKelvin = useOrionStore((s) => s.setKelvin);

  if (!device) return null;

  const activeColor = device.color || '#ffb877';
  const roomName = rooms.find((r) => r.id === device.room)?.name;

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

      <HueScenesPicker hueId={device.hueId} roomName={roomName} />
    </div>
  );
}
