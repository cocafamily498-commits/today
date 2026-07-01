const { getMarkets, getAssets, getFallbackMarkets, getFallbackAssets } = require("./data-markets");
const { getWeather, searchLocations, normalizeRequestedLocation, getFallbackWeather } = require("./data-weather");
const { getQuotes, getFallbackQuotes } = require("./data-quotes");

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
  getWeather,
  searchLocations,
  normalizeRequestedLocation,
  getFallbackMarkets,
  getFallbackAssets,
  getFallbackQuotes,
  getFallbackWeather,
  response,
  errorResponse
};
