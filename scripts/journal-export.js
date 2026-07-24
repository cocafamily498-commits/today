const JOURNAL_EXPORT_FONT_FAMILY = '"Patrick Hand", "Segoe Print", cursive';
const JOURNAL_EXPORT_TEMPLATES = {
  journal: {
    id: "journal",
    name: "Nhật ký",
    url: "assets/journal-template.jpg",
    area: { x: 138, y: 287, width: 518, bottom: 990 },
    date: { x: 510, y: 103, fontSize: 32, color: "#e77778" },
    pageNumber: { x: 657, y: 1020 },
    font: { maximum: 29, minimum: 18 },
    photo: { width: 165, height: 132 }
  },
  note: {
    id: "note",
    name: "Ghi chú",
    url: "assets/note-template.jpg",
    area: { x: 66, y: 327, width: 640, bottom: 900 },
    date: { x: 200, y: 258, fontSize: 25, color: "#5b3517" },
    pageNumber: { x: 700, y: 978 },
    font: { maximum: 29, minimum: 18 },
    photo: { width: 170, height: 136 }
  }
};
const journalExportTemplatePromises = new Map();
let journalExportSelectionMode = "single";
const journalPdfViewerState = {
  canvases: [],
  pdfBlob: null,
  filename: "",
  pageIndex: 0,
  zoom: 1,
  rotation: 0
};

function openJournalExportTemplateMenu(mode = "single") {
  const dialog = document.getElementById("journalTemplateDialog");
  if (!dialog) return;
  journalExportSelectionMode = mode === "filtered" ? "filtered" : "single";
  if (dialog.dataset.ready !== "true") {
    dialog.dataset.ready = "true";
    document.getElementById("journalTemplateDialogCloseButton")
      ?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelectorAll("[data-journal-template]").forEach((option) => {
      option.addEventListener("click", () => {
        dialog.close();
        if (journalExportSelectionMode === "filtered") {
          exportFilteredJournalsPdf(option.dataset.journalTemplate);
        } else {
          exportJournalPdfFromForm(option.dataset.journalTemplate);
        }
      });
    });
  }
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector("[data-journal-template]")?.focus());
}

async function exportJournalPdfFromForm(templateId) {
  const templateConfig = JOURNAL_EXPORT_TEMPLATES[templateId] || JOURNAL_EXPORT_TEMPLATES.journal;
  const button = document.getElementById("journalExportImageButton");
  const date = getJournalDateInputValue();
  const text = String(document.getElementById("journalText")?.value || "").trim();
  if (!date || !text) {
    setJournalFormStatus("Cần có ngày và nội dung để xuất PDF nhật ký.", true);
    return;
  }

  const filename = `Nhat-ky-${date.replace(/-/g, "")}.pdf`;
  openJournalPdfViewerLoading(filename, templateConfig.name);
  if (button) button.disabled = true;
  setJournalFormStatus("Đang tạo một file PDF nhật ký...");
  try {
    try {
      await document.fonts?.load('400 29px "Patrick Hand"', "Nhật ký tiếng Việt đầy đủ dấu");
    } catch (fontError) {
      console.warn("journal export font preload failed", fontError);
    }
    await document.fonts?.ready;
    const [template, images] = await Promise.all([
      loadJournalExportTemplate(templateConfig),
      loadJournalExportImages()
    ]);
    const canvases = renderJournalExportPages(template, date, text, images, templateConfig);
    const pdfBlob = await createJournalPdfBlob(canvases);
    openJournalPdfViewer(canvases, pdfBlob, filename);
    setJournalFormStatus(`Đã tạo PDF ${templateConfig.name} gồm ${canvases.length} trang và mở để xem.`);
  } catch (error) {
    console.error("journal image export failed", error);
    showJournalPdfViewerError("Chưa tạo được PDF. Vui lòng đóng cửa sổ này và thử lại.");
    setJournalFormStatus("Chưa xuất được PDF nhật ký. Vui lòng thử lại.", true);
  } finally {
    if (button) button.disabled = false;
  }
}

