/**
 * Correspondance mesh GLB → device, générée par appariement géométrique :
 * position monde de chaque mesh de lampe (coords Sweet Home 3D, cm) contre
 * SNAP_3D_CM / SALON_LUSTRE_GLOBES_CM de FloorPlan3D (rayon 45 cm, plus proche).
 *
 * gain 1    = source lumineuse (ampoule, diffuseur fin)
 * gain < 1  = abat-jour / verre diffusant
 *
 * Ne sont listés que les matériaux réellement lumineux : les fils (`Wire`),
 * douilles (`Base_2`) et pieds de lampe restent inchangés.
 *
 * Limites connues du modèle :
 *  - le lustre du séjour n'a que 2 globes pour 5 lampes Hue → `hue-salon-2`,
 *    `hue-sam-1`, `hue-sam-2` n'ont pas de mesh (pointLight seul) ;
 *  - pas de mesh pour `hue-entree`, `hue-degagement`, `hueplay-tv-*`,
 *    `yeelight-sejour`, `yeelight-tv` (pointLight seul).
 *
 * Pour régénérer : voir l'appariement dans l'historique (script Node sur appart.glb).
 */
export const LAMP_MESHES = {
  // ── Plafonniers 105 (abat-jour + ampoule) ─────────────────────────────
  'Ceiling_lamp_105_4846_1156': { deviceId: 'hue-bureau', gain: 0.45 },
  'Ceiling_lamp_105_5126_1157': { deviceId: 'hue-bureau', gain: 1 },
  'Ceiling_lamp_105_4846_183': { deviceId: 'hue-chambre-1', gain: 0.45 },
  'Ceiling_lamp_105_5126_184': { deviceId: 'hue-chambre-1', gain: 1 },
  'Ceiling_lamp_105_4846_2093': { deviceId: 'hue-wc', gain: 0.45 },
  'Ceiling_lamp_105_5126_2094': { deviceId: 'hue-wc', gain: 1 },
  'Ceiling_lamp_105_4846_2098': { deviceId: 'yeelight-sdb', gain: 0.45 },
  'Ceiling_lamp_105_5126_2099': { deviceId: 'yeelight-sdb', gain: 1 },

  // ── Suspension cuisine (globe) ────────────────────────────────────────
  'Ceiling_lamp_109_1179': { deviceId: 'hue-cuisine', gain: 0.8 },

  // ── Globes du lustre séjour ───────────────────────────────────────────
  'bulb1_Plane_cristal_blanco_1198': { deviceId: 'hue-salon-1', gain: 1 },
  'bulb1_Plane_cristal_blanco_1191': { deviceId: 'hue-sam-3', gain: 1 },

  // ── Lampes de table du bureau (abat-jour + ampoule + diffuseur) ───────
  'Table_lamp_003_7996_1159': { deviceId: 'hueplay-bureau-gauche', gain: 0.6 },
  'Table_lamp_003_31128_1161': { deviceId: 'hueplay-bureau-gauche', gain: 1 },
  'Table_lamp_003_39828_1165': { deviceId: 'hueplay-bureau-gauche', gain: 1 },
  'Table_lamp_003_7996_1168': { deviceId: 'hueplay-bureau-droite', gain: 0.6 },
  'Table_lamp_003_31128_1170': { deviceId: 'hueplay-bureau-droite', gain: 1 },
  'Table_lamp_003_39828_1174': { deviceId: 'hueplay-bureau-droite', gain: 1 },
};
