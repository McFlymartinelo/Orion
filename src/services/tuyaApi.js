// Service frontend Tuya / clim DrPrepare.
// Toutes les requêtes passent par le proxy Express (/api/tuya/*).

const TIMEOUT_MS = 8000;

async function request(method, path, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}

/** État normalisé : { on, targetTemp, currentTemp, mode, fanSpeed, raw? }. */
export function fetchTuyaStatus() {
  return request('GET', '/api/tuya/status');
}

/**
 * Envoie un patch clim au proxy Tuya.
 * patch : { on?, targetTemp?, mode?, fanSpeed? }
 */
export function sendTuyaControl(patch) {
  return request('PUT', '/api/tuya/control', patch);
}

/**
 * Ne garde que les clés pertinentes pour Tuya.
 * Renvoie null si le patch ne concerne pas la clim.
 */
export function buildTuyaPatch(patch) {
  const out = {};
  if ('on' in patch) out.on = patch.on;
  if ('targetTemp' in patch) out.targetTemp = patch.targetTemp;
  if ('mode' in patch) out.mode = patch.mode;
  if ('fanSpeed' in patch) out.fanSpeed = patch.fanSpeed;
  return Object.keys(out).length ? out : null;
}
