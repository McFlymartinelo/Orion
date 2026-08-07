import 'dotenv/config';

const BRIDGE_IP = () => process.env.HUE_BRIDGE_IP;
const API_KEY   = () => process.env.HUE_API_KEY;

export class HueUnavailableError extends Error {}

function assertConfig() {
  if (!BRIDGE_IP()) throw new HueUnavailableError('HUE_BRIDGE_IP non défini dans .env');
  if (!API_KEY())   throw new HueUnavailableError('HUE_API_KEY non défini dans .env');
}

async function request(method, path, body = null) {
  assertConfig();
  const url = `http://${BRIDGE_IP()}/api/${API_KEY()}${path}`;
  const init = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) init.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new HueUnavailableError(`Bridge injoignable (${err.message})`);
  }

  if (!res.ok) throw new HueUnavailableError(`Hue Bridge HTTP ${res.status}`);
  return res.json();
}

/** Retourne tous les luminaires : { "1": { name, state: { on, bri, hue, sat, ct } }, … } */
export function getLights() {
  return request('GET', '/lights');
}

/** Contrôle l'état d'un luminaire. state : { on?, bri?, hue?, sat?, ct?, xy? } */
export function setLightState(lightId, state) {
  return request('PUT', `/lights/${lightId}/state`, state);
}

/**
 * Pairing : appuyer sur le bouton du bridge AVANT d'appeler cette fonction.
 * Renvoie { username } si succès.
 */
export async function pairBridge() {
  if (!BRIDGE_IP()) throw new HueUnavailableError('HUE_BRIDGE_IP non défini dans .env');
  let res;
  try {
    res = await fetch(`http://${BRIDGE_IP()}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devicetype: 'orion#dashboard' }),
    });
  } catch (err) {
    throw new HueUnavailableError(`Bridge injoignable (${err.message})`);
  }
  const data = await res.json();
  if (data[0]?.success?.username) return { username: data[0].success.username };
  const desc = data[0]?.error?.description ?? 'Erreur inconnue';
  throw new HueUnavailableError(desc);
}
