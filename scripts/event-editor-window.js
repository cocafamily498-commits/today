function renderEventEditorWindowDocument(state) {
  const stateJson = JSON.stringify(state).replace(/</g, "\\u003c");
  const title = state.mode === "edit" ? "Sửa sự kiện" : "Tạo sự kiện";

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${renderEventEditorWindowStyles()}
  </style>
</head>
<body>
  <main>
${renderEventEditorWindowForm(state, title)}
  </main>
  <script>
${renderEventEditorWindowScript(stateJson)}
  <\/script>
</body>
</html>`;
}
