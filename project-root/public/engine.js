const textTool = document.getElementById("textTool");
const selectTool = document.getElementById("selecttool");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const colorTool = document.getElementById("color");
const imageTool = document.getElementById("image");
const buttonTool = document.getElementById("Buttons");

const previewFrame = document.getElementById("previewFrame");

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;
let colorPanel = null;
let buttonPanel = null;

// --- Tool toggle functions ---
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

// --- History functions ---
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
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && e.key === "y") {
    e.preventDefault();
    redo();
  }
});

// --- Event listeners ---
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

// --- Iframe logic ---
previewFrame.addEventListener("load", () => {
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  saveHistory();

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
      newText.style.outline = "none";
      newText.style.cursor = "text";

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
        (el.dataset.editable === "true") ||
        el.tagName === "BUTTON" ||
        el.tagName === "IMG" ||
        el.classList.contains("slideshow-container") ||
        el.tagName === "DIV" ||
        ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "A", "LABEL"].includes(el.tagName) // 👈 added text elements
      ) {
        selectedElement = el;
        selectedElement.style.outline = "2px dashed red";
        makeResizable(selectedElement, iframeDoc);

        // --- Make text editable if it's a text element ---
        if (["P","H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(el.tagName)) {
          selectedElement.contentEditable = "true";
          selectedElement.dataset.editable = "true";
          selectedElement.focus();

          // Save history after finishing edit
          selectedElement.addEventListener("blur", () => saveHistory(), { once: true });
        }
      }
    }
  });
});

// --- Resizing ---
function removeHandles(doc) { doc.querySelectorAll(".resize-handle").forEach(h => h.remove()); }

function makeResizable(el, doc) {
  removeHandles(doc);
  const handle = doc.createElement("div");
  handle.className = "resize-handle";
  handle.style.width = "10px";
  handle.style.height = "10px";
  handle.style.background = "red";
  handle.style.position = "absolute";
  handle.style.right = "0";
  handle.style.bottom = "0";
  handle.style.cursor = "se-resize";
  handle.style.zIndex = "9999";

  el.style.position = "relative";
  el.appendChild(handle);

  let isResizing = false;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation();
    isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(getComputedStyle(el).width, 10);
    const startHeight = parseInt(getComputedStyle(el).height, 10);

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

// --- Color Tool (MS Paint style palette) ---
colorTool.addEventListener("click", () => {
  if (!selectedElement) { alert("Select an element first!"); return; }
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

  if (colorPanel) { colorPanel.remove(); colorPanel = null; return; }

  colorPanel = iframeDoc.createElement("div");
  colorPanel.style.position = "fixed";
  colorPanel.style.top = "20px";
  colorPanel.style.left = "20px";
  colorPanel.style.background = "#fff";
  colorPanel.style.border = "1px solid #ccc";
  colorPanel.style.padding = "10px";
  colorPanel.style.display = "grid";
  colorPanel.style.gridTemplateColumns = "repeat(8, 30px)";
  colorPanel.style.gridGap = "5px";
  colorPanel.style.zIndex = "9999";

  // Prevent palette from being selectable
  colorPanel.addEventListener("mousedown", (e) => e.stopPropagation());
  colorPanel.addEventListener("click", (e) => e.stopPropagation());

  const colors = [
    "#000000","#808080","#C0C0C0","#FFFFFF","#800000","#FF0000","#808000","#FFFF00",
    "#008000","#00FF00","#008080","#00FFFF","#000080","#0000FF","#800080","#FF00FF"
  ];

  colors.forEach(c => {
    const swatch = iframeDoc.createElement("div");
    swatch.style.width = "30px";
    swatch.style.height = "30px";
    swatch.style.background = c;
    swatch.style.cursor = "pointer";
    swatch.style.border = "1px solid #555";
    swatch.addEventListener("click", () => {
      if (!selectedElement) return;
      if (selectedElement.dataset.editable === "true") selectedElement.style.color = c;
      else selectedElement.style.backgroundColor = c;
      saveHistory();
    });
    colorPanel.appendChild(swatch);
  });

  iframeDoc.body.appendChild(colorPanel);
});

// --- Image Tool ---
imageTool.addEventListener("click", () => {
  if (!selectedElement || !(selectedElement.tagName === "IMG" || selectedElement.classList.contains("slideshow-container"))) {
    alert("Select an image or slideshow first."); return;
  }
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.click();
  input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (selectedElement.tagName === "IMG") selectedElement.src = ev.target.result;
      else if (selectedElement.classList.contains("slideshow-container")) {
        const firstSlide = selectedElement.querySelector(".slide");
        if (firstSlide) firstSlide.src = ev.target.result;
      }
      saveHistory();
    };
    reader.readAsDataURL(file);
  };
});

