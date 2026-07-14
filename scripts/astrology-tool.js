const ASTROLOGY_NAP_AM = [
  ["Hải Trung Kim", "Kim", "vàng trong biển, tượng trưng cho giá trị tiềm ẩn"],
  ["Lư Trung Hỏa", "Hỏa", "lửa trong lò, tượng trưng cho sức nóng bền bỉ"],
  ["Đại Lâm Mộc", "Mộc", "cây rừng lớn, tượng trưng cho sự vững chãi và che chở"],
  ["Lộ Bàng Thổ", "Thổ", "đất ven đường, tượng trưng cho nền tảng bền chắc"],
  ["Kiếm Phong Kim", "Kim", "kim loại mũi kiếm, tượng trưng cho sự sắc bén"],
  ["Sơn Đầu Hỏa", "Hỏa", "lửa trên núi, tượng trưng cho ánh sáng mạnh mẽ"],
  ["Giản Hạ Thủy", "Thủy", "nước dưới khe, tượng trưng cho dòng chảy kín đáo"],
  ["Thành Đầu Thổ", "Thổ", "đất trên thành, tượng trưng cho sự bảo vệ vững vàng"],
  ["Bạch Lạp Kim", "Kim", "kim loại đang tinh luyện, tượng trưng cho sự tôi rèn"],
  ["Dương Liễu Mộc", "Mộc", "gỗ cây dương liễu, tượng trưng cho sự mềm dẻo"],
  ["Tuyền Trung Thủy", "Thủy", "nước trong suối, tượng trưng cho nguồn sống trong lành"],
  ["Ốc Thượng Thổ", "Thổ", "đất trên mái nhà, tượng trưng cho sự chở che"],
  ["Tích Lịch Hỏa", "Hỏa", "lửa sấm sét, tượng trưng cho năng lượng bùng nổ"],
  ["Tùng Bách Mộc", "Mộc", "gỗ tùng bách, tượng trưng cho sức sống bền bỉ"],
  ["Trường Lưu Thủy", "Thủy", "dòng nước dài, tượng trưng cho sự vận động không ngừng"],
  ["Sa Trung Kim", "Kim", "kim loại trong cát, tượng trưng cho giá trị cần khai mở"],
  ["Sơn Hạ Hỏa", "Hỏa", "lửa dưới núi, tượng trưng cho hơi ấm âm thầm"],
  ["Bình Địa Mộc", "Mộc", "cây nơi đồng bằng, tượng trưng cho sự sinh trưởng rộng mở"],
  ["Bích Thượng Thổ", "Thổ", "đất trên vách, tượng trưng cho sự ổn định và bảo hộ"],
  ["Kim Bạch Kim", "Kim", "kim loại tinh khiết, tượng trưng cho sự rõ ràng và cứng cáp"],
  ["Phú Đăng Hỏa", "Hỏa", "lửa đèn, tượng trưng cho ánh sáng dẫn đường"],
  ["Thiên Hà Thủy", "Thủy", "nước trên trời, tượng trưng cho nguồn nước nuôi dưỡng"],
  ["Đại Trạch Thổ", "Thổ", "đất vùng rộng lớn, tượng trưng cho sự bao dung và màu mỡ"],
  ["Thoa Xuyến Kim", "Kim", "vàng bạc trang sức, tượng trưng cho vẻ đẹp tinh tế và giá trị quý báu"],
  ["Tang Đố Mộc", "Mộc", "gỗ cây dâu, tượng trưng cho sự hữu ích và sinh sôi"],
  ["Đại Khê Thủy", "Thủy", "nước khe lớn, tượng trưng cho dòng chảy mạnh và linh hoạt"],
  ["Sa Trung Thổ", "Thổ", "đất pha cát, tượng trưng cho nền tảng đang bồi tụ"],
  ["Thiên Thượng Hỏa", "Hỏa", "lửa trên trời, tượng trưng cho nguồn sáng rộng lớn"],
  ["Thạch Lựu Mộc", "Mộc", "gỗ cây lựu đá, tượng trưng cho sức sống kiên cường"],
  ["Đại Hải Thủy", "Thủy", "nước biển lớn, tượng trưng cho sự bao la và mạnh mẽ"]
];

