// engine.js — robust, rebinds editors after srcdoc loads, with debugging
const DEBUG = true;
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

function log(...args){ if(DEBUG) console.log("[engine.js]", ...args); }
function warn(...args){ console.warn("[engine.js]", ...args); }
function error(...args){ console.error("[engine.js]", ...args); }

let activeTool = null;
let selectedElement = null;
let historyStack = [];
let historyIndex = -1;
let colorPanel = null;
let buttonPanel = null;

// --- Helper: access iframe doc safely ---
function getIframeDocUnsafe(){
  // This may throw if cross-origin
  return previewFrame.contentDocument || previewFrame.contentWindow.document;
}
function getIframeDoc(){
  try {
    return getIframeDocUnsafe();
  } catch(e){
    error("Cannot access iframe document — likely cross-origin. Details:", e);
    return null;
  }
}

// --- Tool toggle ---
function deactivateAllTools() {
  activeTool = null;
  textTool?.classList?.remove("active-tool");
  selectTool?.classList?.remove("active-tool");

  const doc = getIframeDoc();
  if (selectedElement && doc) {
    try { selectedElement.style.outline = "none"; } catch(e){}
    removeHandles(doc);
    selectedElement = null;
  }
  if (colorPanel) { try { colorPanel.remove(); } catch(e){}; colorPanel = null; }
  if (buttonPanel) { try { buttonPanel.style.display = "none"; } catch(e){}; }
}

// --- History ---
function saveHistory() {
  const iframeDoc = getIframeDoc();
  if (!iframeDoc || !iframeDoc.body) return;
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(iframeDoc.body.innerHTML);
  historyIndex++;
  log("history saved, index:", historyIndex);
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

// --- Keyboard shortcuts ---
document.addEventListener("keydown", e => {
  if (e.ctrlKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); }
  else if (e.ctrlKey && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); }
});

// --- Tool click events (parent controls only) ---
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

// --- Resize helpers ---
function removeHandles(doc) { if(!doc) return; doc.querySelectorAll(".resize-handle").forEach(h => h.remove()); }
function makeResizable(el, doc) {
  if (!doc || !el) return;
  removeHandles(doc);
  const handle = doc.createElement("div");
  handle.className = "resize-handle";
  Object.assign(handle.style, {
    width: "10px", height: "10px", background: "red",
    position: "absolute", right: "0", bottom: "0", cursor: "se-resize", zIndex: "9999"
  });
  el.style.position = "relative";
  el.appendChild(handle);

  let isResizing = false;
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation();
    isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = parseInt(getComputedStyle(el).width, 10) || el.offsetWidth;
    const startHeight = parseInt(getComputedStyle(el).height, 10) || el.offsetHeight;

    function resizeMove(ev) {
      if (!isResizing) return;
      el.style.width = startWidth + (ev.clientX - startX) + "px";
      el.style.height = startHeight + (ev.clientY - startY) + "px";
    }
    function stopResize() { if (isResizing) saveHistory(); isResizing = false; doc.removeEventListener("mousemove", resizeMove); doc.removeEventListener("mouseup", stopResize); }

    doc.addEventListener("mousemove", resizeMove);
    doc.addEventListener("mouseup", stopResize);
  });
}

