const assert = require("assert").strict;
const { getVietnameseValidationMessage } = require("../scripts/app-shell");

function control(validity, properties = {}) {
  return { validity, ...properties };
}

const cases = [
  [control({ valueMissing: true }), "Vui lòng nhập thông tin này."],
  [control({ badInput: true }), "Vui lòng nhập một số hợp lệ."],
  [control({ rangeUnderflow: true }, { min: "1" }), "Giá trị phải lớn hơn hoặc bằng 1."],
  [control({ rangeOverflow: true }, { max: "31" }), "Giá trị phải nhỏ hơn hoặc bằng 31."],
  [control({ patternMismatch: true }), "Vui lòng nhập đúng định dạng yêu cầu."],
  [control({ typeMismatch: true }, { type: "email" }), "Vui lòng nhập địa chỉ email hợp lệ."]
];

cases.forEach(([input, expected]) => {
  assert.equal(getVietnameseValidationMessage(input), expected);
});

console.log("ok - provides Vietnamese browser validation messages");
