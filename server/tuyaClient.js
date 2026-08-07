// Client Tuya Cloud OpenAPI — auth HMAC-SHA256 + contrôle clim DrPrepare.
// Docs : https://developer.tuya.com/en/docs/iot/new-singnature

import 'dotenv/config';
import crypto from 'node:crypto';

const env = (key, fallback = '') => (process.env[key] ?? fallback).trim();

const ACCESS_ID = () => env('TUYA_ACCESS_ID');
const ACCESS_SECRET = () => env('TUYA_ACCESS_SECRET');
const DEVICE_ID = () => env('TUYA_DEVICE_ID');
const BASE_URL = () => env('TUYA_BASE_URL', 'https://openapi.tuyaeu.com').replace(/\/$/, '');

export class TuyaUnavailableError extends Error {
  constructor(message, { status, rateLimited = false } = {}) {
    super(message);
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

function assertConfig() {
  if (!ACCESS_ID()) throw new TuyaUnavailableError('TUYA_ACCESS_ID non défini dans .env');
  if (!ACCESS_SECRET()) throw new TuyaUnavailableError('TUYA_ACCESS_SECRET non défini dans .env');
}

function assertDevice() {
  assertConfig();
  if (!DEVICE_ID()) throw new TuyaUnavailableError('TUYA_DEVICE_ID non défini dans .env');
}

// ── Signature HMAC-SHA256 ────────────────────────────────────────────────────

function sha256Hex(body) {
  return crypto.createHash('sha256').update(body ?? '', 'utf8').digest('hex');
}

function hmacSha256Upper(message, secret) {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex').toUpperCase();
}

/**
 * stringToSign = METHOD + \\n + Content-SHA256 + \\n + Headers + \\n + URL
 * Headers optionnels laissés vides → ligne blanche entre SHA256 et URL.
 */
function buildStringToSign(method, pathWithQuery, body = '') {
  return `${method}\n${sha256Hex(body)}\n\n${pathWithQuery}`;
}

function signTokenRequest(t, pathWithQuery) {
  const stringToSign = buildStringToSign('GET', pathWithQuery);
  return hmacSha256Upper(`${ACCESS_ID()}${t}${stringToSign}`, ACCESS_SECRET());
}

function signBusinessRequest(method, pathWithQuery, body, t, accessToken) {
  const stringToSign = buildStringToSign(method, pathWithQuery, body);
  return hmacSha256Upper(
    `${ACCESS_ID()}${accessToken}${t}${stringToSign}`,
    ACCESS_SECRET()
  );
}

// ── Token cache (mémoire, ~2 h côté Tuya) ────────────────────────────────────

let cachedToken = null;
let tokenExpiresAt = 0;

async function parseTuyaResponse(res) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new TuyaUnavailableError(`Réponse Tuya vide (HTTP ${res.status})`, {
      status: res.status,
    });
  }
  if (trimmed.startsWith('<') || res.status === 412) {
    throw new TuyaUnavailableError(
      'Tuya a bloqué la requête (412 security risk control) — trop d’appels depuis ce réseau. Attends 10–30 min puis réessaie.',
      { status: res.status, rateLimited: true }
    );
  }
  let json;
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new TuyaUnavailableError(
      `Réponse Tuya non-JSON (HTTP ${res.status}) : ${trimmed.slice(0, 120)}`,
      { status: res.status }
    );
  }
  return json;
}

async function fetchAccessToken() {
  assertConfig();
  const pathWithQuery = '/v1.0/token?grant_type=1';
  const t = String(Date.now());
  const sign = signTokenRequest(t, pathWithQuery);

  let res;
  try {
    res = await fetch(`${BASE_URL()}${pathWithQuery}`, {
      method: 'GET',
      headers: {
        client_id: ACCESS_ID(),
        sign,
        sign_method: 'HMAC-SHA256',
        t,
      },
    });
  } catch (err) {
    throw new TuyaUnavailableError(`Tuya injoignable (${err.message})`);
  }

  const json = await parseTuyaResponse(res);
  if (!json.success) {
    throw new TuyaUnavailableError(
      `Token Tuya refusé : ${json.msg || json.code || res.status}`,
      { status: res.status }
    );
  }

  cachedToken = json.result.access_token;
  // expire_time est en secondes ; on garde une marge de 60 s
  tokenExpiresAt = Date.now() + (json.result.expire_time - 60) * 1000;
  return cachedToken;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  return fetchAccessToken();
}

// ── Requête métier générique ─────────────────────────────────────────────────

async function tuyaRequest(method, pathWithQuery, bodyObj = null, { retried = false } = {}) {
  assertConfig();
  const accessToken = await getAccessToken();
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  const t = String(Date.now());
  const sign = signBusinessRequest(method, pathWithQuery, body, t, accessToken);

  const headers = {
    client_id: ACCESS_ID(),
    access_token: accessToken,
    sign,
    sign_method: 'HMAC-SHA256',
    t,
    'Content-Type': 'application/json',
  };

  let res;
  try {
    res = await fetch(`${BASE_URL()}${pathWithQuery}`, {
      method,
      headers,
      body: body || undefined,
    });
  } catch (err) {
    throw new TuyaUnavailableError(`Tuya injoignable (${err.message})`);
  }

  const json = await parseTuyaResponse(res);
  if (!json.success) {
    // Token expiré / invalide → un seul retry après refresh
    if (!retried && (json.code === 1010 || json.code === 1011)) {
      cachedToken = null;
      tokenExpiresAt = 0;
      return tuyaRequest(method, pathWithQuery, bodyObj, { retried: true });
    }
    throw new TuyaUnavailableError(
      `Tuya API ${json.code ?? res.status} : ${json.msg || 'erreur inconnue'}`,
      { status: res.status }
    );
  }
  return json.result;
}

