// ===============================
// TOOL + EDITOR LOGIC
// ===============================
const textTool = document.getElementById("textTool");
const selectTool = document.getElementById("selecttool");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const colorTool = document.getElementById("color");
const imageTool = document.getElementById("image");
const buttonTool = document.getElementById("Buttons");
const publishBtn = document.getElementById("publishBtn");

const previewFrame = document.getElementById("previewFrame");

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;

let colorPanel = document.getElementById("colorPanel"); // make sure you have a div#colorPanel
let buttonPanel = document.getElementById("buttonPanel"); // make sure you have a div#buttonPanel

// ===============================
// TOOL TOGGLE
// ===============================
function deactivateAllTools() {
    activeTool = null;
    textTool.classList.remove("active-tool");
    selectTool.classList.remove("active-tool");

    if (selectedElement) {
        selectedElement.style.outline = "none";
        removeHandles(previewFrame.contentDocument || previewFrame.contentWindow.document);
        selectedElement = null;
    }
}

// ===============================
// HISTORY
// ===============================
function saveHistory() {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(iframeDoc.body.innerHTML);
    historyIndex++;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        iframeDoc.body.innerHTML = historyStack[historyIndex];
        initIframe(iframeDoc, false);
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        iframeDoc.body.innerHTML = historyStack[historyIndex];
        initIframe(iframeDoc, false);
    }
}

// ===============================
// KEYBOARD SHORTCUTS
// ===============================
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
    else if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
});

// ===============================
// TOOL BUTTON EVENTS
// ===============================
textTool.addEventListener("click", () => {
    if (activeTool === "text") deactivateAllTools();
    else { deactivateAllTools(); activeTool = "text"; textTool.classList.add("active-tool"); }
});

selectTool.addEventListener("click", () => {
    if (activeTool === "select") deactivateAllTools();
    else { deactivateAllTools(); activeTool = "select"; selectTool.classList.add("active-tool"); }
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

// ===============================
// IFRAME INITIALIZATION
// ===============================
function initIframe(iframeDoc, resetClickListener = true) {
    selectedElement = null;

    if (resetClickListener) {
        // Remove previous listeners to avoid duplicates
        iframeDoc.body.replaceWith(iframeDoc.body.cloneNode(true));
    }

    const body = iframeDoc.body;

    body.addEventListener("click", function(e) {
        const el = e.target;

        // --- Text Tool ---
        if (activeTool === "text") {
            const rect = iframeDoc.body.getBoundingClientRect();
            const newText = iframeDoc.createElement("div");
            newText.textContent = "Type here...";
            newText.contentEditable = "true";
            newText.dataset.editable = "true";
            newText.style.position = "absolute";
            newText.style.left = (e.clientX - rect.left) + "px";
            newText.style.top = (e.clientY - rect.top) + "px";
            newText.style.fontSize = "16px";
            newText.style.color = "black";
            iframeDoc.body.appendChild(newText);
            newText.focus();
            saveHistory();
            return;
        }

        // --- Select Tool ---
        if (activeTool === "select") {
            e.preventDefault();
            e.stopPropagation();

            if (selectedElement) {
                selectedElement.style.outline = "none";
                removeHandles(iframeDoc);
            }

            if (el.dataset.editable === "true" || el.tagName === "BUTTON" || el.tagName === "IMG" || el.tagName === "DIV" ||
                ["P","H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(el.tagName)
            ) {
                selectedElement = el;
                selectedElement.style.outline = "2px dashed red";
                makeResizable(selectedElement, iframeDoc);

                if (["P","H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(el.tagName)) {
                    selectedElement.contentEditable = "true";
                    selectedElement.dataset.editable = "true";
                    selectedElement.focus();
                    selectedElement.addEventListener("blur", () => saveHistory(), { once: true });
                }
            }
        }
    });

    // --- Button Panel ---
    if (buttonPanel) {
        buttonPanel.querySelectorAll("button").forEach(btn => {
            btn.onclick = () => {
                if (selectedElement) selectedElement.className = btn.className;
                saveHistory();
            }
        });
    }

    // --- Color Panel ---
    if (colorPanel) {
        colorPanel.querySelectorAll("div").forEach(swatch => {
            swatch.onclick = () => {
                if (!selectedElement) return;
                const color = swatch.style.backgroundColor;
                if (selectedElement.dataset.editable === "true") selectedElement.style.color = color;
                else selectedElement.style.backgroundColor = color;
                saveHistory();
            }
        });
    }
}

// ===============================
// INITIAL IFRAME CONTENT
// ===============================
const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
iframeDoc.open();
iframeDoc.write(`<div style="width:100%;height:100%;position:relative;"></div>`);
iframeDoc.close();
initIframe(iframeDoc);
saveHistory();
