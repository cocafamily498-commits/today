const { getJson } = require("./data-http");

const DEFAULT_WEATHER_LOCATION = {
  name: "Th\u00e0nh ph\u1ed1 H\u1ed3 Ch\u00ed Minh",
  latitude: 10.8231,
  longitude: 106.6297,
  fallback: true
};

async function getWeather(clientIp, requestedLocation) {
  const location = normalizeRequestedLocation(requestedLocation) || await resolveWeatherLocation(clientIp);
  try {
    return await getOpenMeteoWeather(location);
  } catch (error) {
    return getMetNorwayWeather(location);
  }
}

function normalizeRequestedLocation(location) {
  if (!location || location.latitude === null || location.latitude === undefined || location.latitude === ""
    || location.longitude === null || location.longitude === undefined || location.longitude === "") return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const name = String(location.name || "Vị trí đã chọn").trim().slice(0, 120);
  return { name, latitude, longitude, fallback: false, selected: true };
}

async function searchLocations(query) {
  const name = String(query || "").trim().slice(0, 100);
  if (name.length < 2) return [];
  const params = new URLSearchParams({ name, count: "10", language: "vi", format: "json" });
  const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  return (data.results || [])
    .filter((item) => String(item.feature_code || "").startsWith("PPL"))
    .slice(0, 7)
    .map((item) => {
      const parts = [item.name, item.admin1, item.country].filter((value, index, values) => value && values.indexOf(value) === index);
      return {
        id: item.id,
        name: item.name,
        displayName: parts.join(", "),
        latitude: item.latitude,
        longitude: item.longitude,
        countryCode: item.country_code || null
      };
    });
}

async function getOpenMeteoWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day",
    daily: "temperature_2m_max,temperature_2m_min,uv_index_max",
    timezone: "auto",
    forecast_days: "1"
  });
  const airParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "us_aqi,pm2_5",
    timezone: "auto",
    forecast_days: "1"
  });
  const [forecast, air] = await Promise.all([
    getJson(`https://api.open-meteo.com/v1/forecast?${params}`),
    getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`)
  ]);
  const current = forecast.current || {};
  const daily = forecast.daily || {};
  const airCurrent = air.current || {};
  const condition = describeWeather(current.weather_code, current.is_day);

  return {
    location,
    condition,
    temperature: round(current.temperature_2m),
    apparentTemperature: round(current.apparent_temperature),
    high: round(firstValue(daily.temperature_2m_max)),
    low: round(firstValue(daily.temperature_2m_min)),
    humidity: round(current.relative_humidity_2m),
    windSpeed: round(current.wind_speed_10m),
    windGust: round(current.wind_gusts_10m),
    windDirection: round(current.wind_direction_10m),
    uvIndex: round(firstValue(daily.uv_index_max), 1),
    uvLabel: describeUv(firstValue(daily.uv_index_max)),
    aqi: round(airCurrent.us_aqi),
    aqiLabel: describeAqi(airCurrent.us_aqi),
    pm25: round(airCurrent.pm2_5, 1),
    precipitation: round(current.precipitation, 1),
    cloudCover: round(current.cloud_cover),
    updatedAt: current.time || null,
    source: "Open-Meteo"
  };
}

async function getMetNorwayWeather(location) {
  const latitude = Number(location.latitude).toFixed(4);
  const longitude = Number(location.longitude).toFixed(4);
  const payload = await getJson(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude}&lon=${longitude}`,
    { "user-agent": "HomNay/1.0 local-weather-app" }
  );
  const timeseries = payload.properties && Array.isArray(payload.properties.timeseries)
    ? payload.properties.timeseries
    : [];

  if (!timeseries.length) throw new Error("MET Norway returned no weather data");

  const currentEntry = timeseries[0];
  const details = currentEntry.data?.instant?.details || {};
  const nextHour = currentEntry.data?.next_1_hours || currentEntry.data?.next_6_hours || {};
  const temperatures = timeseries.slice(0, 24)
    .map((entry) => Number(entry.data?.instant?.details?.air_temperature))
    .filter(Number.isFinite);
  const symbol = nextHour.summary?.symbol_code || "cloudy";

  return {
    location,
    condition: describeMetWeather(symbol),
    temperature: round(details.air_temperature),
    apparentTemperature: round(details.air_temperature),
    high: temperatures.length ? round(Math.max(...temperatures)) : null,
    low: temperatures.length ? round(Math.min(...temperatures)) : null,
    humidity: round(details.relative_humidity),
    windSpeed: round(Number(details.wind_speed) * 3.6),
    windGust: null,
    windDirection: round(details.wind_from_direction),
    uvIndex: null,
    uvLabel: "--",
    aqi: null,
    aqiLabel: "--",
    pm25: null,
    precipitation: round(nextHour.details?.precipitation_amount, 1),
    cloudCover: round(details.cloud_area_fraction),
    updatedAt: currentEntry.time || null,
    source: "MET Norway"
  };
}

