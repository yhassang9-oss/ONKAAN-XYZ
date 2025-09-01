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
let colorPanel = null;
let buttonPanel = null;

let userId = sessionStorage.getItem("userId");
if (!userId) {
  userId = Date.now().toString() + Math.random().toString(36).substring(2);
  sessionStorage.setItem("userId", userId);
}

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

  if (colorPanel) { colorPanel.remove(); colorPanel = null; }
  if (buttonPanel) { buttonPanel.style.display = "none"; }
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
    initIframe(iframeDoc); // Reattach iframe listeners
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    iframeDoc.body.innerHTML = historyStack[historyIndex];
    initIframe(iframeDoc); // Reattach iframe listeners
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
// TEMPORARY MEMORY LOADER + IFRAME INIT
// ===============================
async function loadTemporaryMemory(filename = "homepage.html") {
  try {
    const res = await fetch(`/template/${filename}?userId=${userId}`);
    if (!res.ok) return;
    const html = await res.text();
    const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Initialize iframe after content is written
    initIframe(iframeDoc);
    saveHistory(); // push loaded content to history stack
  } catch (err) {
    console.error("Failed to load temporary memory:", err);
  }
}

// ===============================
// IFRAME CLICK HANDLER INITIALIZER
// ===============================
function initIframe(iframeDoc) {
  // Re-attach click listener inside iframe
  iframeDoc.addEventListener("click", (e) => {
    const el = e.target;

    // --- Text Tool ---
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

      iframeDoc.body.appendChild(newText);
      newText.focus();

      saveHistory();
      deactivateAllTools();
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
        el.classList.contains("slideshow-container") ||
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

  // Re-attach button panel listeners if it exists
  if (buttonPanel) {
    buttonPanel.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (selectedElement) selectedElement.className = btn.className;
        saveHistory();
      });
    });
  }

  // Re-attach colorPanel listeners if it exists
  if (colorPanel) {
    colorPanel.querySelectorAll("div").forEach(swatch => {
      swatch.addEventListener("click", () => {
        if (!selectedElement) return;
        const color = swatch.style.backgroundColor;
        if (selectedElement.dataset.editable === "true") selectedElement.style.color = color;
        else selectedElement.style.backgroundColor = color;
        saveHistory();
      });
    });
  }
}

// ===============================
// INITIAL LOAD
// ===============================
loadTemporaryMemory("homepage.html");

// ===============================
// REST OF YOUR FUNCTIONS (RESIZE, COLOR, IMAGE, BUTTON, SAVE) …
// ===============================
// Keep everything else exactly as before (resize, color, image, button, saveToTemporaryMemory, publishBtn, setInterval autosave)
