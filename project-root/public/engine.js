const textTool = document.getElementById("textTool");
const selectTool = document.getElementById("selecttool");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const colorTool = document.getElementById("color");
const imageTool = document.getElementById("image");
const buttonTool = document.getElementById("Buttons");
const previewFrame = document.getElementById("previewFrame");
const publishBtn = document.querySelector(".save-btn");

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;
let colorPanel = null;
let buttonPanel = null;
let currentFilename = "homepage.html"; // default file

// --- Tool toggle ---
function deactivateAllTools() {
    activeTool = null;
    textTool.classList.remove("active-tool");
    selectTool.classList.remove("active-tool");
    if (selectedElement) {
        selectedElement.style.outline = "none";
        removeHandles(previewFrame.contentDocument || previewFrame.contentWindow.document);
        selectedElement = null;
    }
    if (colorPanel) { colorPanel.remove(); colorPanel = null; }
    if (buttonPanel) { buttonPanel.style.display = "none"; }
}

// --- History ---
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
    }
}
function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        iframeDoc.body.innerHTML = historyStack[historyIndex];
    }
}

// --- Keyboard shortcuts ---
document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "z") { e.preventDefault(); undo(); }
    else if (e.ctrlKey && e.key === "y") { e.preventDefault(); redo(); }
});

// --- Tool click events ---
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

// --- Load content into iframe (fetch temporary memory first) ---
function loadIframeContent(filename) {
    currentFilename = filename;
    fetch(`https://onkaanpublishprototype-17.onrender.com/template/${filename}`)
        .then(res => res.text())
        .then(html => {
            const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html);
            iframeDoc.close();
            saveHistory();
        })
        .catch(err => console.error("Error loading iframe:", err));
}

// Load default page
loadIframeContent(currentFilename);

// --- Iframe click logic ---
previewFrame.addEventListener("load", () => {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

    iframeDoc.addEventListener("click", (e) => {
        const el = e.target;

        // Text tool
        if (activeTool === "text") {
            const newText = iframeDoc.createElement("div");
            newText.textContent = "Type here...";
            newText.contentEditable = "true";
            newText.dataset.editable = "true";
            newText.style.position = "absolute";
            newText.style.left = e.pageX + "px";
            newText.style.top = e.pageY + "px";
            newText.style.fontSize = "16px";
            newText.style.color = "black";
            newText.style.outline = "none";
            newText.style.cursor = "text";
            iframeDoc.body.appendChild(newText);
            newText.focus();
            saveHistory();
            deactivateAllTools();
            return;
        }

        // Select tool
        if (activeTool === "select") {
            e.preventDefault();
            e.stopPropagation();
            if (selectedElement) {
                selectedElement.style.outline = "none";
                removeHandles(iframeDoc);
            }

            if (
                (el.dataset.editable === "true") || el.tagName === "BUTTON" ||
                el.tagName === "IMG" || el.classList.contains("slideshow-container") ||
                el.tagName === "DIV" ||
                ["P", "H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(el.tagName)
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
});

// --- Resize ---
function removeHandles(doc) { doc.querySelectorAll(".resize-handle").forEach(h => h.remove()); }
function makeResizable(el, doc) { /* ... same as original ... */ }

// --- Color, Image, Button tools ---
// Keep all your existing logic here, unchanged

// --- Publish Button ---
publishBtn.addEventListener("click", () => {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    const htmlContent = "<!DOCTYPE html>\n" + iframeDoc.documentElement.outerHTML;

    // Inline styles/scripts logic here (unchanged)

    // --- Save temporary memory to DB ---
    fetch("https://onkaanpublishprototype-17.onrender.com/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: currentFilename, content: iframeDoc.documentElement.outerHTML })
    })
    .then(res => {
        if (res.ok) alert("Saved to temporary memory!");
        else alert("Error saving temporary memory.");
    })
    .catch(err => console.error("Save memory error:", err));

    // --- Send files to /publish (unchanged) ---
});