// ── Mapping Orion ↔ codes DP Tuya (clim / contrôleur KT) ─────────────────────
// Les codes exacts varient selon le firmware DrPrepare. Surchargeables via .env.

const MODE_TO_TUYA = { cool: 'cold', fan: 'wind', dry: 'wet' };
const MODE_FROM_TUYA = { cold: 'cool', wind: 'fan', wet: 'dry', hot: 'cool', auto: 'cool' };

const FAN_TO_TUYA = {
  1: process.env.TUYA_FAN_1 || 'low',
  2: process.env.TUYA_FAN_2 || 'mid',
  3: process.env.TUYA_FAN_3 || 'high',
};
const FAN_FROM_TUYA = Object.fromEntries(
  Object.entries(FAN_TO_TUYA).map(([k, v]) => [String(v).toLowerCase(), Number(k)])
);
// Variantes fréquentes (level_N / chiffres)
FAN_FROM_TUYA.level_1 = 1;
FAN_FROM_TUYA.level_2 = 2;
FAN_FROM_TUYA.level_3 = 3;
FAN_FROM_TUYA['1'] = 1;
FAN_FROM_TUYA['2'] = 2;
FAN_FROM_TUYA['3'] = 3;

function dp(codeEnv, fallback) {
  return process.env[codeEnv] || fallback;
}

function statusToMap(statusList) {
  const map = {};
  for (const item of statusList || []) {
    if (item?.code != null) map[item.code] = item.value;
  }
  return map;
}

/** Transforme le status brut Tuya en état Orion { on, targetTemp, currentTemp, mode, fanSpeed }. */
export function mapStatusToOrion(statusList) {
  const s = statusToMap(statusList);
  const switchCode = dp('TUYA_DP_SWITCH', 'switch');
  const tempSetCode = dp('TUYA_DP_TEMP_SET', 'temp_set');
  const tempCurCode = dp('TUYA_DP_TEMP_CURRENT', 'temp_current');
  const modeCode = dp('TUYA_DP_MODE', 'mode');
  const fanCode = dp('TUYA_DP_FAN', 'fan_speed_enum');

  const modeRaw = s[modeCode];
  const fanRaw = s[fanCode] ?? s.windspeed ?? s.fan_speed_enum;

  return {
    on: s[switchCode] ?? s.switch ?? s.Power ?? null,
    targetTemp: s[tempSetCode] ?? s.temp_set ?? null,
    currentTemp: s[tempCurCode] ?? s.temp_current ?? null,
    mode: modeRaw != null ? MODE_FROM_TUYA[String(modeRaw).toLowerCase()] ?? null : null,
    fanSpeed: fanRaw != null ? FAN_FROM_TUYA[String(fanRaw).toLowerCase()] ?? null : null,
    raw: s,
  };
}

/** Construit la liste de commandes Tuya à partir d'un patch Orion. */
export function buildCommands(patch) {
  const commands = [];
  if ('on' in patch && patch.on != null) {
    commands.push({ code: dp('TUYA_DP_SWITCH', 'switch'), value: Boolean(patch.on) });
  }
  if ('targetTemp' in patch && patch.targetTemp != null) {
    commands.push({
      code: dp('TUYA_DP_TEMP_SET', 'temp_set'),
      value: Math.round(Number(patch.targetTemp)),
    });
  }
  if ('mode' in patch && patch.mode != null) {
    const tuyaMode = MODE_TO_TUYA[patch.mode] ?? patch.mode;
    commands.push({ code: dp('TUYA_DP_MODE', 'mode'), value: tuyaMode });
  }
  if ('fanSpeed' in patch && patch.fanSpeed != null) {
    const speed = clampFan(patch.fanSpeed);
    commands.push({
      code: dp('TUYA_DP_FAN', 'fan_speed_enum'),
      value: FAN_TO_TUYA[speed],
    });
  }
  return commands;
}

function clampFan(n) {
  return Math.min(3, Math.max(1, Math.round(Number(n))));
}

// ── API publique ─────────────────────────────────────────────────────────────

export function isTuyaConfigured() {
  return Boolean(ACCESS_ID() && ACCESS_SECRET() && DEVICE_ID());
}

/** Statut normalisé de la clim (deviceId optionnel, sinon TUYA_DEVICE_ID). */
export async function getDeviceStatus(deviceId = DEVICE_ID()) {
  assertDevice();
  const id = deviceId || DEVICE_ID();
  const result = await tuyaRequest('GET', `/v1.0/devices/${id}/status`);
  return mapStatusToOrion(result);
}

/** Spécifications / codes DP du device (pour calibrer le mapping). */
export async function getDeviceSpecification(deviceId = DEVICE_ID()) {
  assertDevice();
  const id = deviceId || DEVICE_ID();
  return tuyaRequest('GET', `/v1.0/devices/${id}/specification`);
}

/** Détail device (nom, online, product…). */
export async function getDeviceDetail(deviceId = DEVICE_ID()) {
  assertDevice();
  const id = deviceId || DEVICE_ID();
  return tuyaRequest('GET', `/v1.0/devices/${id}`);
}

/**
 * Envoie un patch Orion { on?, targetTemp?, mode?, fanSpeed? } à la clim.
 * Renvoie le résultat brut Tuya.
 */
export async function sendClimateCommands(patch, deviceId = DEVICE_ID()) {
  assertDevice();
  const id = deviceId || DEVICE_ID();
  const commands = buildCommands(patch);
  if (!commands.length) {
    throw new TuyaUnavailableError('Aucune commande Tuya à envoyer (patch vide)');
  }
  return tuyaRequest('POST', `/v1.0/devices/${id}/commands`, { commands });
}
