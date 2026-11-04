/**
 * Mode RENDU : groupe de lumière du script Blender (orion_rendu_maquette_v9.py, GROUPES_LUMIERE)
 * → appareil(s) Orion. Le calque d'un groupe s'affiche avec la luminosité du plus lumineux
 * de ses appareils allumés.
 *
 * Limite : un groupe à plusieurs appareils (lustre, Hue Play TV, Hue Play bureau) n'a qu'un seul calque,
 * donc il s'allume dès qu'un de ses appareils est allumé.
 *
 * `appareils: []` = pas d'appareil dans Orion : le calque n'est jamais affiché.
 */
export const RENDU_GROUPES = {
  plafonnier_cuisine: { libelle: 'Plafonnier cuisine', appareils: ['hue-cuisine'] },
  plafonnier_entree: { libelle: 'Plafonnier entrée', appareils: ['hue-entree'] },
  plafonnier_degagement: { libelle: 'Plafonnier dégagement', appareils: ['hue-degagement'] },
  plafonnier_bureau: { libelle: 'Plafonnier bureau', appareils: ['hue-bureau'] },
  plafonnier_chambre1: { libelle: 'Plafonnier chambre 1', appareils: ['hue-chambre-1'] },
  plafonnier_wc: { libelle: 'Plafonnier WC', appareils: ['hue-wc'] },
  plafonnier_sdb: { libelle: 'Plafonnier salle de bain', appareils: ['yeelight-sdb'] },
  // Ordre des globes = SALON_LUSTRE_IDS de FloorPlan3D.jsx (globe 1 → 5, x croissant)
  lustre_sejour: {
    libelle: 'Lustre séjour',
    appareils: ['hue-salon-1', 'hue-salon-2', 'hue-sam-3', 'hue-sam-2', 'hue-sam-1'],
  },
  ruban_tv: { libelle: 'Ruban TV', appareils: ['yeelight-tv'] },
  hueplay_tv: { libelle: 'Hue Play TV', appareils: ['hueplay-tv-gauche', 'hueplay-tv-droite'] },
  bande_sejour: { libelle: 'Ruban salon', appareils: ['yeelight-sejour'] },
  cave: { libelle: 'Cave à vin', appareils: [] },
  lampes_bureau: { libelle: 'Lampes du bureau', appareils: ['hueplay-bureau-gauche', 'hueplay-bureau-droite'] },
  pc: { libelle: 'PC', appareils: [] },
};

/** Groupes ayant au moins un appareil : seuls ceux-là ont un calque et un point cliquable. */
export const RENDU_GROUPES_ACTIFS = Object.keys(RENDU_GROUPES).filter(
  (groupe) => RENDU_GROUPES[groupe].appareils.length > 0
);
