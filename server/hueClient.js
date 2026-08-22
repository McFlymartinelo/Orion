import 'dotenv/config';

const BRIDGE_IP = () => process.env.HUE_BRIDGE_IP?.trim();
const API_KEY   = () => process.env.HUE_API_KEY?.trim();

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

/** Pièces / zones Hue : { "1": { name, type, lights: ["1","2"] }, … } */
export function getGroups() {
  return request('GET', '/groups');
}

/** Scènes enregistrées dans l'app Hue (GroupScene / LightScene). */
export function getScenes() {
  return request('GET', '/scenes');
}

/** Active une scène sur son groupe (0 = toutes les lampes). */
export function recallScene(sceneId, groupId = '0') {
  return request('PUT', `/groups/${groupId}/action`, { scene: sceneId });
}

/**
 * Liste normalisée des scènes persistantes (pas les scènes auto « recycle »).
 * { id, name, type, groupId, groupName, lights }
 */
export async function listPersistentScenes() {
  const [scenes, groups] = await Promise.all([getScenes(), getGroups()]);
  if (Array.isArray(scenes)) {
    const desc = scenes[0]?.error?.description ?? 'Impossible de lister les scènes Hue';
    throw new HueUnavailableError(desc);
  }

  const groupNames = {};
  for (const [id, group] of Object.entries(groups || {})) {
    groupNames[id] = group.name;
  }

  const out = [];
  for (const [id, scene] of Object.entries(scenes || {})) {
    if (!scene || scene.recycle) continue;
    if (scene.type !== 'GroupScene' && scene.type !== 'LightScene') continue;
    const name = String(scene.name || '').trim();
    if (!name || /^hidden/i.test(name)) continue;

    const lights = (scene.lights || [])
      .map((lightId) => Number(lightId))
      .filter((n) => Number.isFinite(n) && n > 0);

    out.push({
      id,
      name,
      type: scene.type,
      groupId: scene.group ?? null,
      groupName: scene.group ? groupNames[scene.group] ?? null : null,
      lights,
    });
  }

  out.sort(
    (a, b) =>
      (a.groupName || '').localeCompare(b.groupName || '', 'fr') ||
      a.name.localeCompare(b.name, 'fr')
  );
  return out;
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