async function exportFilteredJournalsPdf(templateId) {
  const journals = journalFilteredEntries.slice()
    .sort((left, right) => String(left.date || "").localeCompare(String(right.date || ""))
      || String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  const printButton = document.getElementById("journalFilterPrintButton");
  if (journals.length === 0) {
    if (printButton) printButton.disabled = true;
    return;
  }

  const templateConfig = JOURNAL_EXPORT_TEMPLATES[templateId] || JOURNAL_EXPORT_TEMPLATES.journal;
  const exportedOn = toDateInputValue(getVietnamToday()).replace(/-/g, "");
  const filename = `Nhat-ky-da-loc-${exportedOn}.pdf`;
  openJournalPdfViewerLoading(filename, templateConfig.name);
  if (printButton) printButton.disabled = true;
  try {
    try {
      await document.fonts?.load('400 29px "Patrick Hand"', "Nhật ký tiếng Việt đầy đủ dấu");
    } catch (fontError) {
      console.warn("filtered journal export font preload failed", fontError);
    }
    await document.fonts?.ready;
    const template = await loadJournalExportTemplate(templateConfig);
    const allCanvases = [];

    for (let index = 0; index < journals.length; index += 1) {
      const journal = journals[index];
      updateJournalPdfViewerLoadingStatus(`Đang tạo nhật ký ${index + 1}/${journals.length}...`);
      const images = await loadJournalRecordExportImages(journal);
      const journalCanvases = renderJournalExportPages(
        template,
        journal.date,
        String(journal.text || "").trim(),
        images,
        templateConfig
      );
      allCanvases.push(...journalCanvases);
    }

    const pdfBlob = await createJournalPdfBlob(allCanvases);
    openJournalPdfViewer(allCanvases, pdfBlob, filename);
    setJournalFormStatus(`Đã tạo PDF từ ${journals.length} nhật ký đang lọc, gồm ${allCanvases.length} trang.`);
  } catch (error) {
    console.error("filtered journal PDF export failed", error);
    showJournalPdfViewerError("Chưa tạo được PDF từ danh sách đang lọc. Vui lòng đóng cửa sổ này và thử lại.");
  } finally {
    if (printButton) printButton.disabled = journalFilteredEntries.length === 0;
  }
}

async function loadJournalRecordExportImages(journal) {
  const imageIds = Array.isArray(journal?.imageIds) ? journal.imageIds : [];
  const images = await Promise.all(imageIds.map(async (id, index) => {
    try {
      const storedImage = await window.LichVietData.getImage(id);
      if (!storedImage?.blob) return null;
      const url = URL.createObjectURL(storedImage.blob);
      try {
        const image = await loadJournalExportImage(url);
        return { image, label: `Ảnh ${index + 1}` };
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.warn("filtered journal image load failed", id, error);
      return null;
    }
  }));
  return images.filter(Boolean);
}

async function createJournalPdfBlob(canvases) {
  const pageImages = [];
  for (const canvas of canvases) {
    const reducedCanvas = document.createElement("canvas");
    reducedCanvas.width = 768;
    reducedCanvas.height = Math.round(reducedCanvas.width * canvas.height / canvas.width);
    const reducedContext = reducedCanvas.getContext("2d", { alpha: false });
    reducedContext.fillStyle = "#fffaf2";
    reducedContext.fillRect(0, 0, reducedCanvas.width, reducedCanvas.height);
    reducedContext.drawImage(canvas, 0, 0, reducedCanvas.width, reducedCanvas.height);
    const jpegBlob = await journalCanvasToBlob(reducedCanvas, "image/jpeg", 0.76);
    if (!jpegBlob) throw new Error("Không nén được trang PDF.");
    pageImages.push({
      width: reducedCanvas.width,
      height: reducedCanvas.height,
      bytes: new Uint8Array(await jpegBlob.arrayBuffer())
    });
  }
  return buildJournalPdfFromJpegs(pageImages);
}

function buildJournalPdfFromJpegs(pageImages) {
  const encoder = new TextEncoder();
  const objectCount = 2 + pageImages.length * 3;
  const offsets = new Array(objectCount + 1).fill(0);
  const chunks = [];
  let byteLength = 0;
  const append = (value) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const appendObject = (id, bodyParts) => {
    offsets[id] = byteLength;
    append(`${id} 0 obj\n`);
    bodyParts.forEach(append);
    append("\nendobj\n");
  };

  append(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
  appendObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  const pageIds = pageImages.map((_, index) => 3 + index * 3);
  appendObject(2, [`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`]);

  pageImages.forEach((pageImage, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const pageWidth = 576;
    const pageHeight = Math.round(pageWidth * pageImage.height / pageImage.width);
    const drawCommands = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/JournalPage Do\nQ\n`;
    appendObject(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `,
      `/Resources << /XObject << /JournalPage ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    ]);
    appendObject(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${pageImage.width} /Height ${pageImage.height} `,
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pageImage.bytes.length} >>\nstream\n`,
      pageImage.bytes,
      "\nendstream"
    ]);
    appendObject(contentId, [
      `<< /Length ${encoder.encode(drawCommands).length} >>\nstream\n`,
      drawCommands,
      "endstream"
    ]);
  });

  const xrefOffset = byteLength;
  append(`xref\n0 ${objectCount + 1}\n`);
  append("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

function loadJournalExportTemplate(templateConfig) {
  if (!journalExportTemplatePromises.has(templateConfig.id)) {
    const templatePromise = loadJournalExportImage(templateConfig.url)
      .catch((error) => {
        journalExportTemplatePromises.delete(templateConfig.id);
        throw error;
      });
    journalExportTemplatePromises.set(templateConfig.id, templatePromise);
  }
  return journalExportTemplatePromises.get(templateConfig.id);
}

function loadJournalExportImages() {
  return Promise.all(journalImageItems.map((item) => loadJournalExportImage(item.url)
    .then((image) => ({ image, label: item.label || "Ảnh nhật ký" }))
    .catch(() => null)))
    .then((items) => items.filter(Boolean));
}

function loadJournalExportImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không tải được ảnh: ${url}`));
    image.src = url;
  });
}

