// ---------------- TREE SEARCH MODULE ----------------

// раскрывает папку (включая листья) и предков; для листьев подгружает файлы
async function openParents(row) {
    let node = row.nextElementSibling; // .tree-node

    if (node && node.classList.contains("tree-node")) {
        const arrow = row.querySelector(" .arrow");
        if (arrow) arrow.textContent = "－";
        node.style.display = "block";

        const hasSubfolders = node.querySelector(".tree-row") !== null;
        if (!hasSubfolders) {
            const mp3 = node.querySelector(".mp3-container");
            if (mp3 && mp3.childElementCount === 0 && typeof loadFilesInto === "function") {
                const fullPath = getFullPathFromRow(row);
                await loadFilesInto(fullPath, mp3);
            }
        }
    }

    // поднимаемся вверх
    let parent = row.parentElement;
    while (parent && parent.classList.contains("tree-node")) {
        const parentRow = parent.previousElementSibling;
        if (!parentRow) break;

        const arrow = parentRow.querySelector(".arrow");
        if (arrow) arrow.textContent = "－";
        parent.style.display = "block";

        parent = parentRow.parentElement;
    }
}

// закрывает все корневые папки, где нет совпадений
function collapseUnmatchedRoots() {
    const roots = treeContainer.querySelectorAll(":scope > .tree-node");

    roots.forEach(root => {
        const hasMatch = root.querySelector(".tree-highlight") !== null;

        const row = root.previousElementSibling;
        if (!row) return;

        const arrow = row.querySelector(".arrow");

        if (hasMatch) {
            arrow.textContent = "－";
            root.style.display = "block";
        } else {
            arrow.textContent = "＋";
            root.style.display = "none";
        }
    });
}

// скроллит строго внутри #tree-container
function scrollToInTree(row) {
    const container = document.getElementById("tree-container");
    const rect = row.getBoundingClientRect();
    const crect = container.getBoundingClientRect();

    container.scrollTop += (rect.top - crect.top) - container.clientHeight / 2;
}

// ---------------- SEARCH IN TREE ----------------

// основной поиск — только по папкам
async function searchTree(term) {
    term = term.toLowerCase();

    const rows = document.querySelectorAll("#tree-container .tree-row");

    let firstMatch = null;

    for (const row of rows) {
        row.classList.remove("tree-highlight");

        const name = row.querySelector(".folder-name").textContent.toLowerCase();

        if (term && name.includes(term)) {
            row.classList.add("tree-highlight");

            await openParents(row);

            if (!firstMatch) firstMatch = row;
        }
    }

    collapseUnmatchedRoots();

    if (firstMatch && term && !keyboardOpen) {
        scrollToInTree(firstMatch);
    }
}

/* =========================================================================
   NEXT BOOK = NEXT SIBLING ONLY (no climbing)
   -------------------------------------------------------------------------
   Rule:
   • If there’s a next sibling under the same parent container, use it.
   • Otherwise, return null (do NOT climb up).
   ========================================================================= */

/** Build a full "A/B/C" path from a .tree-row by walking up parent .tree-node levels. */
function getFullPathFromRow(row) {
    let name = row.querySelector(".folder-name").textContent;
    let path = name;

    let parent = row.parentElement; // .tree-node or #tree-container

    while (parent && parent.classList && parent.classList.contains("tree-node")) {
        const parentRow = parent.previousElementSibling;
        if (!parentRow) break;

        const parentName = parentRow.querySelector(".folder-name").textContent;
        path = parentName + "/" + path;

        parent = parentRow.parentElement;
    }

    return path;
}

/** Return the .tree-row for a given full path like "A/B/C". */
function getRowByPath(fullPath) {
    if (!fullPath) return null;
    const parts = fullPath.split("/");
    let container = treeContainer;
    let finalRow = null;

    for (const part of parts) {
        const rows = [...container.children].filter(el => el.classList.contains("tree-row"));
        finalRow = rows.find(r => r.querySelector(".folder-name")?.textContent === part);
        if (!finalRow) return null; // segment not found

        // go down to this row's children container for the next segment
        const nextContainer = finalRow.nextElementSibling; // .tree-node
        container = nextContainer || container;
    }

    return finalRow;
}

/** Get direct child rows (.tree-row) of a given container (.tree-node or #tree-container). */
function getDirectRows(container) {
    return [...container.children].filter(el => el.classList.contains("tree-row"));
}

/**
 * Next book path under the SAME parent container.
 * If there is no next sibling, returns null (no climbing).
 */
function getNextBookPath(currentBookPath) {
    const currentRow = getRowByPath(currentBookPath);
    if (!currentRow) return null;

    const parentContainer = currentRow.parentElement; // .tree-node or #tree-container
    const siblings = getDirectRows(parentContainer);
    const idx = siblings.indexOf(currentRow);

    if (idx !== -1 && idx < siblings.length - 1) {
        const nextSiblingRow = siblings[idx + 1];
        return getFullPathFromRow(nextSiblingRow);
    }

    // No next sibling at this level -> stop (do NOT climb).
    return null;
}

// ---------------- (legacy-compatible) keep the name used elsewhere ----------------
function findFullBookPath(name) {
    // In case some older code still calls this helper by folder name only,
    // fall back to locating the first visible row with that name at ANY level.
    const row = [...document.querySelectorAll(".tree-row")]
        .find(r => r.querySelector(".folder-name").textContent === name);
    return row ? getFullPathFromRow(row) : null;
}

function getFullPathFromRowCompat(row) {
    // Alias to preserve compatibility if referenced elsewhere
    return getFullPathFromRow(row);
}