// --- Button Tool ---
buttonTool.addEventListener("click", () => {
  if (!selectedElement || selectedElement.tagName !== "BUTTON") { alert("Select a button first!"); return; }
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

  if (!buttonPanel) {
    buttonPanel = iframeDoc.createElement("div");
    buttonPanel.id = "buttonDesignPanel";
    buttonPanel.style.position = "fixed";
    buttonPanel.style.top = "50px";
    buttonPanel.style.left = "20px";
    buttonPanel.style.background = "#fff";
    buttonPanel.style.border = "1px solid #ccc";
    buttonPanel.style.padding = "10px";
    buttonPanel.style.zIndex = "9999";
    buttonPanel.innerHTML = `
      <h3>Buy Now Designs</h3>
      <div class="designs">
        <button class="buyDesign1">1</button>
        <button class="buyDesign2">2</button>
        <button class="buyDesign3">3</button>
        <button class="buyDesign4">4</button>
        <button class="buyDesign5">5</button>
      </div>
      <h3>Add to Cart Designs</h3>
      <div class="designs">
        <button class="addDesign1">1</button>
        <button class="addDesign2">2</button>
        <button class="addDesign3">3</button>
        <button class="addDesign4">4</button>
        <button class="addDesign5">5</button>
      </div>
    `;
    iframeDoc.body.appendChild(buttonPanel);

    buttonPanel.querySelectorAll(".designs:nth-of-type(1) button").forEach(btn => {
      btn.addEventListener("click", () => { if (selectedElement) selectedElement.className = btn.className; saveHistory(); });
    });
    buttonPanel.querySelectorAll(".designs:nth-of-type(2) button").forEach(btn => {
      btn.addEventListener("click", () => { if (selectedElement) selectedElement.className = btn.className; saveHistory(); });
    });
  } else {
    buttonPanel.style.display = buttonPanel.style.display === "none" ? "block" : "none";
  }
});

// --- Auto-save to temporary DB ---
// --- Auto-save to temporary DB + Publish ---
const publishBtn = document.getElementById("publishBtn");

publishBtn.addEventListener("click", () => {
  saveToTemporaryMemory(true); // 👈 call with "true" = manual publish
});

// Main save function
function saveToTemporaryMemory(isPublish = false) {
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  const htmlContent = iframeDoc.documentElement.outerHTML;

  // 🔹 Publish to your Render endpoint (only when publish clicked)
  if (isPublish) {
    fetch("https://onkaanpublishprototype-17.onrender.com/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: "MyProject",
        html: htmlContent,
        css: typeof cssContent !== "undefined" ? cssContent : "",
        js: typeof jsContent !== "undefined" ? jsContent : "",
        images: typeof images !== "undefined" ? images : []
      })
    }).catch(err => console.error("Publish failed:", err));
  }

  // 🔹 Always save to temporary memory
  fetch("/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "homepage.html", // or whichever file is open
      content: htmlContent
    })
  }).catch(err => console.error("Temp memory save failed:", err));
}

// Auto-save every 5s
setInterval(saveToTemporaryMemory, 5000);


