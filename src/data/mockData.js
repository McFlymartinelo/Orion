// Données simulées pour le dashboard Orion — Appartement "Le Domaine de Wallon - E36"
// Le plan reproduit la topologie réelle du plan préliminaire de réservation : le Balcon est
// à gauche (en saillie, mur extérieur latéral), avec une porte donnant sur le Séjour qui
// occupe le reste de la largeur, à droite. Balcon + Séjour forment ensemble la bande du
// haut, sur toute la largeur du logement (= largeur Cuisine + Entrée réunies) qui se
// trouve juste en dessous. Le bloc inférieur garde une colonne de gauche (Cuisine /
// Chambre 2 / Chambre 1, empilées, même largeur, avec fenêtres sur le mur extérieur) et une
// colonne de droite plus étroite (Entrée / GTL+Rangement / Dégagement+WC / Placard+Salle de
// Bain). Toutes les coordonnées (x, y, w, h) sont exprimées dans le repère du viewBox SVG
// "0 0 520 830".

export const APARTMENT_NAME = 'Le Domaine de Wallon';
export const APARTMENT_REF = 'E36';

export const VIEW_BOX = { w: 650, h: 830 };

// Le bâtiment principal commence à x=BLDG_X. Le Balcon est une protrusion
// extérieure à gauche (x=0..130). Le Séjour prend toute la largeur du bâtiment
// (= Cuisine 300 + Entrée 220 = 520px). L'enveloppe est un L dans le SVG.
export const BLDG_X = 130;   // mur gauche du bâtiment principal
export const BALCON_H = 330; // hauteur de la protrusion balcon

export const rooms = [
  // Balcon : protrusion extérieure gauche (hors bâtiment)
  { id: 'balcon',    name: 'Balcon',       surface: 4.75,  x: 0,          y: 0,   w: 130, h: 330, labelX: 65,  labelY: 165 },
  // Séjour : pleine largeur du bâtiment (300+220 = 520)
  { id: 'sejour',    name: 'Séjour',       surface: 21.85, x: BLDG_X,     y: 0,   w: 520, h: 330, labelX: 560, labelY: 155 },

  { id: 'cuisine',   name: 'Cuisine',      surface: 6.5,   x: BLDG_X,     y: 330, w: 300, h: 130, hasWindow: true, labelX: 280, labelY: 350 },
  { id: 'entree',    name: 'Entrée',       surface: 4.95,  x: BLDG_X+300, y: 330, w: 220, h: 130, labelX: 540, labelY: 353 },

  // Dégagement = moitié de l'Entrée (220/2 = 110) ; WC/Rangement prennent le reste (110)
  { id: 'rangement', name: 'Rangement',    surface: 1.25,  x: BLDG_X+410, y: 460, w: 110, h: 40,  labelX: 595, labelY: 482 },

  { id: 'chambre2',  name: 'Chambre 2',    surface: 9.65,  x: BLDG_X,     y: 460, w: 300, h: 160, hasWindow: true, labelX: 280, labelY: 488 },
  { id: 'degagement',name: 'Dégagement',   surface: 2.65,  x: BLDG_X+300, y: 460, w: 110, h: 160, labelX: 485, labelY: 488 },
  { id: 'wc',        name: 'WC',           surface: 1.4,   x: BLDG_X+410, y: 500, w: 110, h: 120, labelX: 595, labelY: 524 },

  { id: 'chambre1',  name: 'Chambre 1',    surface: 10.7,  x: BLDG_X,     y: 620, w: 300, h: 210, hasWindow: true, labelX: 280, labelY: 648 },
  // PL supprimé — SDB prend toute la largeur droite (x=430 à x=650)
  { id: 'sdb',       name: 'Salle de Bain',surface: 3.5,   x: BLDG_X+300, y: 620, w: 220, h: 210, labelX: 540, labelY: 648 },
];

