function render() {
  const today = getVietnamToday();
  const dd = today.getDate();
  const mm = today.getMonth() + 1;
  const yy = today.getFullYear();
  const lunar = convertSolarToLunar(dd, mm, yy, TIME_ZONE);
  const monthName = new Intl.DateTimeFormat("vi-VN", { month: "long" }).format(today);
  const weekday = titleCaseWords(WEEKDAYS[today.getDay()]);
  const lunarMonth = lunar.leap ? `${lunar.month} nhuận` : lunar.month;
  const fullDate = `${weekday}, ngày ${dd} tháng ${mm} năm ${yy}.`;
  const lunarFullDate = `Ngày ${canChiDay(lunar.jd)}: Ngày ${lunar.day} tháng ${lunarMonth} năm ${canChiYear(lunar.year)}.`;

  document.getElementById("solarFullDate").textContent = fullDate;
  document.getElementById("solarMonth").textContent = `${monthName} năm ${yy}`;
  document.getElementById("solarDay").textContent = String(dd).padStart(2, "0");
  document.getElementById("lunarDate").textContent = lunarFullDate;
}

function titleCaseWords(text) {
  return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatVnd(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatWeatherValue(value, suffix = "") {
  return value === null || value === undefined ? "--" : `${value}${suffix}`;
}

function renderWeatherIcon(icon) {
  const icons = {
    sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`,
    moon: `<svg viewBox="0 0 24 24"><path d="M20 14.7A7.5 7.5 0 0 1 9.3 4 8.5 8.5 0 1 0 20 14.7Z"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M17.5 19H8a6 6 0 1 1 5.6-8.1A4.5 4.5 0 1 1 17.5 19Z"></path></svg>`,
    "partly-cloudy": `<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"></circle><path d="M8 2v1"></path><path d="M8 13v1"></path><path d="M2 8h1"></path><path d="M13 8h1"></path><path d="m4.5 4.5.7.7"></path><path d="m10.8 10.8.7.7"></path><path d="M16.5 20H9a4.8 4.8 0 0 1 .7-9.5 5.8 5.8 0 0 1 10.6 3.2A3.5 3.5 0 0 1 16.5 20Z"></path></svg>`,
    "cloud-moon": `<svg viewBox="0 0 24 24"><path d="M19 8.8A5.5 5.5 0 0 1 13.2 3 6.4 6.4 0 0 0 12 9.9"></path><path d="M17.5 20H8.2a5.2 5.2 0 1 1 4.9-7A4 4 0 1 1 17.5 20Z"></path></svg>`,
    rain: `<svg viewBox="0 0 24 24"><path d="M17.5 17H8a6 6 0 1 1 5.6-8.1A4.5 4.5 0 1 1 17.5 17Z"></path><path d="M8 20v2"></path><path d="M12 19v2"></path><path d="M16 20v2"></path></svg>`,
    drizzle: `<svg viewBox="0 0 24 24"><path d="M17.5 17H8a6 6 0 1 1 5.6-8.1A4.5 4.5 0 1 1 17.5 17Z"></path><path d="M9 20h.01"></path><path d="M13 20h.01"></path><path d="M17 20h.01"></path></svg>`,
    storm: `<svg viewBox="0 0 24 24"><path d="M17.5 16H8a6 6 0 1 1 5.6-8.1A4.5 4.5 0 1 1 17.5 16Z"></path><path d="m13 14-3 5h4l-2 3"></path></svg>`,
    fog: `<svg viewBox="0 0 24 24"><path d="M17.5 15H8a5 5 0 1 1 4.8-6.4A4 4 0 1 1 17.5 15Z"></path><path d="M4 19h16"></path><path d="M6 22h12"></path></svg>`,
    snow: `<svg viewBox="0 0 24 24"><path d="M17.5 16H8a6 6 0 1 1 5.6-8.1A4.5 4.5 0 1 1 17.5 16Z"></path><path d="M8 20h.01"></path><path d="M12 20h.01"></path><path d="M16 20h.01"></path></svg>`
  };

  return icons[icon] || icons.cloud;
}

function renderWeather(weather) {
  const locationName = weather.location && weather.location.name ? weather.location.name : "Thành phố Hồ Chí Minh";
  const condition = weather.condition || { text: "Thời tiết hôm nay", icon: "cloud" };
  document.getElementById("weatherCard").innerHTML = `
    <div class="weather-main">
      <div class="weather-icon weather-icon-${condition.icon}" aria-hidden="true">${renderWeatherIcon(condition.icon)}</div>
      <div>
        <p class="weather-location">Tại ${locationName}</p>
        <div class="weather-temp-row">
          <p class="weather-temp">${formatWeatherValue(weather.temperature, "°")}</p>
          <p class="weather-condition">${condition.text}</p>
        </div>
        <p class="weather-feels">Cảm giác như ${formatWeatherValue(weather.apparentTemperature, "°")} · ${weather.source}</p>
      </div>
    </div>
    <div class="weather-stats">
      ${renderWeatherStat("Cao / thấp", `${formatWeatherValue(weather.high, "°")} / ${formatWeatherValue(weather.low, "°")}`)}
      ${renderWeatherStat("UV", formatWeatherValue(weather.uvIndex), weather.uvLabel)}
      ${renderWeatherStat("AQI", formatWeatherValue(weather.aqi), weather.aqiLabel)}
      ${renderWeatherStat("Gió", formatWeatherValue(weather.windSpeed, " km/h"), weather.windGust === null ? "" : `Giật ${weather.windGust} km/h`)}
      ${renderWeatherStat("Độ ẩm", formatWeatherValue(weather.humidity, "%"))}
      ${renderWeatherStat("Mưa / mây", `${formatWeatherValue(weather.precipitation, " mm")} · ${formatWeatherValue(weather.cloudCover, "%")}`)}
    </div>
  `;
}

function renderWeatherStat(label, value, note = "") {
  return `
    <div class="weather-stat">
      <p class="weather-stat-label">${label}</p>
      <p class="weather-stat-value">${value}</p>
      ${note ? `<p class="weather-stat-note">${note}</p>` : ""}
    </div>
  `;
}
