// Client Amazon Alexa (API non officielle via alexa-remote2).
// Auth cookie persistée dans server/.alexa-cookie.json (npm run alexa:auth).
// Mapping Orion → serial : ALEXA_DEVICES=alexa-salon:G090XXXX,...

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { exec } from 'node:child_process';

const require = createRequire(import.meta.url);
const AlexaRemote = require('alexa-remote2');
const alexaCookie = require('alexa-cookie2');

function isWaitingForBrowserLogin(err) {
  const msg = err?.message || String(err || '');
  return /Please open http/i.test(msg);
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.ORION_DATA_DIR || __dirname;
const COOKIE_PATH = path.join(dataDir, '.alexa-cookie.json');

export class AlexaUnavailableError extends Error {}

let alexa = null;
let ready = false;
let initPromise = null;
let lastError = null;
let authUrl = null;

function cb(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, body) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve(body);
    });
  });
}

function readCookieData() {
  try {
    if (!fs.existsSync(COOKIE_PATH)) return null;
    return JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeCookieData(data) {
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/** Mapping id Orion → serial Echo. */
export function getDeviceMap() {
  const raw = process.env.ALEXA_DEVICES || '';
  const map = new Map();
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const id = part.slice(0, idx).trim();
    const serial = part.slice(idx + 1).trim();
    if (id && serial) map.set(id, serial);
  }
  return map;
}

export function isAlexaConfigured() {
  return Boolean(readCookieData() || process.env.ALEXA_DEVICES?.trim());
}

export function getAlexaStatus() {
  return {
    ready,
    authUrl,
    cookieFile: COOKIE_PATH,
    hasCookie: Boolean(readCookieData()),
    mapped: [...getDeviceMap().keys()],
    error: lastError,
    amazonPage: process.env.ALEXA_AMAZON_PAGE || 'amazon.fr',
  };
}

function buildInitOptions({ forceProxy = false } = {}) {
  const cookieData = forceProxy ? null : readCookieData();
  const proxyOwnIp = process.env.ALEXA_PROXY_OWN_IP || '127.0.0.1';
  const proxyPort = Number(process.env.ALEXA_PROXY_PORT || 3001);
  const amazonPage = process.env.ALEXA_AMAZON_PAGE || 'amazon.fr';
  const alexaServiceHost = process.env.ALEXA_SERVICE_HOST || 'alexa.amazon.fr';

  authUrl = `http://${proxyOwnIp}:${proxyPort}/`;

  const options = {
    proxyOnly: true,
    proxyOwnIp,
    proxyPort,
    proxyLogLevel: process.env.ALEXA_PROXY_LOG || 'warn',
    bluetooth: false,
    useWsMqtt: false,
    usePushConnection: false,
    amazonPage,
    alexaServiceHost,
    acceptLanguage: process.env.ALEXA_ACCEPT_LANGUAGE || 'fr-FR',
    cookieRefreshInterval: 4 * 24 * 60 * 60 * 1000,
    logger: (msg) => {
      if (String(msg).includes('Error') || process.env.ALEXA_DEBUG === '1') {
        console.log('[alexa]', msg);
      }
    },
  };

  if (cookieData) {
    // cookieData complet permet le refresh automatique du cookie
    options.cookie = cookieData;
    if (cookieData.formerRegistrationData || cookieData.refreshToken) {
      options.formerRegistrationData = cookieData.formerRegistrationData || cookieData;
    }
    if (cookieData.macDms) options.macDms = cookieData.macDms;
  }

  return options;
}

function attachCookiePersistence(instance) {
  instance.on('cookie', () => {
    try {
      if (instance.cookieData) {
        writeCookieData(instance.cookieData);
        console.log('[alexa] Cookie Amazon sauvegardé →', COOKIE_PATH);
      }
    } catch (err) {
      console.error('[alexa] Impossible de sauver le cookie:', err.message);
    }
  });
}

/**
 * Initialise la session Alexa (cookie existant ou proxy de login).
 *
 * Important : alexa-cookie2 appelle d'abord le callback avec
 * « Please open http://… » (proxy prêt) — ce n'est PAS un échec.
 * Le vrai succès arrive après le login navigateur.
 */
export function ensureAlexa({ forceProxy = false } = {}) {
  if (initPromise && !forceProxy) return initPromise;

  lastError = null;
  ready = false;
  alexa = new AlexaRemote();
  attachCookiePersistence(alexa);

  const options = buildInitOptions({ forceProxy });
  if (!readCookieData() || forceProxy) {
    console.warn(
      `[alexa] Auth requise — ouvre ${authUrl} (PC sans app Alexa), connecte-toi à Amazon`
    );
  }

  initPromise = new Promise((resolve, reject) => {
    let settled = false;
    alexa.init(options, (err) => {
      if (err) {
        if (isWaitingForBrowserLogin(err)) {
          lastError = `En attente du login Amazon — ${authUrl}`;
          console.warn(`[alexa] ${lastError}`);
          console.warn('[alexa] Laisse ce terminal ouvert et connecte-toi dans le navigateur…');
          return; // le callback sera rappelé après login
        }
        if (settled) return;
        settled = true;
        ready = false;
        lastError = err.message || String(err);
        console.error('[alexa] Init échouée:', lastError);
        reject(new AlexaUnavailableError(lastError));
        return;
      }
      if (settled) return;
      settled = true;
      ready = true;
      lastError = null;
      console.log('[alexa] Session prête');
      resolve(alexa);
    });
  });

  // Évite un unhandled rejection si personne n'attend encore
  initPromise.catch(() => {});
  return initPromise;
}

/** Réinitialise la session (ex. après échec auth). */
export function resetAlexaSession() {
  initPromise = null;
  ready = false;
  alexa = null;
}

async function getClient() {
  if (ready && alexa) return alexa;
  try {
    await ensureAlexa();
  } catch (err) {
    throw new AlexaUnavailableError(
      err.message + (authUrl ? ` — Auth: ${authUrl}` : '')
    );
  }
  if (!ready || !alexa) {
    throw new AlexaUnavailableError(
      `Session Alexa non prête. Ouvre ${authUrl} pour te connecter (ou npm run alexa:auth).`
    );
  }
  return alexa;
}

function resolveSerial(orionId) {
  const serial = getDeviceMap().get(orionId);
  if (!serial) {
    throw new AlexaUnavailableError(
      `Pas de serial pour « ${orionId} ». Ajoute-le dans ALEXA_DEVICES (ex. ${orionId}:G090…).`
    );
  }
  return serial;
}

function extractVolume(playerInfo) {
  if (!playerInfo || typeof playerInfo !== 'object') return null;
  const v =
    playerInfo?.volume?.volume ??
    playerInfo?.playerInfo?.volume?.volume ??
    playerInfo?.volume ??
    null;
  if (v == null || Number.isNaN(Number(v))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(v))));
}

