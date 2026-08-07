// Client Yeelight (protocole LAN TCP port 55443).
// Mapping deviceId Orion → IP via YEELIGHT_DEVICES dans .env
// Ex. : YEELIGHT_DEVICES=yeelight-tv:192.168.1.60,yeelight-sejour:192.168.1.61
// Prérequis : activer « Contrôle LAN » dans l'app Yeelight pour chaque ruban.
//
// Important : beaucoup de rubans clignotent à chaque NOUVELLE connexion TCP.
// On garde donc une connexion persistante par IP.

import 'dotenv/config';
import net from 'node:net';
import dgram from 'node:dgram';
import os from 'node:os';

const PORT = 55443;
const TIMEOUT_MS = 4000;
const DISCOVER_MS = 3000;
const TRANSITION_MS = 300;

export class YeelightUnavailableError extends Error {}

/** Parse "id:host,id2:host2" → Map<id, host> */
export function parseYeelightDevices(raw = process.env.YEELIGHT_DEVICES) {
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

export function isYeelightConfigured() {
  return parseYeelightDevices().size > 0;
}

function hostFor(deviceId) {
  const host = parseYeelightDevices().get(deviceId);
  if (!host) {
    throw new YeelightUnavailableError(
      `Aucune IP Yeelight pour "${deviceId}" — ajoutez-le dans YEELIGHT_DEVICES (ex. ${deviceId}:192.168.x.x)`
    );
  }
  return host;
}

function hexToRgbInt(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) throw new YeelightUnavailableError(`Couleur invalide: ${hex}`);
  return parseInt(h, 16);
}

function rgbIntToHex(n) {
  return `#${Math.max(0, Math.min(0xffffff, Number(n) || 0))
    .toString(16)
    .padStart(6, '0')}`;
}

/** Connexion TCP persistante + file de commandes sérialisée. */
class YeelightSocket {
  constructor(host) {
    this.host = host;
    this.socket = null;
    this.buffer = '';
    this.pending = new Map();
    this.connecting = null;
    this.chain = Promise.resolve();
    this.nextId = 1;
  }

  async ensureConnected() {
    if (this.socket && !this.socket.destroyed) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const failConnect = (err) => {
        if (settled) return;
        settled = true;
        this.socket = null;
        this.connecting = null;
        reject(err);
      };

      socket.setKeepAlive(true, 30_000);
      socket.connect(PORT, this.host, () => {
        settled = true;
        this.socket = socket;
        this.connecting = null;
        resolve();
      });

      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('error', (err) => {
        const wrapped = new YeelightUnavailableError(
          `Yeelight injoignable (${this.host}): ${err.message}`
        );
        if (!settled) failConnect(wrapped);
        else {
          this.socket = null;
          this.rejectAll(wrapped);
        }
        socket.destroy();
      });
      socket.on('close', () => {
        this.socket = null;
        this.rejectAll(new YeelightUnavailableError(`Connexion Yeelight fermée (${this.host})`));
      });
    });

    return this.connecting;
  }

  rejectAll(err) {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  onData(chunk) {
    this.buffer += chunk.toString('utf8');
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id == null) continue; // notification props
      const pending = this.pending.get(msg.id);
      if (!pending) continue;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.error) {
        pending.reject(
          new YeelightUnavailableError(msg.error.message || `Yeelight error ${msg.error.code}`)
        );
      } else {
        pending.resolve(msg);
      }
    }
  }

  command(method, params = []) {
    const run = async () => {
      await this.ensureConnected();
      const id = this.nextId++;
      const payload = `${JSON.stringify({ id, method, params })}\r\n`;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new YeelightUnavailableError(`Timeout Yeelight (${this.host})`));
        }, TIMEOUT_MS);
        this.pending.set(id, { resolve, reject, timer });
        try {
          this.socket.write(payload);
        } catch (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          this.socket = null;
          reject(
            new YeelightUnavailableError(
              `Écriture Yeelight échouée (${this.host}): ${err.message}`
            )
          );
        }
      });
    };

    const result = this.chain.then(run, run);
    this.chain = result.catch(() => {});
    return result;
  }
}

