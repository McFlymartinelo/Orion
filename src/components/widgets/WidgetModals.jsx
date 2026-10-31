import { useMemo } from 'react';
import { X } from 'lucide-react';
import useOrionStore from '../../store/useOrionStore';
import { WIDGET_TYPES } from '../../data/widgetCatalog';
import { tryAdd } from '../../layout/widgetLayout';
import { makeWidgetId } from '../../store/useLayoutStore';

function Overlay({ children, onClose, label }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="orion-fade-in absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
    >
      {children}
    </div>
  );
}

function Choice({ id, type, candidate, onPick }) {
  const Icon = type.icon;
  const proposed = type.group === 'proposed';
  return (
    <button
      type="button"
      disabled={!candidate}
      onClick={() => onPick(id)}
      data-proposed={proposed}
      className={`orion-choice min-h-[84px] rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale ${
        proposed
          ? 'border-dashed border-violet-300/40 bg-violet-400/[0.04] hover:enabled:bg-violet-400/10'
          : 'border-white/10 bg-white/[0.03] hover:enabled:border-sky-400/50 hover:enabled:bg-sky-400/10'
      }`}
    >
      <Icon size={16} className={proposed ? 'text-violet-300' : 'text-sky-300'} />
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white">
        {type.name}
        <span
          className={`rounded-full border px-1.5 py-px text-[7px] font-bold tracking-wider ${
            proposed ? 'border-violet-300/50 text-violet-200' : 'border-emerald-400/40 text-emerald-300'
          }`}
        >
          {proposed ? 'FUTUR' : 'DISPONIBLE'}
        </span>
      </p>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">{type.desc}</p>
      {!candidate && <p className="mt-1 text-[10px] text-rose-300">Pas assez de place à cette taille</p>}
    </button>
  );
}

/** Catalogue : widgets disponibles dans l'appli / widgets proposés pour plus tard. */
export function CatalogModal({ widgets, metrics, onAdd, onClose }) {
  const candidates = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(WIDGET_TYPES).map((id) => [id, tryAdd(widgets, id, metrics, WIDGET_TYPES, makeWidgetId)])
      ),
    [widgets, metrics]
  );
  const section = (group) =>
    Object.entries(WIDGET_TYPES)
      .filter(([, t]) => t.group === group)
      .map(([id, t]) => <Choice key={id} id={id} type={t} candidate={candidates[id]} onPick={(i) => onAdd(candidates[i])} />);

  return (
    <Overlay onClose={onClose} label="Ajouter un widget">
      <div className="orion-modal max-h-full w-full max-w-[960px] overflow-hidden rounded-3xl border border-white/15 bg-[var(--orion-modal)] p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Ajouter un widget</h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Les widgets grisés ne tiennent pas dans l’espace restant : réduisez ou retirez un widget pour libérer de la place.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-slate-300 hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>

        <p className="mb-2 mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Déjà disponibles dans Orion
          <span className="rounded-full border border-emerald-400/40 px-2 py-px text-[8px] text-emerald-300">FONCTIONNEL</span>
        </p>
        <div className="grid grid-cols-4 gap-2">{section('existing')}</div>

        <p className="mb-2 mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Proposés · évolution future
          <span className="rounded-full border border-violet-300/50 px-2 py-px text-[8px] text-violet-200">APERÇU SEULEMENT</span>
        </p>
        <div className="grid grid-cols-4 gap-2">{section('proposed')}</div>
      </div>
    </Overlay>
  );
}

/** Réglages d'un widget : pièce concernée, retrait. */
export function ConfigModal({ widget, onChangeRoom, onRemove, onClose }) {
  const rooms = useOrionStore((s) => s.rooms);
  const type = WIDGET_TYPES[widget.type];
  return (
    <Overlay onClose={onClose} label={`Configurer ${type.name}`}>
      <div className="orion-modal w-full max-w-[380px] rounded-2xl border border-white/15 bg-[var(--orion-modal)] p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-white">Configurer · {type.name}</h2>
        <label htmlFor="widget-room" className="mb-1.5 mt-4 block text-[10px] uppercase tracking-wider text-slate-400">
          Pièce
        </label>
        <select
          id="widget-room"
          disabled={!type.room}
          value={widget.room}
          onChange={(e) => onChangeRoom(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          <option value="all">Tout le logement</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {!type.room && <p className="mt-2 text-[10px] text-slate-500">Ce widget n’a pas de réglage de pièce.</p>}
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          Largeur : poignée sur le bord droit du widget. Hauteur : bord inférieur. Les flèches du clavier fonctionnent aussi sur les poignées.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="mr-auto rounded-lg border border-rose-400/40 px-3 py-2 text-[11px] text-rose-300 hover:bg-rose-400/10"
          >
            Retirer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-sky-400/50 bg-sky-400/15 px-3 py-2 text-[11px] text-sky-100 hover:bg-sky-400/25"
          >
            Terminé
          </button>
        </div>
      </div>
    </Overlay>
  );
}
