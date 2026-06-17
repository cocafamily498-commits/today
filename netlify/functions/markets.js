const { getMarkets, response, errorResponse } = require("./data");

exports.handler = async () => {
  try {
    const markets = await getMarkets();
    return response({ markets });
  } catch (error) {
    return errorResponse(error);
  }
};
