/* ================================================
   Custom Audio Player (clean, single volume section)
   ================================================ */

const audio = document.getElementById("player");

const btnPlay = document.getElementById("btn-play");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");

const bar = document.getElementById("progress-bar");
const fill = document.getElementById("progress-fill");
const timeDisplay = document.getElementById("time-display");

let isDragging = false;

/* HAPTIC + SOFT SNAPPING SETTINGS */
const snapInterval = 10;   // snap every 10 seconds
let lastSnap = -1;

/* --------------------------------
   PLAY / PAUSE / RESUME LAST
---------------------------------- */
btnPlay.onclick = () => {

    const mode = localStorage.getItem("ab_mode");

    /* =========================================================
       LOCAL MODE — block play unless a REAL local file is loaded
       ========================================================= */
    if (mode === "local") {

        // No valid playable source
        if (!audio.src || audio.src === "" || audio.readyState < 2) {
            alert("Select a local file to play.");
            return;
        }

        // Normal toggle
        if (audio.paused) {
            audio.play().catch(err => console.warn("Local play error:", err));
            btnPlay.textContent = "⏸";
        } else {
            audio.pause();
            btnPlay.textContent = "▶";
        }

        return;
    }

    /* =========================================================
       ONLINE MODE — resume if no ready source
       ========================================================= */
    if (mode === "online" && audio.readyState < 2) {

        if (typeof resumeLastBookAndFile === "function") {
            resumeLastBookAndFile();

            if (typeof openCurrentFolderAndRemark === "function") {
                setTimeout(() => openCurrentFolderAndRemark(), 0);
            }
        }

        return;
    }

    /* =========================================================
       Normal PLAY/PAUSE toggle (both modes once src is valid)
       ========================================================= */
    if (audio.paused) {
        audio.play();
        btnPlay.textContent = "⏸";

        if (typeof openCurrentFolderAndRemark === "function") {
            setTimeout(() => openCurrentFolderAndRemark(), 0);
        }

    } else {
        audio.pause();
        btnPlay.textContent = "▶";
    }
};

/* SEEK BACK 15s */
btnBack.onclick = () => {
    audio.currentTime = Math.max(0, audio.currentTime - 15);
};

/* SEEK FORWARD 30s */
btnForward.onclick = () => {
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 30);
};

/* UPDATE PROGRESS + TIME */
audio.ontimeupdate = () => {

    if (!isDragging && audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        fill.style.width = pct + "%";
    }

    const cur = formatTime(audio.currentTime);
    const dur = formatTime(audio.duration);
    timeDisplay.textContent = `${cur} / ${dur}`;
};

/* DRAGGING */
bar.addEventListener("mousedown", startDrag);
bar.addEventListener("touchstart", startDrag);

function startDrag(e) {
    isDragging = true;
    moveDrag(e);

    document.addEventListener("mousemove", moveDrag);
    document.addEventListener("touchmove", moveDrag);

    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
}

function moveDrag(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = bar.getBoundingClientRect();

    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));

    if (!audio.duration) return;

    let previewTime = pct * audio.duration;

    const snapped = Math.round(previewTime / snapInterval) * snapInterval;

    if (Math.abs(snapped - previewTime) < snapInterval * 0.4) {
        previewTime = snapped;

        if (snapped !== lastSnap && navigator.vibrate) {
            navigator.vibrate(10);
            lastSnap = snapped;
        }
    }

    const snappedPct = previewTime / audio.duration;
    fill.style.width = snappedPct * 100 + "%";

    const dur = formatTime(audio.duration);
    timeDisplay.textContent = `${formatTime(previewTime)} / ${dur}`;
}

function endDrag(e) {

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const rect = bar.getBoundingClientRect();

    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));

    let finalTime = pct * audio.duration;
    finalTime = Math.round(finalTime / snapInterval) * snapInterval;

    audio.currentTime = finalTime;

    isDragging = false;
    lastSnap = -1;

    document.removeEventListener("mousemove", moveDrag);
    document.removeEventListener("touchmove", moveDrag);

    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchend", endDrag);
}

/* FORMAT TIME */
function formatTime(sec) {
    if (!sec || isNaN(sec)) return "0:00";

    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

audio.onplay = () => {
    btnPlay.textContent = "⏸";

    if (typeof openCurrentFolderAndRemark === "function") {
        setTimeout(() => openCurrentFolderAndRemark(), 0);
    }
};

audio.onpause = () => {
    btnPlay.textContent = "▶";
};

/* =========================================================
   VOLUME CONTROL (side menu)
   ========================================================= */
(() => {

    const audio = document.getElementById("player");
    const volumeControl = document.getElementById("volumeControl");

    const menuBtn = document.getElementById("menu-btn");
    const menuCloseBtn = document.getElementById("menu-close-btn");

    if (!audio || !volumeControl) return;

    if (volumeControl.dataset.bound == "1") return;
    volumeControl.dataset.bound = "1";

    function updateVolumeTrack() {
        const pct = Number(volumeControl.value) * 100 + "%";
        volumeControl.style.setProperty("--val", pct);
    }

    function syncSliderFromAudio() {
        volumeControl.value = String(audio.volume);
        updateVolumeTrack();
    }

    syncSliderFromAudio();

    volumeControl.addEventListener("input", () => {
        audio.volume = Number(volumeControl.value);
        updateVolumeTrack();
    });

    audio.addEventListener("volumechange", syncSliderFromAudio);

    menuBtn?.addEventListener("click", syncSliderFromAudio);
    menuCloseBtn?.addEventListener("click", syncSliderFromAudio);

})();

/* =========================================================
   WATCHDOG (minimal)
   ========================================================= */
setInterval(() => {
    if (!audio.src) return;
    if (audio.paused) return;
    if (!audio.duration) return;
}, 1000);

/* --------------------------------
   Small helper
---------------------------------- */
function updateMenuEmail() {
    const emailBox = document.getElementById("user-email");
    const savedEmail = localStorage.getItem("ab_email");
    emailBox.textContent = savedEmail || "";
}

document.addEventListener("DOMContentLoaded", updateMenuEmail);