// --- Éléments statiques (non pilotables) reproduits pour le contexte visuel -
export const staticFixtures = [
  { id: 'tv',             kind: 'tv',      x: 390, y: 60,  w: 80,  h: 18 },
  // Cuisine : plaques centrées en bas (centre pièce X = 280, bas = 460)
  { id: 'kitchen-counter',kind: 'kitchen', x: 280, y: 448, w: 70,  h: 22 },
  // Baignoire verticale (capsule), calée à droite de la SDB
  { id: 'bathtub',        kind: 'bathtub', x: 622, y: 728, w: 44,  h: 132 },
  { id: 'sink',           kind: 'sink',    x: 470, y: 690, r: 11 },
  // WC : icône toilettes en bas de la pièce (y pièce = 500..620)
  { id: 'toilet',         kind: 'toilet',  x: 595, y: 600, rx: 13, ry: 17 },
];

// --- Types d'équipements ----------------------------------------------------
export const DEVICE_TYPES = {
  HUE: 'hue',
  HUE_PLAY: 'hue-play',
  TPLINK: 'tplink',
  ALEXA: 'alexa',
  YEELIGHT_STRIP: 'yeelight-strip',
  YEELIGHT: 'yeelight',
  CLIM_MOBILE: 'clim-mobile',
};

/** Types pilotables par le bouton « lumières de la pièce ». */
export const LIGHT_DEVICE_TYPES = new Set([
  DEVICE_TYPES.HUE,
  DEVICE_TYPES.HUE_PLAY,
  DEVICE_TYPES.YEELIGHT_STRIP,
  DEVICE_TYPES.YEELIGHT,
]);

