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

let colorPanel = document.getElementById("colorPanel"); // Ensure div#colorPanel exists
let buttonPanel = document.getElementById("buttonPanel"); // Ensure div#buttonPanel exists

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

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

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

    // Avoid replacing body unnecessarily to prevent content loss
    const body = iframeDoc.body;

    // Apply vibrant styling to match gallery aesthetic
    body.style.background = "linear-gradient(135deg, #ff6b6b, #4ecdc4)";
    body.style.position = "relative";
    body.style.minHeight = "100vh";
    body.style.margin = "0";
    body.style.padding = "20px";
    body.style.boxSizing = "border-box";
    body.style.overflowX = "hidden";

    if (resetClickListener) {
        // Clone body to remove old listeners, but preserve content
        const newBody = body.cloneNode(true);
        iframeDoc.body.replaceWith(newBody);
    }

    // Re-reference body after potential replacement
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
            newText.style.color = "#fff";
            newText.style.padding = "8px";
            newText.style.borderRadius = "4px";
            newText.style.background = "rgba(0,0,0,0.3)";
            newText.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
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
                selectedElement.style.outline = "2px dashed #ff6b6b";
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
                background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
                overflow-x: hidden;
                position: relative;
                color: #fff;
                font-family: Arial, sans-serif;
            }
            .welcome {
                text-align: center;
                font-size: 24px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                animation: fadeInDown 1s ease-out;
            }
            @keyframes fadeInDown {
                from { opacity: 0; transform: translateY(-20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    </head>
    <body>
        <div class="welcome">Welcome to Your Editor</div>
    </body>
    </html>
`);
iframeDoc.close();
initIframe(iframeDoc);
saveHistory();
