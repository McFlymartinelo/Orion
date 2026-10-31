import { Box, Image as ImageIcon, Map } from 'lucide-react';
import useOrionStore from '../store/useOrionStore';

export default function FloorPlanModeToggle() {
  const mode = useOrionStore((s) => s.floorPlanMode);
  const setFloorPlanMode = useOrionStore((s) => s.setFloorPlanMode);

  return (
    <div
      role="group"
      aria-label="Mode d’affichage du plan"
      className="absolute right-3 top-3 z-20 flex overflow-hidden rounded-xl border border-white/15 bg-black/55 backdrop-blur-md"
    >
      {[
        { id: '2d', label: '2D', Icon: Map },
        { id: '3d', label: '3D', Icon: Box },
        { id: 'render', label: 'Rendu', Icon: ImageIcon },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setFloorPlanMode(id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition ${
            mode === id ? 'bg-sky-400/20 text-sky-200' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-pressed={mode === id}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
