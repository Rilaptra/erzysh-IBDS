// FILE 2: server.ts
// Run with: bun run server.ts

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
  <title>🏗️ Bimanual (2-Hand) Structural Simulator v0.4.2</title>
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
    .floating-win {
      position: absolute;
      width: 345px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      z-index: 10;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.65);
    }
    .floating-win.grabbed-win { border-color: #a855f7; }
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
    .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 7px; }
    button {
      background: #1e293b;
      color: var(--text);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 6px;
      padding: 6px 9px;
      font-size: 11.5px;
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
      line-height: 1.48;
      margin-top: 6px;
    }
    .metric-box b { color: #38bdf8; }
    .v-cursor {
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
      background: rgba(15, 23, 42, 0.78);
      will-change: transform;
    }
    .v-cursor span:first-child { font-size: 20px; font-weight: bold; }
    .v-tag {
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
      bottom: 18px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      border: 1px solid #38bdf8;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 12.5px;
      z-index: 50;
    }
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
      margin-top: 5px;
      line-height: 1.42;
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

  <!-- Right Hand (Primary) Virtual Cursor -->
  <div id="virtual-cursor-r" class="v-cursor">
    <span id="cursor-sym-r">◎</span>
    <span id="cursor-tag-r" class="v-tag">R · Palm</span>
  </div>

  <!-- Left Hand (Secondary / Bimanual) Virtual Cursor -->
  <div id="virtual-cursor-l" class="v-cursor" style="display: none;">
    <span id="cursor-sym-l">▼</span>
    <span id="cursor-tag-l" class="v-tag">L · Fist</span>
  </div>

  <!-- Floating Window 1: Structural Design & Bimanual Mechanics -->
  <div class="floating-win" id="win-config" style="top: 20px; left: 20px;">
    <div class="win-header">
      <span>🧱 SNI 2847 / 🔩 SNI 1729 Bimanual Engine</span>
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
      <button data-cmd="cycle.support">📐 Tumpuan: SIMPLY-SUPPORTED</button>
      <button data-cmd="toggle.dual.load">🏋️ Dual Load (P1+P2)</button>
    </div>
    <div class="row">
      <button data-cmd="toggle.diagram.bmd">📈 BMD</button>
      <button data-cmd="toggle.diagram.sfd">📊 SFD</button>
      <button data-cmd="toggle.bimanual">🙌 2-Hand Mode</button>
    </div>
    <div class="metric-box">
      <div><b>Hasil Optimasi Penampang:</b></div>
      <div id="opt-result" style="color:#fef08a; font-family:monospace; margin:2px 0;">-</div>
      <div><b>Rasio Kapasitas (DCR):</b> <span id="dcr-val">-</span></div>
      <div><b>Lendutan Maks (Δmax):</b> <span id="defl-val">-</span></div>
      <div><b>Status Mekanika:</b> <span id="bimanual-note" style="color:#d8b4fe;">-</span></div>
    </div>
  </div>

  <!-- Floating Window 2: 2-Hand Camera & Gesture Guide -->
  <div class="floating-win" id="win-gesture" style="top: 20px; right: 20px;">
    <div class="win-header">
      <span>🙌 2-Hand Bimanual Tracking (Eco 12-16 FPS)</span>
      <span>▣ Drag</span>
    </div>
    <div class="cam-preview">
      <video id="webcam-video" width="240" height="180" playsinline muted></video>
      <canvas id="hand-skeleton" width="240" height="180"></canvas>
    </div>
    <div class="row">
      <button id="btn-toggle-cam">📷 Activate 2-Hand Camera (Eco Adaptive)</button>
    </div>
    <div class="metric-box">
      <div><b>Active Hands:</b> <span id="gesture-live-badge">R:[◎ Palm]</span></div>
      <div class="kbd-help">
        <b>5 Kombinasi 2 Tangan (Kamera / Simulator):</b><br/>
        • <code>✊ L + ✊ R</code> : Dual Load (P1 & P2) + Putar Setir Torsi (Tu)<br/>
        • <code>🤏 L + 🤏 R</code> : Rentangkan Zona Beban Merata Parsial (qu)<br/>
        • <code>✊ L + ☝️ R</code> : Tahan Beban P1 (Kiri) + Inspeksi Kurva (Kanan)<br/>
        • <code>✌️ L + 🤏 R</code> : Ganti Tumpuan (Sendi-Rol / Jepit / Kantilever)<br/>
        <b>No Webcam?</b> Tekan <code>Space</code> untuk memunculkan Tangan Kiri Virtual (<code>Q/W/E/R/T</code> gestur kiri, <code>A/D/S</code> geser kiri)!
      </div>
    </div>
  </div>

  <div id="cmd-toast">⚡ Bimanual Workstation Ready · Show 2 Hands to Camera or Press [Space] for Virtual Left Hand</div>

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

console.log(
  `🚀 Bimanual 2-Hand Simulator running at http://localhost:${server.port}`,
);
