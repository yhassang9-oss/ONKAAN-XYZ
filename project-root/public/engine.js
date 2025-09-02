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

let colorPanel = document.getElementById("colorPanel");
let buttonPanel = document.getElementById("buttonPanel");

// ===============================
// TOOL TOGGLE
// ===============================
function deactivateAllTools() {
    activeTool = null;
    textTool.classList.remove("active-tool");
    selectTool.classList.remove("active-tool");
    colorTool.classList.remove("active-tool");
    buttonTool.classList.remove("active-tool");
    colorPanel.style.display = "none";
    buttonPanel.style.display = "none";

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

// ===============================
// UNDO/REDO
// ===============================
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
    if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
    } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
    }
});

// ===============================
// TOOL BUTTON EVENTS
// ===============================
textTool.addEventListener("click", () => {
    if (activeTool === "text") deactivateAllTools();
    else {
        deactivateAllTools();
        activeTool = "text";
        textTool.classList.add("active-tool");
    }
});

selectTool.addEventListener("click", () => {
    if (activeTool === "select") deactivateAllTools();
    else {
        deactivateAllTools();
        activeTool = "select";
        selectTool.classList.add("active-tool");
    }
});

colorTool.addEventListener("click", () => {
    if (activeTool === "color") deactivateAllTools();
    else {
        deactivateAllTools();
        activeTool = "color";
        colorTool.classList.add("active-tool");
        colorPanel.style.display = "block";
    }
});

buttonTool.addEventListener("click", () => {
    if (activeTool === "buttons") deactivateAllTools();
    else {
        deactivateAllTools();
        activeTool = "buttons";
        buttonTool.classList.add("active-tool");
        buttonPanel.style.display = "block";
    }
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

publishBtn.addEventListener("click", () => {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    console.log("Published content:", iframeDoc.body.innerHTML);
    // Add actual publish logic here (e.g., save to server)
});

// ===============================
// RESIZE HANDLES (STUB)
// ===============================
function makeResizable(element, iframeDoc) {
    // Placeholder for resize functionality
    // Add resize handles or use a library like interact.js if needed
}

function removeHandles(iframeDoc) {
    // Placeholder for removing resize handles
}

// ===============================
// IFRAME INITIALIZATION
// ===============================
function initIframe(iframeDoc, resetClickListener = true) {
    selectedElement = null;

    // Apply basic styling to ensure visibility
    const body = iframeDoc.body;
    body.style.margin = "0";
    body.style.padding = "10px";
    body.style.boxSizing = "border-box";
    body.style.minHeight = "100%";
    body.style.position = "relative";

    if (resetClickListener) {
        const newBody = body.cloneNode(true);
        iframeDoc.body.replaceWith(newBody);
    }

    const updatedBody = iframeDoc.body;

    updatedBody.addEventListener("click", function (e) {
        const el = e.target;

        // --- Text Tool ---
        if (activeTool === "text") {
            const rect = updatedBody.getBoundingClientRect();
            const newText = iframeDoc.createElement("div");
            newText.textContent = "Type here...";
            newText.contentEditable = "true";
            newText.dataset.editable = "true";
            newText.style.position = "absolute";
            newText.style.left = `${e.clientX - rect.left}px`;
            newText.style.top = `${e.clientY - rect.top}px`;
            newText.style.fontSize = "16px";
            newText.style.color = "#000";
            updatedBody.appendChild(newText);
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

            if (
                el.dataset.editable === "true" ||
                el.tagName === "BUTTON" ||
                el.tagName === "IMG" ||
                el.tagName === "DIV" ||
                ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "LABEL"].includes(el.tagName)
            ) {
                selectedElement = el;
                selectedElement.style.outline = "2px dashed red";
                makeResizable(selectedElement, iframeDoc);

                if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "LABEL"].includes(el.tagName)) {
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
        buttonPanel.querySelectorAll("button").forEach((btn) => {
            btn.onclick = () => {
                if (selectedElement) {
                    selectedElement.className = btn.className;
                    selectedElement.textContent = btn.textContent;
                    saveHistory();
                }
            };
        });
    }

    // --- Color Panel ---
    if (colorPanel) {
        colorPanel.querySelectorAll("div").forEach((swatch) => {
            swatch.onclick = () => {
                if (!selectedElement) return;
                const color = swatch.style.backgroundColor;
                if (selectedElement.dataset.editable === "true") {
                    selectedElement.style.color = color;
                } else {
                    selectedElement.style.backgroundColor = color;
                }
                saveHistory();
            };
        });
    }
}

// ===============================
// INITIAL IFRAME CONTENT
// ===============================
const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
iframeDoc.open();
iframeDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                margin: 0;
                padding: 10px;
                box-sizing: border-box;
                min-height: 100%;
                position: relative;
                background: #fff;
                font-family: Arial, sans-serif;
            }
            .welcome {
                text-align: center;
                font-size: 18px;
                color: #333;
            }
        </style>
    </head>
    <body>
        <div class="welcome">Welcome to ONKAAN Editor</div>
    </body>
    </html>
`);
iframeDoc.close();
initIframe(iframeDoc);
saveHistory();