// --- Équipements ----------------------------------------------------------
// on: état allumé/éteint
// brightness: 0-100 (lumières)
// color: couleur HEX active (lumières RGB, diamants Alexa, triangles TP-Link)
// kelvin: température de couleur si pas de couleur RGB active
// watts: consommation instantanée (prises)
// targetTemp / currentTemp / mode / fanSpeed: climatisation
// hueId: identifiant numérique du luminaire sur le Hue Bridge (null = non mappé).
//   → GET http://localhost:4000/api/hue/lights pour obtenir les IDs de ton bridge.
export const initialDevices = {
  // ---- Séjour : zone TV — mur nord, centré dans le séjour (x=130-650, centre=390) ----
  // yeelightId: true = pilotée via LAN (YEELIGHT_DEVICES=… dans .env). Activer « Contrôle LAN » dans l'app Yeelight.
  'yeelight-tv': {
    id: 'yeelight-tv', name: 'Yeelight TV (LED TV)', type: DEVICE_TYPES.YEELIGHT_STRIP, room: 'sejour',
    x: 390, y: 32, orientation: 'horizontal', length: 120, on: false, brightness: 55, color: '#facc15',
    yeelightId: true,
  },
  'hueplay-tv-gauche': {
    id: 'hueplay-tv-gauche', name: 'Hue Play TV Gauche', type: DEVICE_TYPES.HUE_PLAY, room: 'sejour',
    x: 340, y: 60, on: false, brightness: 70, color: '#dc2626', hueId: 20,
  },
  // alexaId: true = pilotée via Amazon (ALEXA_DEVICES=… dans .env après npm run alexa:auth)
  'alexa-salon': {
    id: 'alexa-salon', name: 'Alexa Salon', type: DEVICE_TYPES.ALEXA, room: 'sejour',
    x: 390, y: 102, on: true, volume: 50, color: '#f472b6',
    alexaId: true,
  },
  'hueplay-tv-droite': {
    id: 'hueplay-tv-droite', name: 'Hue Play TV Droite', type: DEVICE_TYPES.HUE_PLAY, room: 'sejour',
    x: 440, y: 60, on: false, brightness: 70, color: '#dc2626', hueId: 21,
  },

  // ---- Séjour : climatisation (côté balcon, mur ouest du séjour à x=130) ----
  // powerPlugId = prise Kasa associée (affichage / conso) — pilotage indépendant du thermostat.
  'clim-mobile': {
    id: 'clim-mobile', name: 'Clim Mobile DrPrepare', type: DEVICE_TYPES.CLIM_MOBILE, room: 'sejour',
    x: 180, y: 62, on: true, currentTemp: 23.5, targetTemp: 21, mode: 'cool', fanSpeed: 2, color: '#a78bfa',
    // true = pilotée via Tuya Cloud (TUYA_* dans .env). false = simulation locale.
    tuyaId: true,
    powerPlugId: 'tplink-clim',
  },

  // Prise Kasa « Clim » (HS110) — alimente la clim mobile. Pas sur le plan (pilotée via le thermostat).
  'tplink-clim': {
    id: 'tplink-clim', name: 'Prise Clim', type: DEVICE_TYPES.TPLINK, room: 'sejour',
    on: true, watts: 0, voltage: null, energyKwh: null, hasEmeter: true, color: '#a78bfa',
    kasaId: true,
    hiddenOnMap: true,
  },

  // ---- Séjour : éclairage Salon (orange) + Salle à manger (vert) — rangée centrale ----
  'hue-salon-1': {
    id: 'hue-salon-1', name: 'Lumière Salon 1', type: DEVICE_TYPES.HUE, room: 'sejour',
    x: 260, y: 205, on: false, brightness: 65, color: '#ffb877', kelvin: 2700, hueId: 10,
  },
  'hue-salon-2': {
    id: 'hue-salon-2', name: 'Lumière Salon 2', type: DEVICE_TYPES.HUE, room: 'sejour',
    x: 313, y: 205, on: false, brightness: 65, color: '#ffb877', kelvin: 2700, hueId: 11,
  },
  'hue-sam-3': {
    id: 'hue-sam-3', name: 'Lumière Salle à manger 3', type: DEVICE_TYPES.HUE, room: 'sejour',
    x: 366, y: 205, on: false, brightness: 70, color: '#7ee787', kelvin: 3000, hueId: 9,
  },
  'hue-sam-2': {
    id: 'hue-sam-2', name: 'Lumière Salle à manger 2', type: DEVICE_TYPES.HUE, room: 'sejour',
    x: 419, y: 205, on: false, brightness: 70, color: '#7ee787', kelvin: 3000, hueId: 8,
  },
  'hue-sam-1': {
    id: 'hue-sam-1', name: 'Lumière Salle à manger 1', type: DEVICE_TYPES.HUE, room: 'sejour',
    x: 472, y: 205, on: false, brightness: 70, color: '#7ee787', kelvin: 3000, hueId: 7,
  },

  // ---- Séjour : ruban LED Salon (bleu) — mur sud ----
  'yeelight-sejour': {
    id: 'yeelight-sejour', name: 'Yeelight Séjour (LED Salon)', type: DEVICE_TYPES.YEELIGHT_STRIP, room: 'sejour',
    x: 390, y: 298, orientation: 'horizontal', length: 380, on: false, brightness: 50, color: '#38bdf8',
    yeelightId: true,
  },

  // ---- Verres (TP-Link Kasa HS110) — coin haut droit du Séjour ----
  // kasaId: true = pilotée via LAN (KASA_DEVICES=… dans .env).
  'tplink-verres': {
    id: 'tplink-verres', name: 'TP-Link Verres', type: DEVICE_TYPES.TPLINK, room: 'sejour',
    x: 590, y: 58, on: true, watts: 42, voltage: null, energyKwh: null, hasEmeter: true, color: '#84cc16',
    kasaId: true,
  },

  // ---- Cuisine ----
  // Alexa entre le libellé (haut) et le bouton lumières pièce (coin haut droit ≈ 402,358)
  'alexa-cuisine': {
    id: 'alexa-cuisine', name: 'Alexa Cuisine', type: DEVICE_TYPES.ALEXA, room: 'cuisine',
    x: 355, y: 357, on: true, volume: 35, color: '#fbbf24',
    alexaId: true,
  },
  // hueId 23 = « Hue color lamp 1 » (à confirmer via GET /api/hue/lights)
  // Centre de la pièce (280, 395)
  'hue-cuisine': {
    id: 'hue-cuisine', name: 'Lumière Cuisine', type: DEVICE_TYPES.HUE, room: 'cuisine',
    x: 280, y: 395, on: false, brightness: 70, color: '#ffd9a0', kelvin: 3000, hueId: 23,
  },

  // ---- Entrée ----
  // hueId 22 = « Hue white lamp 1 » (à confirmer)
  'hue-entree': {
    id: 'hue-entree', name: 'Lumière Entrée', type: DEVICE_TYPES.HUE, room: 'entree',
    x: 540, y: 395, on: false, brightness: 60, color: '#e2e8f0', kelvin: 4000, hueId: 22,
  },

  // ---- Dégagement ----
  // hueId 18 = « Lumière Couloir »
  'hue-degagement': {
    id: 'hue-degagement', name: 'Lumière Dégagement', type: DEVICE_TYPES.HUE, room: 'degagement',
    x: 485, y: 540, on: false, brightness: 50, color: '#e2e8f0', kelvin: 4000, hueId: 18,
  },

  // ---- WC ----
  // Pas d'ID Hue libre évident — renseigner hueId après GET /api/hue/lights
  // Centrée dans le WC (centre = 595, 560)
  'hue-wc': {
    id: 'hue-wc', name: 'Lumière WC', type: DEVICE_TYPES.HUE, room: 'wc',
    x: 595, y: 560, on: false, brightness: 50, color: '#e2e8f0', kelvin: 4000, hueId: null,
  },

  // ---- Chambre 2 : coin bureau ----
  // Ampoule centrée (centre pièce = 280, 540)
  'hue-bureau': {
    id: 'hue-bureau', name: 'Lumière Bureau', type: DEVICE_TYPES.HUE, room: 'chambre2',
    x: 280, y: 540, on: false, brightness: 60, color: '#e2e8f0', kelvin: 4000, hueId: 6,
  },
  // Rangée en bas de Chambre 2 (pièce y=460..620)
  'hueplay-bureau-gauche': {
    id: 'hueplay-bureau-gauche', name: 'Hue Play Bureau Gauche', type: DEVICE_TYPES.HUE_PLAY, room: 'chambre2',
    x: 230, y: 600, on: false, brightness: 60, color: '#7f1d1d', hueId: 16,
  },
  'alexa-bureau': {
    id: 'alexa-bureau', name: 'Alexa Bureau', type: DEVICE_TYPES.ALEXA, room: 'chambre2',
    x: 285, y: 600, on: true, volume: 25, color: '#c2703d',
    alexaId: true,
  },
  'hueplay-bureau-droite': {
    id: 'hueplay-bureau-droite', name: 'Hue Play Bureau Droite', type: DEVICE_TYPES.HUE_PLAY, room: 'chambre2',
    x: 335, y: 600, on: false, brightness: 60, color: '#7f1d1d', hueId: 19,
  },

  // ---- Chambre 1 ----
  'hue-chambre-1': {
    id: 'hue-chambre-1', name: 'Lumière Chambre 1', type: DEVICE_TYPES.HUE, room: 'chambre1',
    x: 280, y: 722, on: false, brightness: 60, color: '#f2d9a0', kelvin: 2700, hueId: 17,
  },
  'alexa-chambre': {
    id: 'alexa-chambre', name: 'Alexa Chambre', type: DEVICE_TYPES.ALEXA, room: 'chambre1',
    x: 210, y: 800, on: true, volume: 40, color: '#38bdf8',
    alexaId: true,
  },

  // ---- Salle de Bain ----
  // Même marge bas que alexa-chambre (chambre1/sdb bottom = 830 → y = 800)
  'alexa-sdb': {
    id: 'alexa-sdb', name: 'Alexa Salle de Bains', type: DEVICE_TYPES.ALEXA, room: 'sdb',
    x: 500, y: 800, on: true, volume: 30, color: '#c4b5fd',
    alexaId: true,
  },
  // Ampoule Yeelight centrée dans la SDB (centre pièce ≈ 540, 725)
  // Ajouter l'IP dans YEELIGHT_DEVICES (ex. yeelight-sdb:192.168.1.xx)
  'yeelight-sdb': {
    id: 'yeelight-sdb', name: 'Yeelight Salle de Bain', type: DEVICE_TYPES.YEELIGHT, room: 'sdb',
    x: 540, y: 725, on: false, brightness: 70, color: '#e2e8f0',
    yeelightId: true,
  },
};

