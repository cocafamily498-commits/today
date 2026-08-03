const WEATHER_LOCATION_KEY = "homnay.weatherLocation";
const WEATHER_DATA_TTL = 2 * 60 * 60 * 1000;
const WEATHER_RETRY_TTL = 5 * 60 * 1000;
let selectedLocationSuggestion = null;
let locationSearchTimer = null;
let locationSearchController = null;
let weatherLoadedAt = 0;
let weatherLoadedEndpoint = "";
let weatherLastAttemptAt = 0;
let weatherLastAttemptEndpoint = "";
let weatherRequestPromise = null;
let weatherRequestEndpoint = "";
let weatherRefreshSetupReady = false;

function getSavedWeatherLocation() {
  try {
    const location = JSON.parse(localStorage.getItem(WEATHER_LOCATION_KEY));
    return location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) ? location : null;
  } catch (error) {
    return null;
  }
}

function setupLocationPicker() {
  const form = document.getElementById("locationForm");
  const input = document.getElementById("locationInput");
  const savedLocation = getSavedWeatherLocation();
  if (savedLocation) input.value = savedLocation.displayName || savedLocation.name;

  input.addEventListener("input", () => {
    selectedLocationSuggestion = null;
    clearTimeout(locationSearchTimer);
    const query = input.value.trim();
    if (query.length < 2) {
      renderLocationSuggestions([]);
      return;
    }
    locationSearchTimer = setTimeout(() => searchLocationSuggestions(query), 250);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.getElementById("locationStatus");
    if (!selectedLocationSuggestion) {
      status.textContent = "Hãy chọn một thành phố trong danh sách gợi ý.";
      return;
    }
    try {
      localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(selectedLocationSuggestion));
    } catch (error) {
      status.textContent = "Không thể lưu địa điểm trên thiết bị này.";
      return;
    }
    input.value = selectedLocationSuggestion.displayName;
    status.textContent = `Đã lưu ${selectedLocationSuggestion.displayName}.`;
    renderLocationSuggestions([]);
    loadWeather({ force: true });
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) renderLocationSuggestions([]);
  });
}

async function searchLocationSuggestions(query) {
  if (locationSearchController) locationSearchController.abort();
  locationSearchController = new AbortController();
  const status = document.getElementById("locationStatus");
  status.textContent = "Đang tìm thành phố...";
  try {
    const response = await fetch(getApiUrl(`/api/locations?q=${encodeURIComponent(query)}`), {
      cache: "no-store",
      signal: locationSearchController.signal
    });
    if (!response.ok) throw new Error("Location search unavailable");
    const data = await response.json();
    renderLocationSuggestions(data.locations || []);
    status.textContent = data.locations && data.locations.length ? "Chọn một kết quả bên dưới." : "Không tìm thấy thành phố phù hợp.";
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = "Chưa thể tìm thành phố. Vui lòng thử lại.";
  }
}

function renderLocationSuggestions(locations) {
  const list = document.getElementById("locationSuggestions");
  const input = document.getElementById("locationInput");
  list.replaceChildren();
  locations.forEach((location) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "location-suggestion";
    button.setAttribute("role", "option");
    button.textContent = location.displayName;
    button.addEventListener("click", () => {
      selectedLocationSuggestion = location;
      input.value = location.displayName;
      document.getElementById("locationStatus").textContent = "Nhấn Áp dụng để lưu thành phố này.";
      renderLocationSuggestions([]);
    });
    list.appendChild(button);
  });
  input.setAttribute("aria-expanded", locations.length ? "true" : "false");
}

function getWeatherEndpoint(savedLocation = getSavedWeatherLocation()) {
  const params = new URLSearchParams();
  if (savedLocation) {
    params.set("name", savedLocation.displayName || savedLocation.name);
    params.set("lat", savedLocation.latitude);
    params.set("lon", savedLocation.longitude);
  }
  const query = params.toString();
  return getApiUrl(query ? `/api/weather?${query}` : "/api/weather");
}

function loadWeather({ force = false } = {}) {
  if (document.hidden) return Promise.resolve(false);
  if (!document.getElementById("weatherCard")) return Promise.resolve(false);

  const savedLocation = getSavedWeatherLocation();
  const endpoint = getWeatherEndpoint(savedLocation);
  if (weatherRequestPromise) {
    if (weatherRequestEndpoint === endpoint) return weatherRequestPromise;
    return weatherRequestPromise.then(() => loadWeather({ force: true }));
  }

  const now = Date.now();
  if (!force && weatherLoadedEndpoint === endpoint
    && weatherLoadedAt && now - weatherLoadedAt < WEATHER_DATA_TTL) return Promise.resolve(false);
  if (!force && weatherLastAttemptEndpoint === endpoint
    && weatherLastAttemptAt && now - weatherLastAttemptAt < WEATHER_RETRY_TTL) return Promise.resolve(false);

  weatherLastAttemptAt = now;
  weatherLastAttemptEndpoint = endpoint;
  weatherRequestEndpoint = endpoint;
  weatherRequestPromise = (async () => {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Weather data unavailable");
    const data = await response.json();
    renderWeather(data.weather);
    weatherLoadedAt = Date.now();
    weatherLoadedEndpoint = endpoint;
    return true;
  })().catch((error) => {
    renderWeather({
      location: { name: savedLocation ? savedLocation.displayName || savedLocation.name : "Thành phố Đà Nẵng" },
      condition: { text: "Tam thoi chua co du lieu", icon: "cloud" },
      temperature: null,
      apparentTemperature: null,
      high: null,
      low: null,
      uvIndex: null,
      uvLabel: "--",
      aqi: null,
      aqiLabel: "--",
      windSpeed: null,
      windGust: null,
      humidity: null,
      precipitation: null,
      cloudCover: null,
      source: "Kiem tra server local"
    });
    return false;
  }).finally(() => {
    weatherRequestPromise = null;
    weatherRequestEndpoint = "";
  });
  return weatherRequestPromise;
}

function setupWeatherDataRefresh() {
  if (weatherRefreshSetupReady) return;
  weatherRefreshSetupReady = true;
  window.setInterval(loadWeather, WEATHER_DATA_TTL);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadWeather();
  });
}

function resetWeatherRefreshState() {
  weatherLoadedAt = 0;
  weatherLoadedEndpoint = "";
  weatherLastAttemptAt = 0;
  weatherLastAttemptEndpoint = "";
  weatherRequestPromise = null;
  weatherRequestEndpoint = "";
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WEATHER_DATA_TTL,
    WEATHER_RETRY_TTL,
    getSavedWeatherLocation,
    getWeatherEndpoint,
    loadWeather,
    resetWeatherRefreshState
  };
}
