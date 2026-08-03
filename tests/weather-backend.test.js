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

function loadWeatherDataWithMock(getJson) {
  const httpPath = require.resolve("../netlify/functions/data-http");
  const weatherPath = require.resolve("../netlify/functions/data-weather");
  const originalHttp = require.cache[httpPath];
  require.cache[httpPath] = {
    id: httpPath,
    filename: httpPath,
    loaded: true,
    exports: { getJson }
  };
  delete require.cache[weatherPath];
  const weatherData = require(weatherPath);
  if (originalHttp) require.cache[httpPath] = originalHttp;
  else delete require.cache[httpPath];
  return weatherData;
}

(async () => {
  await run("uses Da Nang by default without IP geolocation", async () => {
    const urls = [];
    const weatherData = loadWeatherDataWithMock(async (url) => {
      urls.push(url);
      if (url.includes("air-quality")) return { current: { us_aqi: 40, pm2_5: 8 } };
      return {
        current: { temperature_2m: 30, weather_code: 1, is_day: 1 },
        daily: { temperature_2m_max: [32], temperature_2m_min: [25], uv_index_max: [7] }
      };
    });
    const weather = await weatherData.getWeather();
    assert.equal(weather.location.name, "Thành phố Đà Nẵng");
    assert.equal(weather.location.latitude, 16.0544);
    assert.equal(weather.location.longitude, 108.2022);
    assert.equal(urls.length, 2);
    assert.equal(urls.some((url) => /ipwho|ipapi/.test(url)), false);
  });

  await run("returns two-hour CDN cache headers for successful weather", async () => {
    const dataPath = require.resolve("../netlify/functions/data");
    const handlerPath = require.resolve("../netlify/functions/weather");
    const originalData = require.cache[dataPath];
    const weather = { location: { name: "Thành phố Đà Nẵng" }, temperature: 30 };
    require.cache[dataPath] = {
      id: dataPath,
      filename: dataPath,
      loaded: true,
      exports: {
        getWeather: async () => weather,
        getFallbackWeather: () => weather,
        normalizeRequestedLocation: () => null
      }
    };
    delete require.cache[handlerPath];
    const handler = require(handlerPath);
    const response = await handler.handler({ queryStringParameters: null, headers: { "x-forwarded-for": "1.2.3.4" } });
    assert.equal(
      response.headers["Netlify-CDN-Cache-Control"],
      "public, durable, max-age=7200, stale-while-revalidate=300"
    );
    if (originalData) require.cache[dataPath] = originalData;
    else delete require.cache[dataPath];
    delete require.cache[handlerPath];
  });
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
