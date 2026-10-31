import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import FloorPlanPanel from './FloorPlanPanel';
import MockupHero from './mockup/MockupHero';
import MockupIntro from './mockup/MockupIntro';
import DeviceOverlay from './DeviceOverlay';
import WidgetCard from './widgets/WidgetCard';
import { CatalogModal, ConfigModal } from './widgets/WidgetModals';
import { WIDGET_TYPES } from '../data/widgetCatalog';
import useLayoutStore, { DEFAULT_HERO_FRAC } from '../store/useLayoutStore';
import {
  COLS,
  GAP,
  ROW,
  SPLITTER_W,
  canAddAny,
  clamp,
  clampHeroWidth,
  computeMetrics,
  fitsWith,
  freeRect,
  heroBounds,
  pack,
  placementRect,
} from '../layout/widgetLayout';

/** Hauteur fixe du plan (selon le thème) : seule sa largeur varie (séparateur). */
const HERO_H = { orion: 430, mockup: 410 };
const SPLIT_STEP = 4;

/**
 * Tableau de bord : plan 2D/3D à hauteur fixe + widgets répartis dans l'espace en « L »
 * (à droite du plan, puis en dessous). Tout tient dans la zone visible, sans défilement.
 */
export default function Dashboard() {
  const stageRef = useRef(null);
  const toastTimer = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState(null); // { id, blocked }
  const [split, setSplit] = useState(null); // { blocked }
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configId, setConfigId] = useState(null);
  const [toast, setToast] = useState('');

  const widgets = useLayoutStore((s) => s.widgets);
  const heroFrac = useLayoutStore((s) => s.heroFrac);
  const mockup = useLayoutStore((s) => s.theme) === 'mockup';
  const heroH = mockup ? HERO_H.mockup : HERO_H.orion;

  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1900);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Taille de la scène (zone sous la barre d'outils).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heroW = size.w ? clampHeroWidth(size.w, heroFrac) : 0;
  const metrics = useMemo(
    () => (size.w ? computeMetrics({ width: size.w, height: size.h, heroW, heroH }) : null),
    [size.w, size.h, heroW, heroH]
  );
  const packed = useMemo(
    () => (metrics ? pack(widgets, metrics, WIDGET_TYPES, true) : null),
    [widgets, metrics]
  );
  const placedById = useMemo(
    () => new Map((packed?.placements ?? []).map((p) => [p.widget.id, p])),
    [packed]
  );
  const hiddenCount = packed ? widgets.length - packed.placements.length : 0;
  const fits = Boolean(packed?.ok);
  const free = fits ? freeRect(packed.occ, metrics, WIDGET_TYPES) : null;
  const canAdd = useMemo(
    () => fits && canAddAny(widgets, metrics, WIDGET_TYPES),
    [fits, widgets, metrics]
  );

  /* ───── Redimensionnement d'un widget (largeur / hauteur) ───── */
  const resizeStep = useCallback(
    (id, key, next) => {
      const store = useLayoutStore.getState();
      if (!fitsWith(store.widgets, id, { [key]: next }, metrics, WIDGET_TYPES)) return false;
      store.updateWidget(id, { [key]: next });
      return true;
    },
    [metrics]
  );

  const onResizeStart = (e, id, axis) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = placedById.get(id);
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const key = axis === 'w' ? 'w' : 'h';
    const unit = axis === 'w' ? metrics[p.region].cw + GAP : ROW;
    const start = axis === 'w' ? p.span : p.rows;
    const lo = axis === 'w' ? p.minSpan : p.minRows;
    const hi = axis === 'w' ? COLS : metrics[p.region].rows;
    const startX = e.clientX;
    const startY = e.clientY;
    let cur = start;
    setDrag({ id, blocked: false });

    const move = (ev) => {
      const delta = axis === 'w' ? ev.clientX - startX : ev.clientY - startY;
      const target = clamp(start + Math.round(delta / unit), lo, hi);
      let blocked = false;
      // On avance pas à pas : on s'arrête à la dernière taille qui tient encore à l'écran.
      while (cur !== target) {
        const next = cur + Math.sign(target - cur);
        if (resizeStep(id, key, next)) cur = next;
        else {
          blocked = true;
          break;
        }
      }
      setDrag({ id, blocked });
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      setDrag(null);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  const onResizeKey = (e, id, axis) => {
    const dir = (axis === 'w' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowDown: 1, ArrowUp: -1 })[e.key];
    const p = placedById.get(id);
    if (!dir || !p) return;
    e.preventDefault();
    const cur = axis === 'w' ? p.span : p.rows;
    const lo = axis === 'w' ? p.minSpan : p.minRows;
    const hi = axis === 'w' ? COLS : metrics[p.region].rows;
    const next = cur + dir;
    if (next < lo || next > hi || !resizeStep(id, axis === 'w' ? 'w' : 'h', next)) {
      setDrag({ id, blocked: true });
      setTimeout(() => setDrag(null), 500);
      showToast('Taille limite pour l’espace disponible');
    }
  };

  /* ───── Séparateur plan / widgets ───── */
  const moveHero = (target) => {
    const width = size.w;
    const { min, max } = heroBounds(width);
    const goal = clamp(Math.round(target), min, max);
    const store = useLayoutStore.getState();
    const metricsAt = (w) => computeMetrics({ width, height: size.h, heroW: w, heroH });
    let cur = clampHeroWidth(width, store.heroFrac);
    const validate = pack(store.widgets, metricsAt(cur), WIDGET_TYPES).ok;
    let blocked = false;
    while (cur !== goal) {
      const next = cur + Math.sign(goal - cur) * Math.min(SPLIT_STEP, Math.abs(goal - cur));
      if (!validate || pack(store.widgets, metricsAt(next), WIDGET_TYPES).ok) cur = next;
      else {
        blocked = true;
        break;
      }
    }
    store.setHeroFrac(cur / width);
    setSplit((s) => (s ? { blocked } : s));
  };

  const onSplitDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setSplit({ blocked: false });
  };
  const onSplitMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    moveHero(e.clientX - stageRef.current.getBoundingClientRect().left - SPLITTER_W / 2);
  };
  const onSplitUp = () => setSplit(null);
  const onSplitKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      moveHero(heroW + (e.key === 'ArrowLeft' ? -24 : 24));
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveHero(DEFAULT_HERO_FRAC * size.w);
    }
  };

  /* ───── Ajout / retrait / réglage ───── */
  const addWidget = (candidate) => {
    if (!candidate) return;
    useLayoutStore.getState().addWidget(candidate);
    setCatalogOpen(false);
    const reduced = candidate.w != null || candidate.h != null;
    showToast(`${WIDGET_TYPES[candidate.type].name} ajouté${reduced ? ' · taille adaptée à l’espace' : ''}`);
  };
  const removeWidget = (id) => {
    const widget = widgets.find((w) => w.id === id);
    useLayoutStore.getState().removeWidget(id);
    setConfigId(null);
    if (widget) showToast(`${WIDGET_TYPES[widget.type].name} retiré · les autres widgets se réorganisent`);
  };
  const configWidget = widgets.find((w) => w.id === configId);

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col pb-3 ${mockup ? 'px-4' : 'px-3'}`}>
      {mockup ? (
        <MockupIntro canAdd={canAdd} hiddenCount={hiddenCount} onAdd={() => setCatalogOpen(true)} />
      ) : (
        <div className="flex h-9 shrink-0 items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tableau de bord</h2>
          {hiddenCount > 0 && (
            <span className="rounded-full border border-amber-400/40 px-2.5 py-0.5 text-[10px] text-amber-200">
              {hiddenCount} widget{hiddenCount > 1 ? 's' : ''} masqué{hiddenCount > 1 ? 's' : ''} : écran trop petit
            </span>
          )}
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            disabled={!canAdd}
            title={canAdd ? 'Ajouter un widget' : 'Plus de place : réduisez ou retirez un widget'}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-400/10 px-3.5 py-1.5 text-[11px] font-semibold text-sky-100 transition hover:enabled:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale"
          >
            <Plus size={13} />
            Ajouter
          </button>
        </div>
      )}

      <div ref={stageRef} className="relative min-h-0 flex-1">
        {metrics && (
          <>
            <div className="absolute left-0 top-0" style={{ width: heroW, height: heroH }}>
              {mockup ? <MockupHero /> : <FloorPlanPanel />}
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Largeur du plan et des widgets"
              aria-valuemin={42}
              aria-valuemax={75}
              aria-valuenow={Math.round((100 * heroW) / size.w)}
              tabIndex={0}
              title="Glisser pour redimensionner · double-clic pour réinitialiser"
              onPointerDown={onSplitDown}
              onPointerMove={onSplitMove}
              onPointerUp={onSplitUp}
              onPointerCancel={onSplitUp}
              onKeyDown={onSplitKey}
              onDoubleClick={() => moveHero(DEFAULT_HERO_FRAC * size.w)}
              className="group absolute top-0 z-10 flex cursor-col-resize touch-none items-center justify-center"
              style={{ left: heroW, width: SPLITTER_W, height: heroH }}
            >
              <span
                className={`w-[3px] rounded-full transition-all ${
                  split?.blocked
                    ? 'h-[90px] bg-rose-400'
                    : split
                      ? mockup
                        ? 'h-[90px] bg-gradient-to-b from-[#54d7f0] to-[#e866bd] shadow-[0_0_12px_#8e6ccc88]'
                        : 'h-[90px] bg-sky-400'
                      : mockup
                        ? 'h-[60px] bg-[#8270aa88] group-hover:h-[90px] group-hover:bg-gradient-to-b group-hover:from-[#54d7f0] group-hover:to-[#e866bd] group-hover:shadow-[0_0_12px_#8e6ccc88]'
                        : 'h-[60px] bg-slate-500/60 group-hover:h-[90px] group-hover:bg-sky-400'
                }`}
              />
              {mockup && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-[3px] top-[calc(50%-20px)] flex h-10 w-5 items-center justify-center rounded-[7px] border border-[#ffffff22] bg-[#19182d] text-[13px] text-[#bfc5dc]"
                >
                  ⋮
                </span>
              )}
            </div>

            {widgets.map((widget) => {
              const p = placedById.get(widget.id);
              if (!p) return null;
              const active = drag?.id === widget.id;
              return (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  rect={placementRect(p, metrics)}
                  state={active ? (drag.blocked ? 'blocked' : 'active') : drag || split ? 'frozen' : null}
                  onConfigure={() => setConfigId(widget.id)}
                  onRemove={() => removeWidget(widget.id)}
                  onResizeStart={(e, axis) => onResizeStart(e, widget.id, axis)}
                  onResizeKey={(e, axis) => onResizeKey(e, widget.id, axis)}
                />
              );
            })}

            {free && (
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                aria-label="Ajouter un widget"
                className={`orion-addslot absolute flex flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-white/20 bg-white/[0.02] text-[11px] text-slate-400 hover:border-sky-400/60 hover:bg-sky-400/5 hover:text-sky-100 ${
                  drag || split ? '' : 'transition-[left,top,width,height] duration-200'
                }`}
                style={placementRect({ ...free }, metrics)}
              >
                <span className="orion-addslot-plus flex h-6 w-6 items-center justify-center rounded-lg border border-white/20 bg-white/5">
                  <Plus size={14} />
                </span>
                Ajouter un widget
              </button>
            )}
          </>
        )}
      </div>

      <DeviceOverlay />

      {catalogOpen && metrics && (
        <CatalogModal widgets={widgets} metrics={metrics} onAdd={addWidget} onClose={() => setCatalogOpen(false)} />
      )}
      {configWidget && (
        <ConfigModal
          widget={configWidget}
          onChangeRoom={(room) => useLayoutStore.getState().updateWidget(configWidget.id, { room })}
          onRemove={() => removeWidget(configWidget.id)}
          onClose={() => setConfigId(null)}
        />
      )}

      <div
        role="status"
        aria-live="polite"
        className={`orion-toast pointer-events-none absolute bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-white/15 bg-[var(--orion-card-from)] px-4 py-2.5 text-[11px] shadow-2xl transition ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {toast}
      </div>
    </div>
  );
}
