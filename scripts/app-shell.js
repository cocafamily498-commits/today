function setupAppTabs() {
  const buttons = [
    document.getElementById("todayTabButton"),
    document.getElementById("converterTabButton"),
    document.getElementById("eventsTabButton")
  ];
  const activate = (button, updateHash) => {
    buttons.forEach((item) => {
      const selected = item === button;
      item.setAttribute("aria-selected", selected ? "true" : "false");
      document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
    });
    if (updateHash) history.replaceState(null, "", `#${button.getAttribute("aria-controls")}`);
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () => activate(button, true));
  });
  const hashedButton = buttons.find((button) => location.hash === `#${button.getAttribute("aria-controls")}`);
  if (hashedButton) activate(hashedButton, false);
}

function setupApplicationInfo() {
  const button = document.getElementById("appInfoButton");
  const dialog = document.getElementById("appInfoDialog");
  button.addEventListener("click", () => dialog.showModal());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
