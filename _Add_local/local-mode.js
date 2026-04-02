// ======================================================
// LOCAL MODE — Stable with resume + auto-next
// Assumes these globals already exist (from app.js):
//   player
//   treeContainer
//   saveTimer
// ======================================================

console.log("local-mode.js loaded");

// ---------------- DOM (local-only) ----------------
const modeSelect = document.getElementById("mode-select");
const selectFolderBtn = document.getElementById("select-local-folder-btn");
const localFolderInput = document.getElementById("local-folder-input");
const folderNameBox = document.getElementById("local-folder-name");

// ---------------- STATE ----------------
let localFilesMap = {};      // fullPath -> File
let localSaveTimer = null;

// ---------------- HELPERS ----------------
function extractRootFolder(files) {
    if (!files.length) return "";
    return files[0].webkitRelativePath.split("/")[0] || "";
}

function shorten(name, max = 22) {
    if (!name) return "";
    return name.length <= max
        ? name
        : `${name.slice(0, 6)}...${name.slice(-6)}`;
}

function updateFolderNameDisplay(name) {
    folderNameBox.textContent = name
        ? "> " + name
        : "> No folder selected";
}

// ---------------- LOCAL SAVE ----------------
function stopLocalSaving() {
    if (localSaveTimer) {
        clearInterval(localSaveTimer);
        localSaveTimer = null;
    }
}

