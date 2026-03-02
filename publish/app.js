const API = "https://slava.localto.net/api/BooksApi";

const treeContainer = document.getElementById("tree-container");
const player = document.getElementById("player");

let userId = null;
let userEmail = null;
let userProgress = {};
let saveTimer = null;

let currentBook = null;
let currentFile = null;

// MENU
const sideMenu = document.getElementById("side-menu");
const menuBtn = document.getElementById("menu-btn");

menuBtn.onclick = () => {
    sideMenu.classList.toggle("open");
    document.body.classList.toggle("menu-open", sideMenu.classList.contains("open"));
};

document.getElementById("menu-close-btn").onclick = () => {
    sideMenu.classList.remove("open");
    document.body.classList.remove("menu-open");
};

document.querySelectorAll("#side-menu .menu-item").forEach(btn => {
    btn.addEventListener("click", () => {
        sideMenu.classList.remove("open");
    });
});

// ---------------- CONTROL DISABLE / ENABLE ----------------

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

// ---------------- LOADING OVERLAY ----------------

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
    setTimeout(() => el.style.display = "none", 200);
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

// ---------------- LOGIN ----------------

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
        loadProgress();
    } else {
        showLogin();
    }
}

// ---------------- LOAD PROGRESS ----------------

async function loadProgress() {
    const res = await fetch(`${API}/GetProgress?userId=${userId}`);
    if (res.ok) {
        const data = await res.json();
        userProgress = data.books || {};
    }
    loadBooks();
}

// ---------------- LOAD BOOKS ----------------

async function loadBooks() {
    const res = await fetch(`${API}/GetBooks`);
    const books = await res.json();

    const paths = books.map(b => b.name);
    const tree = buildTree(paths);

    treeContainer.innerHTML = "";
    renderTree(tree, treeContainer, "");
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

// ---------------- COVER LOADER ----------------

async function loadCover(bookPath) {
    const res = await fetch(`${API}/GetBookCover?book=${encodeURIComponent(bookPath)}`);
    const cover = await res.json();
    if (!cover) return null;
    return `https://slava.localto.net/Uploads/Audio/ABOOKS/${cover}`;
}


// ---------------- TREE RENDERING ----------------

function renderTree(node, container, currentPath) {
    Object.keys(node).forEach(key => {
        const fullPath = currentPath ? `${currentPath}/${key}` : key;

        const row = document.createElement("div");
        row.className = "tree-row";

        // small cover icon
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
        arrow.textContent = "►";

        const name = document.createElement("span");
        name.className = "folder-name";
        name.textContent = key;

        // ℹ ⓘ — ONE BUTTON, inline, at end of row
        const infoIconInline = document.createElement("button");
        infoIconInline.className = "desc-icon-inline";
        infoIconInline.textContent = "ⓘ";
        infoIconInline.onclick = () => openDescription(fullPath);

        const childContainer = document.createElement("div");
        childContainer.className = "tree-node";
        childContainer.style.display = "none";

        // big cover
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

        renderTree(node[key], childContainer, fullPath);

        const mp3Container = document.createElement("div");
        mp3Container.className = "mp3-container";
        childContainer.appendChild(mp3Container);

        arrow.onclick = async () => {
            if (childContainer.style.display === "none") {
                arrow.textContent = "▼";
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

                loadFilesInto(fullPath, mp3Container);
            } else {
                arrow.textContent = "►";
                childContainer.style.display = "none";
            }
        };

        name.onclick = async () => {
            arrow.textContent = "▼";
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

            document.querySelectorAll(".file-item").forEach(el => el.remove());

            await loadFilesInto(fullPath, mp3Container);

            setTimeout(() => autoPlayBook(fullPath), 200);
        };

        row.appendChild(icon);
        row.appendChild(arrow);
        row.appendChild(name);
        row.appendChild(infoIconInline);

        container.appendChild(row);
        container.appendChild(childContainer);
    });
}

// ---------------- DESCRIPTION LOADER ----------------

async function openDescription(fullPath) {
    const modal = document.getElementById("desc-modal");
    const textEl = document.getElementById("desc-text");

    const url = `https://slava.localto.net/Uploads/Audio/ABOOKS/${fullPath}/description.txt`;

    let text = "";

    try {
        const res = await fetch(url);
        if (res.ok) {
            text = await res.text();
        } else {
            text = `No description available for:\n${fullPath}`;
        }
    } catch (e) {
        text = `No description available for:\n${fullPath}`;
    }

    textEl.textContent = text;
    modal.style.display = "flex";
}

document.getElementById("desc-close-btn").onclick = () =>
    document.getElementById("desc-modal").style.display = "none";

document.getElementById("desc-modal").onclick = e => {
    if (e.target.id === "desc-modal") {
        document.getElementById("desc-modal").style.display = "none";
    }
};

// ---------------- LOAD MP3 FILES ----------------

async function loadFilesInto(bookPath, mp3Container) {
    const res = await fetch(`${API}/GetBookFiles?book=${encodeURIComponent(bookPath)}`);
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
}

// ---------------- NOW PLAYING HIGHLIGHT ----------------

function markNowPlaying(book, file, opts = { scroll: false }) {
    const items = document.querySelectorAll(".file-item");
    items.forEach(i => i.classList.remove("now-playing-item"));

    const match = [...items].find(i =>
        i.dataset.book === book && i.dataset.file === file
    );

    if (match) {
        match.classList.add("now-playing-item");
        if (opts.scroll) {
            if (!keyboardOpen) {
                // match.scrollIntoView({ behavior: "smooth", block: "center" });
                scrollToInTree(match);
            }
        }
    }
}

function highlightFile(file) {
    document.querySelectorAll(".file-item").forEach(el => el.classList.remove("file-active"));
    const match = [...document.querySelectorAll(".file-item")]
        .find(el => el.textContent === file);
    if (match) match.classList.add("file-active");
}

// ---------------- PLAYBACK ----------------

function playFile(book, file) {
    const url = `https://slava.localto.net/Uploads/Audio/ABOOKS/${book}/${file}`;

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

        player.addEventListener("canplay", () => {
            hideLoading();
            enablePlayerControls();
            player.play().catch(err => console.warn("Play error:", err));
        }, { once: true });

        player.currentTime = userProgress[book].position;
    } else {
        player.play().catch(err => console.warn("Play error:", err));
    }

    highlightFile(file);
    markNowPlaying(book, file, { scroll: true });

    document.getElementById("now-playing").textContent =
        `📘 ${book} — 🎵 ${file}`;

    startSaving(book, file);

    player.onended = () => playNextFromDom(file, book);
}

