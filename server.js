const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { convertLunarToSolar, parseInput: parseLunarInput } = require("./netlify/functions/lunar-to-solar");

const PORT = process.env.PORT || 3000;
const STATIC_FILES = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app-data.js": { file: "app-data.js", type: "text/javascript; charset=utf-8" }
};
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};
const STATIC_DIRECTORIES = ["partials", "scripts"];
const API_CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};
const MARKET_GROUPS = [
  {
    scanner: "vietnam",
    symbols: [
      { symbol: "HOSE:VNINDEX", name: "VN-Index" },
      { symbol: "HNX:HNXINDEX", name: "HNX-Index" }
    ]
  }
];

const US_MARKETS = [
  { symbol: "%5EDJI", name: "Dow Jones" },
  { symbol: "%5EGSPC", name: "S&P 500" }
];
const ASSET_GROUPS = [
  {
    scanner: "global",
    symbols: [
      { symbol: "BITSTAMP:BTCUSD", name: "Bitcoin" },
      { symbol: "BITSTAMP:ETHUSD", name: "Ethereum" },
      { symbol: "NYMEX:CL1!", name: "Dầu WTI" },
      { symbol: "ICEEUR:BRN1!", name: "Dầu Brent" }
    ]
  }
];
const VCB_EXCHANGE_URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=68";
const GOLD_PRICE_URL = "https://giavang.org/";
const SILVER_PRICE_URL = "https://giabac.phuquygroup.vn/";
const QUOTE_CACHE_PATH = path.join(__dirname, "quotes-cache.json");
const WORLD_GOLD_SYMBOL = "OANDA:XAUUSD";
const WORLD_SILVER_SYMBOL = "TVC:SILVER";
const TROY_OUNCE_GRAMS = 31.1034768;
const VIETNAM_GOLD_TAEL_GRAMS = 37.5;
const DEFAULT_WEATHER_LOCATION = {
  name: "Thành phố Hồ Chí Minh",
  latitude: 10.8231,
  longitude: 106.6297,
  fallback: true
};

async function fetchMarketGroup(group) {
  const payload = await postJson(`https://scanner.tradingview.com/${group.scanner}/scan`, {
    symbols: {
      tickers: group.symbols.map((item) => item.symbol),
      query: { types: [] }
    },
    columns: ["name", "description", "close", "change", "change_abs"]
  });
  const rows = new Map((payload.data || []).map((row) => [row.s, row.d]));

  return group.symbols.map((item) => {
    const row = rows.get(item.symbol);
    if (!row) {
      return { symbol: item.symbol, name: item.name, close: null, change: null, changeAbs: null };
    }

    return {
      symbol: item.symbol,
      name: item.name,
      close: row[2],
      change: row[3],
      changeAbs: row[4]
    };
  });
}

