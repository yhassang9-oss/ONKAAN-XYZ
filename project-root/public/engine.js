const textTool = document.getElementById("textTool");
const selectTool = document.getElementById("selecttool");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const colorTool = document.getElementById("color");
const imageTool = document.getElementById("image");
const buttonTool = document.getElementById("Buttons");
const previewFrame = document.getElementById("previewFrame");
const publishBtn = document.querySelector(".save-btn");
const saveBtn = document.getElementById("saveBtn");

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;
let colorPanel = null;
let buttonPanel = null;

/* -------------------------
   Core Functions
------------------------- */
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

function saveHistory() {
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(iframeDoc.body.innerHTML);
  historyIndex++;
}
function undo() { /* unchanged */ }
function redo() { /* unchanged */ }
function removeHandles(doc) { doc.querySelectorAll(".resize-handle").forEach(h => h.remove()); }
function makeResizable(el, doc) { /* unchanged */ }

/* -------------------------
   Init Editor (attach events into iframe)
------------------------- */
function initEditor() {
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  if (!iframeDoc) return;

  saveHistory();

  iframeDoc.addEventListener("click", (e) => {
    const el = e.target;

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
}

/* -------------------------
   Tool Buttons
------------------------- */
textTool.addEventListener("click", () => { /* unchanged */ });
selectTool.addEventListener("click", () => { /* unchanged */ });
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
document.addEventListener("keydown", e => { /* unchanged */ });

colorTool.addEventListener("click", () => { /* unchanged */ });
imageTool.addEventListener("click", () => { /* unchanged */ });
buttonTool.addEventListener("click", () => { /* unchanged */ });

/* -------------------------
   Publish
------------------------- */
publishBtn.addEventListener("click", () => { /* unchanged */ });

/* -------------------------
   Save
------------------------- */
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    const template = "<!DOCTYPE html>\n" + iframeDoc.documentElement.outerHTML;
    const filename = "homepage.html";
    try {
      const response = await fetch("https://onkaan-xyz23.onrender.com/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content: template })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) alert("✅ Saved successfully!");
      else alert("❌ Save failed: " + (data.error || "Server error"));
    } catch (err) {
      console.error("Save error:", err);
      alert("❌ Save failed: " + err.message);
    }
  });
}

/* -------------------------
   Load (DB first, fallback static)
------------------------- */
async function loadTemplate() {
  const filename = "homepage.html";
  try {
    const api = `https://onkaan-xyz23.onrender.com/api/load/${encodeURIComponent(filename)}`;
    const response = await fetch(api);
    const result = await response.json();
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    if (result && result.success && result.template) {
      iframeDoc.open(); iframeDoc.write(result.template); iframeDoc.close();
      initEditor(); // 🔹 reattach editor
      return;
    }
    // fallback static
    const res = await fetch(filename);
    const html = await res.text();
    iframeDoc.open(); iframeDoc.write(html); iframeDoc.close();
    initEditor(); // 🔹 reattach editor
  } catch (err) {
    console.error("❌ Load failed:", err);
  }
}

/* -------------------------
   Start
------------------------- */
document.addEventListener("DOMContentLoaded", loadTemplate);