function describeMetWeather(symbol) {
  const code = String(symbol).toLowerCase();
  const isNight = code.includes("night");
  if (code.includes("thunder")) return { text: "Dông sét", icon: "storm" };
  if (code.includes("snow") || code.includes("sleet")) return { text: "Có tuyết", icon: "snow" };
  if (code.includes("rain") || code.includes("shower")) return { text: "Có mưa", icon: "rain" };
  if (code.includes("fog")) return { text: "Sương mù", icon: "fog" };
  if (code.includes("partlycloudy")) return { text: "Mây rải rác", icon: isNight ? "cloud-moon" : "partly-cloudy" };
  if (code.includes("cloudy")) return { text: "Nhiều mây", icon: "cloud" };
  return { text: isNight ? "Trời quang" : "Trời nắng", icon: isNight ? "moon" : "sun" };
}

async function resolveWeatherLocation(clientIp) {
  const ip = normalizeClientIp(clientIp);
  const suffix = ip ? `/${encodeURIComponent(ip)}` : "/";
  try {
    const data = await getJson(`https://ipwho.is${suffix}`);
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (data.success === false || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(data.message || "IP location unavailable");
    }

    return {
      name: formatLocationName(data),
      latitude,
      longitude,
      fallback: false
    };
  } catch (error) {}

  try {
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
    const data = await getJson(url);
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!data.error && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { name: formatLocationName(data), latitude, longitude, fallback: false };
    }
  } catch (error) {}

  return DEFAULT_WEATHER_LOCATION;
}

function normalizeClientIp(clientIp) {
  if (!clientIp || typeof clientIp !== "string") return null;
  let ip = clientIp.split(",")[0].trim();
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);

  if (!ip || ip === "::1" || ip === "127.0.0.1") return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) return null;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return null;

  return ip;
}

function formatLocationName(data) {
  const city = data.city || data.region || data.country_name;
  const region = data.region && data.region !== city ? data.region : "";
  const countryName = data.country_name || data.country;
  const country = countryName && countryName !== region ? countryName : "";
  return [city, region, country].filter(Boolean).slice(0, 2).join(", ") || DEFAULT_WEATHER_LOCATION.name;
}

function firstValue(values) {
  return Array.isArray(values) ? values[0] : null;
}

function round(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function describeWeather(code, isDay) {
  const weatherCode = Number(code);
  const daytime = isDay !== 0;

  if ([0, 1].includes(weatherCode)) return { text: daytime ? "Tr\u1eddi n\u1eafng" : "Tr\u1eddi quang", icon: daytime ? "sun" : "moon" };
  if (weatherCode === 2) return { text: "M\u00e2y r\u1ea3i r\u00e1c", icon: daytime ? "partly-cloudy" : "cloud-moon" };
  if (weatherCode === 3) return { text: "Nhi\u1ec1u m\u00e2y", icon: "cloud" };
  if ([45, 48].includes(weatherCode)) return { text: "S\u01b0\u01a1ng m\u00f9", icon: "fog" };
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return { text: "M\u01b0a ph\u00f9n", icon: "drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return { text: "C\u00f3 m\u01b0a", icon: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return { text: "C\u00f3 tuy\u1ebft", icon: "snow" };
  if ([95, 96, 99].includes(weatherCode)) return { text: "D\u00f4ng s\u00e9t", icon: "storm" };

  return { text: "Th\u1eddi ti\u1ebft h\u00f4m nay", icon: "cloud" };
}

function describeUv(value) {
  const uv = Number(value);
  if (!Number.isFinite(uv)) return "--";
  if (uv < 3) return "Th\u1ea5p";
  if (uv < 6) return "Trung b\u00ecnh";
  if (uv < 8) return "Cao";
  if (uv < 11) return "R\u1ea5t cao";
  return "Nguy h\u1ea1i";
}

function describeAqi(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return "--";
  if (aqi <= 50) return "T\u1ed1t";
  if (aqi <= 100) return "Trung b\u00ecnh";
  if (aqi <= 150) return "K\u00e9m cho nh\u00f3m nh\u1ea1y c\u1ea3m";
  if (aqi <= 200) return "K\u00e9m";
  if (aqi <= 300) return "R\u1ea5t k\u00e9m";
  return "Nguy h\u1ea1i";
}


function getFallbackWeather(requestedLocation) {
  return {
    location: requestedLocation || DEFAULT_WEATHER_LOCATION,
    condition: { text: "Tam thoi chua co du lieu", icon: "cloud" },
    temperature: null,
    apparentTemperature: null,
    high: null,
    low: null,
    humidity: null,
    windSpeed: null,
    windGust: null,
    windDirection: null,
    uvIndex: null,
    uvLabel: "--",
    aqi: null,
    aqiLabel: "--",
    pm25: null,
    precipitation: null,
    cloudCover: null,
    updatedAt: null,
    source: "Du lieu tam thoi chua tai duoc"
  };
}

module.exports = { getWeather, searchLocations, normalizeRequestedLocation, getFallbackWeather };
