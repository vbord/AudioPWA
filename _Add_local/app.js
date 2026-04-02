// =====================================================
// app.js — FINAL FIXED VERSION (PART 1 / 4)
// =====================================================
// ONLINE SAVE: server only
// LOCAL SAVE: localStorage only (never touches API)
// =====================================================

const API = "https://slava.localto.net/api/BooksApi";
const treeContainer = document.getElementById("tree-container");
const player = document.getElementById("player");

let userId = null;
let userEmail = null;

// ✅ ONLINE progress (from API)
let userProgress = {};

// ✅ ONLINE auto-save timer
let saveTimer = null;

// ✅ LOCAL auto-save timer
window.localSaveTimer = null;

// ✅ Currently playing ONLINE mode identifier
let currentBook = null;
let currentFile = null;

// =====================================================
// MENU CONTROLS
// =====================================================
const sideMenu = document.getElementById("side-menu");
const menuBtn = document.getElementById("menu-btn");

menuBtn.onclick = () => {
    sideMenu.classList.toggle("open");
    document.body.classList.toggle(
        "menu-open",
        sideMenu.classList.contains("open")
    );
};

document.getElementById("menu-close-btn").onclick = () => {
    sideMenu.classList.remove("open");
    document.body.classList.remove("menu-open");
};

document.querySelectorAll("#side-menu .menu-item").forEach(btn => {
    btn.addEventListener("click", () => sideMenu.classList.remove("open"));
});

// =====================================================
// PLAYER CONTROL HANDLING
// =====================================================
function disablePlayerControls() {
    document.getElementById("btn-back").disabled = true;
    document.getElementById("btn-forward").disabled = true;
    document.getElementById("btn-play").disabled = true;
}

function enablePlayerControls() {
    document.getElementById("btn-back").disabled = false;
    document.getElementById("btn-forward").disabled = false;
    document.getElementById("btn-play").disabled = false;
}

// =====================================================
// LOADING OVERLAY MANAGEMENT
// =====================================================
function showLoading(msg = "Loading…") {
    const el = document.getElementById("loading-overlay");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    el.style.opacity = "1";
}

function hideLoading() {
    const el = document.getElementById("loading-overlay");
    if (!el) return;
    el.style.opacity = "0";
    setTimeout(() => { el.style.display = "none"; }, 200);
}

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

// =====================================================
// LOGIN HANDLING
// =====================================================
function showLogin() {
    document.getElementById("login-modal").style.display = "flex";
}

function hideLogin() {
    document.getElementById("login-modal").style.display = "none";
}

