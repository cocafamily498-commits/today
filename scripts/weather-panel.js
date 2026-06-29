const WEATHER_LOCATION_KEY = "homnay.weatherLocation";
let selectedLocationSuggestion = null;
let locationSearchTimer = null;
let locationSearchController = null;

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
    localStorage.setItem(WEATHER_LOCATION_KEY, JSON.stringify(selectedLocationSuggestion));
    input.value = selectedLocationSuggestion.displayName;
    status.textContent = `Đã lưu ${selectedLocationSuggestion.displayName}.`;
    renderLocationSuggestions([]);
    loadWeather();
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

async function loadWeather() {
  try {
    const savedLocation = getSavedWeatherLocation();
    const params = new URLSearchParams();
    if (savedLocation) {
      params.set("name", savedLocation.displayName || savedLocation.name);
      params.set("lat", savedLocation.latitude);
      params.set("lon", savedLocation.longitude);
    }
    const endpoint = getApiUrl(params.size ? `/api/weather?${params}` : "/api/weather");
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Weather data unavailable");
    const data = await response.json();
    renderWeather(data.weather);
  } catch (error) {
    renderWeather({
      location: { name: "Thanh pho Ho Chi Minh" },
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
    return;
    document.getElementById("weatherCard").innerHTML = `
      <div class="weather-main">
        <div class="weather-icon weather-icon-cloud" aria-hidden="true">${renderWeatherIcon("cloud")}</div>
        <div>
          <p class="weather-location">Tại Thành phố Hồ Chí Minh</p>
          <div class="weather-temp-row">
            <p class="weather-temp">--°</p>
            <p class="weather-condition">Đang tải</p>
          </div>
        </div>
      </div>
    `;
  }
}
