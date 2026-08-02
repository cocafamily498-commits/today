const assert = require("assert").strict;
const {
  STOCK_MARKET_CLOSED_TTL,
  STOCK_MARKET_OPEN_TTL,
  getStockMarketRefreshTtl,
  isUsStockMarketOpen,
  isVietnamStockMarketOpen
} = require("../scripts/market-panels");

function run(name, test) {
  try {
    test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run("detects Vietnam morning and afternoon sessions", () => {
  assert.equal(isVietnamStockMarketOpen(new Date("2026-08-03T02:00:00.000Z")), true);
  assert.equal(isVietnamStockMarketOpen(new Date("2026-08-03T05:00:00.000Z")), false);
  assert.equal(isVietnamStockMarketOpen(new Date("2026-08-03T06:30:00.000Z")), true);
  assert.equal(isVietnamStockMarketOpen(new Date("2026-08-03T08:00:00.000Z")), false);
});

run("detects US regular session with New York daylight saving time", () => {
  assert.equal(isUsStockMarketOpen(new Date("2026-08-03T13:29:00.000Z")), false);
  assert.equal(isUsStockMarketOpen(new Date("2026-08-03T13:30:00.000Z")), true);
  assert.equal(isUsStockMarketOpen(new Date("2026-08-03T20:00:00.000Z")), false);
});

run("treats weekends as closed", () => {
  const saturday = new Date("2026-08-01T14:00:00.000Z");
  assert.equal(isVietnamStockMarketOpen(saturday), false);
  assert.equal(isUsStockMarketOpen(saturday), false);
  assert.equal(getStockMarketRefreshTtl(saturday), STOCK_MARKET_CLOSED_TTL);
});

run("uses fast TTL whenever either stock market is open", () => {
  assert.equal(getStockMarketRefreshTtl(new Date("2026-08-03T02:00:00.000Z")), STOCK_MARKET_OPEN_TTL);
  assert.equal(getStockMarketRefreshTtl(new Date("2026-08-03T14:00:00.000Z")), STOCK_MARKET_OPEN_TTL);
});
