const assert = require("assert").strict;

async function run(name, test) {
  try {
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function loadDataQuotesWithHttpMock(httpMock) {
  const httpPath = require.resolve("../netlify/functions/data-http");
  const quotesPath = require.resolve("../netlify/functions/data-quotes");
  const originalHttpModule = require.cache[httpPath];
  delete require.cache[quotesPath];
  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: httpMock
  };
  const dataQuotes = require(quotesPath);
  if (originalHttpModule) require.cache[httpPath] = originalHttpModule;
  else delete require.cache[httpPath];
  return dataQuotes;
}

(async () => {
  await run("loads Vietcombank and TradingView once for both quotes", async () => {
    let vcbCalls = 0;
    let tradingViewCalls = 0;
    let tradingViewTickers;
    const xml = '<Exrate CurrencyCode="USD" Buy="23000" Transfer="23100" Sell="23200" />'
      + '<Exrate CurrencyCode="EUR" Buy="25000" Transfer="25100" Sell="25200" />'
      + '<DateTime>03/08/2026 20:00</DateTime>';
    const dataQuotes = loadDataQuotesWithHttpMock({
      getJson: async () => ({}),
      getText: async (url) => {
        if (url.includes("vietcombank")) {
          vcbCalls += 1;
          return xml;
        }
        return "";
      },
      postJson: async (url, body) => {
        tradingViewCalls += 1;
        tradingViewTickers = body.symbols.tickers;
        return {
          data: [
            { s: "TVC:SILVER", d: ["SILVER", "Silver", 38, 1.5, 0.56] },
            { s: "OANDA:XAUUSD", d: ["XAUUSD", "Gold", 3300, -0.5, -16.5] }
          ]
        };
      }
    });

    const quotes = await dataQuotes.getQuotes();
    assert.equal(vcbCalls, 1);
    assert.equal(tradingViewCalls, 1);
    assert.deepEqual(tradingViewTickers, ["OANDA:XAUUSD", "TVC:SILVER"]);
    assert.equal(quotes.usd.sell, "23200");
    assert.equal(quotes.eur.sell, "25200");
    assert.equal(quotes.worldGold.symbol, "OANDA:XAUUSD");
    assert.equal(quotes.worldSilver.symbol, "TVC:SILVER");
    assert.deepEqual(Object.keys(quotes), [
      "gold", "silver", "usd", "eur", "worldGold", "worldSilver"
    ]);
  });

  await run("keeps one malformed Vietcombank currency isolated", async () => {
    const { parseCurrencyQuote } = loadDataQuotesWithHttpMock({
      getJson: async () => ({}),
      getText: async () => "",
      postJson: async () => ({})
    });
    const xml = '<Exrate CurrencyCode="USD" Buy="23000" Transfer="23100" Sell="23200" />';
    assert.equal(parseCurrencyQuote(xml, "USD", "USD", "VND/USD").sell, "23200");
    assert.throws(() => parseCurrencyQuote(xml, "EUR", "EUR", "VND/EUR"));
  });

  await run("uses a short CDN TTL only for an all-null fallback", async () => {
    const dataPath = require.resolve("../netlify/functions/data");
    const handlerPath = require.resolve("../netlify/functions/quotes");
    const originalDataModule = require.cache[dataPath];
    const fallback = {
      gold: null, silver: null, usd: null, eur: null, worldGold: null, worldSilver: null
    };
    require.cache[dataPath] = {
      id: dataPath,
      filename: dataPath,
      loaded: true,
      exports: {
        getQuotes: async () => fallback,
        getFallbackQuotes: () => fallback
      }
    };
    delete require.cache[handlerPath];
    const quotesHandler = require(handlerPath);
    const response = await quotesHandler.handler();
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["Netlify-CDN-Cache-Control"],
      quotesHandler.FALLBACK_CACHE_CONTROL
    );
    const successResponse = quotesHandler.quotesResponse(
      { ...fallback, usd: { sell: "23200" } },
      quotesHandler.SUCCESS_CACHE_CONTROL
    );
    assert.equal(
      successResponse.headers["Netlify-CDN-Cache-Control"],
      "public, durable, max-age=3600, stale-while-revalidate=300"
    );
    if (originalDataModule) require.cache[dataPath] = originalDataModule;
    else delete require.cache[dataPath];
    delete require.cache[handlerPath];
  });
})().catch((error) => {
  process.exitCode = 1;
});