function postJson(url, data) {
  const body = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "user-agent": "Mozilla/5.0"
      }
    }, (response) => {
      let content = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        content += chunk;
      });
      response.on("end", () => {
        clearTimeout(timeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`TradingView returned ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(content));
        } catch (error) {
          reject(error);
        }
      });
    });

    const timeout = setTimeout(() => request.destroy(new Error(`${url} timed out`)), 8000);
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.write(body);
    request.end();
  });
}

const DNS_FALLBACKS = {
  "api.open-meteo.com": "188.40.99.226",
  "air-quality-api.open-meteo.com": "152.53.84.73",
  "geocoding-api.open-meteo.com": "202.61.206.6"
};

async function getText(url, headers = {}) {
  try {
    return await requestText(url, headers);
  } catch (error) {
    const hostname = new URL(url).hostname;
    const fallbackIp = DNS_FALLBACKS[hostname];
    if (!fallbackIp || !["EAI_FAIL", "ENOTFOUND"].includes(error.code)) throw error;
    return requestText(url, headers, (ignoredHostname, options, callback) => callback(null, fallbackIp, 4));
  }
}

function requestText(url, headers = {}, lookup) {
  const client = url.startsWith("https:") ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: "GET",
      ...(lookup ? { lookup } : {}),
      headers: {
        "user-agent": "Mozilla/5.0",
        ...headers
      }
    }, (response) => {
      let content = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        content += chunk;
      });
      response.on("end", () => {
        clearTimeout(timeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }

        resolve(content);
      });
    });

    const timeout = setTimeout(() => request.destroy(new Error(`${url} timed out`)), 8000);
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.end();
  });
}

async function getJson(url, headers) {
  const text = await getText(url, headers);
  return JSON.parse(text);
}

async function getMarkets() {
  const [usMarkets, ...groups] = await Promise.all([
    Promise.all(US_MARKETS.map((item) => fetchYahooMarket(item).catch(() => emptyMarket(item)))),
    ...MARKET_GROUPS.map((group) => fetchMarketGroup(group)
      .catch(() => group.symbols.map(emptyMarket)))
  ]);
  return [...usMarkets, ...groups.flat()];
}

function emptyMarket(item) {
  return { symbol: item.symbol, name: item.name, close: null, change: null, changeAbs: null };
}

function getFallbackMarkets() {
  return [
    ...US_MARKETS.map((item) => emptyMarket({ ...item, symbol: decodeURIComponent(item.symbol) })),
    ...MARKET_GROUPS.flatMap((group) => group.symbols.map(emptyMarket))
  ];
}

function getFallbackAssets() {
  return ASSET_GROUPS.flatMap((group) => group.symbols.map(emptyMarket));
}

function getFallbackQuotes() {
  return {
    gold: null,
    worldGold: null,
    usd: null,
    eur: null,
    silver: null,
    worldSilver: null
  };
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

async function fetchYahooMarket(item) {
  const payload = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?range=5d&interval=1d`);
  const meta = payload.chart?.result?.[0]?.meta || {};
  const close = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPreviousClose);

  if (!Number.isFinite(close) || !Number.isFinite(previousClose) || previousClose === 0) {
    throw new Error(`Yahoo Finance returned invalid data for ${item.symbol}`);
  }

  const changeAbs = close - previousClose;
  return {
    symbol: decodeURIComponent(item.symbol),
    name: item.name,
    close,
    change: (changeAbs / previousClose) * 100,
    changeAbs
  };
}

async function getAssets() {
  const groups = await Promise.all(ASSET_GROUPS.map(fetchMarketGroup));
  return groups.flat();
}

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

  if ([0, 1].includes(weatherCode)) return { text: daytime ? "Trời nắng" : "Trời quang", icon: daytime ? "sun" : "moon" };
  if (weatherCode === 2) return { text: "Mây rải rác", icon: daytime ? "partly-cloudy" : "cloud-moon" };
  if (weatherCode === 3) return { text: "Nhiều mây", icon: "cloud" };
  if ([45, 48].includes(weatherCode)) return { text: "Sương mù", icon: "fog" };
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return { text: "Mưa phùn", icon: "drizzle" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) return { text: "Có mưa", icon: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return { text: "Có tuyết", icon: "snow" };
  if ([95, 96, 99].includes(weatherCode)) return { text: "Dông sét", icon: "storm" };

  return { text: "Thời tiết hôm nay", icon: "cloud" };
}

function describeUv(value) {
  const uv = Number(value);
  if (!Number.isFinite(uv)) return "--";
  if (uv < 3) return "Thấp";
  if (uv < 6) return "Trung bình";
  if (uv < 8) return "Cao";
  if (uv < 11) return "Rất cao";
  return "Nguy hại";
}

function describeAqi(value) {
  const aqi = Number(value);
  if (!Number.isFinite(aqi)) return "--";
  if (aqi <= 50) return "Tốt";
  if (aqi <= 100) return "Trung bình";
  if (aqi <= 150) return "Kém cho nhóm nhạy cảm";
  if (aqi <= 200) return "Kém";
  if (aqi <= 300) return "Rất kém";
  return "Nguy hại";
}