// --- Core: attach event handlers inside iframe doc ---
function attachIframeEventsOnce(doc){
  if (!doc) { warn("attachIframeEventsOnce: no doc"); return; }
  if (doc._eventsBound) { log("iframe events already bound"); return; }
  doc._eventsBound = true;
  log("Binding iframe events");

  // record current state in history
  saveHistory();

  // click handler inside iframe
  doc.addEventListener("click", (e) => {
    const el = e.target;

    // TEXT TOOL: place editable div
    if (activeTool === "text") {
      const newText = doc.createElement("div");
      newText.textContent = "Type here...";
      newText.contentEditable = "true";
      newText.dataset.editable = "true";
      newText.style.position = "absolute";
      // Use client coordinates relative to iframe viewport
      newText.style.left = (e.clientX + (doc.documentElement.scrollLeft || 0)) + "px";
      newText.style.top = (e.clientY + (doc.documentElement.scrollTop || 0)) + "px";
      newText.style.fontSize = "16px";
      newText.style.color = "black";
      newText.style.outline = "none";
      newText.style.cursor = "text";
      doc.body.appendChild(newText);
      newText.focus();
      saveHistory();
      deactivateAllTools();
      return;
    }

    // SELECT TOOL: select elements
    if (activeTool === "select") {
      e.preventDefault(); e.stopPropagation();
      if (selectedElement) {
        try { selectedElement.style.outline = "none"; } catch(e){}
        removeHandles(doc);
      }

      const tag = el.tagName || "";
      if (
        (el.dataset && el.dataset.editable === "true") ||
        tag === "BUTTON" || tag === "IMG" ||
        el.classList?.contains?.("slideshow-container") ||
        tag === "DIV" ||
        ["P","H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(tag)
      ) {
        selectedElement = el;
        try { selectedElement.style.outline = "2px dashed red"; } catch(e){}
        makeResizable(selectedElement, doc);

        if (["P","H1","H2","H3","H4","H5","H6","SPAN","A","LABEL"].includes(tag)) {
          selectedElement.contentEditable = "true";
          selectedElement.dataset.editable = "true";
          selectedElement.focus();
          selectedElement.addEventListener("blur", () => saveHistory(), { once: true });
        }
      } else {
        // clicked an area that is not selectable
        selectedElement = null;
      }
    }
  });

  // ensure images added later are selectable: mutation observer to set dataset.editable if needed
  const mo = new doc.defaultView.MutationObserver(muts => {
    muts.forEach(m => {
      if (m.addedNodes) {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) {
            if (["P","DIV","SPAN"].includes(n.tagName)) n.dataset.editable = "true";
          }
        });
      }
    });
  });
  mo.observe(doc.body, { childList: true, subtree: true });
}

// --- Utility: wait for iframe doc to be accessible and ready ---
function waitForIframeDoc(timeout = 4000){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll(){
      try {
        const doc = getIframeDocUnsafe(); // may throw cross-origin
        if (doc && (doc.readyState === "complete" || doc.body)) {
          resolve(doc);
          return;
        }
      } catch(err){
        // cross-origin access -> reject immediately
        reject(err);
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error("Timed out waiting for iframe document"));
        return;
      }
      setTimeout(poll, 100);
    })();
  });
}

// --- Color tool (parent button) ---
colorTool?.addEventListener("click", () => {
  const doc = getIframeDoc();
  if (!doc) { alert("Cannot access preview. Make sure editor & preview are same origin and loaded via HTTP/HTTPS."); return; }
  if (!selectedElement) { alert("Select an element first!"); return; }
  if (colorPanel) { colorPanel.remove(); colorPanel = null; return; }

  colorPanel = doc.createElement("div");
  Object.assign(colorPanel.style, {
    position: "fixed", top: "20px", left: "20px", background: "#fff",
    border: "1px solid #ccc", padding: "10px", display: "grid",
    gridTemplateColumns: "repeat(8, 30px)", gap: "5px", zIndex: "9999"
  });
  colorPanel.addEventListener("mousedown", e => e.stopPropagation());
  colorPanel.addEventListener("click", e => e.stopPropagation());

  const colors = ["#000","#808080","#C0C0C0","#FFF","#800000","#F00","#808000","#FF0","#008000","#0F0","#008080","#0FF","#00F","#800080","#F0F"];
  colors.forEach(c => {
    const swatch = doc.createElement("div");
    Object.assign(swatch.style, { width: "30px", height: "30px", background: c, cursor: "pointer", border: "1px solid #555" });
    swatch.addEventListener("click", () => {
      if (!selectedElement) return;
      if (selectedElement.dataset && selectedElement.dataset.editable === "true") selectedElement.style.color = c;
      else selectedElement.style.backgroundColor = c;
      saveHistory();
    });
    colorPanel.appendChild(swatch);
  });

  doc.body.appendChild(colorPanel);
});

// --- Image Tool ---
imageTool?.addEventListener("click", () => {
  const doc = getIframeDoc();
  if (!doc) { alert("Cannot access preview."); return; }
  if (!selectedElement || !(selectedElement.tagName === "IMG" || selectedElement.classList.contains("slideshow-container"))) { alert("Select an image first!"); return; }
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*"; input.click();
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (selectedElement.tagName === "IMG") selectedElement.src = ev.target.result;
      else if (selectedElement.classList.contains("slideshow-container")) {
        const firstSlide = selectedElement.querySelector(".slide"); if (firstSlide) firstSlide.src = ev.target.result;
      }
      saveHistory();
    };
    reader.readAsDataURL(file);
  };
});

