// Service frontend Philips Hue.
// Toutes les requêtes passent par le proxy Express (/api/hue/*).
// Les conversions de valeurs (brightness %, hex, kelvin → format Hue) sont ici.

const TIMEOUT_MS = 8000;

async function request(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const init = { method, signal: ctrl.signal };
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function put(path, body) {
  return request('PUT', path, body);
}

/**
 * Contrôle l'état d'un luminaire Hue via le proxy.
 * state : { on?, bri?, hue?, sat?, ct? }
 */
export function setHueLightState(hueId, state) {
  return put(`/api/hue/lights/${hueId}`, state);
}

export function fetchHueScenes() {
  return request('GET', '/api/hue/scenes');
}

export function recallHueScene(sceneId) {
  return put(`/api/hue/scenes/${encodeURIComponent(sceneId)}`, {});
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

/** Brightness Hue 1-254 → pourcentage 0-100 */
export function briToPct(bri) {
  return Math.round(Math.max(0, Math.min(100, (bri / 254) * 100)));
}

/** Mired → kelvins */
export function miredToKelvin(ct) {
  return Math.round(1_000_000 / ct);
}

function toHexByte(n) {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}

/** HSV Hue/Sat/Bri → #rrggbb */
export function hueSatBriToHex(hue, sat, bri) {
  const h = (hue / 65535) * 360;
  const s = sat / 254;
  const v = bri / 254;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `#${toHexByte((r + m) * 255)}${toHexByte((g + m) * 255)}${toHexByte((b + m) * 255)}`;
}

/** CIE xy + brightness → #rrggbb (approx. sRGB) */
export function xyBriToHex(x, y, bri = 254) {
  const Y = Math.max(0.01, bri / 254);
  const z = Math.max(0.0001, 1 - x - y);
  const X = (Y / Math.max(y, 0.0001)) * x;
  const Z = (Y / Math.max(y, 0.0001)) * z;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  const gamma = (c) => {
    const v = Math.max(0, c);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  r = gamma(r);
  g = gamma(g);
  b = gamma(b);
  const max = Math.max(r, g, b, 1);
  return `#${toHexByte((r / max) * 255)}${toHexByte((g / max) * 255)}${toHexByte((b / max) * 255)}`;
}

/** État d'une lampe Hue (bridge) → patch Orion. */
export function hueLightToPatch(light) {
  const state = light?.state;
  if (!state) return null;
  const patch = {};
  if (state.on != null) patch.on = Boolean(state.on);
  if (state.bri != null) patch.brightness = briToPct(state.bri);

  if (state.colormode === 'ct' && state.ct) {
    patch.kelvin = miredToKelvin(state.ct);
    patch.color = undefined;
  } else if (state.xy && state.xy.length >= 2) {
    patch.color = xyBriToHex(state.xy[0], state.xy[1], state.bri ?? 254);
    patch.kelvin = undefined;
  } else if (state.hue != null && state.sat != null) {
    patch.color = hueSatBriToHex(state.hue, state.sat, state.bri ?? 254);
    patch.kelvin = undefined;
  }
  return patch;
}
