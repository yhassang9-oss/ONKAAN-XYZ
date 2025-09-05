// engine.js — full fixed version (iframe src, working tools, history)

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
function warn(...args) { if (DEBUG) console.warn("[engine.js]", ...args); }
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
    error("Cannot access iframe (cross-origin?):", e);
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

// --- History ---
function saveHistory() {
  const doc = getIframeDoc();
  if (!doc || !doc.body) return;
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(doc.body.innerHTML);
  historyIndex++;
  log("History saved, index:", historyIndex);
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

// --- Tool bindings ---
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
    width: "10px", height: "10px", background: "red",
    position: "absolute", right: "0", bottom: "0",
    cursor: "se-resize", zIndex: "9999"
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

// --- Iframe events ---
function attachIframeEventsOnce(doc) {
  if (doc._eventsBound) return;
  doc._eventsBound = true;

  saveHistory();

  doc.addEventListener("click", (e) => {
    const el = e.target;

    // Text tool
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

    // Select tool
    if (activeTool === "select") {
      if (selectedElement) {
        selectedElement.style.outline = "none";
        removeHandles(doc);
      }

      selectedElement = el;
      const tag = el.tagName;
      if (["DIV","P","SPAN","IMG","BUTTON"].includes(tag) || el.dataset.editable === "true") {
        selectedElement.style.outline = "2px dashed red";
        makeResizable(selectedElement, doc);
        if (["DIV","P","SPAN"].includes(tag)) {
          selectedElement.contentEditable = "true";
          selectedElement.dataset.editable = "true";
        }
      } else {
        selectedElement = null;
      }
    }
  });
}

// --- Load template ---
function loadTemplate() {
  const filename = "/homepage.html"; // same-origin
  previewFrame.src = filename;

  previewFrame.onload = () => {
    const doc = getIframeDoc();
    if (doc) attachIframeEventsOnce(doc);
  };
}

// --- Save button ---
saveBtn?.addEventListener("click", async () => {
  const doc = getIframeDoc();
  if (!doc) return alert("Cannot access preview to save");
  const template = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

  try {
    const res = await fetch("/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "homepage.html", content: template })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) alert("✅ Saved successfully!");
    else alert("❌ Save failed: " + (data.error || "Server error"));
  } catch (err) {
    error("Save error:", err);
    alert("❌ Save failed: " + err.message);
  }
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadTemplate();
});
