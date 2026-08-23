import { Component } from 'react';
import useOrionStore from '../store/useOrionStore';

function FloorPlan3DFallback({ error, onRetry }) {
  const setFloorPlanMode = useOrionStore((s) => s.setFloorPlanMode);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-white">Impossible d’afficher la vue 3D</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-400">
        {error?.message || 'Le rendu WebGL a échoué. Le plan 2D reste disponible.'}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
        >
          Réessayer
        </button>
        <button
          type="button"
          onClick={() => setFloorPlanMode('2d')}
          className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-400/25"
        >
          Revenir en 2D
        </button>
      </div>
    </div>
  );
}

export default class FloorPlan3DBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Orion] Vue 3D:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <FloorPlan3DFallback
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
