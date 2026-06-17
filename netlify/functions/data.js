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

async function getUsdQuote() {
  const xml = await getText(VCB_EXCHANGE_URL);
  const usdMatch = xml.match(/<Exrate[^>]*CurrencyCode="USD"[^>]*Buy="([^"]+)"[^>]*Transfer="([^"]+)"[^>]*Sell="([^"]+)"/);
  const updatedMatch = xml.match(/<DateTime>([^<]+)<\/DateTime>/);

  if (!usdMatch) {
    throw new Error("Cannot parse Vietcombank USD rate");
  }

  return addQuoteChange({
    name: "USD Vietcombank",
    buy: usdMatch[1],
    transfer: usdMatch[2],
    sell: usdMatch[3],
    unit: "VND/USD",
    source: "Vietcombank",
    updatedAt: updatedMatch ? updatedMatch[1] : null
  }, null, "Netlify kh\u00f4ng l\u01b0u d\u1eef li\u1ec7u USD h\u00f4m tr\u01b0\u1edbc");
}

async function getQuotes() {
  const [gold, usd] = await Promise.all([getGoldQuote(), getUsdQuote()]);
  return { gold, usd };
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
  response,
  errorResponse
};
