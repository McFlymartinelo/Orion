// Service frontend TP-Link Kasa.
// Toutes les requêtes passent par le proxy Express (/api/kasa/*).

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

/** Statuts de toutes les prises configurées : [{ id, on, watts, alias, model } | { id, error }] */
export function fetchKasaStatuses() {
  return request('GET', '/api/kasa/devices');
}

/** Statut d'une prise : { id, on, watts, alias, model } */
export function fetchKasaStatus(deviceId) {
  return request('GET', `/api/kasa/devices/${encodeURIComponent(deviceId)}`);
}

/** Allume / éteint : body { on } → { id, on, watts, voltage?, energyKwh? } */
export function setKasaPower(deviceId, on) {
  return request('PUT', `/api/kasa/devices/${encodeURIComponent(deviceId)}`, { on });
}

/**
 * Envoie l'état ON/OFF à Kasa si le device a kasaId.
 * Met à jour watts/conso dans le store dès la réponse.
 */
export function syncKasa(device, patch, applyResult) {
  if (!device?.kasaId) return;
  if (!('on' in patch)) return;
  setKasaPower(device.id, patch.on)
    .then((result) => {
      applyResult?.(device.id, {
        on: result.on,
        watts: result.watts ?? 0,
        voltage: result.voltage ?? null,
        energyKwh: result.energyKwh ?? null,
        hasEmeter: result.hasEmeter ?? true,
      });
    })
    .catch(console.warn);
}
