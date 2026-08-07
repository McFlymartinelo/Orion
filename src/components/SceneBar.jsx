import useOrionStore from '../store/useOrionStore';

export default function SceneBar() {
  const scenes = useOrionStore((s) => s.scenes);
  const applyScene = useOrionStore((s) => s.applyScene);
  const activeScene = useOrionStore((s) => s.activeScene);

  return (
    <div className="shrink-0 border-t border-white/10 bg-black/30 p-4 backdrop-blur-md">
      <p className="mb-2.5 text-[10px] uppercase tracking-wider text-slate-500">Scènes rapides</p>
      <div className="grid grid-cols-3 gap-2">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => applyScene(scene.id)}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3.5 transition active:scale-95 ${
              activeScene === scene.id
                ? 'border-sky-400/50 bg-sky-400/15 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
            }`}
          >
            <span className="text-xl leading-none">{scene.emoji}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              {scene.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
