function renderMarkets(markets) {
  renderMarketsToGrid("marketGrid", markets);
}

const STOCK_MARKET_OPEN_TTL = 5 * 60 * 1000;
const STOCK_MARKET_CLOSED_TTL = 60 * 60 * 1000;
const ASSET_DATA_TTL = 60 * 60 * 1000;
let marketsLoadedAt = 0;
let assetsLoadedAt = 0;
let marketsRequestPromise = null;
let assetsRequestPromise = null;
let marketRefreshSetupReady = false;

async function loadMarkets() {
  if (document.hidden) return false;
  const now = Date.now();
  if (marketsLoadedAt && now - marketsLoadedAt < getStockMarketRefreshTtl(new Date(now))) return false;
  if (marketsRequestPromise) return marketsRequestPromise;
  marketsLoadedAt = now;

  marketsRequestPromise = (async () => {
    const response = await fetch(getApiUrl("/api/markets"));
    if (!response.ok) throw new Error("Market data unavailable");
    const data = await response.json();
    renderMarkets(data.markets);
    marketsLoadedAt = Date.now();
    return true;
  })().catch((error) => {
    const grid = document.getElementById("marketGrid");
    grid.innerHTML = `
      <div class="market-item">
        <p class="market-name">Chỉ số thị trường</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Chạy bằng server local để tải dữ liệu</p>
      </div>
    `;
    return false;
  }).finally(() => {
    marketsRequestPromise = null;
  });
  return marketsRequestPromise;
}

async function loadAssets() {
  if (document.hidden) return false;
  const now = Date.now();
  if (assetsLoadedAt && now - assetsLoadedAt < ASSET_DATA_TTL) return false;
  if (assetsRequestPromise) return assetsRequestPromise;
  assetsLoadedAt = now;

  assetsRequestPromise = (async () => {
    const response = await fetch(getApiUrl("/api/assets"));
    if (!response.ok) throw new Error("Asset data unavailable");
    const data = await response.json();
    renderMarketsToGrid("assetGrid", data.assets);
    assetsLoadedAt = Date.now();
    return true;
  })().catch((error) => {
    document.getElementById("assetGrid").innerHTML = `
      <div class="market-item">
        <p class="market-name">Bitcoin & dầu</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Chạy bằng server local để tải dữ liệu</p>
      </div>
    `;
    return false;
  }).finally(() => {
    assetsRequestPromise = null;
  });
  return assetsRequestPromise;
}

function setupMarketDataRefresh() {
  if (marketRefreshSetupReady) return;
  marketRefreshSetupReady = true;
  window.setInterval(loadMarkets, 60 * 1000);
  window.setInterval(loadAssets, ASSET_DATA_TTL);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    loadMarkets();
    loadAssets();
  });
}

function getStockMarketRefreshTtl(now = new Date()) {
  return isVietnamStockMarketOpen(now) || isUsStockMarketOpen(now)
    ? STOCK_MARKET_OPEN_TTL
    : STOCK_MARKET_CLOSED_TTL;
}

function isVietnamStockMarketOpen(now) {
  return isMarketSessionOpen(now, "Asia/Ho_Chi_Minh", [
    [9 * 60, 11 * 60 + 30],
    [13 * 60, 15 * 60]
  ]);
}

function isUsStockMarketOpen(now) {
  return isMarketSessionOpen(now, "America/New_York", [
    [9 * 60 + 30, 16 * 60]
  ]);
}

function isMarketSessionOpen(now, timeZone, sessions) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  return sessions.some(([start, end]) => minuteOfDay >= start && minuteOfDay < end);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ASSET_DATA_TTL,
    STOCK_MARKET_CLOSED_TTL,
    STOCK_MARKET_OPEN_TTL,
    getStockMarketRefreshTtl,
    isUsStockMarketOpen,
    isVietnamStockMarketOpen
  };
}

function renderMarketsToGrid(gridId, items) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = items.map((market) => {
    const hasData = Number.isFinite(market.close)
      && Number.isFinite(market.changeAbs)
      && Number.isFinite(market.change);
    if (!hasData) {
      return `
        <div class="market-item">
          <p class="market-name">${market.name}</p>
          <p class="market-value">--</p>
          <p class="market-change flat">Tạm thời chưa có dữ liệu</p>
        </div>
      `;
    }

    const direction = market.changeAbs > 0 ? "up" : market.changeAbs < 0 ? "down" : "flat";
    const sign = market.changeAbs > 0 ? "+" : "";
    return `
      <div class="market-item">
        <p class="market-name">${market.name}</p>
        <p class="market-value">${formatNumber(market.close)}</p>
        <p class="market-change ${direction}">${sign}${formatNumber(market.changeAbs)} (${sign}${market.change.toFixed(2)}%)</p>
      </div>
    `;
  }).join("");
}

