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

async function getMarkets() {
  const groups = await Promise.all(MARKET_GROUPS.map(fetchMarketGroup));
  return groups.flat();
}

async function getAssets() {
  const groups = await Promise.all(ASSET_GROUPS.map(fetchMarketGroup));
  return groups.flat();
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

async function getUsdQuote() {
  const xml = await getText(VCB_EXCHANGE_URL);
  const usdMatch = xml.match(/<Exrate[^>]*CurrencyCode="USD"[^>]*Buy="([^"]+)"[^>]*Transfer="([^"]+)"[^>]*Sell="([^"]+)"/);
  const updatedMatch = xml.match(/<DateTime>([^<]+)<\/DateTime>/);

  if (!usdMatch) {
    throw new Error("Cannot parse Vietcombank USD rate");
  }

  return {
    name: "USD Vietcombank",
    buy: usdMatch[1],
    transfer: usdMatch[2],
    sell: usdMatch[3],
    unit: "VND/USD",
    source: "Vietcombank",
    updatedAt: updatedMatch ? updatedMatch[1] : null
  };
}

async function getQuotes() {
  const [gold, usd] = await Promise.all([getGoldQuoteWithHistory(), getUsdQuote()]);
  const cache = readQuoteCache();
  const todayKey = getVietnamDateKey(new Date());
  const yesterdayKey = getVietnamDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const previousUsd = cache[yesterdayKey] && cache[yesterdayKey].usd;
  const quotes = {
    gold: addQuoteChange(gold, { buy: gold.previousBuy, sell: gold.previousSell }, "So với hôm trước"),
    usd: addQuoteChange(usd, previousUsd, previousUsd ? "So với hôm trước" : "Chưa có dữ liệu hôm trước")
  };

  cache[todayKey] = {
    usd: {
      buy: usd.buy,
      sell: usd.sell,
      updatedAt: usd.updatedAt
    }
  };
  writeQuoteCache(cache);
  return quotes;
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
