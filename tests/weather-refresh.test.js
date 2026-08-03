const assert = require("assert").strict;

let savedValue = null;
global.localStorage = {
  getItem: () => savedValue,
  setItem: (key, value) => { savedValue = value; }
};
global.document = {
  hidden: false,
  getElementById: (id) => id === "weatherCard" ? {} : null
};
global.getApiUrl = (path) => path;
global.renderWeather = () => {};

const {
  WEATHER_DATA_TTL,
  WEATHER_RETRY_TTL,
  getSavedWeatherLocation,
  getWeatherEndpoint,
  loadWeather,
  resetWeatherRefreshState
} = require("../scripts/weather-panel");

let now = 2_000_000;
const realDateNow = Date.now;
Date.now = () => now;

const payload = {
  weather: {
    location: { name: "Thành phố Đà Nẵng", latitude: 16.0544, longitude: 108.2022 }
  }
};

async function run(name, test) {
  try {
    savedValue = null;
    document.hidden = false;
    resetWeatherRefreshState();
    await test();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

(async () => {
  await run("uses the shared default weather endpoint", async () => {
    assert.equal(getWeatherEndpoint(), "/api/weather");
  });

  await run("restores a saved location for later app starts", async () => {
    const location = {
      name: "Hội An",
      displayName: "Hội An, Quảng Nam, Việt Nam",
      latitude: 15.88,
      longitude: 108.33
    };
    localStorage.setItem("homnay.weatherLocation", JSON.stringify(location));
    assert.deepEqual(getSavedWeatherLocation(), location);
    assert.match(getWeatherEndpoint(), /lat=15\.88/);
    assert.match(getWeatherEndpoint(), /lon=108\.33/);
  });

  await run("reuses an in-flight request and caches success for two hours", async () => {
    let calls = 0;
    let resolveFetch;
    global.fetch = () => {
      calls += 1;
      return new Promise((resolve) => { resolveFetch = resolve; });
    };
    const first = loadWeather();
    const second = loadWeather();
    assert.equal(first, second);
    assert.equal(calls, 1);
    resolveFetch({ ok: true, json: async () => payload });
    assert.equal(await first, true);
    now += WEATHER_DATA_TTL - 1;
    assert.equal(await loadWeather(), false);
    assert.equal(calls, 1);
  });

  await run("does not request weather while hidden", async () => {
    let calls = 0;
    global.fetch = async () => { calls += 1; };
    document.hidden = true;
    assert.equal(await loadWeather(), false);
    assert.equal(calls, 0);
  });

  await run("retries failures after five minutes", async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return { ok: false };
    };
    assert.equal(await loadWeather(), false);
    now += WEATHER_RETRY_TTL - 1;
    assert.equal(await loadWeather(), false);
    assert.equal(calls, 1);
    now += 1;
    assert.equal(await loadWeather(), false);
    assert.equal(calls, 2);
  });

  await run("forces an immediate request after location changes", async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return { ok: true, json: async () => payload };
    };
    await loadWeather();
    savedValue = JSON.stringify({
      displayName: "Huế, Việt Nam",
      latitude: 16.46,
      longitude: 107.59
    });
    assert.equal(await loadWeather({ force: true }), true);
    assert.equal(calls, 2);
  });
})().finally(() => {
  Date.now = realDateNow;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
