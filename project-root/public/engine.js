// engine.js — full fixed version (same-origin, working tools)

const DEBUG = true;
const textTool = document.getElementById("textTool");
const selectTool = document.getElementById("selecttool");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const colorTool = document.getElementById("color");
const imageTool = document.getElementById("image");
const buttonTool = document.getElementById("Buttons");
const previewFrame = document.getElementById("previewFrame");
const publishBtn = document.getElementById("publishBtn");
const saveBtn = document.getElementById("saveBtn");

function log(...args) { if (DEBUG) console.log("[engine.js]", ...args); }
function error(...args) { console.error("[engine.js]", ...args); }

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;
let colorPanel = null;
let buttonPanel = null;

// --- Helpers ---
function getIframeDoc() {
  try {
    return previewFrame.contentDocument || previewFrame.contentWindow.document;
  } catch (e) {
    error("Cross-origin access blocked:", e);
    return null;
  }
}

function deactivateAllTools() {
  activeTool = null;
  textTool?.classList?.remove("active-tool");
  selectTool?.classList?.remove("active-tool");

  const doc = getIframeDoc();
  if (selectedElement && doc) {
    selectedElement.style.outline = "none";
    removeHandles(doc);
    selectedElement = null;
  }
  if (colorPanel) { colorPanel.remove(); colorPanel = null; }
  if (buttonPanel) { buttonPanel.style.display = "none"; }
}

// --- History system ---
function saveHistory() {
  const iframeDoc = getIframeDoc();
  if (!iframeDoc || !iframeDoc.body) return;
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(iframeDoc.body.innerHTML);
  historyIndex++;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    const doc = getIframeDoc();
    if (doc) doc.body.innerHTML = historyStack[historyIndex];
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    const doc = getIframeDoc();
    if (doc) doc.body.innerHTML = historyStack[historyIndex];
  }
}

// --- Tool event bindings ---
textTool?.addEventListener("click", () => {
  if (activeTool === "text") deactivateAllTools();
  else { deactivateAllTools(); activeTool = "text"; textTool.classList.add("active-tool"); }
});

selectTool?.addEventListener("click", () => {
  if (activeTool === "select") deactivateAllTools();
  else { deactivateAllTools(); activeTool = "select"; selectTool.classList.add("active-tool"); }
});

undoBtn?.addEventListener("click", undo);
redoBtn?.addEventListener("click", redo);

// --- Resizing ---
function removeHandles(doc) {
  doc.querySelectorAll(".resize-handle").forEach(h => h.remove());
}

function makeResizable(el, doc) {
  removeHandles(doc);
  const handle = doc.createElement("div");
  handle.className = "resize-handle";
  Object.assign(handle.style, {
    width: "10px",
    height: "10px",
    background: "red",
    position: "absolute",
    right: "0",
    bottom: "0",
    cursor: "se-resize",
    zIndex: "9999"
  });
  el.style.position = "relative";
  el.appendChild(handle);

  let isResizing = false;
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation();
    isResizing = true;
    const startX = e.clientX, startY = e.clientY;
    const startWidth = el.offsetWidth, startHeight = el.offsetHeight;

    function resizeMove(ev) {
      if (!isResizing) return;
      el.style.width = startWidth + (ev.clientX - startX) + "px";
      el.style.height = startHeight + (ev.clientY - startY) + "px";
    }
    function stopResize() {
      if (isResizing) saveHistory();
      isResizing = false;
      doc.removeEventListener("mousemove", resizeMove);
      doc.removeEventListener("mouseup", stopResize);
    }

    doc.addEventListener("mousemove", resizeMove);
    doc.addEventListener("mouseup", stopResize);
  });
}

// --- Events inside iframe ---
function attachIframeEventsOnce(doc) {
  if (doc._eventsBound) return;
  doc._eventsBound = true;

  saveHistory();

  doc.addEventListener("click", (e) => {
    const el = e.target;

    // Add new text
    if (activeTool === "text") {
      const newText = doc.createElement("div");
      newText.textContent = "Type here...";
      newText.contentEditable = "true";
      newText.dataset.editable = "true";
      newText.style.position = "absolute";
      newText.style.left = e.clientX + "px";
      newText.style.top = e.clientY + "px";
      doc.body.appendChild(newText);
      newText.focus();
      saveHistory();
      deactivateAllTools();
      return;
    }

    // Select element
    if (activeTool === "select") {
      if (selectedElement) {
        selectedElement.style.outline = "none";
        removeHandles(doc);
      }
      selectedElement = el;
      selectedElement.style.outline = "2px dashed red";
      makeResizable(selectedElement, doc);
    }
  });
}

// --- Load template (local same-origin) ---
async function loadTemplate() {
  const filename = "homepage.html";
  try {
    const res = await fetch("/" + filename);
    if (!res.ok) throw new Error("Static fetch failed " + res.status);
    const html = await res.text();

    // Put template into iframe using srcdoc (same-origin)
    previewFrame.removeAttribute("src");
    previewFrame.srcdoc = html;

    setTimeout(() => {
      const doc = getIframeDoc();
      if (doc) attachIframeEventsOnce(doc);
    }, 300);
  } catch (e) {
    error("Load template failed:", e);
    previewFrame.srcdoc = "<!DOCTYPE html><html><body><h3>No template available</h3></body></html>";
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadTemplate();
});
