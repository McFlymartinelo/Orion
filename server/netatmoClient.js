// Client OAuth2 + API Netatmo minimal, sans dépendance externe (fetch natif Node ≥ 18).
// Documentation API : https://dev.netatmo.com/apidocumentation/weather

import { readTokenStore, writeTokenStore } from './tokenStore.js';

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const STATIONS_URL = 'https://api.netatmo.com/api/getstationsdata';
const MEASURE_URL = 'https://api.netatmo.com/api/getmeasure';

const METRIC_CONFIG = {
  indoorTemp: { type: 'temperature', module: 'indoor', unit: '°C' },
  outdoorTemp: { type: 'temperature', module: 'outdoor', unit: '°C' },
  indoorHumidity: { type: 'humidity', module: 'indoor', unit: '%' },
  co2: { type: 'co2', module: 'indoor', unit: 'ppm' },
};

const RANGE_CONFIG = {
  '24h': { scale: '30min', hours: 24 },
  '7d': { scale: '3hours', hours: 24 * 7 },
};

// Marge de sécurité avant expiration pour éviter d'utiliser un token périmé
const EXPIRY_MARGIN_MS = 30_000;

let cache = null; // { access_token, refresh_token, expires_at }

function loadCache() {
  if (cache) return cache;
  const stored = readTokenStore();
  if (stored) {
    cache = stored;
  } else {
    const envRefreshToken = process.env.NETATMO_REFRESH_TOKEN;
    if (!envRefreshToken) {
      throw new Error(
        'Aucun refresh_token Netatmo disponible. Renseignez NETATMO_REFRESH_TOKEN dans .env ' +
          'ou lancez `npm run netatmo:auth` pour en générer un.'
      );
    }
    cache = { access_token: null, refresh_token: envRefreshToken, expires_at: 0 };
  }
  return cache;
}

async function refreshAccessToken() {
  const { client_id, client_secret } = getCredentials();
  const current = loadCache();

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: current.refresh_token,
    client_id,
    client_secret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Rafraîchissement du token Netatmo échoué (${res.status}) : ${text}`);
  }

  const json = await res.json();
  cache = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || current.refresh_token,
    expires_at: Date.now() + (json.expires_in || 10800) * 1000,
  };
  writeTokenStore(cache);
  return cache.access_token;
}

function getCredentials() {
  const client_id = process.env.NETATMO_CLIENT_ID;
  const client_secret = process.env.NETATMO_CLIENT_SECRET;
  if (!client_id || !client_secret) {
    throw new Error('NETATMO_CLIENT_ID / NETATMO_CLIENT_SECRET manquants dans .env');
  }
  return { client_id, client_secret };
}

async function getAccessToken() {
  const current = loadCache();
  if (current.access_token && current.expires_at - EXPIRY_MARGIN_MS > Date.now()) {
    return current.access_token;
  }
  return refreshAccessToken();
}

function findModule(devices, predicate) {
  for (const device of devices) {
    if (predicate(device)) return device;
    const found = (device.modules || []).find(predicate);
    if (found) return found;
  }
  return null;
}

async function fetchStationsData() {
  const token = await getAccessToken();
  const res = await fetch(STATIONS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Appel getstationsdata échoué (${res.status}) : ${text}`);
  }

  const json = await res.json();
  const devices = json.body?.devices || [];
  if (devices.length === 0) {
    throw new Error('Aucune station Netatmo trouvée sur ce compte.');
  }

  return devices;
}

function resolveStationRefs(devices) {
  const indoor = devices[0];
  const outdoor = findModule(devices, (m) => m.type === 'NAModule1') || indoor;

  return {
    indoor,
    outdoor,
    deviceId: indoor._id,
    indoorModuleId: indoor._id,
    outdoorModuleId: outdoor._id,
  };
}

export async function getIndoorOutdoorTemperatures() {
  const devices = await fetchStationsData();
  const { indoor, outdoor } = resolveStationRefs(devices);
  const indoorDash = indoor?.dashboard_data || {};
  const outdoorDash = outdoor?.dashboard_data || {};

  return {
    indoorTemp: indoorDash.Temperature ?? null,
    indoorHumidity: indoorDash.Humidity ?? null,
    co2: indoorDash.CO2 ?? null,
    pressure: indoorDash.Pressure ?? indoorDash.AbsolutePressure ?? null,
    absolutePressure: indoorDash.AbsolutePressure ?? null,
    noise: indoorDash.Noise ?? null,
    pressureTrend: indoorDash.pressure_trend ?? null,
    tempTrend: indoorDash.temp_trend ?? null,
    outdoorTemp: outdoorDash.Temperature ?? null,
    outdoorHumidity: outdoorDash.Humidity ?? null,
    outdoorTempTrend: outdoorDash.temp_trend ?? null,
    moduleName: indoor?.station_name || indoor?.module_name || null,
    lastSeen: indoorDash.time_utc
      ? new Date(indoorDash.time_utc * 1000).toISOString()
      : null,
  };
}

export async function getClimateHistory(range = '24h', metric = 'indoorTemp') {
  const rangeConfig = RANGE_CONFIG[range];
  const metricConfig = METRIC_CONFIG[metric];

  if (!rangeConfig) {
    throw new Error(`Plage invalide : ${range}`);
  }
  if (!metricConfig) {
    throw new Error(`Métrique invalide : ${metric}`);
  }

  const devices = await fetchStationsData();
  const refs = resolveStationRefs(devices);
  const moduleId =
    metricConfig.module === 'outdoor' ? refs.outdoorModuleId : refs.indoorModuleId;

  const dateEnd = Math.floor(Date.now() / 1000);
  const dateBegin = dateEnd - rangeConfig.hours * 3600;
  const token = await getAccessToken();

  const params = new URLSearchParams({
    device_id: refs.deviceId,
    module_id: moduleId,
    scale: rangeConfig.scale,
    type: metricConfig.type,
    date_begin: String(dateBegin),
    date_end: String(dateEnd),
  });

  const res = await fetch(`${MEASURE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Appel getmeasure échoué (${res.status}) : ${text}`);
  }

  const json = await res.json();
  const rows = json.body || [];

  const points = rows
    .map((row) => {
      const timestamp = Array.isArray(row) ? row[0] : null;
      const values = Array.isArray(row) ? row[1] : null;
      const value = Array.isArray(values) ? values[0] : null;

      if (typeof timestamp !== 'number' || typeof value !== 'number') {
        return null;
      }

      return {
        at: new Date(timestamp * 1000).toISOString(),
        value,
      };
    })
    .filter(Boolean);

  return {
    available: true,
    metric,
    range,
    unit: metricConfig.unit,
    points,
  };
}

export { refreshAccessToken, getCredentials };
