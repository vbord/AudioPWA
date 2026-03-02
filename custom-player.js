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

/* PLAY / PAUSE / RESUME LAST */
btnPlay.onclick = () => {
    if (!audio.src) {
        if (typeof resumeLastBookAndFile === "function") {
            resumeLastBookAndFile();
        }
        return;
    }

    if (audio.paused) {
        audio.play();
        btnPlay.textContent = "⏸";
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
    moveDrag(e); // show preview immediately
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

    // raw preview time
    let previewTime = pct * audio.duration;

    // SOFT SNAPPING (magnetic feel)
    const snapped = Math.round(previewTime / snapInterval) * snapInterval;

    // only snap if close enough (soft feel)
    if (Math.abs(snapped - previewTime) < snapInterval * 0.4) {
        previewTime = snapped;

        // REAL HAPTIC FEEDBACK (Android only)
        if (snapped !== lastSnap && navigator.vibrate) {
            navigator.vibrate(10);
            lastSnap = snapped;
        }
    }

    // update fill visually
    const snappedPct = previewTime / audio.duration;
    fill.style.width = (snappedPct * 100) + "%";

    // update live preview time
    const dur = formatTime(audio.duration);
    timeDisplay.textContent = `${formatTime(previewTime)} / ${dur}`;
}

function endDrag(e) {
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const rect = bar.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));

    if (audio.duration) {
        let finalTime = pct * audio.duration;

        // snap on release too
        finalTime = Math.round(finalTime / snapInterval) * snapInterval;

        audio.currentTime = finalTime;
    }

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
};

audio.onpause = () => {
    btnPlay.textContent = "▶";
};

/* === VOLUME CONTROL (side menu) === */
(function () {
    const volumeControl = document.getElementById("volumeControl");
    const menuBtn = document.getElementById("menu-btn");
    const menuCloseBtn = document.getElementById("menu-close-btn");

    if (!volumeControl) return;

    // 1) При загрузке страницы — выставить ползунок в текущее значение
    volumeControl.value = audio.volume;

    // 2) Синхронизация при открытии/закрытии меню
    function syncVolumeSlider() {
        volumeControl.value = audio.volume;
    }

    menuBtn?.addEventListener("click", syncVolumeSlider);
    menuCloseBtn?.addEventListener("click", syncVolumeSlider);

    // 3) При изменении ползунка — менять громкость плеера
    volumeControl.addEventListener("input", () => {
        audio.volume = volumeControl.value;
    });

    // 4) При resume playback — тоже обновить
    audio.addEventListener("play", syncVolumeSlider);
})();
const volumeControl = document.getElementById("volumeControl");

function updateVolumeTrack() {
    const pct = (volumeControl.value * 100) + "%";
    volumeControl.style.setProperty("--val", pct);
}

volumeControl.addEventListener("input", updateVolumeTrack);
audio.addEventListener("volumechange", updateVolumeTrack);

// начальная установка
updateVolumeTrack();
