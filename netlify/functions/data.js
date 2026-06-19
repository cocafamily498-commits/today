const http = require("http");
const https = require("https");

const MARKET_GROUPS = [
  {
    scanner: "america",
    symbols: [
      { symbol: "DJ:DJI", name: "Dow Jones" },
      { symbol: "SP:SPX", name: "S&P 500" }
    ]
  },
  {
    scanner: "vietnam",
    symbols: [
      { symbol: "HOSE:VNINDEX", name: "VN-Index" },
      { symbol: "HNX:HNXINDEX", name: "HNX-Index" }
    ]
  }
];

const ASSET_GROUPS = [
  {
    scanner: "global",
    symbols: [
      { symbol: "BITSTAMP:BTCUSD", name: "Bitcoin" },
      { symbol: "BITSTAMP:ETHUSD", name: "Ethereum" },
      { symbol: "NYMEX:CL1!", name: "D\u1ea7u WTI" },
      { symbol: "ICEEUR:BRN1!", name: "D\u1ea7u Brent" }
    ]
  }
];

const VCB_EXCHANGE_URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=68";
const GOLD_PRICE_URL = "https://giavang.org/";
const WORLD_GOLD_SYMBOL = "OANDA:XAUUSD";
const TROY_OUNCE_GRAMS = 31.1034768;
const VIETNAM_GOLD_TAEL_GRAMS = 37.5;
const DEFAULT_WEATHER_LOCATION = {
  name: "\u0110\u00e0 N\u1eb5ng",
  latitude: 16.0471,
  longitude: 108.2068,
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
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(content));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function getText(url) {
  const client = url.startsWith("https:") ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0"
      }
    }, (response) => {
      let content = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        content += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }

        resolve(content);
      });
    });

    request.on("error", reject);
    request.end();
  });
}

async function getJson(url) {
  const text = await getText(url);
  return JSON.parse(text);
}

async function getMarkets() {
  const groups = await Promise.all(MARKET_GROUPS.map(fetchMarketGroup));
  return groups.flat();
}

async function getAssets() {
  const groups = await Promise.all(ASSET_GROUPS.map(fetchMarketGroup));
  return groups.flat();
}

async function getWeather(clientIp) {
  const location = await resolveWeatherLocation(clientIp);
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

async function resolveWeatherLocation(clientIp) {
  const ip = normalizeClientIp(clientIp);

  if (!ip) return DEFAULT_WEATHER_LOCATION;

  try {
    const data = await getJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return DEFAULT_WEATHER_LOCATION;
    }

    return {
      name: formatLocationName(data),
      latitude,
      longitude,
      fallback: false
    };
  } catch (error) {
    return DEFAULT_WEATHER_LOCATION;
  }
}

function normalizeClientIp(clientIp) {
  if (!clientIp || typeof clientIp !== "string") return null;
  const ip = clientIp.split(",")[0].trim();

  if (!ip || ip === "::1" || ip === "127.0.0.1") return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip)) return null;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip)) return null;

  return ip;
}

function formatLocationName(data) {
  const city = data.city || data.region || data.country_name;
  const region = data.region && data.region !== city ? data.region : "";
  const country = data.country_name && data.country_name !== region ? data.country_name : "";
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
    name: "V\u00e0ng th\u1ebf gi\u1edbi",
    ounceUsd: row[2],
    change: row[3],
    changeAbs: row[4],
    source: "TradingView"
  };
}

async function getGoldQuote() {
  const html = await getText(GOLD_PRICE_URL);
  const prices = [...html.matchAll(/<span class="gold-price">([^<]+)/g)].map((match) => match[1].trim());
  const updatedMatch = html.match(/Cập nhật lúc\s*([^<]+)/) || html.match(/Cáº­p nháº­t lÃºc\s*([^<]+)/);
  const history = getGoldHistory(html);

  if (prices.length < 2) {
    throw new Error("Cannot parse SJC gold price");
  }

  return addQuoteChange({
    name: "V\u00e0ng mi\u1ebfng SJC",
    buy: prices[0],
    sell: prices[1],
    unit: "x1000\u0111/l\u01b0\u1ee3ng",
    source: "giavang.org",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : null
  }, {
    buy: history.buy,
    sell: history.sell
  }, "So v\u1edbi h\u00f4m tr\u01b0\u1edbc");
}

async function getCurrencyQuote(currencyCode, name, unit) {
  const xml = await getText(VCB_EXCHANGE_URL);
  const pattern = new RegExp(`<Exrate[^>]*CurrencyCode="${currencyCode}"[^>]*Buy="([^"]+)"[^>]*Transfer="([^"]+)"[^>]*Sell="([^"]+)"`);
  const currencyMatch = xml.match(pattern);
  const updatedMatch = xml.match(/<DateTime>([^<]+)<\/DateTime>/);

  if (!currencyMatch) {
    throw new Error(`Cannot parse Vietcombank ${currencyCode} rate`);
  }

  return addQuoteChange({
    name,
    buy: currencyMatch[1],
    transfer: currencyMatch[2],
    sell: currencyMatch[3],
    unit,
    source: "Vietcombank",
    updatedAt: updatedMatch ? updatedMatch[1] : null
  }, null, `Netlify kh\u00f4ng l\u01b0u d\u1eef li\u1ec7u ${currencyCode} h\u00f4m tr\u01b0\u1edbc`);
}

async function getUsdQuote() {
  return getCurrencyQuote("USD", "USD Vietcombank", "VND/USD");
}

async function getEurQuote() {
  return getCurrencyQuote("EUR", "EUR Vietcombank", "VND/EUR");
}

async function getQuotes() {
  const [gold, usd, eur, worldGoldSpot] = await Promise.all([getGoldQuote(), getUsdQuote(), getEurQuote(), getWorldGoldSpot()]);
  return { gold, usd, eur, worldGold: buildWorldGoldQuote(worldGoldSpot, usd) };
}

function buildWorldGoldQuote(spot, usd) {
  const usdVnd = parseMoney(usd.sell || usd.transfer || usd.buy);
  const taelUsd = spot.ounceUsd / TROY_OUNCE_GRAMS * VIETNAM_GOLD_TAEL_GRAMS;
  const taelVnd = usdVnd === null ? null : taelUsd * usdVnd;

  return {
    ...spot,
    taelUsd,
    taelVnd,
    unit: "1 oz = 31.1034768g; 1 l\u01b0\u1ee3ng/l\u1ea1ng = 37.5g"
  };
}

function addQuoteChange(current, previous, changeLabel) {
  return {
    ...current,
    changeLabel,
    buyChange: calculateQuoteChange(current.buy, previous && previous.buy),
    sellChange: calculateQuoteChange(current.sell, previous && previous.sell)
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

function response(body) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function errorResponse(error) {
  return {
    statusCode: 500,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify({ error: error.message })
  };
}

module.exports = {
  getMarkets,
  getAssets,
  getQuotes,
  getWeather,
  response,
  errorResponse
};
