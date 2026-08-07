// Service frontend Alexa — passe par le proxy Express (/api/alexa/*).

const TIMEOUT_MS = 12_000;

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

export function fetchAlexaStatus() {
  return request('GET', '/api/alexa/status');
}

export function fetchAlexaDevices() {
  return request('GET', '/api/alexa/devices');
}

export function fetchAlexaEchoes() {
  return request('GET', '/api/alexa/echoes');
}

/** patch : { volume?, on?, speak?, stop? } */
export function setAlexaState(deviceId, patch) {
  return request('PUT', `/api/alexa/devices/${encodeURIComponent(deviceId)}`, patch);
}

const volumeTimers = new Map();

function sendAlexaPatch(device, body, applyResult) {
  setAlexaState(device.id, body)
    .then((result) => {
      const next = {};
      if (result.on != null) next.on = result.on;
      if (result.volume != null) next.volume = result.volume;
      if (Object.keys(next).length) applyResult?.(device.id, next);
    })
    .catch(console.warn);
}

/**
 * Envoie un patch Alexa si le device a alexaId.
 * Le volume est debouncé (évite de spammer Amazon pendant le slider).
 */
export function syncAlexa(device, patch, applyResult) {
  if (!device?.alexaId) return;

  const immediate = {};
  if ('on' in patch) immediate.on = patch.on;
  if ('speak' in patch) immediate.speak = patch.speak;
  if ('stop' in patch) immediate.stop = patch.stop;
  if (Object.keys(immediate).length) {
    sendAlexaPatch(device, immediate, applyResult);
  }

  if ('volume' in patch) {
    const prev = volumeTimers.get(device.id);
    if (prev) clearTimeout(prev);
    volumeTimers.set(
      device.id,
      setTimeout(() => {
        volumeTimers.delete(device.id);
        sendAlexaPatch(device, { volume: patch.volume }, applyResult);
      }, 350)
    );
  }
}