async function getWorldGoldSpot() {
  const payload = await postJson("https://scanner.tradingview.com/global/scan", {
    symbols: {
      tickers: [WORLD_GOLD_SYMBOL],
      query: { types: [] }
    },
    columns: ["name", "description", "close", "change", "change_abs"]
  });
  const row = payload.data && payload.data[0] && payload.data[0].d;

  if (!row || !Number.isFinite(row[2])) {
    throw new Error("Cannot parse world gold price");
  }

  return {
    symbol: WORLD_GOLD_SYMBOL,
    name: "Vàng thế giới",
    ounceUsd: row[2],
    change: row[3],
    changeAbs: row[4],
    source: "TradingView"
  };
}

async function getWorldSilverSpot() {
  const payload = await postJson("https://scanner.tradingview.com/global/scan", {
    symbols: {
      tickers: [WORLD_SILVER_SYMBOL],
      query: { types: [] }
    },
    columns: ["name", "description", "close", "change", "change_abs"]
  });
  const row = payload.data && payload.data[0] && payload.data[0].d;

  if (!row || !Number.isFinite(row[2])) {
    throw new Error("Cannot parse world silver price");
  }

  return {
    symbol: WORLD_SILVER_SYMBOL,
    name: "Bạc thế giới",
    ounceUsd: row[2],
    change: row[3],
    changeAbs: row[4],
    source: "TradingView"
  };
}

