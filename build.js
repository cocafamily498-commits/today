const fs = require("fs");
const path = require("path");

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      return;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  });
}

const outputDirectory = path.join(__dirname, "dist");
fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
fs.copyFileSync(path.join(__dirname, "index.html"), path.join(outputDirectory, "index.html"));
fs.copyFileSync(path.join(__dirname, "styles.css"), path.join(outputDirectory, "styles.css"));
fs.copyFileSync(path.join(__dirname, "app-data.js"), path.join(outputDirectory, "app-data.js"));
copyDirectory(path.join(__dirname, "partials"), path.join(outputDirectory, "partials"));
copyDirectory(path.join(__dirname, "scripts"), path.join(outputDirectory, "scripts"));
