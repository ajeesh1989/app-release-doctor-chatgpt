import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "App Release Doctor",
  version: "1.0.0",
});

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("App root element not found.");
}

root.innerHTML = `
  <div class="app">
    <header class="header">
      <div class="brand">
        <div class="brand-icon">🩺</div>

        <div>
          <h1>App Release Doctor</h1>
          <p>Smart Flutter Android release diagnostics</p>
        </div>
      </div>

      <div class="connection">
        <span id="status-dot" class="status-dot"></span>
        <span id="status-text">Connecting...</span>
      </div>
    </header>

    <main>
      <section class="intro">
        <div class="eyebrow">RELEASE DIAGNOSTICS</div>

        <h2>Check your Android release before publishing.</h2>

        <p>
          Inspect your Android App Bundle, verify Flutter configuration,
          check Target SDK requirements, and review Google Play readiness.
        </p>
      </section>

      <section class="diagnostics">
        <button class="diagnostic-card" data-action="inspect_aab">
          <span class="card-icon">📦</span>
          <span class="card-content">
            <strong>Inspect AAB</strong>
            <small>Analyze your Android App Bundle</small>
          </span>
          <span class="arrow">›</span>
        </button>

        <button class="diagnostic-card" data-action="check_flutter_project">
          <span class="card-icon">🧩</span>
          <span class="card-content">
            <strong>Check Flutter Project</strong>
            <small>Inspect Flutter release configuration</small>
          </span>
          <span class="arrow">›</span>
        </button>

        <button class="diagnostic-card" data-action="check_target_sdk">
          <span class="card-icon">🎯</span>
          <span class="card-content">
            <strong>Check Target SDK</strong>
            <small>Verify Android SDK compliance</small>
          </span>
          <span class="arrow">›</span>
        </button>

        <button class="diagnostic-card" data-action="check_play_store_readiness">
          <span class="card-icon">✓</span>
          <span class="card-content">
            <strong>Play Store Readiness</strong>
            <small>Check release readiness</small>
          </span>
          <span class="arrow">›</span>
        </button>
      </section>

      <section class="result-section">
        <div class="result-header">
          <div>
            <div class="eyebrow">RESULT</div>
            <h3>Release analysis</h3>
          </div>

          <button id="copy-button" class="copy-button" hidden>
            Copy result
          </button>
        </div>

        <div id="result" class="result empty">
          <div class="empty-icon">🩺</div>

          <strong>Ready to inspect</strong>

          <p>
            Select a diagnostic above to begin.
          </p>
        </div>
      </section>
    </main>
  </div>
`;

const style = document.createElement("style");

style.textContent = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: #f8f9fa;
    color: #202124;
    font-family:
      Inter,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Arial,
      sans-serif;
  }

  body {
    min-width: 320px;
  }

  .app {
    max-width: 820px;
    margin: 0 auto;
    padding: 28px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 26px;
    border-bottom: 1px solid #e1e4e8;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .brand-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: #ffffff;
    border: 1px solid #dadce0;
    font-size: 24px;
    box-shadow: 0 1px 2px rgba(60, 64, 67, 0.08);
  }

  .brand h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.2px;
  }

  .brand p {
    margin: 4px 0 0;
    color: #5f6368;
    font-size: 13px;
  }

  .connection {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #5f6368;
    font-size: 12px;
    white-space: nowrap;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fbbc04;
  }

  .status-dot.connected {
    background: #34a853;
  }

  .status-dot.error {
    background: #ea4335;
  }

  .intro {
    padding: 42px 0 28px;
  }

  .eyebrow {
    color: #5f6368;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.1px;
    margin-bottom: 10px;
  }

  .intro h2 {
    margin: 0;
    max-width: 680px;
    font-size: 32px;
    line-height: 1.18;
    letter-spacing: -0.8px;
    font-weight: 650;
  }

  .intro p {
    max-width: 650px;
    margin: 14px 0 0;
    color: #5f6368;
    font-size: 15px;
    line-height: 1.65;
  }

  .diagnostics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .diagnostic-card {
    appearance: none;
    border: 1px solid #dadce0;
    background: #ffffff;
    border-radius: 16px;
    padding: 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .diagnostic-card:hover {
    border-color: #b7bcc1;
    box-shadow: 0 2px 8px rgba(60, 64, 67, 0.12);
    transform: translateY(-1px);
  }

  .diagnostic-card:disabled {
    cursor: wait;
    opacity: 0.65;
    transform: none;
  }

  .card-icon {
    width: 42px;
    height: 42px;
    flex: 0 0 42px;
    border-radius: 12px;
    background: #f1f3f4;
    display: grid;
    place-items: center;
    font-size: 19px;
  }

  .card-content {
    min-width: 0;
    flex: 1;
  }

  .card-content strong {
    display: block;
    font-size: 14px;
    font-weight: 650;
    color: #202124;
  }

  .card-content small {
    display: block;
    margin-top: 4px;
    color: #5f6368;
    font-size: 12px;
  }

  .arrow {
    color: #80868b;
    font-size: 24px;
    line-height: 1;
  }

  .result-section {
    margin-top: 34px;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 10px;
  }

  .result-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
  }

  .copy-button {
    border: 1px solid #dadce0;
    background: #ffffff;
    color: #3c4043;
    border-radius: 9px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .copy-button:hover {
    background: #f8f9fa;
  }

  .result {
    min-height: 170px;
    border: 1px solid #dadce0;
    border-radius: 16px;
    background: #ffffff;
    padding: 24px;
  }

  .result.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .empty-icon {
    font-size: 28px;
    margin-bottom: 10px;
  }

  .result.empty strong {
    font-size: 14px;
  }

  .result.empty p {
    margin: 6px 0 0;
    color: #5f6368;
    font-size: 13px;
  }

  .result pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family:
      "SFMono-Regular",
      Consolas,
      "Liberation Mono",
      monospace;
    font-size: 12px;
    line-height: 1.6;
    color: #202124;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    color: #5f6368;
    font-size: 13px;
  }

  .error-result {
    color: #b3261e;
  }

  @media (max-width: 640px) {
    .app {
      padding: 18px;
    }

    .header {
      align-items: flex-start;
      flex-direction: column;
    }

    .connection {
      margin-left: 62px;
    }

    .intro {
      padding-top: 30px;
    }

    .intro h2 {
      font-size: 26px;
    }

    .diagnostics {
      grid-template-columns: 1fr;
    }
  }
