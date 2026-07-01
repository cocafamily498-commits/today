const { getVapidConfig, jsonResponse, optionsResponse } = require("./push-shared");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  const config = getVapidConfig();
  return jsonResponse({
    publicKey: config.publicKey,
    configured: Boolean(config.publicKey && config.privateKey)
  });
};
