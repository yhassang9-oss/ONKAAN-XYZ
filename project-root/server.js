require("dotenv").config(); // 👈 load .env first

console.log("DB_HOST =", process.env.DB_HOST);
console.log("DB_PORT =", process.env.DB_PORT);
console.log("DB_USERNAME =", process.env.DB_USERNAME);
console.log("DB_DATABASE =", process.env.DB_DATABASE);

const express = require("express");
const nodemailer = require("nodemailer");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise"); // ✅ MySQL/TiDB client
const cors = require("cors"); // ✅ allow frontend

const app = express();

// ✅ allow frontend calls
app.use(cors());

// ✅ parse JSON with bigger size (for HTML, base64 images)
app.use(bodyParser.json({ limit: "10mb" }));

// ✅ TiDB/MySQL connection pool
let poolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT
};

// Optional SSL (only if CA is provided)
if (process.env.DB_CA) {
  poolConfig.ssl = { ca: process.env.DB_CA };
}
const pool = mysql.createPool(poolConfig);

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"));
});

// --- Template route (iframe live preview) ---
app.get("/template/:filename", async (req, res) => {
  let { filename } = req.params;
  if (!filename.endsWith(".html")) filename += ".html"; // normalize

  console.log("🔍 /template requested:", filename);

  try {
    // 1. Look for cached version in DB
    const [rows] = await pool.query(
      "SELECT content FROM pages WHERE filename = ? LIMIT 1",
      [filename]
    );

    if (rows.length > 0) {
      console.log("✅ Loaded from DB:", filename);
      res.type("html").send(rows[0].content);
      return;
    }

    // 2. Look in /public
    let filePath = path.join(__dirname, "public", filename);

    // 3. Look in /public/templates if not found
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, "public", "templates", filename);
    }

    // 4. Serve file if exists
    if (fs.existsSync(filePath)) {
      console.log("📂 Loaded from file:", filePath);
      res.sendFile(filePath);
    } else {
      console.warn("⚠️ Not found:", filename);
      res
        .type("html")
        .send(
          `<!DOCTYPE html><html><body><h3>⚠️ Template "${filename}" not found</h3></body></html>`
        );
    }
  } catch (err) {
    console.error("❌ DB Error in /template:", err);
    res
      .type("html")
      .send(
        "<!DOCTYPE html><html><body><h3>❌ Database error while loading template</h3></body></html>"
      );
  }
});

// Auto-serve any HTML page by name (with DB support)
app.get("/:page", async (req, res, next) => {
  let filename = req.params.page;
  if (!filename.endsWith(".html")) filename += ".html"; // normalize

  console.log("🔍 /:page requested:", filename);

  try {
    const [rows] = await pool.query(
      "SELECT content FROM pages WHERE filename = ? LIMIT 1",
      [filename]
    );

    if (rows.length > 0) {
      console.log("✅ Loaded from DB:", filename);
      res.type("html").send(rows[0].content);
      return;
    }

    const filePath = path.join(__dirname, "public", filename);
    if (fs.existsSync(filePath)) {
      console.log("📂 Loaded from file:", filePath);
      res.sendFile(filePath);
    } else {
      console.warn("⚠️ Page not found:", filename);
      next();
    }
  } catch (err) {
    console.error("❌ DB Error in /:page:", err);
    res.status(500).send("Database error");
  }
});

// ✅ Save edits permanently in DB
app.post("/update", async (req, res) => {
  let { filename, content } = req.body;
  if (!filename || !content) {
    return res
      .status(400)
      .json({ success: false, error: "Missing filename or content" });
  }

  if (!filename.endsWith(".html")) filename += ".html"; // normalize
  console.log("💾 Saving file:", filename);

  try {
    await pool.query(
      "INSERT INTO pages (filename, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)",
      [filename, content]
    );
    res.json({ success: true, message: "✅ Saved successfully!" });
  } catch (err) {
    console.error("❌ DB Error in /update:", err);
    res.status(500).json({ success: false, error: "Error saving file" });
  }
});

// ✅ Load saved template by ID
app.get("/api/load/:id", async (req, res) => {
  let websiteId = req.params.id;
  if (!websiteId.endsWith(".html")) websiteId += ".html"; // normalize

  console.log("🔍 /api/load requested:", websiteId);

  try {
    const [rows] = await pool.query(
      "SELECT content FROM pages WHERE filename = ? LIMIT 1",
      [websiteId]
    );

    if (rows.length > 0) {
      console.log("✅ Loaded from DB:", websiteId);
      res.json({ success: true, template: rows[0].content });
    } else {
      console.warn("⚠️ No saved template:", websiteId);
      res.json({ success: false, error: "No saved template found" });
    }
  } catch (err) {
    console.error("❌ DB Error in /api/load:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to load template" });
  }
});

// ✅ Reset pages (clear DB)
app.post("/reset", async (req, res) => {
  try {
    await pool.query("DELETE FROM pages");
    console.log("🗑️ Pages table cleared");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DB Error in /reset:", err);
    res.status(500).json({ success: false, error: "Error resetting pages" });
  }
});

// ✅ Send zipped templates via email
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
            pass: "yourapppassword"
          }
        });

        let mailOptions = {
          from: "yourgmail@gmail.com",
          to: "receiver@gmail.com",
          subject: "Full Template",
          text: "Here are all the template files zipped.",
          attachments: [{ filename: "template.zip", path: zipPath }]
        };

        await transporter.sendMail(mailOptions);
        res.send("Template sent successfully!");
      } catch (mailErr) {
        console.error("❌ Email send error:", mailErr);
        res.status(500).send("Error sending email");
      }
    });

    output.on("error", (zipErr) => {
      console.error("❌ Zip creation error:", zipErr);
      res.status(500).send("Error creating zip");
    });
  } catch (err) {
    console.error("❌ Unexpected error in /send-template:", err);
    res.status(500).send("Error sending template");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
