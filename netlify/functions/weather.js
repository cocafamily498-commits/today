const { getWeather, getFallbackWeather, normalizeRequestedLocation } = require("./data");

const SUCCESS_CACHE_CONTROL = "public, durable, max-age=7200, stale-while-revalidate=300";
const FALLBACK_CACHE_CONTROL = "public, durable, max-age=300";

function weatherResponse(weather, cacheControl) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Netlify-CDN-Cache-Control": cacheControl
    },
    body: JSON.stringify({ weather })
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const requestedLocation = normalizeRequestedLocation({
    name: params.name,
    latitude: params.lat,
    longitude: params.lon
  });
  try {
    const weather = await getWeather(requestedLocation);
    return weatherResponse(weather, SUCCESS_CACHE_CONTROL);
  } catch (error) {
    console.error("Weather endpoint failed:", error.message);
    return weatherResponse(getFallbackWeather(requestedLocation), FALLBACK_CACHE_CONTROL);
  }
};

exports.weatherResponse = weatherResponse;
exports.SUCCESS_CACHE_CONTROL = SUCCESS_CACHE_CONTROL;
exports.FALLBACK_CACHE_CONTROL = FALLBACK_CACHE_CONTROL;
