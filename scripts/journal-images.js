async function compressJournalImageFile(file) {
  const bitmap = await createJournalImageBitmap(file);
  try {
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const largestSide = Math.max(originalWidth, originalHeight);
    let maxSide = Math.min(JOURNAL_IMAGE_MAX_SIDE, largestSide);
    let bestBlob = null;
    let bestWidth = originalWidth;
    let bestHeight = originalHeight;

    while (maxSide >= JOURNAL_IMAGE_MIN_SIDE) {
      const scale = Math.min(1, maxSide / largestSide);
      const width = Math.max(1, Math.round(originalWidth * scale));
      const height = Math.max(1, Math.round(originalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await encodeJournalCanvasUnderTarget(canvas);
      bestBlob = blob;
      bestWidth = width;
      bestHeight = height;
      if (blob.size <= JOURNAL_IMAGE_TARGET_BYTES) break;
      maxSide = Math.floor(maxSide * 0.82);
    }

    if (!bestBlob) throw new Error("image compression failed");
    return {
      blob: bestBlob,
      mimeType: bestBlob.type || "image/jpeg",
      width: bestWidth,
      height: bestHeight,
      size: bestBlob.size
    };
  } finally {
    if (typeof bitmap.close === "function") bitmap.close();
  }
}

async function createJournalImageBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      return createImageBitmap(file);
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encodeJournalCanvasUnderTarget(canvas) {
  const mimeTypes = ["image/webp", "image/jpeg"];
  let best = null;

  for (const mimeType of mimeTypes) {
    let low = 0.24;
    let high = 0.86;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const quality = (low + high) / 2;
      const blob = await journalCanvasToBlob(canvas, mimeType, quality);
      if (!blob) break;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= JOURNAL_IMAGE_TARGET_BYTES) {
        best = blob;
        low = quality;
      } else {
        high = quality;
      }
    }
  }

  return best;
}

function journalCanvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

function openJournalImageViewer(url, label) {
  if (!url) return;
  const existingDialog = document.getElementById("journalImageViewerDialog");
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement("dialog");
  dialog.id = "journalImageViewerDialog";
  dialog.className = "journal-image-viewer-dialog";
  dialog.innerHTML = `
    <div class="journal-image-viewer">
      <div class="journal-image-viewer-toolbar">
        <strong>${escapeHtml(label || "Ảnh nhật ký")}</strong>
        <div class="journal-image-viewer-actions">
          <button class="journal-image-viewer-control" type="button" data-zoom="out" aria-label="Thu nhỏ">-</button>
          <button class="journal-image-viewer-control" type="button" data-zoom="reset" aria-label="Vừa màn hình">100%</button>
          <button class="journal-image-viewer-control" type="button" data-zoom="in" aria-label="Phóng to">+</button>
          <button class="journal-image-viewer-close" type="button" aria-label="Đóng">×</button>
        </div>
      </div>
      <div class="journal-image-viewer-stage">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(label || "Ảnh nhật ký")}">
      </div>
    </div>
  `;

  document.body.append(dialog);
  document.body.classList.add("event-dialog-open");
  const image = dialog.querySelector("img");
  let zoom = 1;
  const applyZoom = () => {
    image.style.transform = `scale(${zoom})`;
    image.style.cursor = zoom > 1 ? "grab" : "zoom-in";
  };
  dialog.addEventListener("close", () => {
    document.body.classList.remove("event-dialog-open");
    dialog.remove();
  });
  dialog.querySelector(".journal-image-viewer-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelectorAll("[data-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.zoom;
      if (action === "in") zoom = Math.min(4, zoom + 0.25);
      if (action === "out") zoom = Math.max(0.5, zoom - 0.25);
      if (action === "reset") zoom = 1;
      applyZoom();
    });
  });
  image.addEventListener("click", () => {
    zoom = zoom === 1 ? 2 : 1;
    applyZoom();
  });
  applyZoom();
  dialog.showModal();
  dialog.querySelector(".journal-image-viewer-close").focus();
}
