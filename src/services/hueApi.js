// Service frontend Philips Hue.
// Toutes les requêtes passent par le proxy Express (/api/hue/*).
// Les conversions de valeurs (brightness %, hex, kelvin → format Hue) sont ici.

const TIMEOUT_MS = 4000;

async function put(path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Contrôle l'état d'un luminaire Hue via le proxy.
 * state : { on?, bri?, hue?, sat?, ct? }
 */
export function setHueLightState(hueId, state) {
  return put(`/api/hue/lights/${hueId}`, state);
}

// ── Conversions ──────────────────────────────────────────────────────────────

/** Pourcentage 0-100 → brightness Hue 1-254 */
export function pctToBri(pct) {
  return Math.round(Math.max(1, Math.min(254, pct * 2.54)));
}

/** Kelvins → Mired (ct Hue 153-500) */
export function kelvinToMired(k) {
  return Math.round(Math.max(153, Math.min(500, 1_000_000 / k)));
}

/**
 * Couleur hexadécimale (#rrggbb) → { hue, sat, bri } au format Hue.
 * hue : 0-65535 / sat : 0-254 / bri : 0-254
 */
export function hexToHueSatBri(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d   = max - min;

  let h = 0;
  if (d > 0) {
    if (max === r)      h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h /= 6;
  }

  return {
    hue: Math.round(h * 65535),
    sat: max === 0 ? 0 : Math.round((d / max) * 254),
    bri: Math.round(max * 254),
  };
}

/**
 * Construit le payload Hue à partir d'un patch du store Orion.
 * Renvoie null si aucune propriété Hue n'est concernée.
 */
export function buildHueState(patch) {
  const state = {};

  if ('on' in patch)         state.on  = patch.on;
  if ('brightness' in patch) state.bri = pctToBri(patch.brightness);

  if (patch.color && !patch.kelvin) {
    Object.assign(state, hexToHueSatBri(patch.color));
  } else if (patch.kelvin) {
    state.ct = kelvinToMired(patch.kelvin);
    // En mode CT, désactiver la couleur saturée
    state.sat = 0;
  }

  return Object.keys(state).length ? state : null;
}