function renderQuoteCard(quote, fallbackName = "Giá mua và bán") {
  if (!quote) {
    return `
      <div class="market-item">
        <p class="market-name">${fallbackName}</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Tạm thời chưa có dữ liệu</p>
      </div>
    `;
  }
  return `
    <div class="market-item">
      <p class="market-name">${quote.name}</p>
      <div class="quote-row">
        <div class="quote-side">
          <p class="quote-label">Mua vào</p>
          <p class="quote-value">${quote.buy}</p>
          ${renderQuoteChange(quote.buyChange, quote.changeLabel)}
        </div>
        <div class="quote-side">
          <p class="quote-label">Bán ra</p>
          <p class="quote-value">${quote.sell}</p>
          ${renderQuoteChange(quote.sellChange, quote.changeLabel)}
        </div>
      </div>
      <p class="quote-unit">${quote.unit} · ${quote.source}</p>
    </div>
  `;
}

function renderWorldMetalCard(quote, fallbackName = "Giá thế giới") {
  if (!quote) {
    return `
      <div class="market-item">
        <p class="market-name">${fallbackName}</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Tạm thời chưa có dữ liệu</p>
      </div>
    `;
  }

  const direction = quote.changeAbs > 0 ? "up" : quote.changeAbs < 0 ? "down" : "flat";
  const sign = quote.changeAbs > 0 ? "+" : "";
  const changeText = Number.isFinite(quote.changeAbs) && Number.isFinite(quote.change)
    ? `${sign}${formatNumber(quote.changeAbs)} (${sign}${quote.change.toFixed(2)}%)`
    : "Chưa có mốc so sánh";

  return `
    <div class="market-item">
      <p class="market-name">${quote.name}</p>
      <div class="world-gold-row">
        <div>
          <p class="quote-label">1 ounce</p>
          <p class="world-gold-value">${formatUsd(quote.ounceUsd)}/oz</p>
          <p class="quote-change ${direction}">${changeText}</p>
        </div>
        <div>
          <p class="quote-label">Quy đổi 1 lượng/lạng</p>
          <p class="world-gold-value">${formatVnd(quote.taelVnd)}</p>
          <p class="world-gold-note">${formatUsd(quote.taelUsd)} · theo tỷ giá USD bán ra</p>
        </div>
      </div>
      <p class="quote-unit">${quote.unit} · ${quote.source}</p>
    </div>
  `;
}

function renderQuoteChange(change, fallbackText) {
  if (!change) {
    return "";
  }

  const direction = change.value > 0 ? "up" : change.value < 0 ? "down" : "flat";
  const sign = change.value > 0 ? "+" : "";
  return `<p class="quote-change ${direction}">${sign}${formatNumber(change.value)} (${sign}${change.percent.toFixed(2)}%)</p>`;
}

async function loadQuotes() {
  try {
    const response = await fetch(getApiUrl("/api/quotes"), { cache: "no-store" });
    if (!response.ok) throw new Error("Quote data unavailable");
    const data = await response.json();
    document.getElementById("quoteGrid").innerHTML = [
      renderQuoteCard(data.gold),
      renderWorldMetalCard(data.worldGold)
    ].join("");
    document.getElementById("currencyGrid").innerHTML = [
      renderQuoteCard(data.usd),
      renderQuoteCard(data.eur)
    ].join("");
    document.getElementById("silverGrid").innerHTML = [
      renderQuoteCard(data.silver, "Bạc miếng Phú Quý 999"),
      renderWorldMetalCard(data.worldSilver, "Bạc thế giới")
    ].join("");
  } catch (error) {
    document.getElementById("quoteGrid").innerHTML = `
      <div class="market-item">
        <p class="market-name">Vàng</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Chạy bằng server local để tải dữ liệu</p>
      </div>
    `;
    document.getElementById("currencyGrid").innerHTML = `
      <div class="market-item">
        <p class="market-name">Ngoại tệ</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Tạm thời chưa tải được dữ liệu</p>
      </div>
    `;
    document.getElementById("silverGrid").innerHTML = `
      <div class="market-item">
        <p class="market-name">Bạc</p>
        <p class="market-value">--</p>
        <p class="market-change flat">Tạm thời chưa tải được dữ liệu</p>
      </div>
    `;
  }
}