function renderJournalExportPages(template, date, text, images, templateConfig) {
  const measurementCanvas = document.createElement("canvas");
  const context = measurementCanvas.getContext("2d");
  let selectedLayout = null;

  for (let fontSize = templateConfig.font.maximum; fontSize >= templateConfig.font.minimum; fontSize -= 2) {
    const layout = layoutJournalExportContent(context, text, images, fontSize, templateConfig);
    selectedLayout = layout;
    if (layout.pages.length === 1) break;
  }

  return selectedLayout.pages.map((page, pageIndex) => {
    const canvas = document.createElement("canvas");
    canvas.width = template.naturalWidth || template.width || 1024;
    canvas.height = template.naturalHeight || template.height || 1536;
    const pageContext = canvas.getContext("2d");
    pageContext.drawImage(template, 0, 0, canvas.width, canvas.height);
    drawJournalExportDate(pageContext, date, templateConfig);
    drawJournalExportPageNumber(pageContext, pageIndex, selectedLayout.pages.length, templateConfig);
    drawJournalExportPage(pageContext, page, selectedLayout.fontSize);
    return canvas;
  });
}

function layoutJournalExportContent(context, text, images, fontSize, templateConfig) {
  const exportArea = templateConfig.area;
  const photoSize = templateConfig.photo;
  const lineHeight = Math.round(fontSize * 1.72);
  context.font = `${fontSize}px ${JOURNAL_EXPORT_FONT_FAMILY}`;
  const paragraphs = text.split(/\n+/).map((value) => value.trim()).filter(Boolean);
  const pages = [{ lines: [], images: [] }];
  let page = pages[0];
  let y = exportArea.y;
  let imageIndex = 0;

  const newPage = () => {
    page = { lines: [], images: [] };
    pages.push(page);
    y = exportArea.y;
  };

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraphIndex > 0) y += Math.round(lineHeight * 0.34);
    if (y + lineHeight > exportArea.bottom) newPage();
    let paragraphImageBottom = 0;
    let paragraphImagePage = null;

    if (imageIndex < images.length) {
      const side = imageIndex % 2 === 0 ? "left" : "right";
      const imageHeight = photoSize.height;
      const imageWidth = photoSize.width;
      if (y + imageHeight > exportArea.bottom) newPage();
      page.images.push({
        ...images[imageIndex],
        x: side === "left" ? exportArea.x : exportArea.x + exportArea.width - imageWidth,
        y,
        width: imageWidth,
        height: imageHeight,
        side
      });
      paragraphImageBottom = y + imageHeight;
      paragraphImagePage = page;
      imageIndex += 1;
    }

    const words = paragraph.split(/\s+/);
    let line = "";
    while (words.length) {
      if (y + lineHeight > exportArea.bottom) {
        newPage();
        line = "";
      }
      const lineArea = getJournalExportLineArea(page.images, y, lineHeight, exportArea);
      const nextWord = words[0];
      const candidate = line ? `${line} ${nextWord}` : nextWord;
      if (!line || context.measureText(candidate).width <= lineArea.width) {
        line = candidate;
        words.shift();
      } else {
        page.lines.push({ text: line, x: lineArea.x, y });
        line = "";
        y += lineHeight;
      }
    }
    if (line) {
      const lineArea = getJournalExportLineArea(page.images, y, lineHeight, exportArea);
      page.lines.push({ text: line, x: lineArea.x, y });
      y += lineHeight;
    }
    if (paragraphImageBottom && page === paragraphImagePage) {
      y = Math.max(y, paragraphImageBottom + Math.round(lineHeight * 0.22));
    }
  });

  while (imageIndex < images.length) {
    if (y + photoSize.height > exportArea.bottom) newPage();
    const side = imageIndex % 2 === 0 ? "left" : "right";
    page.images.push({
      ...images[imageIndex],
      x: side === "left" ? exportArea.x : exportArea.x + exportArea.width - photoSize.width,
      y,
      width: photoSize.width,
      height: photoSize.height,
      side
    });
    y += photoSize.height + 18;
    imageIndex += 1;
  }

  return { pages, fontSize };
}

