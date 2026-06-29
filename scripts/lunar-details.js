function getVietnamToday() {
  const now = new Date();
  const vietnamTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return vietnamTime;
}

function canChiYear(year) {
  return `${CAN[(year + 6) % 10]} ${CHI[(year + 8) % 12]}`;
}

function canChiMonth(lunarYear, lunarMonth) {
  return `${CAN[(lunarYear * 12 + lunarMonth + 3) % 10]} ${CHI[(lunarMonth + 1) % 12]}`;
}

function canChiDay(jd) {
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
}

function getLunarDayType(jd, lunarMonth) {
  const dayBranch = (jd + 1) % 12;
  const firstAuspiciousBranch = ((lunarMonth - 1) % 6) * 2;
  const deityIndex = (dayBranch - firstAuspiciousBranch + 12) % 12;
  return [0, 1, 4, 5, 7, 10].includes(deityIndex) ? "Ngày Hoàng đạo" : "Ngày Hắc đạo";
}

function getDayOfficer(jd, timeZone) {
  const dayOfficers = ["Kiến", "Trừ", "Mãn", "Bình", "Định", "Chấp", "Phá", "Nguy", "Thành", "Thu", "Khai", "Bế"];
  const dayBranch = (jd + 1) % 12;
  const longitudeAtLocalNoon = solarLongitudeDegrees(jd - timeZone / 24);
  const solarMonthOffset = Math.floor(((longitudeAtLocalNoon - 315 + 360) % 360) / 30);
  const monthBranch = (solarMonthOffset + 2) % 12;
  return dayOfficers[(dayBranch - monthBranch + 12) % 12];
}

function getDayOfficerGuidance(dayOfficer) {
  const guidance = {
    "Kiến": { shouldDo: "Xuất hành, khai trương, cưới hỏi.", shouldAvoid: "Động thổ." },
    "Trừ": { shouldDo: "Tẩy uế, chữa bệnh, giải trừ việc xấu.", shouldAvoid: "Cưới hỏi, khai trương." },
    "Mãn": { shouldDo: "Cầu tài, khai trương, tế lễ.", shouldAvoid: "Kiện tụng." },
    "Bình": { shouldDo: "Xuất hành, sửa chữa, hòa giải.", shouldAvoid: "Kiện tụng, tranh chấp." },
    "Định": { shouldDo: "Cầu tài, giao dịch, ký kết, yến tiệc.", shouldAvoid: "Kiện tụng, đi xa." },
    "Chấp": { shouldDo: "Khởi công, xây dựng, sửa chữa.", shouldAvoid: "Di chuyển, xuất hành, khai trương." },
    "Phá": { shouldDo: "Chữa bệnh, phá dỡ, loại bỏ việc cũ.", shouldAvoid: "Cưới hỏi, khai trương, việc lớn." },
    "Nguy": { shouldDo: "Tế lễ, cầu an, làm việc thận trọng.", shouldAvoid: "Đi xa, leo cao, tiến hành việc lớn." },
    "Thành": { shouldDo: "Khai trương, cưới hỏi, nhập học, cầu tài.", shouldAvoid: "Kiện tụng, tranh chấp." },
    "Thu": { shouldDo: "Thu hoạch, cất giữ, thu tiền, thu nợ.", shouldAvoid: "Khởi công, xuất hành." },
    "Khai": { shouldDo: "Khai trương, xuất hành, cầu tài, mở việc mới.", shouldAvoid: "Đóng cửa, kết thúc việc đang tiến hành." },
    "Bế": { shouldDo: "Cất giữ, đóng cửa, đắp đê, an táng.", shouldAvoid: "Khai trương, xuất hành, mở việc mới." }
  };
  return guidance[dayOfficer] || { shouldDo: "Xem xét theo tính chất công việc.", shouldAvoid: "Tránh quyết định vội vàng." };
}

function getSolarTermForDate(jd, timeZone) {
  const solarTerms = [
    "Xuân phân", "Thanh minh", "Cốc vũ", "Lập hạ", "Tiểu mãn", "Mang chủng",
    "Hạ chí", "Tiểu thử", "Đại thử", "Lập thu", "Xử thử", "Bạch lộ",
    "Thu phân", "Hàn lộ", "Sương giáng", "Lập đông", "Tiểu tuyết", "Đại tuyết",
    "Đông chí", "Tiểu hàn", "Đại hàn", "Lập xuân", "Vũ thủy", "Kinh trập"
  ];
  const startOfLocalDay = jd - .5 - timeZone / 24;
  const startLongitude = solarLongitudeDegrees(startOfLocalDay);
  let endLongitude = solarLongitudeDegrees(startOfLocalDay + 1);
  if (endLongitude < startLongitude) endLongitude += 360;
  const boundary = (Math.floor(startLongitude / 15) + 1) * 15;
  if (boundary > endLongitude + 1e-7) return "";
  return solarTerms[Math.round(boundary / 15) % 24];
}
