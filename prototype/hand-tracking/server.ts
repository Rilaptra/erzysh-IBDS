// FILE 2: server.ts
// Run with: bun run server.ts
// Fixes 4:3 Aspect Ratio Camera Alignment & Removes GPU-Heavy CSS Blur Shaders

const buildResult = await Bun.build({
  entrypoints: ["./engine.ts"],
  target: "browser",
  minify: true,
});

if (!buildResult.success) {
  console.error(buildResult.logs);
  process.exit(1);
}

const bundledJs = await buildResult.outputs[0]!.text();

const htmlShell = /* html */ `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🏗️ Beam Deflection & Multimodal Gesture Prototype v0.4.1 (Eco Mode)</title>
  <style>
    :root {
      --bg: #090d16;
      --panel: rgba(13, 19, 33, 0.96);
      --border: rgba(56, 189, 248, 0.3);
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; user-select: none; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    #sim-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }
    /* Removed backdrop-filter: blur() because it forces 60Hz GPU Gaussian shaders over canvas */
    .floating-win {
      position: absolute;
      width: 330px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      z-index: 10;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
    }
    .floating-win.grabbed-win {
      border-color: #a855f7;
    }
    .hidden-win { display: none !important; }
    .win-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      cursor: grab;
      color: #38bdf8;
    }
    .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    button {
      background: #1e293b;
      color: var(--text);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
      flex: 1;
    }
    button:hover { border-color: #38bdf8; }
    button.active-chip {
      background: rgba(16, 185, 129, 0.22);
      border-color: #10b981;
      color: #6ee7b7;
      font-weight: 600;
    }
    .metric-box {
      background: #060911;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      line-height: 1.5;
      margin-top: 6px;
    }
    .metric-box b { color: #38bdf8; }
    #virtual-cursor {
      position: fixed;
      top: 0;
      left: 0;
      width: 44px;
      height: 44px;
      border: 2px solid #38bdf8;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.75);
      will-change: transform;
    }
    #cursor-symbol { font-size: 20px; font-weight: bold; }
    #cursor-tag {
      position: absolute;
      left: 50px;
      white-space: nowrap;
      background: #0f172a;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    #cmd-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      border: 1px solid #38bdf8;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      z-index: 50;
    }
    /* Exact 4:3 Aspect Ratio (240x180) with object-fit: fill so landmarks never compress or crop! */
    .cam-preview {
      position: relative;
      width: 240px;
      height: 180px;
      margin: 0 auto 8px auto;
      background: #020617;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    #webcam-video {
      width: 240px;
      height: 180px;
      object-fit: fill;
      transform: scaleX(-1);
      opacity: 0.55;
    }
    #hand-skeleton {
      position: absolute;
      inset: 0;
      width: 240px;
      height: 180px;
    }
    .kbd-help {
      font-size: 11px;
      color: var(--muted);
      margin-top: 6px;
      line-height: 1.45;
    }
    .kbd-help code {
      color: #fef08a;
      background: rgba(254, 240, 138, 0.12);
      padding: 1px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <canvas id="sim-canvas"></canvas>

  <div id="virtual-cursor">
    <span id="cursor-symbol">◎</span>
    <span id="cursor-tag">Open Palm (Pointer)</span>
  </div>

  <!-- Floating Window 1: Structural Design & Optimizer -->
  <div class="floating-win" id="win-config" style="top: 24px; left: 24px;">
    <div class="win-header">
      <span>🧱 SNI 2847 / 🔩 SNI 1729 Optimizer</span>
      <span>▣ Drag</span>
    </div>
    <div class="row">
      <button data-cmd="set.material.rc">🧱 Beton (SNI 2847)</button>
      <button data-cmd="set.material.steel">🔩 Baja (SNI 1729)</button>
    </div>
    <div class="row">
      <button data-cmd="set.steel.filter.all">All (IWF+BOX)</button>
      <button data-cmd="set.steel.filter.iwf">Only IWF</button>
      <button data-cmd="set.steel.filter.box">Only BOX</button>
    </div>
    <div class="row">
      <button data-cmd="toggle.diagram.bmd">📈 Toggle BMD</button>
      <button data-cmd="toggle.diagram.sfd">📊 Toggle SFD</button>
    </div>
    <div class="metric-box">
      <div><b>Rekomendasi Penampang O(log N):</b></div>
      <div id="opt-result" style="color:#fef08a; font-family:monospace; margin:3px 0;">-</div>
      <div><b>Rasio Kapasitas (Mu / ΦMn):</b> <span id="dcr-val">-</span></div>
      <div><b>Lendutan Maks (Δmax):</b> <span id="defl-val">-</span></div>
    </div>
  </div>

  <!-- Floating Window 2: Multimodal Hand Tracking & Voice -->
  <div class="floating-win" id="win-gesture" style="top: 24px; right: 24px;">
    <div class="win-header">
      <span>🤚 Multimodal Hand & Voice (Eco Mode)</span>
      <span>▣ Drag</span>
    </div>
    <div class="cam-preview">
      <video id="webcam-video" width="240" height="180" playsinline muted></video>
      <canvas id="hand-skeleton" width="240" height="180"></canvas>
    </div>
    <div class="row">
      <button id="btn-toggle-cam">📷 Activate Hand Camera (Eco 16 FPS)</button>
    </div>
    <div class="row">
      <button id="btn-voice">🎤 Enable Voice Command</button>
    </div>
    <div class="metric-box">
      <div><b>Active Gesture:</b> <span id="gesture-live-badge">◎ Open Palm</span></div>
      <div class="kbd-help">
        <b>Debug Keys:</b> <code>1</code> ✋ Palm · <code>2</code> 🤏 Pinch · <code>3</code> ✊ Fist · <code>4</code> ☝️ Point · <code>5</code> ✌️ Drag
      </div>
    </div>
  </div>

  <div id="cmd-toast">⚡ Eco Workstation Ready · 0% Idle GPU Redraw · Knuckle-Anchored Pinch</div>

  <script type="module" src="/engine.js"></script>
</body>
</html>`;

const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/engine.js") {
      return new Response(bundledJs, {
        headers: { "Content-Type": "application/javascript; charset=utf-8" },
      });
    }
    return new Response(htmlShell, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`🚀 Eco-Mode Multimodal Simulator running at http://localhost:${server.port}`);
