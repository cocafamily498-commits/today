const { getQuotes, getFallbackQuotes } = require("./data");

const SUCCESS_CACHE_CONTROL = "public, durable, max-age=3600, stale-while-revalidate=300";
const FALLBACK_CACHE_CONTROL = "public, durable, max-age=300";

function quotesResponse(quotes, cacheControl) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Netlify-CDN-Cache-Control": cacheControl
    },
    body: JSON.stringify(quotes)
  };
}

function hasAnyQuote(quotes) {
  return Object.values(quotes).some((quote) => quote !== null);
}

exports.handler = async () => {
  try {
    const quotes = await getQuotes();
    return quotesResponse(
      quotes,
      hasAnyQuote(quotes) ? SUCCESS_CACHE_CONTROL : FALLBACK_CACHE_CONTROL
    );
  } catch (error) {
    console.error("Quotes endpoint failed:", error.message);
    return quotesResponse(getFallbackQuotes(), FALLBACK_CACHE_CONTROL);
  }
};

exports.hasAnyQuote = hasAnyQuote;
exports.quotesResponse = quotesResponse;
exports.SUCCESS_CACHE_CONTROL = SUCCESS_CACHE_CONTROL;
exports.FALLBACK_CACHE_CONTROL = FALLBACK_CACHE_CONTROL;
