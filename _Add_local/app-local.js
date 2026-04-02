/* =========================================================
   app-local.js — Local source (device folder) support
   ========================================================= */

/* ---- shared global from app.js ----
   let sourceMode = localStorage.getItem('ab_sourceMode') || 'online';
   let userProgress = {};
   const treeContainer = document.getElementById("tree-container");
   const player = document.getElementById("player");
*/

let localRootHandle = null;        // FileSystemDirectoryHandle | null
let localIndex = {};               // { [bookPath: string]: { files:[{name,handle}], cover?:handle, desc?:handle } }
let localProgress = {};            // local-only progress map
let currentObjectUrl = null;       // revoke on track switch

/* ================== IndexedDB helpers ================== */
const abIDB = (() => {
  const DB_NAME = "ab_local_db";
  const STORE = "handles";
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
    return dbp;
  }
  async function get(key) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const st = tx.objectStore(STORE);
      const rq = st.get(key);
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function set(key, val) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      const rq = st.put(val, key);
      rq.onsuccess = () => res(true);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function del(key) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      const rq = st.delete(key);
      rq.onsuccess = () => res(true);
      rq.onerror = () => rej(rq.error);
    });
  }
  return { get, set, del };
})();

/* ================== Permissions & traversal ================== */
async function ensurePermission(handle, mode = "read") {
  if (!handle) return false;
  try {
    if (handle.queryPermission) {
      const q = await handle.queryPermission({ mode });
      if (q === "granted") return true;
    }
    if (handle.requestPermission) {
      const r = await handle.requestPermission({ mode });
      return r === "granted";
    }
  } catch {}
  return false;
}

async function buildLocalIndexFromRoot(rootHandle) {
  localIndex = {};
  const paths = [];

  async function walk(dirHandle, relPath = "") {
    let hasMp3 = false;
    let cover = null, desc = null;
    const subdirs = [];

    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "file") {
        const lower = name.toLowerCase();
        if (lower.endsWith(".mp3")) hasMp3 = true;
        if (!cover && (lower === "cover.jpg" || lower === "cover.png" ||
                       lower === "folder.jpg" || lower === "folder.png")) {
          cover = handle;
        }
        if (!desc && lower === "description.txt") desc = handle;
      } else if (handle.kind === "directory") {
        subdirs.push([name, handle]);
      }
    }

    if (hasMp3) {
      const bookPath = relPath || dirHandle.name;
      const files = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === "file" && name.toLowerCase().endsWith(".mp3")) {
          files.push({ name, handle });
        }
      }
      files.sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:"base"}));
      localIndex[bookPath] = { files, cover, desc };
      paths.push(bookPath);
    }

    for (const [childName, childHandle] of subdirs) {
      const childRel = relPath ? `${relPath}/${childName}` : childName;
      await walk(childHandle, childRel);
    }
  }

  await walk(rootHandle, "");
  return paths;
}

async function buildLocalIndexFromFileList(fileList) {
  localIndex = {};
  const pathsSet = new Set();
  const filesArr = Array.from(fileList);
  const groups = new Map();

  for (const f of filesArr) {
    const p = f.webkitRelativePath || f.name;
    const lower = p.toLowerCase();
    if (!(lower.endsWith(".mp3") || lower.endsWith("description.txt") ||
          lower.endsWith("cover.jpg") || lower.endsWith("cover.png") ||
          lower.endsWith("folder.jpg") || lower.endsWith("folder.png"))) {
      continue;
    }
    const slash = p.lastIndexOf("/");
    if (slash < 0) continue;
    const folder = p.substring(0, slash);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(f);
  }

  for (const [folder, arr] of groups.entries()) {
    const mp3s = arr.filter(f => f.name.toLowerCase().endsWith(".mp3"));
    if (mp3s.length === 0) continue;
    const cover = arr.find(f => ["cover.jpg","cover.png","folder.jpg","folder.png"]
                                  .includes(f.name.toLowerCase())) || null;
    const desc = arr.find(f => f.name.toLowerCase() === "description.txt") || null;
    const files = mp3s
      .map(f => ({ name: f.name, handle: f }))
      .sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:"base"}));
    localIndex[folder] = { files, cover, desc };
    pathsSet.add(folder);
  }
  return [...pathsSet];
}

/* ================== Progress (Local) ================== */
async function local_loadProgress() {
  try {
    const raw = localStorage.getItem("ab_local_progress");
    localProgress = raw ? JSON.parse(raw) : {};
  } catch { localProgress = {}; }
  // Reuse app.js expectations (resumeLastBookAndFile etc.)
  userProgress = localProgress;
}
function local_saveProgress(book, file, pos) {
  localProgress[book] = { file, position: pos, updated: new Date().toISOString() };
  localStorage.setItem("ab_local_progress", JSON.stringify(localProgress));
}

