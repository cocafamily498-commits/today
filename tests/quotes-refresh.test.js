const assert = require("assert").strict;
const {
  QUOTE_DATA_TTL,
  QUOTE_RETRY_TTL,
  loadQuotes,
  resetQuoteRefreshState
} = require("../scripts/market-panels");

const grids = {
  quoteGrid: { innerHTML: "" },
  currencyGrid: { innerHTML: "" },
  silverGrid: { innerHTML: "" }
};

global.document = {
  hidden: false,
  getElementById: (id) => grids[id] || null
};
global.getApiUrl = (path) => path;

let now = 1_000_000;
const realDateNow = Date.now;
Date.now = () => now;

const quotePayload = {
  gold: null,
  silver: null,
  usd: null,
  eur: null,
  worldGold: null,
  worldSilver: null
};

async function run(name, test) {
  try {
    resetQuoteRefreshState();
    document.hidden = false;
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

(async () => {
  await run("reuses an in-flight quotes request", async () => {
    let resolveFetch;
    let calls = 0;
    global.fetch = () => {
      calls += 1;
      return new Promise((resolve) => { resolveFetch = resolve; });
    };
    const first = loadQuotes();
    const second = loadQuotes();
    assert.equal(first, second);
    assert.equal(calls, 1);
    resolveFetch({ ok: true, json: async () => quotePayload });
    assert.equal(await first, true);
    assert.equal(await second, true);
  });

  await run("does not refresh successful quotes within one hour", async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return { ok: true, json: async () => quotePayload };
    };
    await loadQuotes();
    now += QUOTE_DATA_TTL - 1;
    assert.equal(await loadQuotes(), false);
    assert.equal(calls, 1);
  });

  await run("does not request quotes while the tab is hidden", async () => {
    let calls = 0;
    global.fetch = async () => { calls += 1; };
    document.hidden = true;
    assert.equal(await loadQuotes(), false);
    assert.equal(calls, 0);
  });

  await run("retries a failed request only after the retry TTL", async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return { ok: false };
    };
    assert.equal(await loadQuotes(), false);
    now += QUOTE_RETRY_TTL - 1;
    assert.equal(await loadQuotes(), false);
    assert.equal(calls, 1);
    now += 1;
    assert.equal(await loadQuotes(), false);
    assert.equal(calls, 2);
  });
})().finally(() => {
  Date.now = realDateNow;
}).catch((error) => {
  process.exitCode = 1;
});
