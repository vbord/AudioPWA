const API = "https://slava.localto.net/api/BooksApi";

const treeContainer = document.getElementById("tree-container");
const player = document.getElementById("player");

let userId = null;
let userEmail = null;
let userProgress = {};
let saveTimer = null;

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

        const childContainer = document.createElement("div");
        childContainer.className = "tree-node";
        childContainer.style.display = "none";

        const coverImg = document.createElement("img");
        coverImg.className = "book-cover";
        coverImg.style.display = "none";
        coverImg.onerror = () => coverImg.style.display = "none";
        childContainer.appendChild(coverImg);

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
                } else {
                    coverImg.style.display = "none";
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
            } else {
                coverImg.style.display = "none";
            }

            // FIX: clear old MP3 lists from other books
            document.querySelectorAll(".file-item").forEach(el => el.remove());

            await loadFilesInto(fullPath, mp3Container);

            // FIX: wait for DOM to update before autoplay
            setTimeout(() => autoPlayBook(fullPath), 200);
        };

        row.appendChild(icon);
        row.appendChild(arrow);
        row.appendChild(name);
        container.appendChild(row);
        container.appendChild(childContainer);
    });
}

// ---------------- LOAD MP3 FILES ----------------

async function loadFilesInto(bookPath, mp3Container) {
    const res = await fetch(`${API}/GetBookFiles?book=${encodeURIComponent(bookPath)}`);
    const files = await res.json();

    mp3Container.innerHTML = "";

    files.forEach(f => {
        const div = document.createElement("div");
        div.className = "file-item";
        div.textContent = f;

        div.onclick = () => playFile(bookPath, f);

        mp3Container.appendChild(div);
    });
}

// ---------------- PLAYBACK ----------------

function playFile(book, file) {
    const url = `https://slava.localto.net/Uploads/Audio/ABOOKS/${book}/${file}`;

    player.src = url;
    player.play().catch(err => console.warn("Play error:", err));

    highlightFile(file);

    document.getElementById("now-playing").textContent =
        `📘 ${book} — 🎵 ${file}`;

    if (userProgress[book] && userProgress[book].file === file) {
        player.currentTime = userProgress[book].position;
    }

    startSaving(book, file);

    // NEW: continuous playback
    player.onended = () => playNextFromDom(file, book);
}

function highlightFile(file) {
    document.querySelectorAll(".file-item").forEach(el => el.classList.remove("file-active"));
    const match = [...document.querySelectorAll(".file-item")]
        .find(el => el.textContent === file);
    if (match) match.classList.add("file-active");
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

// ---------------- FIND NEXT BOOK ----------------

function getNextBookPath(currentBookPath) {
    const rows = [...document.querySelectorAll(".tree-row")];
    const names = rows.map(r => r.querySelector(".folder-name").textContent);

    const parts = currentBookPath.split("/");
    const currentName = parts[parts.length - 1];

    const idx = names.indexOf(currentName);
    if (idx === -1) return null;

    // next book
    if (idx < names.length - 1) {
        return findFullBookPath(names[idx + 1]);
    }

    // wrap to first
    return findFullBookPath(names[0]);
}

function findFullBookPath(name) {
    const row = [...document.querySelectorAll(".tree-row")]
        .find(r => r.querySelector(".folder-name").textContent === name);

    if (!row) return null;

    let path = name;
    let parent = row.parentElement;

    while (parent && parent.classList.contains("tree-node")) {
        const parentRow = parent.previousElementSibling;
        if (!parentRow) break;

        const parentName = parentRow.querySelector(".folder-name").textContent;
        path = parentName + "/" + path;

        parent = parentRow.parentElement;
    }

    return path;
}

// ---------------- CONTINUOUS PLAYBACK ----------------

function playNextFromDom(currentFileName, currentBookPath) {
    const items = [...document.querySelectorAll(".file-item")];
    const idx = items.findIndex(el => el.textContent === currentFileName);

    // next file in same book
    if (idx >= 0 && idx < items.length - 1) {
        items[idx + 1].click();
        return;
    }

    // last file → next book
    const nextBook = getNextBookPath(currentBookPath);
    if (!nextBook) return;

    // WAIT for next book to expand and load files
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

// ---------------- RESUME BUTTON ----------------

document.getElementById("resume-btn").onclick = () => {
    let lastBook = null;
    let lastTime = 0;

    for (const book in userProgress) {
        const t = new Date(userProgress[book].updated).getTime();
        if (t > lastTime) {
            lastTime = t;
            lastBook = book;
        }
    }

    if (!lastBook) {
        alert("No saved progress yet.");
        return;
    }

    autoExpandAndPlay(lastBook);
};

async function autoExpandAndPlay(bookPath) {
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

    // FIX: clear old MP3 lists
    document.querySelectorAll(".file-item").forEach(el => el.remove());

    // FIX: load MP3 list for the next book
    const mp3Container = container.querySelector(".mp3-container");
    if (mp3Container) {
        await loadFilesInto(bookPath, mp3Container);
    }

    // FIX: wait for DOM update then autoplay
    setTimeout(() => autoPlayBook(bookPath), 300);
}


// ---------------- INIT ----------------

initLogin();
