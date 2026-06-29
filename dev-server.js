require("./server");

// Keep the local dev process alive when launched from Windows background scripts.
setInterval(() => {}, 60 * 60 * 1000);
