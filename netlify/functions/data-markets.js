const { postJson, getJson } = require("./data-http");

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
      { symbol: "NYMEX:CL1!", name: "D\u1ea7u WTI" },
      { symbol: "ICEEUR:BRN1!", name: "D\u1ea7u Brent" }
    ]
  }
];

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


function getFallbackMarkets() {
  return [
    ...US_MARKETS.map((item) => emptyMarket({ ...item, symbol: decodeURIComponent(item.symbol) })),
    ...MARKET_GROUPS.flatMap((group) => group.symbols.map(emptyMarket))
  ];
}

function getFallbackAssets() {
  return ASSET_GROUPS.flatMap((group) => group.symbols.map(emptyMarket));
}

module.exports = { getMarkets, getAssets, getFallbackMarkets, getFallbackAssets };