function getJournalExportLineArea(images, y, lineHeight, exportArea) {
  const overlapping = images.find((item) => y < item.y + item.height + 12 && y + lineHeight > item.y);
  if (!overlapping) return { x: exportArea.x, width: exportArea.width };
  const gap = 18;
  if (overlapping.side === "left") {
    return {
      x: overlapping.x + overlapping.width + gap,
      width: exportArea.width - overlapping.width - gap
    };
  }
  return {
    x: exportArea.x,
    width: exportArea.width - overlapping.width - gap
  };
}

function drawJournalExportDate(context, dateValue, templateConfig) {
  const [year, month, day] = dateValue.split("-");
  context.save();
  context.fillStyle = templateConfig.date.color;
  context.font = `${templateConfig.date.fontSize}px ${JOURNAL_EXPORT_FONT_FAMILY}`;
  context.textBaseline = "alphabetic";
  context.fillText(`${Number(day)} / ${Number(month)} / ${year}`, templateConfig.date.x, templateConfig.date.y);
  context.restore();
}

function drawJournalExportPageNumber(context, pageIndex, pageCount, templateConfig) {
  if (pageCount < 2) return;
  context.save();
  context.fillStyle = "rgba(104, 75, 53, .72)";
  context.font = `17px ${JOURNAL_EXPORT_FONT_FAMILY}`;
  context.textAlign = "right";
  context.fillText(`${pageIndex + 1}/${pageCount}`, templateConfig.pageNumber.x, templateConfig.pageNumber.y);
  context.restore();
}

function drawJournalExportPage(context, page, fontSize) {
  page.images.forEach((item) => drawJournalExportPhoto(context, item));
  context.save();
  context.fillStyle = "#5d4635";
  context.font = `${fontSize}px ${JOURNAL_EXPORT_FONT_FAMILY}`;
  context.textBaseline = "top";
  page.lines.forEach((line) => context.fillText(line.text, line.x, line.y));
  context.restore();
}

function drawJournalExportPhoto(context, item) {
  const radius = 14;
  context.save();
  context.beginPath();
  context.roundRect(item.x, item.y, item.width, item.height, radius);
  context.clip();
  const sourceRatio = item.image.naturalWidth / item.image.naturalHeight;
  const targetRatio = item.width / item.height;
  let sourceWidth = item.image.naturalWidth;
  let sourceHeight = item.image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = sourceHeight * targetRatio;
    sourceX = (item.image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = sourceWidth / targetRatio;
    sourceY = (item.image.naturalHeight - sourceHeight) / 2;
  }
  context.drawImage(item.image, sourceX, sourceY, sourceWidth, sourceHeight, item.x, item.y, item.width, item.height);
  context.restore();
  context.save();
  context.strokeStyle = "rgba(192, 145, 103, .72)";
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(item.x, item.y, item.width, item.height, radius);
  context.stroke();
  context.restore();
}

function openJournalPdfViewerLoading(filename, templateName) {
  const dialog = document.getElementById("journalPdfViewerDialog");
  if (!dialog) return;
  setupJournalPdfViewer(dialog);
  document.getElementById("journalPdfViewerHeading").textContent = filename;
  const status = document.getElementById("journalPdfViewerStatus");
  if (status) {
    status.hidden = false;
    status.classList.remove("error");
    status.textContent = `Đang tạo PDF theo mẫu ${templateName}...`;
  }
  const canvas = document.getElementById("journalPdfViewerCanvas");
  if (canvas) canvas.hidden = true;
  dialog.querySelectorAll("[data-pdf-action]:not([data-pdf-action='close'])")
    .forEach((control) => { control.disabled = true; });
  if (!dialog.open) dialog.showModal();
}

