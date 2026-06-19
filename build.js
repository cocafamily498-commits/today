const fs = require("fs");
const path = require("path");

const outputDirectory = path.join(__dirname, "dist");
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(path.join(__dirname, "index.html"), path.join(outputDirectory, "index.html"));