`;

document.head.appendChild(style);

const statusDot =
  document.querySelector<HTMLSpanElement>("#status-dot");

const statusText =
  document.querySelector<HTMLSpanElement>("#status-text");

const result =
  document.querySelector<HTMLDivElement>("#result");

const copyButton =
  document.querySelector<HTMLButtonElement>("#copy-button");

const buttons =
  Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      ".diagnostic-card"
    )
  );

let lastResultText = "";

function setStatus(
  text: string,
  state: "connecting" | "connected" | "error"
) {
  if (statusText) {
    statusText.textContent = text;
  }

  if (statusDot) {
    statusDot.className = "status-dot";

    if (state === "connected") {
      statusDot.classList.add("connected");
    }

    if (state === "error") {
      statusDot.classList.add("error");
    }
  }
}

function setLoading() {
  if (!result) {
    return;
  }

  result.className = "result";

  result.innerHTML = `
    <div class="loading">
      Running release diagnostics...
    </div>
  `;

  if (copyButton) {
    copyButton.hidden = true;
  }
}

function displayResult(value: unknown) {
  if (!result) {
    return;
  }

  let text: string;

  if (typeof value === "string") {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }

  lastResultText = text;

  result.className = "result";

  result.innerHTML = "";

  const pre = document.createElement("pre");
  pre.textContent = text;

  result.appendChild(pre);

  if (copyButton) {
    copyButton.hidden = false;
  }
}

async function runDiagnostic(action: string) {
  buttons.forEach((button) => {
    button.disabled = true;
  });

  setLoading();

  try {
    const response = await app.callServerTool({
      name: "app_release_doctor",
      arguments: {
        action,
      },
    });

    displayResult(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    if (result) {
      result.className = "result error-result";

      result.textContent =
        `Diagnostic failed: ${message}`;
    }

    if (copyButton) {
      copyButton.hidden = true;
    }
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action) {
      void runDiagnostic(action);
    }
  });
});

copyButton?.addEventListener("click", async () => {
  if (!lastResultText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastResultText);

    copyButton.textContent = "Copied";

    window.setTimeout(() => {
      copyButton.textContent = "Copy result";
    }, 1500);
  } catch {
    copyButton.textContent = "Copy failed";

    window.setTimeout(() => {
      copyButton.textContent = "Copy result";
    }, 1500);
  }
});

app.ontoolresult = (resultData) => {
  displayResult(resultData);
};

app.onerror = (error) => {
  console.error("App connection error:", error);

  setStatus(
    "Connection error",
    "error"
  );
};

async function start() {
  try {
    setStatus(
      "Connecting...",
      "connecting"
    );

    await app.connect();

    setStatus(
      "Connected to App Release Doctor",
      "connected"
    );
  } catch (error) {
    console.error(
      "Failed to connect to App Release Doctor:",
      error
    );

    setStatus(
      "Waiting for ChatGPT connection",
      "error"
    );
  }
}

void start();