import FloorPlanPanel from '../FloorPlanPanel';
import useOrionStore from '../../store/useOrionStore';

/**
 * Cadre du plan du thème « Maquette » (titre, modes d’affichage, pied de carte).
 * Les vues à l'intérieur restent celles du thème classique (FloorPlanPanel).
 */
export default function MockupHero() {
  const mode = useOrionStore((s) => s.floorPlanMode);
  const setMode = useOrionStore((s) => s.setFloorPlanMode);
  const deviceCount = useOrionStore((s) => Object.values(s.devices).filter((d) => !d.hiddenOnMap).length);
  const selectedName = useOrionStore((s) => (s.selectedDeviceId ? s.devices[s.selectedDeviceId]?.name : null));
  const modeTitle = mode === '3d' ? 'Vue 3D interactive' : mode === 'render' ? 'Rendu de l’appartement' : 'Plan 2D interactif';

  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-[#53507888] bg-[radial-gradient(ellipse_at_50%_48%,#343050_0,#20203d_43%,#17182d_100%)] shadow-[0_18px_60px_#0004,inset_0_0_70px_#ac47ff0a]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.32]"
        style={{
          backgroundImage:
            'linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px)',
          backgroundSize: '35px 35px',
          maskImage: 'linear-gradient(transparent,#000 40%,#000 90%)',
        }}
      />

      <div className="relative z-[2] flex shrink-0 items-center justify-between px-[18px] pt-3.5">
        <div>
          <h2 className="m-0 text-[13px] font-bold">{modeTitle}</h2>
          <small className="mt-1 block text-[10px] text-[#a4a6c1]">
            {mode === '3d'
              ? 'Touchez une pièce ou un équipement'
              : mode === 'render'
                ? 'Vue d’ambiance de l’appartement'
                : 'Touchez un équipement pour le piloter'}
          </small>
        </div>
        <div role="group" aria-label="Mode d’affichage" className="flex gap-1.5">
          {['2d', '3d', 'render'].map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-[9px] border px-3 py-1.5 text-[10px] ${
                mode === m
                  ? 'border-[#45d8ee88] bg-[#11334088] text-[#6deaf0]'
                  : 'border-[#ffffff20] bg-[#14172bc9] text-[#c9cce0]'
              }`}
            >
              {m === 'render' ? 'RENDU' : m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-[1] min-h-0 flex-1 px-3.5 py-1">
        <FloorPlanPanel showToggle={false} />
      </div>

      <div className="relative z-[2] flex shrink-0 items-center gap-3.5 px-[18px] pb-3 text-[10px] text-[#c1c4d9]">
        <span className="flex items-center gap-1.5 text-[#80efb9]">
          <i className="h-[7px] w-[7px] rounded-full bg-[#5ce1a0] shadow-[0_0_9px_#5ce1a0]" />
          <b className="text-white">{deviceCount}</b> équipements
        </span>
        <span className="text-[#555978]">·</span>
        <span>{selectedName ? `Sélection : ${selectedName}` : 'Aucun équipement sélectionné'}</span>
        <div className="ml-auto flex gap-3 text-[9px] text-[#9699ba]">
          <span className="flex items-center gap-[5px]">
            <i className="h-[7px] w-[7px] rounded-full bg-[#ffc451]" />
            Allumé
          </span>
          <span className="flex items-center gap-[5px]">
            <i className="h-[7px] w-[7px] rounded-full bg-[#748197]" />
            Éteint
          </span>
        </div>
      </div>
    </section>
  );
}
