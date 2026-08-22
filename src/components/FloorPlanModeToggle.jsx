import { Box, Map } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';

export default function FloorPlanModeToggle() {
  const mode = useOrionStore((s) => s.floorPlanMode);
  const setFloorPlanMode = useOrionStore((s) => s.setFloorPlanMode);

  return (
    <div className="absolute right-3 top-3 z-20 flex overflow-hidden rounded-xl border border-white/15 bg-black/55 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setFloorPlanMode('2d')}
        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
          mode === '2d' ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-pressed={mode === '2d'}
      >
        <Map size={14} />
        2D
      </button>
      <button
        type="button"
        onClick={() => setFloorPlanMode('3d')}
        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
          mode === '3d' ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-pressed={mode === '3d'}
      >
        <Box size={14} />
        3D
      </button>
    </div>
  );
}