function parseDndList(body) {
  const list =
    body?.doNotDisturbDeviceStatusList ||
    body?.deviceStatusList ||
    [];
  const map = new Map();
  for (const item of list) {
    if (item?.deviceSerialNumber != null) {
      map.set(item.deviceSerialNumber, Boolean(item.enabled));
    }
  }
  return map;
}

/** Liste tous les Echo/appareils contrôlables (pour mapper les serials). */
export async function listEchoDevices() {
  const client = await getClient();
  const arr = Object.values(client.serialNumbers || {});
  return arr
    .filter((d) => d && (d.isControllable || d.deviceFamily === 'ECHO' || d.hasMusicPlayer))
    .map((d) => ({
      serialNumber: d.serialNumber,
      accountName: d.accountName,
      deviceFamily: d.deviceFamily,
      deviceType: d.deviceType,
      online: Boolean(d.online),
      isControllable: Boolean(d.isControllable),
      hasMusicPlayer: Boolean(d.hasMusicPlayer),
    }));
}

/** Statuts des appareils mappés dans ALEXA_DEVICES. */
export async function getMappedStatuses() {
  const client = await getClient();
  const map = getDeviceMap();
  if (!map.size) {
    throw new AlexaUnavailableError(
      'ALEXA_DEVICES manquant — ex. alexa-salon:G090XXXX,alexa-cuisine:G090YYYY'
    );
  }

  let dndMap = new Map();
  try {
    const dndBody = await cb(client.getDoNotDisturb.bind(client));
    dndMap = parseDndList(dndBody);
  } catch (err) {
    console.warn('[alexa] DND list:', err.message);
  }

  const results = [];
  for (const [id, serial] of map) {
    const dev = client.find(serial);
    if (!dev) {
      results.push({ id, serial, error: 'Appareil inconnu (serial invalide?)' });
      continue;
    }

    let volume = null;
    try {
      const player = await cb(client.getPlayerInfo.bind(client), serial);
      volume = extractVolume(player);
    } catch {
      // pas de lecture en cours — volume inconnu
    }

    const dnd = dndMap.has(serial) ? dndMap.get(serial) : false;
    results.push({
      id,
      serial,
      name: dev.accountName,
      online: Boolean(dev.online),
      // on = « Active » (pas en Ne pas déranger)
      on: !dnd,
      dnd,
      volume,
      error: null,
    });
  }
  return results;
}

/**
 * Contrôle un Echo mappé.
 * patch : { volume?, on? (false = DND), speak?, stop? }
 */
