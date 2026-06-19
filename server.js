const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
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
      { symbol: "NYMEX:CL1!", name: "Dầu WTI" },
      { symbol: "ICEEUR:BRN1!", name: "Dầu Brent" }
    ]
  }
];
const VCB_EXCHANGE_URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=68";
const GOLD_PRICE_URL = "https://giavang.org/";
const QUOTE_CACHE_PATH = path.join(__dirname, "quotes-cache.json");
const WORLD_GOLD_SYMBOL = "OANDA:XAUUSD";
const TROY_OUNCE_GRAMS = 31.1034768;
const VIETNAM_GOLD_TAEL_GRAMS = 37.5;
const DEFAULT_WEATHER_LOCATION = {
  name: "Đà Nẵng",
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
  const [gold, usd, eur, worldGoldSpot] = await Promise.all([getGoldQuoteWithHistory(), getUsdQuote(), getEurQuote(), getWorldGoldSpot()]);
  const cache = readQuoteCache();
  const todayKey = getVietnamDateKey(new Date());
  const yesterdayKey = getVietnamDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const previousUsd = cache[yesterdayKey] && cache[yesterdayKey].usd;
  const previousEur = cache[yesterdayKey] && cache[yesterdayKey].eur;
  const quotes = {
    gold: addQuoteChange(gold, { buy: gold.previousBuy, sell: gold.previousSell }, "So với hôm trước"),
    usd: addQuoteChange(usd, previousUsd, previousUsd ? "So với hôm trước" : "Chưa có dữ liệu hôm trước"),
    eur: addQuoteChange(eur, previousEur, previousEur ? "So với hôm trước" : "Chưa có dữ liệu hôm trước"),
    worldGold: buildWorldGoldQuote(worldGoldSpot, usd)
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

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === "/api/markets") {
      const markets = await getMarkets();
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ markets }));
      return;
    }

    if (request.url === "/api/assets") {
      const assets = await getAssets();
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ assets }));
      return;
    }

    if (request.url === "/api/quotes") {
      const quotes = await getQuotes();
      send(response, 200, "application/json; charset=utf-8", JSON.stringify(quotes));
      return;
    }

    if (request.url === "/api/weather") {
      const clientIp = request.headers["x-forwarded-for"] || request.socket.remoteAddress;
      const weather = await getWeather(clientIp);
      send(response, 200, "application/json; charset=utf-8", JSON.stringify({ weather }));
      return;
    }

    const filePath = path.join(__dirname, "index.html");
    const html = fs.readFileSync(filePath);
    send(response, 200, "text/html; charset=utf-8", html);
  } catch (error) {
    send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Hom nay app: http://localhost:${PORT}`);
});
