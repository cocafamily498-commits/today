(function () {
  "use strict";

  document.addEventListener("lichviet:vault-gate-visible", () => {
    if (typeof preloadInitialAppPartials !== "function") return;
    window.LichVietInitialPartialsPromise = preloadInitialAppPartials()
      .catch((error) => console.warn("initial application UI preload failed", error));
  }, { once: true });

  // Start opening IndexedDB and render the vault gate as soon as the security
  // layer is ready. Feature scripts can continue downloading in parallel.
  window.LichVietVaultSessionPromise = window.LichVietVault.requireSession().then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error })
  );

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Cannot load optional script: ${source}`));
      document.head.append(script);
    });
  }

  // Password-strength estimation is only advisory. It must not delay the
  // login gate; load it in the background for create/change-password forms.
  window.LichVietPasswordEstimatorReady = loadScript("node_modules/@zxcvbn-ts/core/dist/zxcvbn-ts.js")
    .then(() => loadScript("node_modules/@zxcvbn-ts/language-common/dist/zxcvbn-ts.js"))
    .then(() => {
      document.querySelectorAll("[data-password-strength-for]").forEach((meter) => {
        const input = document.getElementById(meter.dataset.passwordStrengthFor);
        if (input) input.dispatchEvent(new Event("input"));
      });
    })
    .catch((error) => console.warn("password estimator unavailable", error));
})();