const ASTROLOGY_PALACES = {
  1: { name: "Khảm", group: "Đông tứ mệnh", good: "Bắc, Đông, Đông Nam, Nam", bad: "Tây Nam, Đông Bắc, Tây, Tây Bắc" },
  2: { name: "Khôn", group: "Tây tứ mệnh", good: "Đông Bắc, Tây, Tây Bắc, Tây Nam", bad: "Bắc, Đông, Đông Nam, Nam" },
  3: { name: "Chấn", group: "Đông tứ mệnh", good: "Nam, Bắc, Đông Nam, Đông", bad: "Tây, Tây Bắc, Đông Bắc, Tây Nam" },
  4: { name: "Tốn", group: "Đông tứ mệnh", good: "Bắc, Nam, Đông, Đông Nam", bad: "Đông Bắc, Tây Nam, Tây Bắc, Tây" },
  6: { name: "Càn", group: "Tây tứ mệnh", good: "Tây, Đông Bắc, Tây Nam, Tây Bắc", bad: "Nam, Đông, Bắc, Đông Nam" },
  7: { name: "Đoài", group: "Tây tứ mệnh", good: "Tây Bắc, Tây Nam, Đông Bắc, Tây", bad: "Đông, Đông Nam, Bắc, Nam" },
  8: { name: "Cấn", group: "Tây tứ mệnh", good: "Tây Nam, Tây Bắc, Tây, Đông Bắc", bad: "Đông Nam, Bắc, Đông, Nam" },
  9: { name: "Ly", group: "Đông tứ mệnh", good: "Đông, Đông Nam, Bắc, Nam", bad: "Tây Bắc, Tây, Tây Nam, Đông Bắc" }
};

const ASTROLOGY_COLORS = {
  Kim: { good: [["Trắng", "#ffffff"], ["Xám", "#9ca3af"], ["Vàng", "#f5c542"], ["Nâu đất", "#8b5e3c"]], bad: [["Đỏ", "#dc2626"], ["Hồng", "#ec4899"], ["Cam", "#f97316"], ["Tím", "#7c3aed"]] },
  Mộc: { good: [["Xanh lá", "#16a34a"], ["Đen", "#111827"], ["Xanh dương", "#2563eb"]], bad: [["Trắng", "#ffffff"], ["Xám", "#9ca3af"], ["Vàng", "#f5c542"], ["Nâu đất", "#8b5e3c"]] },
  Thủy: { good: [["Đen", "#111827"], ["Xanh dương", "#2563eb"], ["Trắng", "#ffffff"], ["Xám", "#9ca3af"]], bad: [["Vàng", "#f5c542"], ["Nâu đất", "#8b5e3c"], ["Xanh lá", "#16a34a"]] },
  Hỏa: { good: [["Đỏ", "#dc2626"], ["Hồng", "#ec4899"], ["Cam", "#f97316"], ["Tím", "#7c3aed"], ["Xanh lá", "#16a34a"]], bad: [["Đen", "#111827"], ["Xanh dương", "#2563eb"], ["Trắng", "#ffffff"], ["Xám", "#9ca3af"]] },
  Thổ: { good: [["Vàng", "#f5c542"], ["Nâu đất", "#8b5e3c"], ["Đỏ", "#dc2626"], ["Hồng", "#ec4899"]], bad: [["Xanh lá", "#16a34a"], ["Đen", "#111827"], ["Xanh dương", "#2563eb"]] }
};

function astrologyDigitRoot(value) {
  let result = Math.abs(value);
  while (result > 9) result = String(result).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return result;
}

function getAstrologyPalace(year, gender) {
  const root = astrologyDigitRoot(year % 100);
  let number = year < 2000
    ? (gender === "male" ? astrologyDigitRoot(10 - root) : astrologyDigitRoot(root + 5))
    : (gender === "male" ? 9 - root : astrologyDigitRoot(root + 6));
  if (number === 0) number = 9;
  if (number === 5) number = gender === "male" ? 2 : 8;
  return ASTROLOGY_PALACES[number];
}

