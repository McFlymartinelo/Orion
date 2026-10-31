import { lazy, Suspense } from 'react';
import FloorPlanSVG from './FloorPlanSVG';
import FloorPlanModeToggle from './FloorPlanModeToggle';
import FloorPlan3DBoundary from './FloorPlan3DBoundary';
import useOrionStore from '../store/useOrionStore';

const FloorPlan3D = lazy(() => import('./FloorPlan3D'));

/**
 * Cadre du plan (2D / 3D / rendu) : prend toute la taille que lui donne le Dashboard.
 * `classic-view` garde la palette du thème classique, quel que soit le thème actif.
 */
export default function FloorPlanPanel({ showToggle = true }) {
  const floorPlanMode = useOrionStore((s) => s.floorPlanMode);

  return (
    <div className="classic-view relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur-md">
      {showToggle && <FloorPlanModeToggle />}
      {floorPlanMode === 'render' ? (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-[#080914]">
          <img
            src="/images/apartment-render.png"
            alt="Rendu en coupe de l’appartement"
            className="h-full w-full object-contain"
          />
        </div>
      ) : floorPlanMode === '3d' ? (
        <FloorPlan3DBoundary>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Préparation de la vue 3D…
              </div>
            }
          >
            <FloorPlan3D />
          </Suspense>
        </FloorPlan3DBoundary>
      ) : (
        <FloorPlanSVG />
      )}
    </div>
  );
}
