const { getMarkets, response, errorResponse } = require("./data");

exports.handler = async () => {
  try {
    const markets = await getMarkets();
    return response(
      { markets },
      "public, max-age=60, s-maxage=300, stale-while-revalidate=300"
    );
  } catch (error) {
    return errorResponse(error);
  }
};
