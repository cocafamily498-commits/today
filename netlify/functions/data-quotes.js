const { postJson, getJson, getText } = require("./data-http");

const VCB_EXCHANGE_URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=68";
const GOLD_PRICE_URL = "https://giavang.org/";
const SILVER_PRICE_URL = "https://giabac.phuquygroup.vn/";
const WORLD_GOLD_SYMBOL = "OANDA:XAUUSD";
const WORLD_SILVER_SYMBOL = "TVC:SILVER";
const TROY_OUNCE_GRAMS = 31.1034768;
const VIETNAM_GOLD_TAEL_GRAMS = 37.5;
async function getWorldMetalSpots() {
  const payload = await postJson("https://scanner.tradingview.com/global/scan", {
    symbols: {
      tickers: [WORLD_GOLD_SYMBOL, WORLD_SILVER_SYMBOL],
      query: { types: [] }
    },
    columns: ["name", "description", "close", "change", "change_abs"]
  });
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const parseSpot = (symbol, name) => {
    const result = rows.find((row) => row && row.s === symbol);
    const values = result && result.d;
    if (!values || !Number.isFinite(values[2])) {
      console.error(`TradingView ${symbol} failed: Cannot parse spot price`);
      return null;
    }
    return {
      symbol,
      name,
      ounceUsd: values[2],
      change: values[3],
      changeAbs: values[4],
      source: "TradingView"
    };
  };

  return {
    worldGoldSpot: parseSpot(WORLD_GOLD_SYMBOL, "V\u00e0ng th\u1ebf gi\u1edbi"),
    worldSilverSpot: parseSpot(WORLD_SILVER_SYMBOL, "B\u1ea1c th\u1ebf gi\u1edbi")
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
    name: "B\u1ea1c mi\u1ebfng Ph\u00fa Qu\u00fd 999",
    buy: prices[0],
    sell: prices[1],
    unit: "VND/l\u01b0\u1ee3ng",
    source: "Ph\u00fa Qu\u00fd",
    updatedAt: updatedMatch ? updatedMatch[1].trim() : null
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

function parseCurrencyQuote(xml, currencyCode, name, unit) {
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

async function getCurrencyQuotes() {
  const xml = await getText(VCB_EXCHANGE_URL);
  return {
    usd: getOptionalParsedQuote(
      () => parseCurrencyQuote(xml, "USD", "USD Vietcombank", "VND/USD"),
      "Vietcombank USD"
    ),
    eur: getOptionalParsedQuote(
      () => parseCurrencyQuote(xml, "EUR", "EUR Vietcombank", "VND/EUR"),
      "Vietcombank EUR"
    )
  };
}

async function getQuotes() {
  const [gold, silver, currencies, metals] = await Promise.all([
    getOptionalQuote(getGoldQuote, "giavang.org"),
    getOptionalQuote(getSilverQuote, "Phu Quy silver"),
    getOptionalQuote(getCurrencyQuotes, "Vietcombank"),
    getOptionalQuote(getWorldMetalSpots, "TradingView")
  ]);
  const usd = currencies && currencies.usd;
  const eur = currencies && currencies.eur;
  const worldGoldSpot = metals && metals.worldGoldSpot;
  const worldSilverSpot = metals && metals.worldSilverSpot;
  return {
    gold,
    silver,
    usd,
    eur,
    worldGold: worldGoldSpot && usd ? buildWorldGoldQuote(worldGoldSpot, usd) : null,
    worldSilver: worldSilverSpot && usd ? buildWorldGoldQuote(worldSilverSpot, usd) : null
  };
}

async function getOptionalQuote(loader, source) {
  try {
    return await loader();
  } catch (error) {
    console.error(`${source} failed:`, error.message);
    return null;
  }
}

function getOptionalParsedQuote(loader, source) {
  try {
    return loader();
  } catch (error) {
    console.error(`${source} failed:`, error.message);
    return null;
  }
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

module.exports = { getQuotes, getFallbackQuotes, parseCurrencyQuote };
