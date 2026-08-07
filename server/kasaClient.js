// Client TP-Link Kasa (protocole local LAN) — prises / switches.
// Mapping deviceId Orion → IP via KASA_DEVICES dans .env
// Ex. : KASA_DEVICES=tplink-verres:192.168.1.50

import 'dotenv/config';
import os from 'node:os';
import { Client } from 'tplink-smarthome-api';

const TIMEOUT_MS = 4000;

export class KasaUnavailableError extends Error {}

/** Parse "id:host,id2:host2" → Map<id, host> */
export function parseKasaDevices(raw = process.env.KASA_DEVICES) {
  const map = new Map();
  if (!raw?.trim()) return map;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const id = trimmed.slice(0, colon).trim();
    const host = trimmed.slice(colon + 1).trim();
    if (id && host) map.set(id, host);
  }
  return map;
}

export function isKasaConfigured() {
  return parseKasaDevices().size > 0;
}

function hostFor(deviceId) {
  const host = parseKasaDevices().get(deviceId);
  if (!host) {
    throw new KasaUnavailableError(
      `Aucune IP Kasa pour "${deviceId}" — ajoutez-le dans KASA_DEVICES (ex. ${deviceId}:192.168.x.x)`
    );
  }
  return host;
}

const client = new Client({ defaultSendOptions: { timeout: TIMEOUT_MS } });
const deviceCache = new Map(); // deviceId → Plug

async function getPlug(deviceId) {
  const host = hostFor(deviceId);
  let plug = deviceCache.get(deviceId);
  if (plug && plug.host === host) return plug;

  try {
    plug = await client.getDevice({ host });
  } catch (err) {
    deviceCache.delete(deviceId);
    throw new KasaUnavailableError(`Prise Kasa injoignable (${host}): ${err.message}`);
  }

  if (typeof plug.getPowerState !== 'function') {
    deviceCache.delete(deviceId);
    throw new KasaUnavailableError(`L'appareil ${host} n'est pas une prise Kasa supportée`);
  }

  deviceCache.set(deviceId, plug);
  return plug;
}

/**
 * Conso si le modèle a un emeter (HS110, KP115…).
 * @returns {{ watts: number, voltage: number|null, energyKwh: number|null } | null}
 */
async function readEmeter(plug) {
  try {
    const rt = await plug.emeter.getRealtime();
    let watts = null;
    if (rt?.power != null && !Number.isNaN(Number(rt.power))) watts = Number(rt.power);
    else if (rt?.power_mw != null && !Number.isNaN(Number(rt.power_mw))) watts = Number(rt.power_mw) / 1000;
    if (watts == null) return null;

    let energyKwh = null;
    if (rt?.total != null && !Number.isNaN(Number(rt.total))) energyKwh = Number(rt.total);
    else if (rt?.total_wh != null && !Number.isNaN(Number(rt.total_wh))) energyKwh = Number(rt.total_wh) / 1000;

    let voltage = null;
    if (rt?.voltage != null && !Number.isNaN(Number(rt.voltage))) voltage = Number(rt.voltage);
    else if (rt?.voltage_mv != null && !Number.isNaN(Number(rt.voltage_mv))) voltage = Number(rt.voltage_mv) / 1000;

    return {
      watts: Math.round(watts * 10) / 10,
      voltage: voltage != null ? Math.round(voltage * 10) / 10 : null,
      energyKwh: energyKwh != null ? Math.round(energyKwh * 1000) / 1000 : null,
    };
  } catch {
    return null;
  }
}

/**
 * État normalisé d'une prise.
 * @returns {{ id, host, on, watts, voltage, energyKwh, hasEmeter, alias, model }}
 */
export async function getPlugStatus(deviceId) {
  const plug = await getPlug(deviceId);
  try {
    const [on, sysInfo, emeter] = await Promise.all([
      plug.getPowerState(),
      plug.getSysInfo(),
      readEmeter(plug),
    ]);
    return {
      id: deviceId,
      host: plug.host,
      on: Boolean(on),
      watts: emeter?.watts ?? 0,
      voltage: emeter?.voltage ?? null,
      energyKwh: emeter?.energyKwh ?? null,
      hasEmeter: Boolean(emeter),
      alias: sysInfo?.alias ?? null,
      model: sysInfo?.model ?? sysInfo?.mic_type ?? null,
    };
  } catch (err) {
    deviceCache.delete(deviceId);
    if (err instanceof KasaUnavailableError) throw err;
    throw new KasaUnavailableError(err.message);
  }
}

