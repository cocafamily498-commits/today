const { getWeather, response, errorResponse } = require("./data");

exports.handler = async (event) => {
  try {
    const headers = event.headers || {};
    const clientIp = headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || headers["client-ip"];
    const params = event.queryStringParameters || {};
    const weather = await getWeather(clientIp, {
      name: params.name,
      latitude: params.lat,
      longitude: params.lon
    });
    return response({ weather });
  } catch (error) {
    return errorResponse(error);
  }
};