/* ================== Public helpers (called by app.js) ================== */
async function local_getBookPaths() {
  return Object.keys(localIndex).sort((a,b)=>a.localeCompare(b, undefined, {numeric:true, sensitivity:"base"}));
}

async function local_loadCover(bookPath) {
  const meta = localIndex[bookPath];
  if (!meta || !meta.cover) return null;
  try {
    const file = meta.cover.getFile ? await meta.cover.getFile() : meta.cover;
    return URL.createObjectURL(file);
  } catch { return null; }
}

async function local_loadFiles(bookPath) {
  const meta = localIndex[bookPath];
  if (!meta?.files?.length) return [];
  return meta.files.map(x => x.name);
}

async function local_openDescription(fullPath) {
  let text = `No description available for:
${fullPath}`;
  try {
    const meta = localIndex[fullPath];
    if (meta?.desc) {
      const file = meta.desc.getFile ? await meta.desc.getFile() : meta.desc;
      text = await file.text();
    }
  } catch {}
  return text;
}

async function local_resolveUrl(book, file) {
  const entry = localIndex[book]?.files?.find(x => x.name === file);
  if (!entry) return null;
  try {
    const blob = entry.handle.getFile ? await entry.handle.getFile() : entry.handle;
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    currentObjectUrl = URL.createObjectURL(blob);
    return currentObjectUrl;
  } catch (e) {
    console.warn("Unable to open local file", e);
    return null;
  }
}

async function local_tryRestoreLocalRootAndIndex() {
  try {
    const saved = await abIDB.get("root");
    if (saved && await ensurePermission(saved, "read")) {
      localRootHandle = saved;
      const lbl = document.getElementById("local-root-label");
      if (lbl) lbl.textContent = `Root: ${saved.name}`;
      await buildLocalIndexFromRoot(saved);
    }
  } catch (e) {
    console.warn("restore local root failed", e);
  }
}

/* ================== UI wiring (menu) ================== */
(function wireLocalUI(){
  const radioOnline = document.getElementById("source-online");
  const radioLocal  = document.getElementById("source-local");
  const localCtrls  = document.getElementById("local-controls");
  const localRootLbl = document.getElementById("local-root-label");
  const btnChooseRoot = document.getElementById("choose-local-root-btn");
  const btnReindex = document.getElementById("reindex-local-btn");
  const btnClearLocal = document.getElementById("clear-local-data-btn");
  const inputFolder = document.getElementById("local-folder-input");

  function reflectSourceUI() {
    if (radioOnline) radioOnline.checked = sourceMode === "online";
    if (radioLocal)  radioLocal.checked  = sourceMode === "local";
    if (localCtrls)  localCtrls.style.display = sourceMode === "local" ? "block" : "none";
  }

  async function setSourceMode(mode) {
    sourceMode = mode;
    localStorage.setItem("ab_sourceMode", sourceMode);
    reflectSourceUI();
    treeContainer.innerHTML = "";
    if (sourceMode === "local") {
      await local_loadProgress();
      await local_tryRestoreLocalRootAndIndex();
      await loadBooks();   // from app.js (dispatches based on sourceMode)
    } else {
      if (typeof initLogin === "function") {
        initLogin();
      } else {
        await loadBooks();
      }
    }
  }

  // initial reflect
  reflectSourceUI();

  radioOnline?.addEventListener("change", () => setSourceMode("online"));
  radioLocal?.addEventListener("change",  () => setSourceMode("local"));

  btnChooseRoot?.addEventListener("click", async () => {
    if (window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker({ id: "ab_local_root", mode: "read" });
        if (!(await ensurePermission(handle, "read"))) return;
        localRootHandle = handle;
        await abIDB.set("root", handle);
        if (localRootLbl) localRootLbl.textContent = `Root: ${handle.name}`;
        await buildLocalIndexFromRoot(handle);
        await loadBooks();
      } catch (e) {
        console.warn("choose root cancelled or failed", e);
      }
    } else {
      inputFolder?.click(); // fallback
    }
  });

  inputFolder?.addEventListener("change", async () => {
    const list = inputFolder.files;
    if (!list || list.length === 0) return;
    localRootHandle = null; // fallback has no persistent handle
    if (localRootLbl) localRootLbl.textContent = "Root: (selected via fallback)";
    await buildLocalIndexFromFileList(list);
    await loadBooks();
  });

  btnReindex?.addEventListener("click", async () => {
    if (localRootHandle) {
      if (!(await ensurePermission(localRootHandle, "read"))) return;
      await buildLocalIndexFromRoot(localRootHandle);
    }
    await loadBooks();
  });

  btnClearLocal?.addEventListener("click", async () => {
    await abIDB.del("root");
    localRootHandle = null;
    localIndex = {};
    localProgress = {};
    localStorage.removeItem("ab_local_progress");
    if (localRootLbl) localRootLbl.textContent = "";
    treeContainer.innerHTML = "";
    alert("Local data cleared.");
  });
})();
