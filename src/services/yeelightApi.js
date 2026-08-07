// Service frontend Yeelight.
// Toutes les requêtes passent par le proxy Express (/api/yeelight/*).

const TIMEOUT_MS = 6000;

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

/** Statuts de tous les rubans configurés */
export function fetchYeelightStatuses() {
  return request('GET', '/api/yeelight/devices');
}

/** Patch : { on?, brightness?, color? } */
export function setYeelightState(deviceId, patch) {
  return request('PUT', `/api/yeelight/devices/${encodeURIComponent(deviceId)}`, patch);
}

/**
 * Envoie l'état au ruban Yeelight si le device a yeelightId.
 * Met à jour le store dès la réponse.
 */
export function syncYeelight(device, patch, applyResult) {
  if (!device?.yeelightId) return;
  const body = {};
  if ('on' in patch) body.on = patch.on;
  if ('brightness' in patch) body.brightness = patch.brightness;
  if ('color' in patch) body.color = patch.color;
  if (!Object.keys(body).length) return;

  setYeelightState(device.id, body)
    .then((result) => {
      applyResult?.(device.id, {
        on: result.on,
        brightness: result.brightness,
        color: result.color,
      });
    })
    .catch(console.warn);
}
