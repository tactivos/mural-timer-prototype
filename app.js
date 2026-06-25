/* ============================================================
   Mural Timer prototype — interaction logic
   ============================================================ */

// Flip to true for a traditional dropdown (show all options + checkmark).
// false = the "swap selected out / keep No music" behavior from the designs.
const TRADITIONAL_DROPDOWN = false;

const $ = (s) => document.querySelector(s);

const state = {
  durationSec: 300,    // chosen setup duration
  customSec: 300,      // value held by the custom stepper
  isCustom: false,
  track: "none",       // selected track key
  remaining: 300,      // running countdown
  running: false,
  paused: false,
  role: "facilitator",
  previewing: false,
  panelOpen: false,
};

// ---- elements
const pill = $("#timerPill");
const pillTime = $("#pillTime");
const setupPanel = $("#setupPanel");
const runPanel = $("#runPanel");
const durationSeg = $("#durationSeg");
const customStepper = $("#customStepper");
const customDisplay = $("#customDisplay");
const musicSelect = $("#musicSelect");
const selIcon = $("#selIcon");
const selLabel = $("#selLabel");
const dropdown = $("#musicDropdown");
const previewBtn = $("#previewBtn");
const startBtn = $("#startBtn");
const muteBtn = $("#muteBtn");
const volSlider = $("#volSlider");
const adjTime = $("#adjTime");
const pauseBtn = $("#pauseBtn");
const endBtn = $("#endBtn");
const facilControls = $("#facilControls");
const viz = $("#viz");

// ---- helpers
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function fmt(sec, padMin = true) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  const mm = padMin ? String(m).padStart(2, "0") : String(m);
  return `${mm}:${String(s).padStart(2, "0")}`;
}
function trackDot(key, sizeClass = "") {
  const t = TRACKS[key];
  const none = key === "none" ? "dot-none" : "";
  const style = key === "none" ? "" : `style="background:${t.color}"`;
  return `<span class="track-dot ${none} ${sizeClass}" ${style}>${t.icon}</span>`;
}

// ============================================================
//  Setup panel — duration
// ============================================================
durationSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  [...durationSeg.children].forEach((b) => b.classList.toggle("is-active", b === btn));
  const v = btn.dataset.dur;
  if (v === "custom") {
    state.isCustom = true;
    customStepper.hidden = false;
    state.durationSec = state.customSec;
    customDisplay.textContent = fmt(state.customSec);
  } else {
    state.isCustom = false;
    customStepper.hidden = true;
    state.durationSec = parseInt(v, 10) * 60;
  }
  refreshPillIdle();
});

$("#stepMinus").addEventListener("click", () => stepCustom(-60));
$("#stepPlus").addEventListener("click", () => stepCustom(60));
function stepCustom(delta) {
  state.customSec = clamp(state.customSec + delta, 60, 60 * 60);
  state.durationSec = state.customSec;
  customDisplay.textContent = fmt(state.customSec);
  refreshPillIdle();
}

// ============================================================
//  Music select + dropdown
// ============================================================
function renderDropdown() {
  const keys = ["none", ...TRACK_ORDER];
  // Swap behavior (per designs): omit the currently-selected option — when a
  // track is active "No music" reappears; when "No music" is active it drops out.
  // Traditional: show every option and check the active one.
  const list = TRADITIONAL_DROPDOWN ? keys : keys.filter((k) => k !== state.track);
  dropdown.innerHTML = list.map((k) => {
    const t = TRACKS[k];
    const sel = k === state.track ? "selected" : "";
    return `<li class="dd-item ${sel}" data-key="${k}" role="option">
      ${trackDot(k)}
      <span class="dd-text"><span class="dd-name">${t.name}</span><span class="dd-genre">${t.genre}</span></span>
      <span class="dd-check">✓</span>
    </li>`;
  }).join("");
}
function openDropdown() {
  renderDropdown();
  dropdown.hidden = false;
  musicSelect.classList.add("open");
}
function closeDropdown() {
  dropdown.hidden = true;
  musicSelect.classList.remove("open");
}
musicSelect.addEventListener("click", () => {
  dropdown.hidden ? openDropdown() : closeDropdown();
});
dropdown.addEventListener("click", (e) => {
  const item = e.target.closest(".dd-item");
  if (!item) return;
  selectTrack(item.dataset.key);
  closeDropdown();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".music-row")) closeDropdown();
});

function selectTrack(key) {
  state.track = key;
  selIcon.innerHTML = trackDot(key);
  selLabel.textContent = TRACKS[key].name;
  const isNone = key === "none";
  previewBtn.disabled = isNone;
  if (isNone) stopPreview();
  // if previewing, switch the preview to the new track
  if (state.previewing && !isNone) MUSIC.play(key);
}

// Preview toggle (play ▶ / stop ■)
previewBtn.addEventListener("click", () => {
  if (state.track === "none") return;
  state.previewing ? stopPreview() : startPreview();
});
function startPreview() {
  state.previewing = true;
  previewBtn.classList.add("playing");
  MUSIC.setVolume(state.muted ? 0 : volSlider.value / 100);
  MUSIC.play(state.track);
}
function stopPreview() {
  state.previewing = false;
  previewBtn.classList.remove("playing");
  if (!state.running) MUSIC.stop();
}

