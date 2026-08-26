(() => {
  const CHECK_INTERVAL_MS = 60_000;
  const AUTO_REFRESH_SECONDS = 15;
  const versionMeta = document.querySelector('meta[name="app-version"]');
  const currentVersion = versionMeta ? versionMeta.content.trim() : '';

  let updateShown = false;
  let refreshTimer = null;

  // The deployment workflow replaces __BUILD_ID__ with the deployed commit SHA.
  // Skip update checks for local/source-file usage where no deployed build ID exists.
  if (!currentVersion || currentVersion === '__BUILD_ID__') return;

  function injectStyles() {
    if (document.getElementById('contactimporter-update-style')) return;

    const style = document.createElement('style');
    style.id = 'contactimporter-update-style';
    style.textContent = `
      body.ci-update-required {
        overflow: hidden !important;
      }

      #ci-update-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 18% 14%, rgba(91, 145, 255, .38), transparent 30%),
          radial-gradient(circle at 84% 18%, rgba(255, 113, 180, .32), transparent 28%),
          radial-gradient(circle at 76% 82%, rgba(151, 118, 255, .28), transparent 30%),
          rgba(235, 244, 255, .72);
        backdrop-filter: blur(36px) saturate(190%);
        -webkit-backdrop-filter: blur(36px) saturate(190%);
      }

      #ci-update-overlay::before,
      #ci-update-overlay::after {
        content: '';
        position: absolute;
        width: 420px;
        height: 420px;
        border-radius: 50%;
        filter: blur(82px);
        opacity: .52;
        pointer-events: none;
      }

      #ci-update-overlay::before {
        left: -120px;
        top: -120px;
        background: #87b7ff;
      }

      #ci-update-overlay::after {
        right: -120px;
        bottom: -120px;
        background: #ff99c8;
      }

      .ci-update-card {
        position: relative;
        width: min(620px, 100%);
        padding: 36px;
        border-radius: 34px;
        text-align: center;
        color: #142033;
        background: linear-gradient(145deg, rgba(255,255,255,.72), rgba(255,255,255,.38));
        border: 1px solid rgba(255,255,255,.82);
        box-shadow:
          0 36px 110px rgba(40, 65, 105, .22),
          inset 0 1px 0 rgba(255,255,255,.96);
        backdrop-filter: blur(30px) saturate(200%);
        -webkit-backdrop-filter: blur(30px) saturate(200%);
        overflow: hidden;
      }

      .ci-update-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255,255,255,.30), transparent 38%);
        pointer-events: none;
      }

      .ci-update-icon {
        position: relative;
        width: 76px;
        height: 76px;
        margin: 0 auto 20px;
        display: grid;
        place-items: center;
        border-radius: 25px;
        color: #fff;
        background: linear-gradient(135deg, #6488ff, #9279ff 52%, #ff7fb6);
        box-shadow: 0 20px 48px rgba(103, 120, 255, .32);
      }

      .ci-update-icon svg {
        width: 34px;
        height: 34px;
      }

      .ci-update-kicker,
      .ci-update-title,
      .ci-update-copy,
      .ci-update-meta,
      .ci-update-button {
        position: relative;
        z-index: 1;
      }

      .ci-update-kicker {
        margin-bottom: 8px;
        color: #71809a;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .ci-update-title {
        margin: 0;
        font: 800 clamp(30px, 6vw, 48px)/1.02 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: -.055em;
      }

      .ci-update-copy {
        max-width: 470px;
        margin: 16px auto 0;
        color: #6f7d97;
        font: 500 14px/1.65 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .ci-update-meta {
        margin: 14px 0 24px;
        color: #8e9bb0;
        font: 700 11px/1.4 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .ci-update-button {
        width: 100%;
        min-height: 56px;
        border: 1px solid rgba(255,255,255,.45);
        border-radius: 18px;
        color: #fff;
        cursor: pointer;
        font: 800 15px/1 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #5f80ff, #8977ff 54%, #ff78b3);
        box-shadow: 0 18px 40px rgba(90, 112, 255, .30);
        transition: transform .18s ease, box-shadow .18s ease;
      }

      .ci-update-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 22px 46px rgba(90, 112, 255, .36);
      }

      .ci-update-button:focus-visible {
        outline: 4px solid rgba(95, 128, 255, .22);
        outline-offset: 4px;
      }

      @media (max-width: 560px) {
        #ci-update-overlay { padding: 14px; }
        .ci-update-card { padding: 28px 20px; border-radius: 28px; }
        .ci-update-icon { width: 66px; height: 66px; border-radius: 22px; }
      }
    `;
    document.head.appendChild(style);
  }

  function hardRefresh(latestVersion) {
    if (refreshTimer) clearInterval(refreshTimer);

    const url = new URL(window.location.href);
    url.searchParams.set('updated', latestVersion.slice(0, 12));
    url.searchParams.set('_refresh', Date.now().toString());
    window.location.replace(url.toString());
  }

  function showUpdateScreen(latestVersion) {
    if (updateShown) return;
    updateShown = true;
    injectStyles();
    document.body.classList.add('ci-update-required');

    const overlay = document.createElement('div');
    overlay.id = 'ci-update-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'ci-update-title');
    overlay.innerHTML = `
      <div class="ci-update-card">
        <div class="ci-update-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"></path>
            <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"></path>
          </svg>
        </div>
        <div class="ci-update-kicker">ContactImporter update</div>
        <h1 class="ci-update-title" id="ci-update-title">A new version is ready.</h1>
        <p class="ci-update-copy">
          ContactImporter has been updated. Refresh is required before you can continue so you always use the latest fixes and features.
        </p>
        <div class="ci-update-meta" id="ci-update-countdown">Refreshing automatically in ${AUTO_REFRESH_SECONDS} seconds…</div>
        <button class="ci-update-button" id="ci-update-refresh" type="button">Refresh now</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const button = document.getElementById('ci-update-refresh');
    if (button) {
      button.addEventListener('click', () => hardRefresh(latestVersion));
      button.focus({ preventScroll: true });
    }

    // Prevent keyboard dismissal/navigation around the blocked app.
    document.addEventListener('keydown', (event) => {
      if (!updateShown) return;
      if (event.key === 'Escape') event.preventDefault();
    }, true);

    let secondsLeft = AUTO_REFRESH_SECONDS;
    const countdown = document.getElementById('ci-update-countdown');
    refreshTimer = setInterval(() => {
      secondsLeft -= 1;
      if (countdown) {
        countdown.textContent = `Refreshing automatically in ${Math.max(secondsLeft, 0)} second${secondsLeft === 1 ? '' : 's'}…`;
      }
      if (secondsLeft <= 0) {
        clearInterval(refreshTimer);
        hardRefresh(latestVersion);
      }
    }, 1000);
  }

  async function checkForUpdate() {
    if (updateShown || !navigator.onLine) return;

    try {
      const response = await fetch(`./version.json?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) return;

      const payload = await response.json();
      const latestVersion = String(payload.version || '').trim();

      if (latestVersion && latestVersion !== currentVersion) {
        showUpdateScreen(latestVersion);
      }
    } catch (error) {
      // An unavailable version endpoint should never break the main app.
      console.debug('ContactImporter update check skipped:', error);
    }
  }

  // Check shortly after load, then continuously while the page remains open.
  window.setTimeout(checkForUpdate, 2500);
  window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });

  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
})();