function updateJournalPdfViewerLoadingStatus(message) {
  const status = document.getElementById("journalPdfViewerStatus");
  if (!status || status.hidden) return;
  status.textContent = message;
}

function showJournalPdfViewerError(message) {
  const status = document.getElementById("journalPdfViewerStatus");
  if (!status) return;
  status.hidden = false;
  status.classList.add("error");
  status.textContent = message;
}

function openJournalPdfViewer(canvases, pdfBlob, filename) {
  const dialog = document.getElementById("journalPdfViewerDialog");
  if (!dialog) return;
  Object.assign(journalPdfViewerState, {
    canvases,
    pdfBlob,
    filename,
    pageIndex: 0,
    zoom: 1,
    rotation: 0
  });
  setupJournalPdfViewer(dialog);
  document.getElementById("journalPdfViewerHeading").textContent = filename;
  document.getElementById("journalPdfPageCount").textContent = String(canvases.length);
  const status = document.getElementById("journalPdfViewerStatus");
  if (status) {
    status.hidden = true;
    status.classList.remove("error");
  }
  const canvas = document.getElementById("journalPdfViewerCanvas");
  if (canvas) canvas.hidden = false;
  dialog.querySelectorAll("[data-pdf-action]")
    .forEach((control) => { control.disabled = false; });
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(fitJournalPdfViewerPage);
}

function setupJournalPdfViewer(dialog) {
  if (dialog.dataset.ready === "true") return;
  dialog.dataset.ready = "true";
  dialog.querySelectorAll("[data-pdf-action]").forEach((button) => {
    button.addEventListener("click", () => handleJournalPdfViewerAction(button.dataset.pdfAction));
  });
  document.getElementById("journalPdfPageInput")?.addEventListener("change", (event) => {
    showJournalPdfViewerPage(Number(event.target.value) - 1);
  });
  dialog.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    setJournalPdfViewerZoom(journalPdfViewerState.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false, capture: true });
  dialog.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "_", "0"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "0") fitJournalPdfViewerPage();
      else setJournalPdfViewerZoom(journalPdfViewerState.zoom + (["+", "="].includes(event.key) ? 0.1 : -0.1));
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      showJournalPdfViewerPage(journalPdfViewerState.pageIndex - 1);
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      showJournalPdfViewerPage(journalPdfViewerState.pageIndex + 1);
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      printJournalPdf();
    }
  });
  dialog.addEventListener("close", closeJournalPdfViewerState);
}

function handleJournalPdfViewerAction(action) {
  if (action === "close") {
    document.getElementById("journalPdfViewerDialog")?.close();
  } else if (action === "previous") {
    showJournalPdfViewerPage(journalPdfViewerState.pageIndex - 1);
  } else if (action === "next") {
    showJournalPdfViewerPage(journalPdfViewerState.pageIndex + 1);
  } else if (action === "zoom-out") {
    setJournalPdfViewerZoom(journalPdfViewerState.zoom - 0.1);
  } else if (action === "zoom-in") {
    setJournalPdfViewerZoom(journalPdfViewerState.zoom + 0.1);
  } else if (action === "fit") {
    fitJournalPdfViewerPage();
  } else if (action === "rotate") {
    journalPdfViewerState.rotation = (journalPdfViewerState.rotation + 90) % 360;
    renderJournalPdfViewerPage();
  } else if (action === "fullscreen") {
    toggleJournalPdfViewerFullscreen();
  } else if (action === "download") {
    downloadJournalPdf();
  } else if (action === "print") {
    printJournalPdf();
  }
}

function showJournalPdfViewerPage(pageIndex) {
  const lastPageIndex = journalPdfViewerState.canvases.length - 1;
  journalPdfViewerState.pageIndex = Math.min(Math.max(0, pageIndex), Math.max(0, lastPageIndex));
  journalPdfViewerState.rotation = 0;
  renderJournalPdfViewerPage();
}

