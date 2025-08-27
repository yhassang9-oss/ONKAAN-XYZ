const express = require("express");
const nodemailer = require("nodemailer");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();

// Parse JSON for API requests
app.use(bodyParser.json());

// Serve static files (HTML, CSS, JS, images) from /public
app.use(express.static(path.join(__dirname, "public")));

// Persistent session cache file
const CACHE_FILE = path.join(__dirname, "sessionCache.json");

// Load cache from disk on startup
let sessionCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    sessionCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading sessionCache.json:", err);
    sessionCache = {};
  }
}

// Utility to save cache to disk
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(sessionCache, null, 2), "utf-8");
}

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Template route for live preview
app.get("/template/:filename", (req, res) => {
  const { filename } = req.params;

  // 1️⃣ Serve from sessionCache if exists
  if (sessionCache[filename]) {
    return res.type("html").send(sessionCache[filename]);
  }

  // 2️⃣ Otherwise check in /public
  let filePath = path.join(__dirname, "public", filename);

  // 3️⃣ If not found, check in /public/templates
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "public", "templates", filename);
  }

  // 4️⃣ Serve file if exists
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // 5️⃣ File not found
  res.status(404).send("File not found");
});

// Auto-serve any HTML file (e.g., /account → account.html)
app.get("/:page", (req, res, next) => {
  const filename = `${req.params.page}.html`;

  if (sessionCache[filename]) {
    return res.type("html").send(sessionCache[filename]);
  }

  const filePath = path.join(__dirname, "public", filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);

  next();
});

// Save edits temporarily in memory and disk
app.post("/update", (req, res) => {
  const { filename, content } = req.body;
  sessionCache[filename] = content;
  saveCache(); // persist to disk
  res.sendStatus(200);
});

// Clear session cache
app.post("/reset", (req, res) => {
  sessionCache = {};
  saveCache();
  res.sendStatus(200);
});

// Send zipped templates via email
app.get("/send-template", async (req, res) => {
  try {
    const zipPath = path.join(__dirname, "template.zip");

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(path.join(__dirname, "public", "templates/"), false);
    archive.finalize();

    output.on("close", async () => {
      try {
        let transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "yourgmail@gmail.com",
            pass: "yourapppassword",
          },
        });

        let mailOptions = {
          from: "yourgmail@gmail.com",
          to: "receiver@gmail.com",
          subject: "Full Template",
          text: "Here are all the template files zipped.",
          attachments: [{ filename: "template.zip", path: zipPath }],
        };

        await transporter.sendMail(mailOptions);
        res.send("Template sent successfully!");
      } catch (mailErr) {
        console.error("Email send error:", mailErr);
        res.status(500).send("Error sending email");
      }
    });

    output.on("error", (zipErr) => {
      console.error("Zip creation error:", zipErr);
      res.status(500).send("Error creating zip");
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).send("Error sending template");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
