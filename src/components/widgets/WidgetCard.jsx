import { GripVertical, Settings2, X } from 'lucide-react';
import { WIDGET_TYPES } from '../../data/widgetCatalog';
import WidgetBody from './WidgetBody';

// Hauteur occupée par l'en-tête et les marges de la carte (bordure + padding + titre).
const CHROME_H = 52;
// Marge droite : laisse la place à la poignée de largeur.
const CHROME_W = 28;

/**
 * Carte d'un widget, positionnée en absolu par le Dashboard.
 * Poignée du bord droit = largeur, bord inférieur = hauteur (souris, tactile et clavier).
 */
export default function WidgetCard({
  widget,
  rect,
  state,
  onConfigure,
  onRemove,
  onResizeStart,
  onResizeKey,
}) {
  const type = WIDGET_TYPES[widget.type];
  const Icon = type.icon;
  const proposed = type.group === 'proposed';
  const narrow = rect.width < 300;

  return (
    <article
      className={`orion-card absolute overflow-hidden rounded-2xl border bg-gradient-to-br from-[var(--orion-card-from)] to-[var(--orion-card-to)] pb-2.5 pl-3 pr-4 pt-2.5 shadow-[0_6px_18px_rgba(0,0,0,0.3)] ${
        state === 'blocked'
          ? 'border-rose-400 shadow-[0_0_0_1px_rgba(251,113,133,0.8),0_0_18px_rgba(251,113,133,0.4)]'
          : state === 'active'
            ? 'border-sky-400/70'
            : proposed
              ? 'border-dashed border-violet-300/30'
              : 'border-white/10'
      } ${state ? '' : 'transition-[left,top,width,height] duration-200'}`}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      data-widget={widget.type}
    >
      <header className="mb-1.5 flex h-6 items-center gap-2">
        <span className="orion-wicon flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300">
          <Icon size={13} />
        </span>
        <h3 className="orion-wtitle min-w-0 truncate text-[10.5px] font-semibold uppercase tracking-wider text-slate-200">
          {type.name}
        </h3>
        {proposed && !narrow && (
          <span className="shrink-0 rounded-full border border-violet-300/40 px-1.5 py-px text-[7.5px] font-semibold tracking-wider text-violet-200">
            PROPOSÉ
          </span>
        )}
        <div className="ml-auto flex shrink-0 gap-0.5">
          <button
            type="button"
            onClick={onConfigure}
            aria-label={`Configurer ${type.name}`}
            title="Configurer"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <Settings2 size={13} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer ${type.name}`}
            title="Retirer"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100%-30px)] min-h-0 flex-col gap-1.5 overflow-hidden">
        <WidgetBody widget={widget} w={rect.width - CHROME_W} bh={rect.height - CHROME_H} />
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Largeur de ${type.name}`}
        title="Tirer pour ajuster la largeur"
        tabIndex={0}
        onPointerDown={(e) => onResizeStart(e, 'w')}
        onKeyDown={(e) => onResizeKey(e, 'w')}
        className="orion-colhandle absolute right-0 top-1/2 flex h-11 w-3.5 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-l-lg border border-r-0 border-white/15 bg-[var(--orion-handle)] text-slate-400 opacity-60 transition hover:border-sky-400/70 hover:text-white hover:opacity-100 focus-visible:opacity-100"
      >
        <GripVertical size={11} />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Hauteur de ${type.name}`}
        title="Tirer le bord inférieur pour ajuster la hauteur"
        tabIndex={0}
        onPointerDown={(e) => onResizeStart(e, 'h')}
        onKeyDown={(e) => onResizeKey(e, 'h')}
        className="group absolute bottom-0 left-4 right-8 flex h-2.5 cursor-ns-resize touch-none items-end justify-center"
      >
        <span className="orion-rowgrip h-1 w-11 rounded-t bg-slate-500/70 transition group-hover:bg-sky-400 group-focus-visible:bg-sky-400" />
      </div>
    </article>
  );
}
