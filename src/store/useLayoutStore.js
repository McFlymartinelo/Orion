import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_WIDGETS, WIDGET_TYPES } from '../data/widgetCatalog';

export const DEFAULT_HERO_FRAC = 0.56;
export const THEMES = [
  { id: 'orion', label: 'Classique' },
  { id: 'mockup', label: 'Maquette' },
];
const MAX_ROWS = 80;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

let idCounter = 0;
export const makeWidgetId = () =>
  `w-${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Nettoie un widget venant du stockage local (type inconnu, tailles invalides…). */
function sanitizeWidget(raw) {
  if (!raw || !WIDGET_TYPES[raw.type]) return null;
  const widget = {
    id: typeof raw.id === 'string' ? raw.id : makeWidgetId(),
    type: raw.type,
    room: typeof raw.room === 'string' ? raw.room : 'all',
  };
  if (Number.isFinite(raw.w)) widget.w = clamp(Math.round(raw.w), 1, 12);
  if (Number.isFinite(raw.h)) widget.h = clamp(Math.round(raw.h), 1, MAX_ROWS);
  return widget;
}

/**
 * Disposition du tableau de bord : widgets présents (type, pièce, taille choisie)
 * et largeur du plan. Persisté dans localStorage. La validation « ça tient à
 * l'écran » est faite par le composant (qui connaît la taille de la scène).
 */
const useLayoutStore = create(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      heroFrac: DEFAULT_HERO_FRAC,
      theme: 'orion',

      setTheme: (theme) => set({ theme: THEMES.some((t) => t.id === theme) ? theme : 'orion' }),
      addWidget: (widget) => set((s) => ({ widgets: [...s.widgets, widget] })),
      removeWidget: (id) => set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      updateWidget: (id, patch) =>
        set((s) => ({ widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      setHeroFrac: (frac) => set({ heroFrac: clamp(frac, 0.3, 0.85) }),
      resetLayout: () => set({ widgets: DEFAULT_WIDGETS, heroFrac: DEFAULT_HERO_FRAC }),
    }),
    {
      name: 'orion-layout-v1',
      version: 1,
      partialize: (s) => ({ widgets: s.widgets, heroFrac: s.heroFrac, theme: s.theme }),
      merge: (persisted, current) => {
        const widgets = Array.isArray(persisted?.widgets)
          ? persisted.widgets.map(sanitizeWidget).filter(Boolean)
          : current.widgets;
        const seen = new Set();
        for (const w of widgets) {
          if (seen.has(w.id)) w.id = makeWidgetId();
          seen.add(w.id);
        }
        return {
          ...current,
          widgets,
          heroFrac: Number.isFinite(persisted?.heroFrac)
            ? clamp(persisted.heroFrac, 0.3, 0.85)
            : current.heroFrac,
          theme: THEMES.some((t) => t.id === persisted?.theme) ? persisted.theme : current.theme,
        };
      },
    }
  )
);

export default useLayoutStore;
