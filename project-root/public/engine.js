// --- Auto-save to temporary memory ---
function saveToTemporaryMemory() {
  const iframeDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
  const htmlContent = iframeDoc.documentElement.outerHTML;

  fetch("/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "homepage.html", // or whichever file is active
      content: htmlContent
    })
  }).catch(err => console.error("Temp memory save failed:", err));
}

// Optional: auto-save every 5 seconds
setInterval(saveToTemporaryMemory, 5000);

// Or: save whenever you make an edit
function saveHistoryAndTempMemory() {
  saveHistory();
  saveToTemporaryMemory();
}
