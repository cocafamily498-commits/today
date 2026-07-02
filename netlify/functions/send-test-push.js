const webPush = require("web-push");
const {
  configureWebPush,
  jsonResponse,
  optionsResponse,
  parseJsonBody
} = require("./push-shared");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return jsonResponse({ error: "Only POST is supported." }, 405);

  try {
    configureWebPush();
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }

  try {
    const input = parseJsonBody(event);
    const subscription = input.subscription;
    if (!subscription || !subscription.endpoint) {
      return jsonResponse({ ok: false, error: "Subscription endpoint is required." }, 400);
    }

    const messageId = `test-${Date.now()}`;
    const payload = {
      title: "Sổ tay lịch Việt",
      body: "Thông báo test được gửi từ Netlify Function.",
      tag: "lichviet-test-push",
      url: "/#eventsTab",
      icon: "/icons/app-icon-lichviet-calendar-192.png",
      badge: "/icons/app-icon-lichviet-calendar-192.png",
      eventId: "test-push",
      occurrenceDate: "",
      messageId
    };
    const result = await webPush.sendNotification(subscription, JSON.stringify(payload));

    return jsonResponse({
      ok: true,
      messageId,
      pushServiceStatusCode: result && result.statusCode ? result.statusCode : 201
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return jsonResponse({
      ok: false,
      error: error.message || "Could not send test push.",
      expiredSubscription: statusCode === 404 || statusCode === 410,
      pushServiceStatusCode: statusCode
    }, statusCode === 404 || statusCode === 410 ? 410 : 502);
  }
};