document.getElementById("login-btn").onclick = async () => {
    const email = document.getElementById("login-email").value.trim();
    if (!email) return;

    const res = await fetch(`${API}/Login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    const data = await res.json();

    userId = data.userId;
    userEmail = email;

    localStorage.setItem("ab_userId", userId);
    localStorage.setItem("ab_email", email);

    updateMenuEmail();
    hideLogin();
    loadProgress();
};

function initLogin() {
    const savedId = localStorage.getItem("ab_userId");
    const savedEmail = localStorage.getItem("ab_email");

    if (savedId && savedEmail) {
        userId = savedId;
        userEmail = savedEmail;

        hideLogin();
        if (localStorage.getItem("ab_mode") === "online") {
            loadProgress();     // online tree
        } else {
            if (typeof loadLocalTree === "function") {
                loadLocalTree(); // ✅ correct method name
            }
        }

        // If current mode is local, load local books
        if (localStorage.getItem("ab_mode") === "local") {
            if (typeof loadLocalBooks === "function") loadLocalBooks();
        }

    } else {
        showLogin();
    }
}

// =====================================================
// LOAD USER PROGRESS (ONLINE ONLY)
// =====================================================
async function loadProgress() {
    const res = await fetch(`${API}/GetProgress?userId=${userId}`);

    if (res.ok) {
        const data = await res.json();
        userProgress = data.books || {};
    }

    if (localStorage.getItem("ab_mode") !== "local") {
        loadBooks();   // load online tree only if NOT local mode
    }
}

// =====================================================
// LOAD BOOKS (ONLINE TREE)
// =====================================================
async function loadBooks() {
    const res = await fetch(`${API}/GetBooks`);
    const books = await res.json();

    const paths = books.map(b => b.name);
    const tree = buildTree(paths);

    treeContainer.innerHTML = "";
    renderTree(tree, treeContainer, "");

    if (currentBook) {
        setTimeout(() => openCurrentFolderAndRemark(), 0);
    }
}

function buildTree(paths) {
    const root = {};

    paths.forEach(path => {
        const parts = path.split("/");
        let node = root;

        parts.forEach(part => {
            if (!node[part]) node[part] = {};
            node = node[part];
        });
    });

    return root;
}
// =====================================================
// COVER + TREE RENDERING (continuation from Part 1)
// =====================================================
// ---------------- COVER LOADER ----------------
async function loadCover(bookPath) {
    const res = await fetch(`${API}/GetBookCover?book=${encodeURIComponent(bookPath)}`);
    const cover = await res.json();
    if (!cover) return null;

    return `https://slava.localto.net/Uploads/Audio/ABOOKS/${cover}`;
}

function renderTree(node, container, currentPath) {
    Object.keys(node).forEach(key => {
        const fullPath = currentPath ? `${currentPath}/${key}` : key;

        const row = document.createElement("div");
        row.className = "tree-row";

        // cover icon
        const icon = document.createElement("img");
        icon.className = "folder-icon hidden";

        loadCover(fullPath).then(url => {
            if (url) {
                icon.src = url;
                icon.classList.remove("hidden");
            }
        });
        icon.onerror = () => icon.classList.add("hidden");

        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "＋";

        const name = document.createElement("span");
        name.className = "folder-name";
        name.textContent = key;

        // inline description icon
        const infoIconInline = document.createElement("button");
        infoIconInline.className = "desc-icon-inline";
        infoIconInline.textContent = "ⓘ";
        infoIconInline.onclick = () => openDescription(fullPath);

        // child container
        const childContainer = document.createElement("div");
        childContainer.className = "tree-node";
        childContainer.style.display = "none";

        // big cover wrapper
        const coverWrapper = document.createElement("div");
        coverWrapper.className = "book-cover-wrapper";
        coverWrapper.style.display = "none";

        const coverImg = document.createElement("img");
        coverImg.className = "book-cover";
        coverImg.style.display = "none";

        coverImg.onerror = () => {
            coverImg.style.display = "none";
            coverWrapper.style.display = "none";
        };

        coverWrapper.appendChild(coverImg);
        childContainer.appendChild(coverWrapper);

        // recursively build folders
        renderTree(node[key], childContainer, fullPath);

        // mp3 container
        const mp3Container = document.createElement("div");
        mp3Container.className = "mp3-container";
        childContainer.appendChild(mp3Container);

        // arrow click
        arrow.onclick = async () => {
            if (childContainer.style.display === "none") {

                arrow.textContent = "－";
                childContainer.style.display = "block";

                // load cover
                const coverUrl = await loadCover(fullPath);
                if (coverUrl) {
                    coverImg.src = coverUrl;
                    coverImg.style.display = "block";
                    coverWrapper.style.display = "block";
                } else {
                    coverImg.style.display = "none";
                    coverWrapper.style.display = "none";
                }

                // load files
                await loadFilesInto(fullPath, mp3Container);

                // if this book is the current one — highlight
                if (currentBook === fullPath && currentFile) {
                    markNowPlaying(fullPath, currentFile, { scroll: false });
                    highlightFile(currentFile);
                }

            } else {
                arrow.textContent = "＋";
                childContainer.style.display = "none";
            }
        };

        // name click
        name.onclick = async () => {
            arrow.textContent = "－";
            childContainer.style.display = "block";

            const coverUrl = await loadCover(fullPath);
            if (coverUrl) {
                coverImg.src = coverUrl;
                coverImg.style.display = "block";
                coverWrapper.style.display = "block";
            } else {
                coverImg.style.display = "none";
                coverWrapper.style.display = "none";
            }

            [...document.querySelectorAll(".file-item")].forEach(el => el.remove());
            await loadFilesInto(fullPath, mp3Container);

            if (currentBook === fullPath && currentFile) {
                markNowPlaying(fullPath, currentFile, { scroll: false });
                highlightFile(currentFile);
            }

            setTimeout(() => autoPlayBook(fullPath), 200);
        };

        // append row and children
        row.appendChild(arrow);
        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(infoIconInline);

        container.appendChild(row);
        container.appendChild(childContainer);
    });
}

// =====================================================
// DESCRIPTION LOADER
// =====================================================
async function openDescription(fullPath) {
    const modal = document.getElementById("desc-modal");
    const textEl = document.getElementById("desc-text");

    const url =
        `https://slava.localto.net/Uploads/Audio/ABOOKS/${fullPath}/description.txt`;

    let text = "";

    try {
        const res = await fetch(url);
        if (res.ok) {
            text = await res.text();
        } else {
            text = `No description available for:\n${fullPath}`;
        }
    } catch {
        text = `No description available for:\n${fullPath}`;
    }

    textEl.textContent = text;
    modal.style.display = "flex";
}

document.getElementById("desc-close-btn").onclick = () =>
    (document.getElementById("desc-modal").style.display = "none");

document.getElementById("desc-modal").onclick = e => {
    if (e.target.id === "desc-modal") {
        document.getElementById("desc-modal").style.display = "none";
    }
};

// =====================================================
// LOAD MP3 FILES
// =====================================================
async function loadFilesInto(bookPath, mp3Container) {
    const res = await fetch(
        `${API}/GetBookFiles?book=${encodeURIComponent(bookPath)}`
    );

    const files = await res.json();

    mp3Container.innerHTML = "";

    files.forEach(f => {
        const div = document.createElement("div");
        div.className = "file-item";
        div.textContent = f;
        div.dataset.book = bookPath;
        div.dataset.file = f;
        div.onclick = () => playFile(bookPath, f);

        mp3Container.appendChild(div);
    });

    if (currentBook === bookPath && currentFile) {
        markNowPlaying(bookPath, currentFile, { scroll: false });
        highlightFile(currentFile);
    }
}

// =====================================================
// NOW PLAYING HIGHLIGHT
// =====================================================
function markNowPlaying(book, file, opts = { scroll: false }) {
    const items = document.querySelectorAll(".file-item");

    items.forEach(i => i.classList.remove("now-playing-item"));

    const match = [...items].find(
        i => i.dataset.book === book && i.dataset.file === file
    );

    if (match) {
        match.classList.add("now-playing-item");

        if (opts.scroll && !keyboardOpen) {
            scrollToInTree(match);
        }
    }
}

function highlightFile(file) {
    document
        .querySelectorAll(".file-item")
        .forEach(el => el.classList.remove("file-active"));

    const match = [...document.querySelectorAll(".file-item")].find(
        el => el.textContent === file
    );

    if (match) match.classList.add("file-active");
}
// =====================================================
// PLAYBACK LOGIC (ONLINE MODE ONLY)
// =====================================================
function playFile(book, file) {
    const url =
        `https://slava.localto.net/Uploads/Audio/ABOOKS/${book}/${file}`;

    // ✅ STOP LOCAL AUTOSAVE if active
    if (window.localSaveTimer) {
        clearInterval(window.localSaveTimer);
        window.localSaveTimer = null;
    }

    // ✅ START ONLINE AUTOSAVE
    startSaving(book, file);

    currentBook = book;
    currentFile = file;

    player.src = url;
    player.dataset.book = book;
    player.dataset.file = file;

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
                player.play().catch(err => console.warn("Play error:", err));
            },
            { once: true }
        );

        player.currentTime = userProgress[book].position;
    } else {
        player.play().catch(err => console.warn("Play error:", err));
    }

    highlightFile(file);
    markNowPlaying(book, file, { scroll: true });

    document.getElementById("now-playing").textContent =
        `📘 ${book} — 🎵 ${file}`;

    openCurrentFolderAndRemark();

    player.onended = () => playNextFromDom(file, book);
}

