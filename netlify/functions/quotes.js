const { getQuotes, response, errorResponse } = require("./data");

exports.handler = async () => {
  try {
    const quotes = await getQuotes();
    return response(quotes);
  } catch (error) {
    return errorResponse(error);
  }
};