function startLocalSaving(key) {
    stopLocalSaving();

    localSaveTimer = setInterval(() => {
        const data = JSON.parse(
            localStorage.getItem("ab_local_progress") || "{}"
        );

        data[key] = {
            position: player.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(
            "ab_local_progress",
            JSON.stringify(data)
        );
    }, 3000);
}

// ---------------- INIT ----------------
modeSelect.value =
    localStorage.getItem("ab_mode") || "online";

updateFolderNameDisplay(
    localStorage.getItem("ab_local_root_short") || null
);

// ---------------- MODE SWITCH ----------------
modeSelect.addEventListener("change", () => {

    const mode = modeSelect.value;
    localStorage.setItem("ab_mode", mode);

    // Stop local saving
    stopLocalSaving();

    // Stop online autosave (VERY IMPORTANT)
    if (typeof saveTimer !== "undefined" && saveTimer) {
        clearInterval(saveTimer);
    }

    // Reset player state
    try { player.pause(); } catch { }
    player.onloadedmetadata = null;
    player.onended = null;
    player.src = "";

    document.getElementById("now-playing").textContent = "Nothing playing";

    if (mode === "local") {

        const meta = localStorage.getItem("ab_local_files");
        if (!meta) {
            treeContainer.innerHTML =
                "<div style='padding:10px;'>No folder selected</div>";
            return;
        }

        loadLocalTree();
        restoreLastLocalPlayback();
        return;
    }

    // ONLINE MODE
    if (typeof loadBooks === "function") {
        loadBooks();
    }
});

// ---------------- SELECT LOCAL FOLDER ----------------
selectFolderBtn.addEventListener("click", () => {
    localFolderInput.click();
});

localFolderInput.addEventListener("change", evt => {

    const files = [...evt.target.files];
    if (!files.length) {
        alert("No files selected.");
        return;
    }

    localFilesMap = {};
    for (const f of files) {
        localFilesMap[f.webkitRelativePath] = f;
    }

    const meta = files.map(f => ({
        name: f.name,
        path: f.webkitRelativePath
    }));
    localStorage.setItem("ab_local_files", JSON.stringify(meta));

    const root = extractRootFolder(files);
    const short = shorten(root);
    localStorage.setItem("ab_local_root", root);
    localStorage.setItem("ab_local_root_short", short);

    updateFolderNameDisplay(short);

    if (localStorage.getItem("ab_mode") === "local") {
        loadLocalTree();
        restoreLastLocalPlayback(); // ✅ ADD THIS
    }

    //alert("Local folder loaded.");
});

// ---------------- BUILD TREE ----------------
function buildLocalTree(list) {
    const tree = {};
    list.forEach(item => {
        const parts = item.path.split("/");
        parts.shift(); // remove root
        let node = tree;

        for (let i = 0; i < parts.length; i++) {
            const p = parts[i];
            if (i === parts.length - 1) {
                (node._files ||= []).push(p);
            } else {
                node = (node[p] ||= {});
            }
        }
    });
    return tree;
}

// ---------------- PLAY LOCAL FILE ----------------
function playLocalFile(folderPath, fileName) {

    const root = localStorage.getItem("ab_local_root") || "";
    const full =
        root + "/" +
        (folderPath ? folderPath + "/" : "") +
        fileName;

    const blob = localFilesMap[full];
    if (!blob) {
        alert("Folder access lost. Please re-select folder.");
        return;
    }

    // Reset handlers before setting src
    player.onloadedmetadata = null;
    player.onended = null;

    player.src = URL.createObjectURL(blob);

    const key = folderPath + "/" + fileName;
    const progress = JSON.parse(
        localStorage.getItem("ab_local_progress") || "{}"
    );

    const resumePos = progress[key]?.position || 0;

    // ✅ Correct resume timing
    player.onloadedmetadata = () => {
        if (resumePos > 0) {
            try { player.currentTime = resumePos; } catch { }
        }
    };

    document.getElementById("now-playing").textContent =
        `🎵 ${folderPath} — ${fileName}`;

    localStorage.setItem(
        "ab_local_last_playing",
        JSON.stringify({ folder: folderPath, file: fileName })
    );

    player.play().catch(err => console.warn(err));

    startLocalSaving(key);

    // ✅ Auto-next
    player.onended = () =>
        playNextLocalFile(folderPath, fileName);
}

// ---------------- AUTO NEXT ----------------
function playNextLocalFile(folderPath, currentFile) {

    const entries = Object.keys(localFilesMap)
        .filter(p => p.startsWith(folderPath + "/"))
        .sort();

    const idx = entries.findIndex(p =>
        p.endsWith("/" + currentFile)
    );

    if (idx >= 0 && idx < entries.length - 1) {
        playLocalFile(
            folderPath,
            entries[idx + 1].split("/").pop()
        );
        return;
    }

    playNextLocalFolder(folderPath);
}

function playNextLocalFolder(currentFolder) {
    const folders = [...new Set(
        Object.keys(localFilesMap)
            .map(p => p.split("/").slice(0, -1).join("/"))
    )].sort();

    const idx = folders.indexOf(currentFolder);
    if (idx < 0 || idx >= folders.length - 1) return;

    const next = folders[idx + 1];
    const files = Object.keys(localFilesMap)
        .filter(p => p.startsWith(next + "/"))
        .sort();

    if (files.length) {
        playLocalFile(next, files[0].split("/").pop());
    }
}

// ---------------- RENDER TREE ----------------
function renderLocalFiles(folderPath, files, container) {
    container.innerHTML = "";
    files.forEach(f => {
        const div = document.createElement("div");
        div.className = "file-item";
        div.textContent = f;
        div.onclick = () => playLocalFile(folderPath, f);
        container.appendChild(div);
    });
}

function renderLocalTree(tree, container, cur = "") {
    Object.keys(tree).forEach(key => {

        if (key === "_files") return;

        const full = cur ? `${cur}/${key}` : key;

        const row = document.createElement("div");
        row.className = "tree-row";

        const arrow = document.createElement("span");
        arrow.className = "arrow";
        arrow.textContent = "＋";

        const name = document.createElement("span");
        name.className = "folder-name";
        name.textContent = key;

        const child = document.createElement("div");
        child.className = "tree-node";
        child.style.display = "none";

        row.appendChild(arrow);
        row.appendChild(name);
        container.appendChild(row);
        container.appendChild(child);

        arrow.onclick = name.onclick = () => {
            const open = child.style.display !== "none";
            child.style.display = open ? "none" : "block";
            arrow.textContent = open ? "＋" : "－";
        };

        renderLocalTree(tree[key], child, full);

        if (tree[key]._files) {
            const box = document.createElement("div");
            box.className = "mp3-container";
            child.appendChild(box);
            renderLocalFiles(full, tree[key]._files, box);
        }
    });
}

function loadLocalTree() {
    const json = localStorage.getItem("ab_local_files");
    if (!json) {
        treeContainer.innerHTML =
            "<div style='padding:10px;'>No folder selected</div>";
        return;
    }

    const meta = JSON.parse(json);
    const tree = buildLocalTree(meta);
    treeContainer.innerHTML = "";
    renderLocalTree(tree, treeContainer, "");
}

// ---------------- RESTORE LAST LOCAL ----------------
function restoreLastLocalPlayback() {
    try {
        const last = JSON.parse(
            localStorage.getItem("ab_local_last_playing")
        );

        if (!last?.folder || !last?.file) return;
        if (!Object.keys(localFilesMap).length) return; // ✅ ADD

        if (last?.folder && last?.file) {
            playLocalFile(last.folder, last.file);
        }
    } catch { }
}