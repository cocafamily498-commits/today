const PI = Math.PI;

function jdToDate(jd) {
  let a;
  if (jd > 2299160) {
    const alpha = Math.floor((jd - 1867216.25) / 36524.25);
    a = jd + 1 + alpha - Math.floor(alpha / 4);
  } else {
    a = jd;
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = Math.floor(b - d - Math.floor(30.6001 * e));
  const month = e < 14 ? e - 1 : e - 13;
  const year = month < 3 ? c - 4715 : c - 4716;
  return [day, month, year];
}

function newMoon(k) {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  const dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + .0001178 * t2 - .000000155 * t3;
  jd1 += .00033 * Math.sin((166.56 + 132.87 * t - .009173 * t2) * dr);
  const m = 359.2242 + 29.10535608 * k - .0000333 * t2 - .00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + .0107306 * t2 + .00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - .0016528 * t2 - .00000239 * t3;
  let c1 = (.1734 - .000393 * t) * Math.sin(m * dr) + .0021 * Math.sin(2 * dr * m);
  c1 += -.4068 * Math.sin(mpr * dr) + .0161 * Math.sin(2 * dr * mpr);
  c1 -= .0004 * Math.sin(3 * dr * mpr);
  c1 += .0104 * Math.sin(2 * dr * f) - .0051 * Math.sin((m + mpr) * dr);
  c1 += -.0074 * Math.sin((m - mpr) * dr) + .0004 * Math.sin((2 * f + m) * dr);
  c1 += -.0004 * Math.sin((2 * f - m) * dr) - .0006 * Math.sin((2 * f + mpr) * dr);
  c1 += .001 * Math.sin((2 * f - mpr) * dr) + .0005 * Math.sin((2 * mpr + m) * dr);
  const deltaT = t < -11
    ? .001 + .000839 * t + .0002261 * t2 - .00000845 * t3 - .000000081 * t * t3
    : -.000278 + .000265 * t + .000262 * t2;
  return jd1 + c1 - deltaT;
}

function sunLongitude(jdn) {
  const t = (jdn - 2451545) / 36525;
  const t2 = t * t;
  const dr = PI / 180;
  const m = 357.5291 + 35999.0503 * t - .0001559 * t2 - .00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + .0003032 * t2;
  let dl = (1.9146 - .004817 * t - .000014 * t2) * Math.sin(dr * m);
  dl += (.019993 - .000101 * t) * Math.sin(2 * dr * m) + .00029 * Math.sin(3 * dr * m);
  let longitude = (l0 + dl) * dr;
  longitude -= PI * 2 * Math.floor(longitude / (PI * 2));
  return Math.floor(longitude / PI * 6);
}

function getNewMoonDay(k, timeZone) {
  return Math.floor(newMoon(k) + .5 + timeZone / 24);
}

function getSunLongitude(dayNumber, timeZone) {
  return sunLongitude(dayNumber - .5 - timeZone / 24);
}

function getLunarMonth11(year, timeZone) {
  const a = Math.floor((14 - 12) / 12);
  const y = year + 4800 - a;
  const m = 12 + 12 * a - 3;
  const jd = 31 + Math.floor((153 * m + 2) / 5) + 365 * y
    + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const k = Math.floor((jd - 2415021) / 29.530588853);
  let newMoonDay = getNewMoonDay(k, timeZone);
  if (getSunLongitude(newMoonDay, timeZone) >= 9) {
    newMoonDay = getNewMoonDay(k - 1, timeZone);
  }
  return newMoonDay;
}

function getLeapMonthOffset(a11, timeZone) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + .5);
  let last = 0;
  let index = 1;
  let arc = getSunLongitude(getNewMoonDay(k + index, timeZone), timeZone);
  do {
    last = arc;
    index += 1;
    arc = getSunLongitude(getNewMoonDay(k + index, timeZone), timeZone);
  } while (arc !== last && index < 14);
  return index - 1;
}

function convertLunarToSolar(lunarDay, lunarMonth, lunarYear, lunarLeap, timeZone) {
  let a11;
  let b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }

  const k = Math.floor(.5 + (a11 - 2415021.076998695) / 29.530588853);
  let offset = lunarMonth - 11;
  if (offset < 0) offset += 12;

  if (b11 - a11 > 365) {
    const leapOffset = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOffset - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (lunarLeap && lunarMonth !== leapMonth) return null;
    if (lunarLeap || offset >= leapOffset) offset += 1;
  } else if (lunarLeap) {
    return null;
  }

  const monthStart = getNewMoonDay(k + offset, timeZone);
  const nextMonthStart = getNewMoonDay(k + offset + 1, timeZone);
  if (lunarDay > nextMonthStart - monthStart) return null;

  const jd = monthStart + lunarDay - 1;
  const [day, month, year] = jdToDate(jd);
  return { day, month, year, jd };
}

function parseInput(payload) {
  const lunarDay = Number(payload.lunarDay);
  const lunarMonth = Number(payload.lunarMonth);
  const lunarYear = Number(payload.lunarYear);
  const timeZone = payload.timeZone === undefined ? 7 : Number(payload.timeZone);
  const lunarLeap = payload.lunarLeap === true || payload.lunarLeap === 1;

  if (!Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) throw new Error("Ngày âm phải từ 1 đến 30");
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12) throw new Error("Tháng âm phải từ 1 đến 12");
  if (!Number.isInteger(lunarYear) || lunarYear < 1000 || lunarYear > 3000) throw new Error("Năm âm không hợp lệ");
  if (!Number.isFinite(timeZone) || timeZone < -12 || timeZone > 14) throw new Error("Múi giờ không hợp lệ");
  return { lunarDay, lunarMonth, lunarYear, lunarLeap, timeZone };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Chỉ hỗ trợ phương thức POST" });
  try {
    const input = parseInput(JSON.parse(event.body || "{}"));
    const solar = convertLunarToSolar(
      input.lunarDay,
      input.lunarMonth,
      input.lunarYear,
      input.lunarLeap,
      input.timeZone
    );
    if (!solar) return json(400, { error: "Ngày âm hoặc tháng nhuận không hợp lệ" });
    return json(200, { solar });
  } catch (error) {
    return json(400, { error: error.message || "Dữ liệu không hợp lệ" });
  }
};

exports.convertLunarToSolar = convertLunarToSolar;
exports.parseInput = parseInput;
