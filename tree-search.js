// ---------------- TREE SEARCH MODULE ----------------

// раскрывает только папки, у которых есть подпапки
async function openParents(row) {
    let node = row.nextElementSibling; // .tree-node

    if (node && node.classList.contains("tree-node")) {
        const hasSubfolders = node.querySelector(".tree-row") !== null;

        if (hasSubfolders) {
            const arrow = row.querySelector(".arrow");
            arrow.textContent = "▼";
            node.style.display = "block";
        }
    }

    // поднимаемся вверх
    let parent = row.parentElement;
    while (parent && parent.classList.contains("tree-node")) {
        const parentRow = parent.previousElementSibling;
        if (!parentRow) break;

        const hasSubfolders = parent.querySelector(".tree-row") !== null;

        if (hasSubfolders) {
            const arrow = parentRow.querySelector(".arrow");
            arrow.textContent = "▼";
            parent.style.display = "block";
        }

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
            arrow.textContent = "▼";
            root.style.display = "block";
        } else {
            arrow.textContent = "►";
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

// ---------------- FIND NEXT BOOK ----------------

function getNextBookPath(currentBookPath) {
    const rows = [...document.querySelectorAll(".tree-row")];
    const names = rows.map(r => r.querySelector(".folder-name").textContent);

    const parts = currentBookPath.split("/");
    const currentName = parts[parts.length - 1];

    const idx = names.indexOf(currentName);
    if (idx === -1) return null;

    if (idx < names.length - 1) {
        return findFullBookPath(names[idx + 1]);
    }

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

function getFullPathFromRow(row) {
    let name = row.querySelector(".folder-name").textContent;
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