// =====================================================
// AUTOSAVE ONLINE PROGRESS (PATCHED & SAFE)
// =====================================================
function startSaving(book, file) {
    if (saveTimer) clearInterval(saveTimer);

    saveTimer = setInterval(() => {
        saveProgress(book, file, player.currentTime);
    }, 5000);
}

async function saveProgress(book, file, pos) {
    // ✅ DO NOT SAVE if LOCAL MODE (blob URL)
    if (player.src.startsWith("blob:")) return;

    // ✅ DO NOT SAVE if audio cleared (switching modes)
    if (!player.src || player.src === "" || player.readyState < 2) return;

    // ✅ DO NOT SAVE without valid identifiers
    if (!book || !file) return;

    // ✅ VALID ONLINE SAVE
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

// =====================================================
// CONTINUOUS PLAYBACK (NEXT FILE OR NEXT BOOK)
// =====================================================
function playNextFromDom(currentFileName, currentBookPath) {
    const items = [...document.querySelectorAll(".file-item")];
    const idx = items.findIndex(el => el.textContent === currentFileName);

    if (idx >= 0 && idx < items.length - 1) {
        items[idx + 1].click();
        return;
    }

    const nextBook = getNextBookPath(currentBookPath);
    if (!nextBook) return;

    setTimeout(() => autoExpandAndPlay(nextBook), 300);
}

// =====================================================
// AUTO PLAY WITHOUT USER INTERACTION
// =====================================================
async function autoPlayBook(book) {
    if (userProgress[book]) {
        playFile(book, userProgress[book].file);
        return;
    }

    const items = [...document.querySelectorAll(".file-item")];
    if (items.length > 0) items[0].click();
}

// =====================================================
// RESUME LAST ONLINE FILE
// =====================================================
function resumeLastBookAndFile() {
    if (!userProgress || Object.keys(userProgress).length === 0) return;

    let lastBook = null;
    let lastTS = 0;

    for (const [book, data] of Object.entries(userProgress)) {
        const t = new Date(data.updated).getTime();
        if (t > lastTS) {
            lastTS = t;
            lastBook = book;
        }
    }

    if (!lastBook) return;

    const file = userProgress[lastBook].file;
    const pos = userProgress[lastBook].position;

    expandAndPlay(lastBook, file, pos);
}

async function expandAndPlay(bookPath, fileName, position) {
    const parts = bookPath.split("/");
    let container = treeContainer;

    // expand folder tree
    for (const part of parts) {
        const row = [...container.querySelectorAll(".tree-row")]
            .find(r => r.querySelector(".folder-name").textContent === part);

        if (!row) continue;

        const arrow = row.querySelector(".arrow");
        const nextContainer = row.nextElementSibling;

        if (nextContainer.style.display === "none") {
            arrow.textContent = "－";
            nextContainer.style.display = "block";
        }

        container = nextContainer || container;
    }

    // load mp3
    [...document.querySelectorAll(".file-item")].forEach(el => el.remove());

    const mp3Container = container.querySelector(".mp3-container");
    if (mp3Container) {
        await loadFilesInto(bookPath, mp3Container);
    }

    const target = [...document.querySelectorAll(".file-item")]
        .find(el => el.textContent === fileName);

    if (target) {
        target.click();

        if (typeof position === "number" && position > 0) {
            showLoading("Loading…");
            disablePlayerControls();

            player.addEventListener(
                "canplay",
                () => {
                    hideLoading();
                    enablePlayerControls();
                    player.currentTime = position;
                    player.play().catch(err => console.warn("Play error:", err));
                },
                { once: true }
            );
        }
    } else {
        setTimeout(() => autoPlayBook(bookPath), 300);
    }
}
// =====================================================
// EXPAND PATH TO CURRENT BOOK (used for highlighting)
// =====================================================
function expandPathTo(bookPath) {
    if (!bookPath) return null;

    const parts = bookPath.split("/");
    let container = treeContainer;

    for (const part of parts) {
        const row = [...container.querySelectorAll(".tree-row")]
            .find(r => r.querySelector(".folder-name").textContent === part);

        if (!row) return null;

        const arrow = row.querySelector(".arrow");
        const nextContainer = row.nextElementSibling;

        if (nextContainer && nextContainer.style.display === "none") {
            arrow.textContent = "－";
            nextContainer.style.display = "block";
        }

        container = nextContainer || container;
    }

    return container;
}

// =====================================================
// OPEN CURRENT FOLDER + REMARK SELECTED FILE
// (for restoring 'now playing' state)
// =====================================================
async function openCurrentFolderAndRemark() {
    if (!currentBook) return;

    const leaf = expandPathTo(currentBook);
    if (!leaf) return;

    // Show cover (like your folder arrow handlers)
    const coverWrapper = leaf.querySelector(".book-cover-wrapper");
    const coverImg = coverWrapper?.querySelector(".book-cover");

    if (coverWrapper && coverImg) {
        const coverUrl = await loadCover(currentBook);
        if (coverUrl) {
            coverImg.src = coverUrl;
            coverImg.style.display = "block";
            coverWrapper.style.display = "block";
        } else {
            coverImg.style.display = "none";
            coverWrapper.style.display = "none";
        }
    }

    // Reload MP3 files
    const mp3Container = leaf.querySelector(".mp3-container");
    if (mp3Container) {
        await loadFilesInto(currentBook, mp3Container);

        if (currentFile) {
            markNowPlaying(currentBook, currentFile, { scroll: false });
            highlightFile(currentFile);
        }
    }
}

// =====================================================
// SEARCH HOOKS
// =====================================================
const searchInput = document.getElementById("tree-search");
if (searchInput) {
    searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim();
        searchTree(term);
    });
}

