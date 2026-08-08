import { getIndoorOutdoorTemperatures } from './netatmoClient.js';

const CO2_WARNING_PPM = 1000;
const CO2_CRITICAL_PPM = 1400;
const STALE_MS = 30 * 60 * 1000;

export async function getOrionNotifications() {
  const at = new Date().toISOString();
  const items = [];

  try {
    const climate = await getIndoorOutdoorTemperatures();

    if (climate.co2 !== null && climate.co2 >= CO2_CRITICAL_PPM) {
      items.push({
        id: `co2-critical-${climate.co2}`,
        type: 'climate',
        severity: 'critical',
        title: 'CO₂ critique',
        message: `${climate.co2} ppm mesurés à la maison.`,
        at,
      });
    } else if (climate.co2 !== null && climate.co2 >= CO2_WARNING_PPM) {
      items.push({
        id: `co2-warning-${climate.co2}`,
        type: 'climate',
        severity: 'warning',
        title: 'CO₂ élevé',
        message: `${climate.co2} ppm — aère la pièce si possible.`,
        at,
      });
    }

    if (climate.lastSeen) {
      const ageMs = Date.now() - new Date(climate.lastSeen).getTime();
      if (ageMs > STALE_MS) {
        items.push({
          id: 'netatmo-stale',
          type: 'climate',
          severity: 'warning',
          title: 'Station Netatmo inactive',
          message: `Dernière mesure : ${climate.lastSeen}`,
          at,
        });
      }
    }

    if (climate.indoorTemp !== null && climate.indoorTemp >= 28) {
      items.push({
        id: `indoor-heat-${Math.round(climate.indoorTemp)}`,
        type: 'climate',
        severity: 'info',
        title: 'Température intérieure élevée',
        message: `${climate.indoorTemp} °C à l'intérieur.`,
        at,
      });
    }

    return { available: true, items };
  } catch (err) {
    return {
      available: true,
      items: [
        {
          id: 'netatmo-unavailable',
          type: 'system',
          severity: 'critical',
          title: 'Netatmo indisponible',
          message: err.message,
          at,
        },
      ],
    };
  }
}