// --- Button Tool ---
buttonTool?.addEventListener("click", () => {
  const doc = getIframeDoc();
  if (!doc) { alert("Cannot access preview."); return; }
  if (!selectedElement || selectedElement.tagName !== "BUTTON") { alert("Select a button first!"); return; }

  if (!buttonPanel) {
    buttonPanel = doc.createElement("div");
    buttonPanel.id = "buttonDesignPanel";
    Object.assign(buttonPanel.style, { position: "fixed", top: "50px", left: "20px", background: "#fff", border: "1px solid #ccc", padding: "10px", zIndex: "9999" });
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
    doc.body.appendChild(buttonPanel);

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

// --- Publish Button ---
publishBtn?.addEventListener("click", () => {
  const doc = getIframeDoc();
  if (!doc) { alert("Cannot access preview."); return; }
  const htmlContent = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

  let cssContent = "";
  doc.querySelectorAll("style").forEach(tag => cssContent += tag.innerHTML + "\n");
  let jsContent = "";
  doc.querySelectorAll("script").forEach(tag => jsContent += tag.innerHTML + "\n");

  const images = [];
  doc.querySelectorAll("img").forEach((img, i) => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      images.push({ name: `image${i + 1}.png`, data: dataUrl.split(",")[1] });
    } catch (err) {
      warn("Skipping image (CORS issue):", img.src);
    }
  });

  fetch("https://onkaanpublishprototype-17.onrender.com/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectName: "MyProject", html: htmlContent, css: cssContent, js: jsContent, images })
  })
  .then(res => res.json())
  .then(data => alert(data.message))
  .catch(err => alert("Error sending files: " + err));
});

// --- Save Button ---
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const doc = getIframeDoc();
    if (!doc) { alert("Cannot access preview to save."); return; }
    const template = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
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
      error("Save error:", err);
      alert("❌ Save failed: " + err.message);
    }
  });
}

// --- Load template (DB then static) and bind events robustly ---
async function loadTemplate() {
  const filename = "homepage.html";
  try {
    const api = `https://onkaan-xyz23.onrender.com/api/load/${encodeURIComponent(filename)}`;
    const response = await fetch(api);
    const result = await response.json();
    if (result && result.success && result.template) {
      previewFrame.removeAttribute("src"); // ensure not navigating to different doc
      previewFrame.srcdoc = result.template;
      try {
        const doc = await waitForIframeDoc(3000);
        attachIframeEventsOnce(doc);
        log("Loaded template from DB and bound events");
      } catch (err) {
        error("Failed to bind after srcdoc (DB result):", err);
        alert("Editor can't access the preview document. Check console for cross-origin errors.");
      }
      return;
    }
  } catch (err) {
    warn("DB load attempt failed:", err);
  }

  // Fallback to static file in same origin (served from /public)
  try {
    // use root-relative path so same origin is used
    const res = await fetch("/" + filename);
    if (!res.ok) throw new Error("Static fetch failed " + res.status);
    const html = await res.text();
    previewFrame.removeAttribute("src");
    previewFrame.srcdoc = html;
    try {
      const doc = await waitForIframeDoc(3000);
      attachIframeEventsOnce(doc);
      log("Loaded static template and bound events");
    } catch (err) {
      error("Failed to bind after srcdoc (static):", err);
      alert("Editor can't access the preview document. Check console for cross-origin errors.");
    }
  } catch (e) {
    error("Static fallback failed:", e);
    previewFrame.srcdoc = "<!DOCTYPE html><html><body><h3>No template available</h3></body></html>";
  }
}

// --- init ---
document.addEventListener("DOMContentLoaded", () => {
  // Quick cross-origin check: are parent and iframe expected to share origin?
  try {
    const sameOriginTest = window.location.origin;
    log("Parent origin:", sameOriginTest);
  } catch(e){
    warn("Could not read parent origin (rare):", e);
  }
  loadTemplate();
});
