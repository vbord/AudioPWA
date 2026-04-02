// play.js
// ================================================
// Extracted PLAY CODE from OLD app.js
// Any code touching <audio id="player"> lives HERE
// ================================================

const player = document.getElementById("player");

// ---------------- CONTROL DISABLE / ENABLE ----------------
export function disablePlayerControls() {
    document.getElementById("btn-back").disabled = true;
    document.getElementById("btn-forward").disabled = true;
    document.getElementById("btn-play").disabled = true;
}

export function enablePlayerControls() {
    document.getElementById("btn-back").disabled = false;
    document.getElementById("btn-forward").disabled = false;
    document.getElementById("btn-play").disabled = false;
}

// ---------------- LOADING OVERLAY ----------------
export function showLoading(msg = "Loading…") {
    const el = document.getElementById("loading-overlay");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    el.style.opacity = "1";
}

export function hideLoading() {
    const el = document.getElementById("loading-overlay");
    if (!el) return;
    el.style.opacity = "0";
    setTimeout(() => (el.style.display = "none"), 200);
}

// ---------------- PLAYER EVENTS ----------------
player.addEventListener("waiting", () => {
    showLoading("Loading…");
    disablePlayerControls();
});

player.addEventListener("canplay", () => {
    hideLoading();
    enablePlayerControls();
});

player.addEventListener("playing", () => {
    hideLoading();
    enablePlayerControls();
});

// ---------------- SAVE PROGRESS ----------------
let saveTimer = null;

export function startSaving(book, file, userProgress, userId, API) {
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => {
        saveProgress(book, file, player.currentTime, userProgress, userId, API);
    }, 5000);
}

async function saveProgress(book, file, pos, userProgress, userId, API) {
    userProgress[book] = {
        file,
        position: pos,
        updated: new Date().toISOString()
    };

    await fetch(`${API}/SaveProgress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            book,
            file,
            position: pos
        })
    });
}

// ---------------- PLAY FILE ----------------
export function playFile({
    book,
    file,
    url,
    userProgress,
    userId,
    API,
    setCurrent,
    highlightFile,
    markNowPlaying,
    openCurrentFolderAndRemark,
    playNextFromDom
}) {
    setCurrent(book, file);

    player.src = url;

    const hasSaved =
        userProgress[book] &&
        userProgress[book].file === file &&
        typeof userProgress[book].position === "number" &&
        userProgress[book].position > 0;

    if (hasSaved) {
        showLoading("Loading…");
        disablePlayerControls();

        player.addEventListener(
            "canplay",
            () => {
                hideLoading();
                enablePlayerControls();
                player.play().catch(() => { });
            },
            { once: true }
        );

        player.currentTime = userProgress[book].position;
    } else {
        player.play().catch(() => { });
    }

    highlightFile(file);
    markNowPlaying(book, file, { scroll: true });

    openCurrentFolderAndRemark();

    startSaving(book, file, userProgress, userId, API);

    player.onended = () => playNextFromDom(file, book);
}

// ---------------- AUTO PLAY ----------------
export function autoPlayBook(book, userProgress, playFileFromDom) {
    if (userProgress[book]) {
        playFileFromDom(book, userProgress[book].file);
        return;
    }
}

// ---------------- RESUME LAST ----------------
export function resumeLastBookAndFile(userProgress, expandAndPlay) {
    if (!userProgress || Object.keys(userProgress).length === 0) return;

    let lastBook = null;
    let lastTime = 0;

    for (const [book, data] of Object.entries(userProgress)) {
        const t = new Date(data.updated).getTime();
        if (t > lastTime) {
            lastTime = t;
            lastBook = book;
        }
    }

    if (!lastBook) return;

    const { file, position } = userProgress[lastBook];
    expandAndPlay(lastBook, file, position);
}

// ---------------- EXPAND AND PLAY ----------------
export async function expandAndPlay(
    bookPath,
    fileName,
    position,
    helpers
) {
    const {
        treeContainer,
        loadFilesInto,
        autoPlayBookFromDom
    } = helpers;

    const parts = bookPath.split("/");
    let container = treeContainer;

    for (const part of parts) {
        const row = [...container.querySelectorAll(".tree-row")].find(
            r => r.querySelector(".folder-name").textContent === part
        );
        if (!row) continue;

        const arrow = row.querySelector(".arrow");
        const nextContainer = row.nextElementSibling;

        if (nextContainer.style.display === "none") {
            arrow.textContent = "-";
            nextContainer.style.display = "block";
        }

        container = nextContainer;
    }

    document.querySelectorAll(".file-item").forEach(el => el.remove());

    const mp3Container = container.querySelector(".mp3-container");
    if (mp3Container) {
        await loadFilesInto(bookPath, mp3Container);
    }

    const target = [...document.querySelectorAll(".file-item")].find(
        el => el.textContent === fileName
    );

    if (target) {
        target.click();
    } else {
        setTimeout(() => autoPlayBookFromDom(bookPath), 300);
    }
}