function getAstrologyNapAm(year) {
  const cycleIndex = ((year - 1984) % 60 + 60) % 60;
  const [name, element, meaning] = ASTROLOGY_NAP_AM[Math.floor(cycleIndex / 2)];
  return { name, element, meaning };
}

function getAstrologyStar(age, gender) {
  const male = { 0: "Mộc Đức", 1: "La Hầu", 2: "Thổ Tú", 3: "Thủy Diệu", 4: "Thái Bạch", 5: "Thái Dương", 6: "Vân Hớn", 7: "Kế Đô", 8: "Thái Âm" };
  const female = { 0: "Thủy Diệu", 1: "Kế Đô", 2: "Vân Hớn", 3: "Mộc Đức", 4: "Thái Âm", 5: "Thổ Tú", 6: "La Hầu", 7: "Thái Dương", 8: "Thái Bạch" };
  return (gender === "male" ? male : female)[age % 9];
}

function getAstrologyLimit(age, gender) {
  const male = { 0: "Thiên Tinh", 1: "Toán Tận", 2: "Thiên La", 3: "Địa Võng", 4: "Diêm Vương", 5: "Huỳnh Tuyền", 6: "Tam Kheo", 7: "Ngũ Mộ" };
  const female = { 0: "Địa Võng", 1: "Diêm Vương", 2: "Tam Kheo", 3: "Ngũ Mộ", 4: "Thiên Tinh", 5: "Toán Tận", 6: "Huỳnh Tuyền", 7: "Thiên La" };
  return (gender === "male" ? male : female)[age % 8];
}

function renderAstrologyColors(colors) {
  return `<span class="astrology-color-list">${colors.map(([name, value]) =>
    `<span class="astrology-color-item"><span class="astrology-color-swatch" style="background:${value}"></span>${name}</span>`
  ).join("")}</span>`;
}