// ============================================================
//  Pill / panel open-close
// ============================================================
pill.addEventListener("click", () => {
  if (state.running) toggleRunPanel();
  else toggleSetupPanel();
});
document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => { setupPanel.hidden = true; runPanel.hidden = true; state.panelOpen = false; })
);
function toggleSetupPanel() {
  const open = setupPanel.hidden;
  setupPanel.hidden = !open;
  runPanel.hidden = true;
}
function toggleRunPanel() {
  const open = runPanel.hidden;
  runPanel.hidden = !open;
  setupPanel.hidden = true;
}

// ============================================================
//  Start / countdown / pause / end
// ============================================================
let ticker = null;
let endAt = 0;

startBtn.addEventListener("click", startTimer);
function startTimer() {
  state.running = true;
  state.paused = false;
  state.remaining = state.durationSec;
  stopPreview();
  setupPanel.hidden = true;
  pill.classList.add("running");
  pill.classList.toggle("music", state.track !== "none");
  if (state.track !== "none") {
    MUSIC.setVolume(state.muted ? 0 : volSlider.value / 100);
    MUSIC.play(state.track);
  }
  runTick();
  endAt = performance.now() + state.remaining * 1000;
  ticker = setInterval(tickLoop, 200);
  startViz();
}

function tickLoop() {
  if (state.paused) return;
  state.remaining = (endAt - performance.now()) / 1000;
  if (state.remaining <= 0) { state.remaining = 0; finishTimer(); }
  runTick();
}

function runTick() {
  const txt = fmt(state.remaining, true);
  pillTime.textContent = txt;
  adjTime.textContent = fmt(state.remaining, false);
}

pauseBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  if (state.paused) {
    MUSIC.stop();
  } else {
    endAt = performance.now() + state.remaining * 1000;
    if (state.track !== "none") MUSIC.play(state.track);
  }
});

endBtn.addEventListener("click", () => resetToIdle());

function finishTimer() {
  clearInterval(ticker); ticker = null;
  MUSIC.stop();
  MUSIC.chime();
  pillTime.textContent = "Time's up!";
  pill.classList.add("done");
  setTimeout(() => { resetToIdle(); }, 3200);
}

function resetToIdle() {
  clearInterval(ticker); ticker = null;
  stopViz();
  MUSIC.stop();
  state.running = false;
  state.paused = false;
  pauseBtn.textContent = "Pause";
  pill.classList.remove("running", "done", "music");
  runPanel.hidden = true;
  state.remaining = state.durationSec;
  refreshPillIdle();
}

function refreshPillIdle() {
  if (!state.running) pillTime.textContent = fmt(state.durationSec, true);
}

// Adjust time (facilitator)
$("#adjMinus").addEventListener("click", () => adjustRemaining(-30));
$("#adjPlus").addEventListener("click", () => adjustRemaining(30));
function adjustRemaining(delta) {
  if (!state.running) return;
  state.remaining = clamp(state.remaining + delta, 0, 99 * 60);
  endAt = performance.now() + state.remaining * 1000;
  runTick();
}

// ============================================================
//  Volume + mute (per-user)
// ============================================================
volSlider.addEventListener("input", () => {
  if (state.muted) toggleMute();
  MUSIC.setVolume(volSlider.value / 100);
});
$("#volMinus").addEventListener("click", () => nudgeVol(-10));
$("#volPlus").addEventListener("click", () => nudgeVol(10));
function nudgeVol(d) {
  volSlider.value = clamp(parseInt(volSlider.value, 10) + d, 0, 100);
  if (state.muted && volSlider.value > 0) toggleMute();
  MUSIC.setVolume(volSlider.value / 100);
}
muteBtn.addEventListener("click", toggleMute);
function toggleMute() {
  state.muted = !state.muted;
  muteBtn.classList.toggle("muted", state.muted);
  MUSIC.setMuted(state.muted);
}

// ============================================================
//  Visualizer (pill bars driven by real audio level)
// ============================================================
let vizRAF = null;
const bars = [...viz.querySelectorAll("i")];
function startViz() {
  const seeds = [0.6, 1, 0.75, 1, 0.55];
  const animate = () => {
    const lvl = MUSIC.level();           // 0..1
    bars.forEach((b, i) => {
      const base = state.track === "none" ? 0.12 : 0.25;
      const wobble = state.track === "none" ? 0 : (Math.sin(performance.now() / (120 + i * 40)) + 1) / 2;
      const h = 3 + (base + lvl * seeds[i] + wobble * 0.4) * 13;
      b.style.height = clamp(h, 3, 16) + "px";
    });
    vizRAF = requestAnimationFrame(animate);
  };
  animate();
}
function stopViz() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizRAF = null;
  bars.forEach((b) => (b.style.height = "5px"));
}

// ============================================================
//  Role toggle (dev)
// ============================================================
document.querySelector(".role-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".role-btn");
  if (!btn) return;
  state.role = btn.dataset.role;
  document.querySelectorAll(".role-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
  facilControls.classList.toggle("hidden", state.role !== "facilitator");
});

// ---- init
selectTrack("none");
refreshPillIdle();
setupPanel.hidden = false;   // open on load so the panel is visible
state.panelOpen = true;
