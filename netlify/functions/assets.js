const { getAssets, response, errorResponse } = require("./data");

exports.handler = async () => {
  try {
    const assets = await getAssets();
    return response(
      { assets },
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600"
    );
  } catch (error) {
    return errorResponse(error);
  }
};