// ---------------- SAVE PROGRESS ----------------

function startSaving(book, file) {
    if (saveTimer) clearInterval(saveTimer);

    saveTimer = setInterval(() => {
        saveProgress(book, file, player.currentTime);
    }, 5000);
}

async function saveProgress(book, file, pos) {
    userProgress[book] = { file, position: pos, updated: new Date().toISOString() };

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
// ---------------- CONTINUOUS PLAYBACK ----------------

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

// ---------------- AUTO PLAY BOOK ----------------

async function autoPlayBook(book) {
    if (userProgress[book]) {
        playFile(book, userProgress[book].file);
        return;
    }

    const items = [...document.querySelectorAll(".file-item")];
    if (items.length > 0) items[0].click();
}

// ---------------- RESUME LAST BOOK/FILE ----------------

function resumeLastBookAndFile() {
    if (!userProgress || Object.keys(userProgress).length === 0) {
        return;
    }

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

    const file = userProgress[lastBook].file;
    const pos = userProgress[lastBook].position;

    expandAndPlay(lastBook, file, pos);
}

async function expandAndPlay(bookPath, fileName, position) {
    const parts = bookPath.split("/");
    let container = treeContainer;

    for (const part of parts) {
        const row = [...container.querySelectorAll(".tree-row")]
            .find(r => r.querySelector(".folder-name").textContent === part);

        if (!row) continue;

        const arrow = row.querySelector(".arrow");
        const nextContainer = row.nextElementSibling;

        if (nextContainer.style.display === "none") {
            arrow.textContent = "▼";
            nextContainer.style.display = "block";
        }

        container = nextContainer;
    }

    document.querySelectorAll(".file-item").forEach(el => el.remove());

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

            player.addEventListener("canplay", () => {
                hideLoading();
                enablePlayerControls();
                player.currentTime = position;
                player.play().catch(err => console.warn("Play error:", err));
            }, { once: true });
        }
    } else {
        setTimeout(() => autoPlayBook(bookPath), 300);
    }
}


// ---------------- UI HOOKS FOR SEARCH & NOW PLAYING ----------------

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
        if (item) {
            if (!keyboardOpen) {
                item.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    };
}

// ---------------- REFRESH TREE ----------------

document.getElementById("refresh-tree-btn").onclick = () => {
    treeContainer.innerHTML = "";
    loadBooks();
};

// ---------------- LOGOUT ----------------

document.getElementById("logout-btn").onclick = () => {
    localStorage.removeItem("ab_userId");
    localStorage.removeItem("ab_email");
    location.reload();
};

// ---------------- CLEAR SITE DATA ----------------

document.getElementById("clear-site-btn").onclick = async () => {
    localStorage.clear();

    if ('caches' in window) {
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

// ---------------- INIT ----------------

initLogin();

// ---------------- KEYBOARD DETECTOR ----------------

let keyboardOpen = false;

const isMobile = matchMedia("(pointer: coarse)").matches;

if (isMobile) {
    const searchInput = document.getElementById("tree-search");

    if (searchInput) {
        searchInput.addEventListener("focus", () => {
            keyboardOpen = true;
        });

        searchInput.addEventListener("blur", () => {
            keyboardOpen = false;
        });
    }
}