export async function setDeviceState(orionId, patch = {}) {
  const client = await getClient();
  const serial = resolveSerial(orionId);
  const dev = client.find(serial);
  if (!dev) throw new AlexaUnavailableError(`Echo introuvable: ${serial}`);

  if (typeof patch.volume === 'number') {
    const vol = Math.max(0, Math.min(100, Math.round(patch.volume)));
    await cb(client.sendSequenceCommand.bind(client), serial, 'volume', vol);
  }

  if (typeof patch.on === 'boolean') {
    // Active ↔ DND désactivé ; Muet ↔ Ne pas déranger
    await cb(client.setDoNotDisturb.bind(client), serial, !patch.on);
  }

  if (patch.stop) {
    await cb(client.sendSequenceCommand.bind(client), serial, 'deviceStop', true);
  }

  if (typeof patch.speak === 'string' && patch.speak.trim()) {
    await cb(client.sendSequenceCommand.bind(client), serial, 'speak', patch.speak.trim());
  }

  // Relire un état synthétique
  let volume = typeof patch.volume === 'number' ? patch.volume : null;
  if (volume == null) {
    try {
      const player = await cb(client.getPlayerInfo.bind(client), serial);
      volume = extractVolume(player);
    } catch {
      /* ignore */
    }
  }

  let on = typeof patch.on === 'boolean' ? patch.on : null;
  if (on == null) {
    try {
      const dndBody = await cb(client.getDoNotDisturb.bind(client));
      const dnd = parseDndList(dndBody).get(serial);
      if (dnd != null) on = !dnd;
    } catch {
      /* ignore */
    }
  }

  return {
    id: orionId,
    serial,
    online: Boolean(dev.online),
    on,
    volume,
  };
}

/**
 * Auth dédiée via alexa-cookie2 (proxy navigateur).
 * Le message « Please open http://… » est normal : on attend ensuite le cookie.
 */
export function runAuthProxy() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(COOKIE_PATH)) {
      fs.unlinkSync(COOKIE_PATH);
      console.log('[alexa] Ancien cookie supprimé');
    }

    const proxyOwnIp = process.env.ALEXA_PROXY_OWN_IP || '127.0.0.1';
    const proxyPort = Number(process.env.ALEXA_PROXY_PORT || 3001);
    const amazonPage = process.env.ALEXA_AMAZON_PAGE || 'amazon.fr';
    authUrl = `http://${proxyOwnIp}:${proxyPort}/`;

    console.log('\nOrion · Autorisation Amazon Alexa');
    console.log('─────────────────────────────────');
    console.log(`1. Un navigateur va s’ouvrir sur ${authUrl}`);
    console.log('2. Connecte-toi avec ton compte Amazon');
    console.log('   (utilise un PC / navigateur SANS l’app Alexa installée)');
    console.log('3. Laisse CE terminal ouvert jusqu’au message de succès');
    console.log('4. Le cookie sera sauvé automatiquement\n');

    const options = {
      proxyOnly: true,
      setupProxy: true,
      proxyOwnIp,
      proxyPort,
      proxyListenBind: '0.0.0.0',
      proxyLogLevel: 'info',
      amazonPage,
      acceptLanguage: process.env.ALEXA_ACCEPT_LANGUAGE || 'fr-FR',
      amazonPageProxyLanguage: process.env.ALEXA_PROXY_LANGUAGE || 'fr_FR',
      // Inscription appareil : western countries → amazon.com
      baseAmazonPage: process.env.ALEXA_BASE_AMAZON_PAGE || 'amazon.com',
      logger: console.log,
    };

    let browserOpened = false;
    let done = false;

    // Signature sans email/password : (options, callback) — proxyOnly forcé
    alexaCookie.generateAlexaCookie(options, (err, result) => {
      if (err && isWaitingForBrowserLogin(err)) {
        console.log(`\n→ Ouvre ${authUrl} et connecte-toi…\n`);
        if (!browserOpened) {
          browserOpened = true;
          openBrowser(authUrl);
        }
        return; // attendre le 2ᵉ callback après login
      }

      if (done) return;

      if (err || !result) {
        done = true;
        try {
          alexaCookie.stopProxyServer();
        } catch {
          /* ignore */
        }
        reject(new Error(err?.message || 'Auth Alexa échouée (pas de cookie)'));
        return;
      }

      done = true;
      try {
        writeCookieData(result);
        console.log('\n✓ Cookie Amazon sauvegardé →', COOKIE_PATH);
        console.log('  Ensuite :');
        console.log('  1. Relance npm run dev:full');
        console.log('  2. curl http://localhost:4000/api/alexa/echoes');
        console.log('  3. Copie les serials dans ALEXA_DEVICES du .env\n');
      } catch (writeErr) {
        reject(writeErr);
        return;
      }

      try {
        alexaCookie.stopProxyServer();
      } catch {
        /* ignore */
      }
      resolve(result);
    });
  });
}