const sockets = new Map();

function getSocket(host) {
  let s = sockets.get(host);
  if (!s) {
    s = new YeelightSocket(host);
    sockets.set(host, s);
  }
  return s;
}

function sendCommand(host, method, params = []) {
  return getSocket(host).command(method, params);
}

function normalizeStatus(deviceId, host, props) {
  const [power, bright, rgb] = props;
  return {
    id: deviceId,
    host,
    on: String(power).toLowerCase() === 'on',
    brightness: Number(bright) || 0,
    color: rgbIntToHex(rgb),
  };
}

/** Statut d'un ruban : { id, host, on, brightness, color } */
export async function getStripStatus(deviceId) {
  const host = hostFor(deviceId);
  const res = await sendCommand(host, 'get_prop', ['power', 'bright', 'rgb']);
  return normalizeStatus(deviceId, host, res.result ?? []);
}

/** Statuts de tous les rubans configurés */
export async function getAllStripStatuses() {
  const entries = [...parseYeelightDevices().entries()];
  return Promise.all(
    entries.map(async ([id, host]) => {
      try {
        return await getStripStatus(id);
      } catch (err) {
        return { id, host, error: err.message };
      }
    })
  );
}

/**
 * Applique un patch : { on?, brightness?, color? }
 * Une seule connexion, commandes minimales (évite le clignotement).
 * Ne renvoie PAS de set_power sauf si `on` est explicitement dans le patch.
 */
export async function setStripState(deviceId, patch = {}) {
  const host = hostFor(deviceId);
  const sock = getSocket(host);
  const commands = [];

  if (typeof patch.on === 'boolean') {
    commands.push(['set_power', [patch.on ? 'on' : 'off', 'smooth', TRANSITION_MS]]);
  }

  if (typeof patch.brightness === 'number' && patch.on !== false) {
    const bri = Math.max(1, Math.min(100, Math.round(patch.brightness)));
    commands.push(['set_bright', [bri, 'smooth', TRANSITION_MS]]);
  }

  if (typeof patch.color === 'string' && patch.color.startsWith('#') && patch.on !== false) {
    commands.push(['set_rgb', [hexToRgbInt(patch.color), 'smooth', TRANSITION_MS]]);
  }

  if (!commands.length) {
    const res = await sock.command('get_prop', ['power', 'bright', 'rgb']);
    return normalizeStatus(deviceId, host, res.result ?? []);
  }

  for (const [method, params] of commands) {
    await sock.command(method, params);
  }

  // Statut sur la même connexion (pas de reconnexion = pas de clignotement)
  const res = await sock.command('get_prop', ['power', 'bright', 'rgb']);
  return normalizeStatus(deviceId, host, res.result ?? []);
}

/** Probe une IP sans mapping .env (connexion one-shot OK pour discovery). */
export async function probeHost(host) {
  if (!host) throw new YeelightUnavailableError('Paramètre host requis');
  const res = await sendCommand(host, 'get_prop', ['power', 'bright', 'rgb', 'name', 'model']);
  const [power, bright, rgb, name, model] = res.result ?? [];
  return {
    host,
    on: String(power).toLowerCase() === 'on',
    brightness: Number(bright) || 0,
    color: rgbIntToHex(rgb),
    name: name || null,
    model: model || null,
  };
}

function lanBroadcasts() {
  const set = new Set(['255.255.255.255']);
  for (const iface of Object.values(os.networkInterfaces()).flat()) {
    if (!iface || iface.family !== 'IPv4' || iface.internal) continue;
    if (iface.address.startsWith('10.5.') || iface.address.startsWith('172.1')) continue;
    const parts = iface.address.split('.').map(Number);
    const mask = iface.netmask.split('.').map(Number);
    const bcast = parts.map((p, i) => (p & mask[i]) | (~mask[i] & 255)).join('.');
    set.add(bcast);
  }
  return [...set];
}

