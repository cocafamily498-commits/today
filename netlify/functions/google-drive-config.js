const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

exports.handler = async () => ({
  statusCode: 200,
  headers,
  body: JSON.stringify({
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    configured: Boolean(process.env.GOOGLE_CLIENT_ID)
  })
});
