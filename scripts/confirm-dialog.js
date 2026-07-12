function showConfirmDialog(options = {}) {
  const title = String(options.title || "Xác nhận");
  const message = String(options.message || "Bạn có muốn tiếp tục?");
  const confirmLabel = String(options.confirmLabel || "Có");
  const cancelLabel = String(options.cancelLabel || "Không");
  const danger = options.danger === true;

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "event-confirm-dialog";
    dialog.innerHTML = `
      <form method="dialog" class="event-confirm-content">
        <h2>${escapeConfirmDialogHtml(title)}</h2>
        <p>${escapeConfirmDialogHtml(message)}</p>
        <div class="event-confirm-actions">
          <button class="event-secondary-button" value="cancel" type="submit">${escapeConfirmDialogHtml(cancelLabel)}</button>
          <button class="${danger ? "event-danger-button" : "event-submit"}" value="confirm" type="submit">${escapeConfirmDialogHtml(confirmLabel)}</button>
        </div>
      </form>`;
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "confirm");
      dialog.remove();
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector(".event-secondary-button").focus();
  });
}

function escapeConfirmDialogHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}