const searchBtn = document.getElementById("search-go-btn");
if (searchBtn) {
    searchBtn.onclick = () => {
        const term = searchInput ? searchInput.value.trim() : "";
        searchTree(term);
    };
}

const jumpNowBtn = document.getElementById("jump-now-btn");
if (jumpNowBtn) {
    jumpNowBtn.onclick = () => {
        const item = document.querySelector(".now-playing-item");
        if (item && !keyboardOpen) {
            item.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };
}

// =====================================================
// REFRESH TREE
// =====================================================
document.getElementById("refresh-tree-btn").onclick = () => {
    treeContainer.innerHTML = "";
    loadBooks();
};

// =====================================================
// LOGOUT
// =====================================================
document.getElementById("logout-btn").onclick = () => {
    localStorage.removeItem("ab_userId");
    localStorage.removeItem("ab_email");
    location.reload();
};

// =====================================================
// CLEAR SITE DATA
// =====================================================
document.getElementById("clear-site-btn").onclick = async () => {
    localStorage.clear();

    if ("caches" in window) {
        const names = await caches.keys();
        for (const name of names) {
            await caches.delete(name);
        }
    }

    if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
            await reg.unregister();
        }
    }

    alert("Site data cleared. Reloading…");
    location.reload();
};

// =====================================================
// INIT APPLICATION
// =====================================================
initLogin();