function renderJournalPdfViewerPage() {
  const source = journalPdfViewerState.canvases[journalPdfViewerState.pageIndex];
  const target = document.getElementById("journalPdfViewerCanvas");
  if (!source || !target) return;
  const rotation = journalPdfViewerState.rotation;
  const swapsSides = rotation === 90 || rotation === 270;
  target.width = swapsSides ? source.height : source.width;
  target.height = swapsSides ? source.width : source.height;
  const context = target.getContext("2d");
  context.save();
  if (rotation === 90) {
    context.translate(target.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    context.translate(target.width, target.height);
    context.rotate(Math.PI);
  } else if (rotation === 270) {
    context.translate(0, target.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(source, 0, 0);
  context.restore();
  target.style.width = `${Math.round(target.width * journalPdfViewerState.zoom)}px`;
  target.style.height = `${Math.round(target.height * journalPdfViewerState.zoom)}px`;

  const pageInput = document.getElementById("journalPdfPageInput");
  if (pageInput) {
    pageInput.max = String(journalPdfViewerState.canvases.length);
    pageInput.value = String(journalPdfViewerState.pageIndex + 1);
  }
  document.getElementById("journalPdfZoomLabel").textContent =
    `${Math.round(journalPdfViewerState.zoom * 100)}%`;
  const previous = document.querySelector("#journalPdfViewerDialog [data-pdf-action='previous']");
  const next = document.querySelector("#journalPdfViewerDialog [data-pdf-action='next']");
  if (previous) previous.disabled = journalPdfViewerState.pageIndex === 0;
  if (next) next.disabled = journalPdfViewerState.pageIndex >= journalPdfViewerState.canvases.length - 1;
}

function setJournalPdfViewerZoom(zoom) {
  journalPdfViewerState.zoom = Math.min(2.5, Math.max(0.25, zoom));
  renderJournalPdfViewerPage();
}

function fitJournalPdfViewerPage() {
  const source = journalPdfViewerState.canvases[journalPdfViewerState.pageIndex];
  const stage = document.getElementById("journalPdfViewerStage");
  if (!source || !stage) return;
  const swapsSides = journalPdfViewerState.rotation === 90 || journalPdfViewerState.rotation === 270;
  const width = swapsSides ? source.height : source.width;
  const height = swapsSides ? source.width : source.height;
  journalPdfViewerState.zoom = Math.min(
    1.5,
    Math.max(0.25, (stage.clientWidth - 36) / width),
    Math.max(0.25, (stage.clientHeight - 36) / height)
  );
  renderJournalPdfViewerPage();
}

function toggleJournalPdfViewerFullscreen() {
  const viewer = document.querySelector("#journalPdfViewerDialog .journal-pdf-viewer");
  if (!viewer) return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    viewer.requestFullscreen?.();
  }
}

function printJournalPdf() {
  if (journalPdfViewerState.canvases.length === 0) return;
  const iframe = document.createElement("iframe");
  iframe.className = "journal-pdf-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  const pageImages = journalPdfViewerState.canvases
    .map((canvas) => canvas.toDataURL("image/jpeg", 0.86));
  iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: 100%; height: auto; break-after: page; page-break-after: always; }
    img:last-child { break-after: auto; page-break-after: auto; }
  </style></head><body>${pageImages.map((source) => `<img src="${source}" alt="">`).join("")}</body></html>`;
  iframe.addEventListener("load", () => {
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    }, 250);
  }, { once: true });
  document.body.append(iframe);
}

async function downloadJournalPdf() {
  const blob = journalPdfViewerState.pdfBlob;
  const filename = journalPdfViewerState.filename;
  if (!blob || !filename) return;
  const file = typeof File === "function"
    ? new File([blob], filename, { type: "application/pdf" })
    : null;
  if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("PDF file sharing failed", error);
    }
  }

  if (window.matchMedia("(pointer: coarse)").matches) {
    window.alert("Trình duyệt mobile chỉ có thể lưu PDF qua Share Sheet khi ứng dụng chạy bằng HTTPS. Bạn vẫn có thể dùng nút In ngay trong ứng dụng.");
    return;
  }

  const url = URL.createObjectURL(blob);
  downloadJournalExportUrl(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function closeJournalPdfViewerState() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  Object.assign(journalPdfViewerState, {
    canvases: [],
    pdfBlob: null,
    filename: "",
    pageIndex: 0,
    zoom: 1,
    rotation: 0
  });
  const canvas = document.getElementById("journalPdfViewerCanvas");
  if (canvas) {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function downloadJournalExportUrl(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
