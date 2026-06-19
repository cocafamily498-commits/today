const { getWeather, response, errorResponse } = require("./data");

exports.handler = async (event) => {
  try {
    const headers = event.headers || {};
    const clientIp = headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || headers["client-ip"];
    const weather = await getWeather(clientIp);
    return response({ weather });
  } catch (error) {
    return errorResponse(error);
  }
};