// =====================================================
// KEYBOARD DETECTION (mobile)
// =====================================================
let keyboardOpen = false;
const isMobile = matchMedia("(pointer: coarse)").matches;

if (isMobile) {
    const searchInput2 = document.getElementById("tree-search");
    if (searchInput2) {
        searchInput2.addEventListener("focus", () => (keyboardOpen = true));
        searchInput2.addEventListener("blur", () => (keyboardOpen = false));
    }
}

// =====================================================
// AUTO EXPAND + PLAY (used by auto-continue)
// =====================================================
async function autoExpandAndPlay(bookPath) {
    if (!bookPath) return;

    const parts = bookPath.split("/");
    let container = treeContainer;

    for (const part of parts) {
        const row = [...container.querySelectorAll(".tree-row")]
            .find(r => r.querySelector(".folder-name").textContent === part);

        if (!row) return;

        const arrow = row.querySelector(".arrow");
        const nextContainer = row.nextElementSibling;

        if (nextContainer && nextContainer.style.display === "none") {
            arrow.textContent = "－";
            nextContainer.style.display = "block";
        }

        container = nextContainer || container;
    }

    // cover logic
    const coverWrapper = container.querySelector(".book-cover-wrapper");
    const coverImg = coverWrapper?.querySelector(".book-cover");

    if (coverWrapper && coverImg) {
        try {
            const coverUrl = await loadCover(bookPath);
            if (coverUrl) {
                coverImg.src = coverUrl;
                coverImg.style.display = "block";
                coverWrapper.style.display = "block";
            } else {
                coverImg.style.display = "none";
                coverWrapper.style.display = "none";
            }
        } catch {
            coverImg.style.display = "none";
            coverWrapper.style.display = "none";
        }
    }

    // load files
    const mp3Container = container.querySelector(".mp3-container");
    if (mp3Container) {
        await loadFilesInto(bookPath, mp3Container);
    }

    // start playback automatically
    await autoPlayBook(bookPath);
}