/** Liste le statut de toutes les prises configurées dans KASA_DEVICES. */
export async function getAllPlugStatuses() {
  const ids = [...parseKasaDevices().keys()];
  const results = await Promise.allSettled(ids.map((id) => getPlugStatus(id)));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      id: ids[i],
      host: parseKasaDevices().get(ids[i]),
      error: r.reason?.message ?? 'Erreur inconnue',
    };
  });
}

/** Allume / éteint une prise. */
export async function setPlugPower(deviceId, on) {
  const plug = await getPlug(deviceId);
  try {
    await plug.setPowerState(Boolean(on));
    const emeter = on ? await readEmeter(plug) : null;
    return {
      id: deviceId,
      on: Boolean(on),
      watts: on ? (emeter?.watts ?? 0) : 0,
      voltage: emeter?.voltage ?? null,
      energyKwh: emeter?.energyKwh ?? null,
      hasEmeter: Boolean(emeter) || !on,
    };
  } catch (err) {
    deviceCache.delete(deviceId);
    if (err instanceof KasaUnavailableError) throw err;
    throw new KasaUnavailableError(err.message);
  }
}

/** Broadcasts IPv4 des interfaces LAN (exclut loopback / VPN courants). */
function localBroadcasts() {
  const list = new Set();
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    // NordLynx / WSL / virtual adapters cassent souvent le broadcast 255.255.255.255
    if (/nord|wsl|vethernet|hyper-v|docker|virtual|loopback/i.test(name)) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (!addr.netmask) continue;
      const ipParts = addr.address.split('.').map(Number);
      const maskParts = addr.netmask.split('.').map(Number);
      const bcast = ipParts.map((o, i) => (o & maskParts[i]) | (255 ^ maskParts[i])).join('.');
      list.add(bcast);
    }
  }
  // Fallback classique si aucune interface filtrée
  if (list.size === 0) list.add('255.255.255.255');
  return [...list];
}

/**
 * Découverte UDP sur chaque sous-réseau LAN (quelques secondes).
 * Sous Windows + VPN, le broadcast global échoue souvent — on cible 192.168.x.255.
 */
export async function discoverPlugs(durationMs = 8000) {
  const broadcasts = localBroadcasts();
  const found = new Map();

  await Promise.all(
    broadcasts.map(
      (broadcast) =>
        new Promise((resolve) => {
          const discovery = new Client();
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            try {
              discovery.stopDiscovery();
            } catch {
              /* ignore */
            }
            resolve();
          };

          discovery
            .startDiscovery({
              broadcast,
              discoveryTimeout: durationMs,
              discoveryInterval: 1500,
            })
            .on('device-new', (device) => {
              const sys = device.sysInfo || {};
              const isPlug = typeof device.getPowerState === 'function';
              found.set(device.host, {
                host: device.host,
                alias: sys.alias ?? device.alias ?? null,
                model: sys.model ?? null,
                deviceId: sys.deviceId ?? null,
                type: isPlug ? 'plug' : 'other',
                broadcast,
              });
            });

          setTimeout(finish, durationMs + 400);
        })
    )
  );

  return {
    devices: [...found.values()].sort((a, b) =>
      (a.alias || '').localeCompare(b.alias || '')
    ),
    broadcastsTried: broadcasts,
    hint:
      found.size === 0
        ? 'Aucune prise trouvée. Coupez le VPN (NordLynx), vérifiez que le PC est sur le même Wi‑Fi/Ethernet que la prise, ou récupérez l’IP dans l’app Kasa / la box puis utilisez KASA_DEVICES=tplink-verres:IP.'
        : null,
  };
}

/** Teste une IP précise (contourne la découverte UDP). */
export async function probeHost(host) {
  if (!host?.trim()) throw new KasaUnavailableError('Paramètre host requis');
  const client = new Client({ defaultSendOptions: { timeout: TIMEOUT_MS } });
  try {
    const device = await client.getDevice({ host: host.trim() });
    const sys = await device.getSysInfo();
    const isPlug = typeof device.getPowerState === 'function';
    let on = null;
    if (isPlug) on = Boolean(await device.getPowerState());
    return {
      host: host.trim(),
      alias: sys?.alias ?? null,
      model: sys?.model ?? null,
      deviceId: sys?.deviceId ?? null,
      type: isPlug ? 'plug' : 'other',
      on,
      ok: true,
    };
  } catch (err) {
    throw new KasaUnavailableError(
      `Pas de réponse Kasa sur ${host} (${err.message}). Firmware trop récent (KLAP) ou mauvaise IP ?`
    );
  }
}
