// Serveur Express proxy : Netatmo + Hue + Tuya + Kasa + Yeelight + Alexa.
// Les clés API restent côté serveur, le frontend n'appelle que /api/*.

import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getIndoorOutdoorTemperatures } from './netatmoClient.js';
import { getLights, setLightState, pairBridge, HueUnavailableError } from './hueClient.js';
import {
  getDeviceStatus,
  getDeviceSpecification,
  getDeviceDetail,
  sendClimateCommands,
  isTuyaConfigured,
  TuyaUnavailableError,
} from './tuyaClient.js';
import {
  getPlugStatus,
  getAllPlugStatuses,
  setPlugPower,
  discoverPlugs,
  probeHost,
  isKasaConfigured,
  KasaUnavailableError,
} from './kasaClient.js';
import {
  getStripStatus,
  getAllStripStatuses,
  setStripState,
  discoverStrips,
  probeHost as probeYeelightHost,
  isYeelightConfigured,
  YeelightUnavailableError,
} from './yeelightClient.js';
import {
  ensureAlexa,
  getAlexaStatus,
  listEchoDevices,
  getMappedStatuses,
  setDeviceState as setAlexaDeviceState,
  isAlexaConfigured,
  AlexaUnavailableError,
} from './alexaClient.js';

const app = express();
app.use(express.json());
const PORT = Number(process.env.PORT || process.env.NETATMO_PROXY_PORT || 4000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

// Petit cache mémoire pour éviter de spammer l'API Netatmo si le frontend
// recharge la page plusieurs fois d'affilée (Netatmo ne rafraîchit ses capteurs
// que toutes les ~5-10 minutes de toute façon).
let lastPayload = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60_000;

app.get('/api/netatmo', async (_req, res) => {
  const now = Date.now();
  if (lastPayload && now - lastFetchedAt < CACHE_TTL_MS) {
    return res.json(lastPayload);
  }

  try {
    const data = await getIndoorOutdoorTemperatures();
    lastPayload = data;
    lastFetchedAt = now;
    res.json(data);
  } catch (err) {
    console.error('[netatmo]', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ── Philips Hue ─────────────────────────────────────────────────────────────

/** GET /api/hue/lights — liste tous les luminaires du bridge (utile pour récupérer les IDs). */
app.get('/api/hue/lights', async (_req, res) => {
  try {
    const lights = await getLights();
    res.json(lights);
  } catch (err) {
    const status = err instanceof HueUnavailableError ? 503 : 502;
    console.error('[hue]', err.message);
    res.status(status).json({ error: err.message });
  }
});

/** PUT /api/hue/lights/:id — contrôle l'état d'un luminaire.
 *  Body : { on?, bri?, hue?, sat?, ct?, xy? } */
app.put('/api/hue/lights/:id', async (req, res) => {
  try {
    const result = await setLightState(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    const status = err instanceof HueUnavailableError ? 503 : 502;
    console.error('[hue]', err.message);
    res.status(status).json({ error: err.message });
  }
});

/** POST /api/hue/pair — appuyer sur le bouton du bridge AVANT d'appeler cette route.
 *  Renvoie { username } à copier dans HUE_API_KEY du .env. */
app.post('/api/hue/pair', async (_req, res) => {
  try {
    const result = await pairBridge();
    res.json(result);
  } catch (err) {
    const status = err instanceof HueUnavailableError ? 503 : 502;
    console.error('[hue]', err.message);
    res.status(status).json({ error: err.message });
  }
});

// ── Tuya / Clim DrPrepare ────────────────────────────────────────────────────

/** GET /api/tuya/status — état normalisé de la clim (on, temp, mode, fan). */
app.get('/api/tuya/status', async (_req, res) => {
  try {
    const status = await getDeviceStatus();
    res.json(status);
  } catch (err) {
    const code = err instanceof TuyaUnavailableError ? 503 : 502;
    console.error('[tuya]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** GET /api/tuya/device — détail + specs DP (utile pour calibrer le mapping). */
app.get('/api/tuya/device', async (_req, res) => {
  try {
    const [detail, specification] = await Promise.all([
      getDeviceDetail(),
      getDeviceSpecification().catch((e) => ({ error: e.message })),
    ]);
    res.json({ detail, specification });
  } catch (err) {
    const code = err instanceof TuyaUnavailableError ? 503 : 502;
    console.error('[tuya]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** PUT /api/tuya/control — Body : { on?, targetTemp?, mode?, fanSpeed? }. */
app.put('/api/tuya/control', async (req, res) => {
  try {
    const result = await sendClimateCommands(req.body ?? {});
    res.json({ ok: true, result });
  } catch (err) {
    const code = err instanceof TuyaUnavailableError ? 503 : 502;
    console.error('[tuya]', err.message);
    res.status(code).json({ error: err.message });
  }
});

// ── TP-Link Kasa (prises locales) ────────────────────────────────────────────

/** GET /api/kasa/devices — statut de toutes les prises listées dans KASA_DEVICES. */
app.get('/api/kasa/devices', async (_req, res) => {
  try {
    if (!isKasaConfigured()) {
      return res.status(503).json({
        error: 'KASA_DEVICES manquant dans .env (ex. tplink-verres:192.168.1.50)',
      });
    }
    const devices = await getAllPlugStatuses();
    res.json(devices);
  } catch (err) {
    const code = err instanceof KasaUnavailableError ? 503 : 502;
    console.error('[kasa]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** GET /api/kasa/devices/:id — statut d'une prise (id Orion, ex. tplink-verres). */
app.get('/api/kasa/devices/:id', async (req, res) => {
  try {
    const status = await getPlugStatus(req.params.id);
    res.json(status);
  } catch (err) {
    const code = err instanceof KasaUnavailableError ? 503 : 502;
    console.error('[kasa]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** PUT /api/kasa/devices/:id — Body : { on: boolean }. */
app.put('/api/kasa/devices/:id', async (req, res) => {
  try {
    if (typeof req.body?.on !== 'boolean') {
      return res.status(400).json({ error: 'Body attendu : { on: true|false }' });
    }
    const result = await setPlugPower(req.params.id, req.body.on);
    res.json(result);
  } catch (err) {
    const code = err instanceof KasaUnavailableError ? 503 : 502;
    console.error('[kasa]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/**
 * GET /api/kasa/discover — scan UDP ~8 s sur les broadcasts LAN (ex. 192.168.1.255).
 * Renvoie { devices, broadcastsTried, hint }.
 */
app.get('/api/kasa/discover', async (_req, res) => {
  try {
    const result = await discoverPlugs(8000);
    res.json(result);
  } catch (err) {
    console.error('[kasa]', err.message);
    res.status(502).json({ error: err.message });
  }
});

/** GET /api/kasa/probe?host=192.168.1.50 — teste une IP sans discovery. */
app.get('/api/kasa/probe', async (req, res) => {
  try {
    const status = await probeHost(String(req.query.host || ''));
    res.json(status);
  } catch (err) {
    const code = err instanceof KasaUnavailableError ? 503 : 502;
    console.error('[kasa]', err.message);
    res.status(code).json({ error: err.message });
  }
});

// ── Yeelight (rubans LED LAN) ────────────────────────────────────────────────

/** GET /api/yeelight/devices — statut de tous les rubans listés dans YEELIGHT_DEVICES. */
app.get('/api/yeelight/devices', async (_req, res) => {
  try {
    if (!isYeelightConfigured()) {
      return res.status(503).json({
        error: 'YEELIGHT_DEVICES manquant dans .env (ex. yeelight-tv:192.168.1.60)',
      });
    }
    const devices = await getAllStripStatuses();
    res.json(devices);
  } catch (err) {
    const code = err instanceof YeelightUnavailableError ? 503 : 502;
    console.error('[yeelight]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** GET /api/yeelight/devices/:id — statut d'un ruban (id Orion). */
app.get('/api/yeelight/devices/:id', async (req, res) => {
  try {
    const status = await getStripStatus(req.params.id);
    res.json(status);
  } catch (err) {
    const code = err instanceof YeelightUnavailableError ? 503 : 502;
    console.error('[yeelight]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** PUT /api/yeelight/devices/:id — Body : { on?, brightness?, color? }. */
app.put('/api/yeelight/devices/:id', async (req, res) => {
  try {
    const result = await setStripState(req.params.id, req.body ?? {});
    res.json(result);
  } catch (err) {
    const code = err instanceof YeelightUnavailableError ? 503 : 502;
    console.error('[yeelight]', err.message);
    res.status(code).json({ error: err.message });
  }
});

/** GET /api/yeelight/discover — SSDP puis scan TCP port 55443 (peut prendre ~10-20 s). */
app.get('/api/yeelight/discover', async (_req, res) => {
  try {
    const result = await discoverStrips(4000);
    res.json(result);
  } catch (err) {
    console.error('[yeelight]', err.message);
    res.status(502).json({ error: err.message });
  }
});

/** GET /api/yeelight/probe?host=192.168.1.60 — teste une IP sans discovery. */
app.get('/api/yeelight/probe', async (req, res) => {
  try {
    const status = await probeYeelightHost(String(req.query.host || ''));
    res.json(status);
  } catch (err) {
    const code = err instanceof YeelightUnavailableError ? 503 : 502;
    console.error('[yeelight]', err.message);
    res.status(code).json({ error: err.message });
  }
});

// ── Amazon Alexa (API non officielle) ────────────────────────────────────────

/** GET /api/alexa/status — session / URL d'auth proxy. */
app.get('/api/alexa/status', (_req, res) => {
  res.json(getAlexaStatus());
});

/** GET /api/alexa/echoes — liste tous les Echo (noms + serials) pour le mapping .env. */
app.get('/api/alexa/echoes', async (_req, res) => {
  try {
    const echoes = await listEchoDevices();
    res.json({ devices: echoes });
  } catch (err) {
    const code = err instanceof AlexaUnavailableError ? 503 : 502;
    console.error('[alexa]', err.message);
    res.status(code).json({ error: err.message, ...getAlexaStatus() });
  }
});

/** GET /api/alexa/devices — statuts des appareils mappés dans ALEXA_DEVICES. */
app.get('/api/alexa/devices', async (_req, res) => {
  try {
    const devices = await getMappedStatuses();
    res.json(devices);
  } catch (err) {
    const code = err instanceof AlexaUnavailableError ? 503 : 502;
    console.error('[alexa]', err.message);
    res.status(code).json({ error: err.message, ...getAlexaStatus() });
  }
});

/**
 * PUT /api/alexa/devices/:id — Body : { volume?, on?, speak?, stop? }
 * on:false = Ne pas déranger ; speak = TTS ; stop = coupe la lecture.
 */
app.put('/api/alexa/devices/:id', async (req, res) => {
  try {
    const result = await setAlexaDeviceState(req.params.id, req.body ?? {});
    res.json(result);
  } catch (err) {
    const code = err instanceof AlexaUnavailableError ? 503 : 502;
    console.error('[alexa]', err.message);
    res.status(code).json({ error: err.message });
  }
});

// ── Santé ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// En production (Docker / npm run build), Express sert le frontend Vite.
if (existsSync(distPath)) {
  app.use(express.static(distPath, { index: false }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[orion-server] À l'écoute sur http://0.0.0.0:${PORT}`);
  if (existsSync(distPath)) {
    console.log(`[orion-server] Frontend servi depuis ${distPath}`);
  }
  if (!process.env.HUE_BRIDGE_IP || !process.env.HUE_API_KEY) {
    console.warn('[hue] HUE_BRIDGE_IP ou HUE_API_KEY manquant dans .env — Hue désactivé');
  }
  if (!isTuyaConfigured()) {
    console.warn(
      '[tuya] TUYA_ACCESS_ID / TUYA_ACCESS_SECRET / TUYA_DEVICE_ID manquants — clim DrPrepare simulée'
    );
  }
  if (!isKasaConfigured()) {
    console.warn(
      '[kasa] KASA_DEVICES manquant — prises TP-Link simulées (ex. tplink-verres:192.168.1.50)'
    );
  }
  if (!isYeelightConfigured()) {
    console.warn(
      '[yeelight] YEELIGHT_DEVICES manquant — rubans simulés (ex. yeelight-tv:192.168.1.60)'
    );
  }
  if (!isAlexaConfigured()) {
    console.warn(
      '[alexa] Pas de cookie / ALEXA_DEVICES — lance npm run alexa:auth puis mappe les serials'
    );
  } else {
    ensureAlexa().catch(() => {});
  }
});