function setupAstrologyTool() {
  const form = document.getElementById("astrologyLookupForm");
  if (!form || form.dataset.ready === "true") return;
  form.dataset.ready = "true";
  const typeButton = document.getElementById("astrologyCalendarTypeButton");
  const help = document.getElementById("astrologyDateHelp");
  const leap = document.getElementById("astrologyInputLeap");
  const leapOption = document.getElementById("astrologyLeapOption");
  const dayInput = document.getElementById("astrologyInputDay");
  const lookupYearInput = document.getElementById("astrologyLookupYear");
  const message = document.getElementById("astrologyMessage");
  const result = document.getElementById("astrologyResult");
  const details = document.getElementById("astrologyResultDetails");
  const today = getVietnamToday();
  const todayLunar = convertSolarToLunar(today.getDate(), today.getMonth() + 1, today.getFullYear(), TIME_ZONE);
  let lunarMode = true;
  let gender = "male";

  document.getElementById("astrologyInputDay").value = todayLunar.day;
  document.getElementById("astrologyInputMonth").value = todayLunar.month;
  document.getElementById("astrologyInputYear").value = todayLunar.year;
  leap.checked = todayLunar.leap;
  setupNumberEntryControl("astrologyInputDay", "astrologyDayPicker", 1, 31);
  setupNumberEntryControl("astrologyInputMonth", "astrologyMonthPicker", 1, 12);
  setupNumberEntryControl("astrologyInputYear", "astrologyYearPicker", CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR);
  lookupYearInput.value = String(today.getFullYear());
  setupNumberEntryControl("astrologyLookupYear", "astrologyLookupYearPicker", CALENDAR_MIN_YEAR, CALENDAR_MAX_YEAR);

  const clearResult = () => {
    message.textContent = "";
    result.hidden = true;
    details.innerHTML = "";
  };

  const setCalendarMode = (useLunar) => {
    lunarMode = useLunar;
    typeButton.textContent = useLunar ? "Ngày Âm lịch" : "Ngày dương lịch";
    typeButton.setAttribute("aria-pressed", String(useLunar));
    help.textContent = useLunar
      ? "Nhập ngày sinh âm lịch; nếu có hai tháng cùng số, hãy xác định tháng thường hay tháng nhuận."
      : "Nhập ngày sinh dương lịch để quy đổi sang năm âm lịch tương ứng.";
    dayInput.max = useLunar ? "30" : "31";
    leap.disabled = !useLunar;
    if (!useLunar) leap.checked = false;
    leapOption.classList.toggle("is-disabled", !useLunar);
    clearResult();
  };

  typeButton.addEventListener("click", () => setCalendarMode(!lunarMode));
  form.querySelectorAll("[data-gender]").forEach((button) => {
    button.addEventListener("click", () => {
      gender = button.dataset.gender;
      form.querySelectorAll("[data-gender]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      clearResult();
    });
  });
  form.addEventListener("input", clearResult);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearResult();
    const day = Number(dayInput.value);
    const month = Number(document.getElementById("astrologyInputMonth").value);
    const enteredYear = Number(document.getElementById("astrologyInputYear").value);
    const lookupYear = Number(lookupYearInput.value);
    let lunarYear = enteredYear;
    let lunarBirthDate;
    let solarBirthDate;

    try {
      if (lunarMode) {
        lunarBirthDate = { day, month, year: enteredYear, leap: leap.checked };
        solarBirthDate = await convertLunarToSolar(day, month, enteredYear, leap.checked, TIME_ZONE);
      } else {
        if (!isValidSolarDate(day, month, enteredYear)) throw new Error("Ngày dương lịch không hợp lệ.");
        solarBirthDate = { day, month, year: enteredYear };
        lunarBirthDate = convertSolarToLunar(day, month, enteredYear, TIME_ZONE);
        lunarYear = lunarBirthDate.year;
      }
    } catch (error) {
      message.textContent = error.message || "Ngày đã nhập không hợp lệ.";
      return;
    }

    if (lookupYear < lunarYear) {
      message.textContent = "Năm cần tra sao hạn không được nhỏ hơn năm sinh âm lịch.";
      return;
    }

    const palace = getAstrologyPalace(lunarYear, gender);
    const napAm = getAstrologyNapAm(lunarYear);
    const colors = ASTROLOGY_COLORS[napAm.element];
    const lunarAge = lookupYear - lunarYear + 1;
    const genderLabel = gender === "male" ? "Nam" : "Nữ";
    const lunarLeapLabel = lunarBirthDate.leap ? " nhuận" : "";
    const napAmDisplayName = napAm.name.charAt(0) + napAm.name.slice(1).toLowerCase();
    details.innerHTML = `
      <dt>Ngày sinh âm lịch</dt>
      <dd class="astrology-birth-date-value">
        <strong>${genderLabel} ${lunarBirthDate.day}/${lunarBirthDate.month}${lunarLeapLabel}/${canChiYear(lunarYear)}</strong>
        <span class="astrology-solar-birth-date">Ngày sinh dương lịch: ${solarBirthDate.day}/${solarBirthDate.month}/${solarBirthDate.year}</span>
      </dd>
      <dt>Cung</dt><dd>${palace.name} – ${palace.group}</dd>
      <dt>Hướng hợp</dt><dd>${palace.good}</dd>
      <dt>Hướng xung</dt><dd>${palace.bad}</dd>
      <dt>Mạng</dt><dd>${napAmDisplayName} (${napAm.meaning})</dd>
      <dt>Màu hợp</dt><dd>${renderAstrologyColors(colors.good)}</dd>
      <dt>Màu xung</dt><dd>${renderAstrologyColors(colors.bad)}</dd>
      <dt>Sao chiếu mệnh năm ${lookupYear}</dt><dd>${getAstrologyStar(lunarAge, gender)} (tuổi âm ${lunarAge})</dd>
      <dt>Hạn năm ${lookupYear}</dt><dd>${getAstrologyLimit(lunarAge, gender)}</dd>`;
    result.hidden = false;
  });

  setCalendarMode(true);
}