async function getSilverQuote() {
  const html = await getText(SILVER_PRICE_URL);
  const productPattern = /BẠC MIẾNG PH(?:&#218;|Ú) QU(?:&#221;|Ý) 999 1 LƯỢNG/i;
  const productIndex = html.search(productPattern);
  const rowStart = productIndex < 0 ? -1 : html.lastIndexOf("<tr", productIndex);
  const rowEnd = productIndex < 0 ? -1 : html.indexOf("</tr>", productIndex);
  const rowHtml = rowStart < 0 || rowEnd < 0 ? "" : html.slice(rowStart, rowEnd + 5);
  const prices = rowHtml.match(/\d{1,3}(?:,\d{3})+/g) || [];
  const updatedMatch = html.match(/Cập nhật lần cuối:\s*([^<]+)/i);

  if (prices.length < 2) {
    throw new Error("Cannot parse Phu Quy silver price");
  }

  return {
    name: "Bạc miếng Phú Quý 999",
    buy: prices[0],
    sell: prices[1],
    unit: "VND/lượng",
    source: "Phú Quý",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : null
  };
}

async function getGoldQuote() {
  const html = await getText(GOLD_PRICE_URL);
  const sectionMatch = html.match(/Giá vàng Miếng SJC[\s\S]*?<span class="gold-price">([^<]+)[\s\S]*?<span class="gold-price">([^<]+)/);
  const updatedMatch = html.match(/Cập nhật lúc\s*([^<]+)/);

  if (!sectionMatch) {
    throw new Error("Cannot parse SJC gold price");
  }

  return {
    name: "Vàng miếng SJC",
    buy: sectionMatch[1].trim(),
    sell: sectionMatch[2].trim(),
    unit: "x1000đ/lượng",
    source: "giavang.org",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : null
  };
}

async function getCurrencyQuote(currencyCode, name, unit) {
  const xml = await getText(VCB_EXCHANGE_URL);
  const pattern = new RegExp(`<Exrate[^>]*CurrencyCode="${currencyCode}"[^>]*Buy="([^"]+)"[^>]*Transfer="([^"]+)"[^>]*Sell="([^"]+)"`);
  const currencyMatch = xml.match(pattern);
  const updatedMatch = xml.match(/<DateTime>([^<]+)<\/DateTime>/);

  if (!currencyMatch) {
    throw new Error(`Cannot parse Vietcombank ${currencyCode} rate`);
  }

  return {
    name,
    buy: currencyMatch[1],
    transfer: currencyMatch[2],
    sell: currencyMatch[3],
    unit,
    source: "Vietcombank",
    updatedAt: updatedMatch ? updatedMatch[1] : null
  };
}

async function getUsdQuote() {
  return getCurrencyQuote("USD", "USD Vietcombank", "VND/USD");
}

async function getEurQuote() {
  return getCurrencyQuote("EUR", "EUR Vietcombank", "VND/EUR");
}

async function getQuotes() {
  const [gold, silver, usd, eur, worldGoldSpot, worldSilverSpot] = await Promise.all([
    getGoldQuoteWithHistory(),
    getSilverQuote().catch(() => null),
    getUsdQuote(),
    getEurQuote(),
    getWorldGoldSpot(),
    getWorldSilverSpot().catch(() => null)
  ]);
  const cache = readQuoteCache();
  const todayKey = getVietnamDateKey(new Date());
  const yesterdayKey = getVietnamDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const previousUsd = cache[yesterdayKey] && cache[yesterdayKey].usd;
  const previousEur = cache[yesterdayKey] && cache[yesterdayKey].eur;
  const quotes = {
    gold: addQuoteChange(gold, { buy: gold.previousBuy, sell: gold.previousSell }, "So với hôm trước"),
    silver,
    usd: addQuoteChange(usd, previousUsd, previousUsd ? "So với hôm trước" : "Chưa có dữ liệu hôm trước"),
    eur: addQuoteChange(eur, previousEur, previousEur ? "So với hôm trước" : "Chưa có dữ liệu hôm trước"),
    worldGold: buildWorldGoldQuote(worldGoldSpot, usd),
    worldSilver: worldSilverSpot ? buildWorldGoldQuote(worldSilverSpot, usd) : null
  };

  cache[todayKey] = {
    usd: {
      buy: usd.buy,
      sell: usd.sell,
      updatedAt: usd.updatedAt
    },
    eur: {
      buy: eur.buy,
      sell: eur.sell,
      updatedAt: eur.updatedAt
    }
  };
  writeQuoteCache(cache);
  return quotes;
}

function buildWorldGoldQuote(spot, usd) {
  const usdVnd = parseMoney(usd.sell || usd.transfer || usd.buy);
  const taelUsd = spot.ounceUsd / TROY_OUNCE_GRAMS * VIETNAM_GOLD_TAEL_GRAMS;
  const taelVnd = usdVnd === null ? null : taelUsd * usdVnd;

  return {
    ...spot,
    taelUsd,
    taelVnd,
    unit: "1 oz = 31.1034768g; 1 lượng/lạng = 37.5g"
  };
}

function readQuoteCache() {
  try {
    return JSON.parse(fs.readFileSync(QUOTE_CACHE_PATH, "utf8"));
  } catch (error) {
    return {};
  }
}

function writeQuoteCache(quotes) {
  fs.writeFileSync(QUOTE_CACHE_PATH, JSON.stringify(quotes, null, 2), "utf8");
}

function addQuoteChange(current, previous, changeLabel) {
  return {
    ...current,
    changeLabel,
    buyChange: calculateQuoteChange(current.buy, previous && previous.buy),
    sellChange: calculateQuoteChange(current.sell, previous && previous.sell)
  };
}

async function getGoldQuoteWithHistory() {
  const html = await getText(GOLD_PRICE_URL);
  const prices = [...html.matchAll(/<span class="gold-price">([^<]+)/g)].map((match) => match[1].trim());
  const updatedMatch = html.match(/Cập nhật lúc\s*([^<]+)/) || html.match(/Cáº­p nháº­t lÃºc\s*([^<]+)/);
  const history = getGoldHistory(html);

  if (prices.length < 2) {
    throw new Error("Cannot parse SJC gold price");
  }

  return {
    name: "Vàng miếng SJC",
    buy: prices[0],
    sell: prices[1],
    unit: "x1000đ/lượng",
    source: "giavang.org",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : null,
    previousBuy: history.buy,
    previousSell: history.sell
  };
}

function getGoldHistory(html) {
  const series = [...html.matchAll(/data:\[([\s\S]*?)\],tooltip/g)];
  if (series.length < 2) return {};

  return {
    buy: getPreviousDayValue(series[0][1]),
    sell: getPreviousDayValue(series[1][1])
  };
}

function getPreviousDayValue(seriesText) {
  const points = [...seriesText.matchAll(/\[(\d+),([\d.]+)\]/g)].map((match) => ({
    time: Number(match[1]),
    value: match[2]
  }));

  if (points.length < 2) return null;

  const last = points[points.length - 1];
  const lastDate = getVietnamDateKey(new Date(last.time));

  for (let i = points.length - 2; i >= 0; i -= 1) {
    if (getVietnamDateKey(new Date(points[i].time)) !== lastDate) {
      return points[i].value;
    }
  }

  return null;
}

function getVietnamDateKey(date) {
  const vietnamTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, "0");
  const day = String(vietnamTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateQuoteChange(currentText, previousText) {
  const current = parseMoney(currentText);
  const previous = parseMoney(previousText);

  if (current === null || previous === null) {
    return null;
  }

  const value = current - previous;
  const percent = previous === 0 ? 0 : value / previous * 100;
  return { value, percent };
}

function parseMoney(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function send(response, status, contentType, body, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(body);
}

function getStaticFile(pathname) {
  const knownFile = STATIC_FILES[pathname];
  if (knownFile) return knownFile;

  const normalizedPath = path.posix.normalize(decodeURIComponent(pathname));
  if (normalizedPath !== pathname || normalizedPath.includes("..")) return null;

  const parts = normalizedPath.replace(/^\//, "").split("/");
  if (!STATIC_DIRECTORIES.includes(parts[0])) return null;

  const extension = path.extname(normalizedPath);
  const type = STATIC_TYPES[extension];
  if (!type) return null;

  return {
    file: normalizedPath.replace(/^\//, ""),
    type
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) request.destroy(new Error("Request body too large"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Dữ liệu JSON không hợp lệ"));
      }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (requestUrl.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      send(response, 204, "text/plain; charset=utf-8", "", API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/markets") {
      const markets = await getMarkets().catch(() => getFallbackMarkets());
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ markets }), API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/assets") {
      const assets = await getAssets().catch(() => getFallbackAssets());
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ assets }), API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/quotes") {
      const quotes = await getQuotes().catch(() => getFallbackQuotes());
      send(response, 200, "application/json; charset=utf-8", JSON.stringify(quotes), API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/locations") {
      const locations = await searchLocations(requestUrl.searchParams.get("q")).catch(() => []);
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ locations }), API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/weather") {
      const clientIp = request.headers["x-forwarded-for"] || request.socket.remoteAddress;
      const requestedLocation = normalizeRequestedLocation({
        name: requestUrl.searchParams.get("name"),
        latitude: requestUrl.searchParams.get("lat"),
        longitude: requestUrl.searchParams.get("lon")
      });
      const weather = await getWeather(clientIp, requestedLocation).catch(() => getFallbackWeather(requestedLocation));
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ weather }), API_CORS_HEADERS);
      return;
    }

    if (requestUrl.pathname === "/api/lunar-to-solar") {
      if (request.method === "OPTIONS") {
        send(response, 204, "text/plain; charset=utf-8", "", API_CORS_HEADERS);
        return;
      }
      if (request.method !== "POST") {
        send(response, 405, "application/json; charset=utf-8", JSON.stringify({ error: "Chỉ hỗ trợ phương thức POST" }), API_CORS_HEADERS);
        return;
      }
      const input = parseLunarInput(await readJsonBody(request));
      const solar = convertLunarToSolar(
        input.lunarDay,
        input.lunarMonth,
        input.lunarYear,
        input.lunarLeap,
        input.timeZone
      );
      if (!solar) {
        send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "Ngày âm hoặc tháng nhuận không hợp lệ" }), API_CORS_HEADERS);
        return;
      }
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ solar }), API_CORS_HEADERS);
      return;
    }

    const staticFile = getStaticFile(requestUrl.pathname);
    if (!staticFile) {
      send(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const filePath = path.join(__dirname, staticFile.file);
    const content = fs.readFileSync(filePath);
    send(response, 200, staticFile.type, content);
  } catch (error) {
    send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Hom nay app: http://localhost:${PORT}`);
});
