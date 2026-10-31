import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Durée d'historique conservée (24 h) et espacement minimal entre deux relevés. */
export const HISTORY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 20 * 1000;

/**
 * Historique de la puissance mesurée (somme des prises Kasa), relevé par l'appli tant qu'elle
 * tourne et conservé dans localStorage. Chaque échantillon est une paire [timestamp ms, watts].
 * Les périodes où l'appli était fermée restent des trous (la page ne les interpole pas).
 */
const useEnergyStore = create(
  persist(
    (set) => ({
      samples: [],

      addSample: (t, watts) =>
        set((s) => {
          const last = s.samples[s.samples.length - 1];
          if (last && t - last[0] < MIN_GAP_MS) return s;
          const cutoff = t - HISTORY_MS;
          const kept = s.samples.filter(([ts]) => ts >= cutoff);
          kept.push([t, Math.round(watts * 10) / 10]);
          return { samples: kept };
        }),

      clearHistory: () => set({ samples: [] }),
    }),
    {
      name: 'orion-energy-v1',
      version: 1,
      partialize: (s) => ({ samples: s.samples }),
      merge: (persisted, current) => {
        const raw = Array.isArray(persisted?.samples) ? persisted.samples : [];
        const samples = raw
          .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
          .sort((a, b) => a[0] - b[0]);
        return { ...current, samples };
      },
    }
  )
);

export default useEnergyStore;
