const { searchLocations, response, errorResponse } = require("./data");

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const locations = await searchLocations(params.q);
    return response({ locations });
  } catch (error) {
    return errorResponse(error);
  }
};
