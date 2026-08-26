(() => {
  const CHECK_INTERVAL_MS = 60_000;
  const AUTO_REFRESH_SECONDS = 15;
  const versionMeta = document.querySelector('meta[name="app-version"]');
  const currentVersion = versionMeta ? versionMeta.content.trim() : '';

  let updateShown = false;
  let refreshTimer = null;

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
        color: #f8f8f6;
        background:
          radial-gradient(circle at 12% 86%, rgba(255,177,31,.15), transparent 30rem),
          radial-gradient(circle at 88% 12%, rgba(230,50,47,.18), transparent 34rem),
          rgba(4,5,6,.82);
        backdrop-filter: blur(24px) saturate(1.18);
        -webkit-backdrop-filter: blur(24px) saturate(1.18);
      }

      #ci-update-overlay::before,
      #ci-update-overlay::after {
        content: '';
        position: absolute;
        width: 460px;
        height: 460px;
        border-radius: 50%;
        filter: blur(96px);
        opacity: .32;
        pointer-events: none;
      }

      #ci-update-overlay::before {
        left: -140px;
        top: -160px;
        background: #ffb11f;
      }

      #ci-update-overlay::after {
        right: -140px;
        bottom: -160px;
        background: #e6322f;
      }

      .ci-update-card {
        position: relative;
        width: min(620px, 100%);
        padding: 36px;
        border-radius: 22px;
        text-align: center;
        color: #f8f8f6;
        background:
          radial-gradient(circle at 50% 0, rgba(255,106,34,.12), transparent 22rem),
          linear-gradient(145deg, rgba(255,255,255,.075), rgba(255,255,255,.018)),
          rgba(13,15,16,.86);
        border: 1px solid rgba(255,255,255,.15);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.14),
          0 28px 72px rgba(0,0,0,.42),
          0 8px 28px rgba(230,50,47,.08);
        backdrop-filter: blur(24px) saturate(1.2);
        -webkit-backdrop-filter: blur(24px) saturate(1.2);
        overflow: hidden;
      }

      .ci-update-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255,255,255,.065), transparent 38%);
        pointer-events: none;
      }

      .ci-update-icon {
        position: relative;
        width: 76px;
        height: 76px;
        margin: 0 auto 20px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        color: #fff;
        background: linear-gradient(105deg, #ffb11f 0%, #ff6a22 52%, #e6322f 100%);
        border: 1px solid rgba(255,151,75,.24);
        box-shadow: 0 18px 44px rgba(224,57,30,.28), inset 0 1px 0 rgba(255,255,255,.18);
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
        color: #ff8b46;
        font: 800 12px/1.2 "Helvetica Neue", Helvetica, Arial, sans-serif;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .ci-update-title {
        margin: 0;
        color: #f8f8f6;
        font: 700 clamp(30px, 6vw, 48px)/1.02 "Helvetica Neue", Helvetica, Arial, sans-serif;
        letter-spacing: -.035em;
      }

      .ci-update-copy {
        max-width: 470px;
        margin: 16px auto 0;
        color: #a4aaa6;
        font: 500 14px/1.65 "Helvetica Neue", Helvetica, Arial, sans-serif;
      }

      .ci-update-meta {
        margin: 14px 0 24px;
        color: #767d79;
        font: 700 11px/1.4 "Helvetica Neue", Helvetica, Arial, sans-serif;
      }

      .ci-update-button {
        width: 100%;
        min-height: 56px;
        border: 1px solid rgba(255,151,75,.24);
        border-radius: 12px;
        color: #fff;
        cursor: pointer;
        font: 800 15px/1 "Helvetica Neue", Helvetica, Arial, sans-serif;
        background: linear-gradient(105deg, #ffb11f 0%, #ff6a22 52%, #e6322f 100%);
        box-shadow: 0 16px 40px rgba(224,57,30,.24);
        transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
      }

      .ci-update-button:hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
        box-shadow: 0 20px 48px rgba(230,58,31,.34);
      }

      .ci-update-button:focus-visible {
        outline: 2px solid #ff8b46;
        outline-offset: 4px;
      }

      @media (max-width: 560px) {
        #ci-update-overlay { padding: 14px; }
        .ci-update-card { padding: 28px 20px; border-radius: 20px; }
        .ci-update-icon { width: 66px; height: 66px; border-radius: 16px; }
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
      console.debug('ContactImporter update check skipped:', error);
    }
  }

  window.setTimeout(checkForUpdate, 2500);
  window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });

  window.addEventListener('focus', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
})();
