const http = require("http");
const https = require("https");

function postJson(url, data) {
  const body = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "user-agent": "Mozilla/5.0"
      }
    }, (response) => {
      let content = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        content += chunk;
      });
      response.on("end", () => {
        clearTimeout(timeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(content));
        } catch (error) {
          reject(error);
        }
      });
    });

    const timeout = setTimeout(() => request.destroy(new Error(`${url} timed out`)), 8000);
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.write(body);
    request.end();
  });
}

const DNS_FALLBACKS = {
  "api.open-meteo.com": "188.40.99.226",
  "air-quality-api.open-meteo.com": "152.53.84.73",
  "geocoding-api.open-meteo.com": "202.61.206.6"
};

async function getText(url, headers = {}) {
  try {
    return await requestText(url, headers);
  } catch (error) {
    const hostname = new URL(url).hostname;
    const fallbackIp = DNS_FALLBACKS[hostname];
    if (!fallbackIp || !["EAI_FAIL", "ENOTFOUND"].includes(error.code)) throw error;
    return requestText(url, headers, (ignoredHostname, options, callback) => callback(null, fallbackIp, 4));
  }
}

function requestText(url, headers = {}, lookup) {
  const client = url.startsWith("https:") ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(url, {
      method: "GET",
      ...(lookup ? { lookup } : {}),
      headers: {
        "user-agent": "Mozilla/5.0",
        ...headers
      }
    }, (response) => {
      let content = "";

      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        content += chunk;
      });
      response.on("end", () => {
        clearTimeout(timeout);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }

        resolve(content);
      });
    });

    const timeout = setTimeout(() => request.destroy(new Error(`${url} timed out`)), 8000);
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.end();
  });
}

async function getJson(url, headers) {
  const text = await getText(url, headers);
  return JSON.parse(text);
}


module.exports = { postJson, getText, getJson };
