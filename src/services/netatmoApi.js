// Client léger pour le proxy Netatmo local (voir /server).
// Le frontend n'a jamais accès au client_secret ni aux tokens OAuth : il interroge
// simplement `/api/netatmo`, servi par le petit serveur Express fourni dans /server,
// qui gère lui-même le rafraîchissement du token auprès de l'API Netatmo.

const ENDPOINT = '/api/netatmo';
const TIMEOUT_MS = 6000;

export class NetatmoUnavailableError extends Error {}

export async function fetchNetatmoData() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new NetatmoUnavailableError(body.error || `Netatmo proxy HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      indoorTemp: data.indoorTemp ?? null,
      indoorHumidity: data.indoorHumidity ?? null,
      outdoorTemp: data.outdoorTemp ?? null,
      outdoorHumidity: data.outdoorHumidity ?? null,
      co2: data.co2 ?? null,
      pressure: data.pressure ?? null,
      absolutePressure: data.absolutePressure ?? null,
      noise: data.noise ?? null,
      pressureTrend: data.pressureTrend ?? null,
      tempTrend: data.tempTrend ?? null,
      outdoorTempTrend: data.outdoorTempTrend ?? null,
      moduleName: data.moduleName ?? null,
      lastSeen: data.lastSeen ?? null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new NetatmoUnavailableError('Netatmo proxy timeout');
    }
    throw err instanceof NetatmoUnavailableError ? err : new NetatmoUnavailableError(err.message);
  } finally {
    clearTimeout(timeout);
  }
}