// --- Scènes globales --------------------------------------------------------
/** Coupe uniquement les lumières (Hue / Hue Play / Yeelight) — pas la clim ni les prises. */
const ALL_LIGHTS_OFF = {
  'hue-salon-1': { on: false },
  'hue-salon-2': { on: false },
  'hue-sam-1': { on: false },
  'hue-sam-2': { on: false },
  'hue-sam-3': { on: false },
  'hue-chambre-1': { on: false },
  'hue-bureau': { on: false },
  'hue-cuisine': { on: false },
  'hue-entree': { on: false },
  'hue-degagement': { on: false },
  'hue-wc': { on: false },
  'hueplay-tv-gauche': { on: false },
  'hueplay-tv-droite': { on: false },
  'hueplay-bureau-gauche': { on: false },
  'hueplay-bureau-droite': { on: false },
  'yeelight-tv': { on: false },
  'yeelight-sejour': { on: false },
  'yeelight-sdb': { on: false },
};

export const scenes = [
  {
    id: 'lights-off',
    label: 'Lumières off',
    emoji: '💡',
    deviceStates: { ...ALL_LIGHTS_OFF },
  },
  {
    id: 'salon-sam',
    label: 'Salon + SAM',
    emoji: '✨',
    // Clic 1 = allume tout le séjour (ampoules + Hue Play + rubans), reclic = éteint
    toggle: true,
    deviceStates: {
      'hue-salon-1': { on: true, brightness: 65 },
      'hue-salon-2': { on: true, brightness: 65 },
      'hue-sam-1': { on: true, brightness: 70 },
      'hue-sam-2': { on: true, brightness: 70 },
      'hue-sam-3': { on: true, brightness: 70 },
      'hueplay-tv-gauche': { on: true, brightness: 70 },
      'hueplay-tv-droite': { on: true, brightness: 70 },
      'yeelight-tv': { on: true, brightness: 55 },
      'yeelight-sejour': { on: true, brightness: 50 },
    },
  },
  {
    id: 'cinema',
    label: 'Mode Cinéma',
    emoji: '🎬',
    deviceStates: {
      'hue-salon-1': { on: false },
      'hue-salon-2': { on: false },
      'hue-sam-1': { on: false },
      'hue-sam-2': { on: false },
      'hue-sam-3': { on: false },
      'hueplay-tv-gauche': { on: true, brightness: 45, color: '#7e1616' },
      'hueplay-tv-droite': { on: true, brightness: 45, color: '#7e1616' },
      'yeelight-tv': { on: true, brightness: 40, color: '#1e293b' },
      'yeelight-sejour': { on: false },
    },
  },
  {
    id: 'nuit',
    label: 'Mode Nuit',
    emoji: '🌙',
    deviceStates: {
      ...ALL_LIGHTS_OFF,
      'tplink-verres': { on: false },
    },
  },
  {
    id: 'depart',
    label: 'Départ',
    emoji: '🏃',
    // Tout éteint (lumières + prises + clim + prise clim) — plus large que « Lumières off »
    deviceStates: {
      ...ALL_LIGHTS_OFF,
      'tplink-verres': { on: false },
      'clim-mobile': { on: false },
      'tplink-clim': { on: false },
    },
  },
  {
    id: 'reveil',
    label: 'Réveil',
    emoji: '☀️',
    deviceStates: {
      'hue-chambre-1': { on: true, brightness: 35, color: '#ffd9a0' },
      'hue-sam-1': { on: true, brightness: 70, color: '#ffd9a0' },
      'hue-sam-2': { on: true, brightness: 70, color: '#ffd9a0' },
    },
  },
];

// --- Météo / climat intérieur simulés (secours si Netatmo indisponible) ---
export const weather = {
  outdoorTemp: 8,
  outdoorHumidity: 68,
  indoorTemp: 21.4,
  indoorHumidity: 46,
  condition: 'cloudy', // clear | cloudy | rain | night
};