function lanSubnets() {
  const set = new Set();
  for (const iface of Object.values(os.networkInterfaces()).flat()) {
    if (!iface || iface.family !== 'IPv4' || iface.internal) continue;
    if (iface.address.startsWith('10.5.') || iface.address.startsWith('172.1')) continue;
    const parts = iface.address.split('.');
    if (parts.length !== 4) continue;
    set.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
  }
  return [...set];
}

function tcpOpen(host, port, timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function scanLanForYeelight() {
  const found = new Map();
  const subnets = lanSubnets();
  const hosts = [];
  for (const prefix of subnets) {
    for (let i = 1; i <= 254; i++) hosts.push(`${prefix}.${i}`);
  }

  const CONCURRENCY = 64;
  for (let i = 0; i < hosts.length; i += CONCURRENCY) {
    const batch = hosts.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (host) => {
        const open = await tcpOpen(host, PORT, 280);
        if (!open) return;
        try {
          const status = await probeHost(host);
          found.set(host, {
            host,
            port: PORT,
            name: status.name,
            model: status.model,
            power: status.on ? 'on' : 'off',
            via: 'tcp-scan',
          });
        } catch {
          /* pas un Yeelight utilisable */
        }
      })
    );
  }
  return found;
}

function discoverSsdp(timeoutMs = DISCOVER_MS) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const found = new Map();
    const broadcasts = lanBroadcasts();
    const msg = Buffer.from(
      [
        'M-SEARCH * HTTP/1.1',
        'HOST: 239.255.255.250:1982',
        'MAN: "ssdp:discover"',
        'ST: wifi_bulb',
        '',
        '',
      ].join('\r\n')
    );

    const done = () => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolve({ found, broadcasts });
    };

    const timer = setTimeout(done, timeoutMs);

    socket.on('message', (buf, rinfo) => {
      const text = buf.toString('utf8');
      if (!/yeelight:\/\//i.test(text) && !/wifi_bulb/i.test(text)) return;
      const loc = text.match(/Location:\s*yeelight:\/\/([^:\r\n]+):(\d+)/i);
      const host = loc?.[1] || rinfo.address;
      const port = Number(loc?.[2] || PORT);
      const name = text.match(/name:\s*(.+)/i)?.[1]?.trim() || null;
      const model = text.match(/model:\s*(.+)/i)?.[1]?.trim() || null;
      const power = text.match(/power:\s*(.+)/i)?.[1]?.trim() || null;
      found.set(host, { host, port, name, model, power, via: 'ssdp' });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      done();
    });

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
      } catch {
        /* ignore */
      }
      try {
        socket.addMembership('239.255.255.250');
      } catch {
        /* ignore */
      }
      const sendAll = () => {
        for (const bcast of broadcasts) {
          socket.send(msg, 0, msg.length, 1982, bcast);
        }
        socket.send(msg, 0, msg.length, 1982, '239.255.255.250');
      };
      sendAll();
      setTimeout(sendAll, 800);
      setTimeout(sendAll, 1600);
    });
  });
}

export async function discoverStrips(timeoutMs = DISCOVER_MS) {
  const { found, broadcasts } = await discoverSsdp(timeoutMs);

  let method = 'ssdp';
  if (found.size === 0) {
    method = 'tcp-scan';
    const scanned = await scanLanForYeelight();
    for (const [host, meta] of scanned) found.set(host, meta);
  }

  return {
    devices: [...found.values()].sort((a, b) => a.host.localeCompare(b.host)),
    broadcastsTried: broadcasts,
    subnetsScanned: method === 'tcp-scan' ? lanSubnets() : [],
    method,
    hint:
      found.size === 0
        ? 'Aucun ruban trouvé. 1) App Yeelight → appareil → activer « Contrôle LAN ». 2) Coupez le VPN. 3) Sinon : curl "http://localhost:4000/api/yeelight/probe?host=192.168.1.XX"'
        : 'Ajoutez dans .env : YEELIGHT_DEVICES=yeelight-tv:IP1,yeelight-sejour:IP2 puis relancez le serveur.',
  };
}
