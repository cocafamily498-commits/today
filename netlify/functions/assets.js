const { getAssets, response, errorResponse } = require("./data");

exports.handler = async () => {
  try {
    const assets = await getAssets();
    return response({ assets });
  } catch (error) {
    return errorResponse(error);
  }
};
