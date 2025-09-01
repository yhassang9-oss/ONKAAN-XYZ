const { Pool } = require('pg');
const express = require("express");
const nodemailer = require("nodemailer");
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// PostgreSQL connection
const pool = new Pool({
  user: 'onkaan_test_user',
  host: 'dpg-d2nb7ga4d50c73e5kar0-a',  
  database: 'onkaan_test',
  password: 'PDsOVhhtulaBieloPQkZJF4wpFguHkK4', 
  port: 5432,
});

// Ensure session_cache table exists with user_id
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_cache (
        filename TEXT,
        user_id TEXT,
        content TEXT,
        PRIMARY KEY (filename, user_id)
      )
    `);
    console.log("✅ session_cache table is ready");
  } catch (err) {
    console.error("❌ Error creating session_cache table:", err);
  }
})();

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Template route for live preview with optional userId
app.get("/template/:filename", async (req, res) => {
  const { filename } = req.params;
  const userId = req.query.userId || "default";

  try {
    const result = await pool.query(
      "SELECT content FROM session_cache WHERE filename=$1 AND user_id=$2",
      [filename, userId]
    );
    if (result.rows.length > 0) {
      return res.type("html").send(result.rows[0].content);
    }
  } catch (err) {
    console.error("DB fetch error:", err);
  }

  // Fallback to public files
  let filePath = path.join(__dirname, "public", filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, "public", "templates", filename);
  }

  if (fs.existsSync(filePath)) return res.sendFile(filePath);

  res.status(404).send("File not found");
});

// Auto-serve any HTML file with userId support
app.get("/:page", async (req, res, next) => {
  const filename = `${req.params.page}.html`;
  const userId = req.query.userId || "default";

  try {
    const result = await pool.query(
      "SELECT content FROM session_cache WHERE filename=$1 AND user_id=$2",
      [filename, userId]
    );
    if (result.rows.length > 0) {
      return res.type("html").send(result.rows[0].content);
    }
  } catch (err) {
    console.error("DB fetch error:", err);
  }

  const filePath = path.join(__dirname, "public", filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);

  next();
});

// Save edits to PostgreSQL
app.post("/update", async (req, res) => {
  const { filename, content, userId } = req.body;
  const uid = userId || "default";

  try {
    await pool.query(
      `INSERT INTO session_cache (filename, user_id, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename, user_id)
       DO UPDATE SET content = $3`,
      [filename, uid, content]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error("DB save error:", err);
    res.status(500).send("Error saving session");
  }
});

// Clear session cache (all users)
app.post("/reset", async (req, res) => {
  try {
    await pool.query("DELETE FROM session_cache");
    res.sendStatus(200);
  } catch (err) {
    console.error("DB reset error:", err);
    res.status(500).send("Error clearing session cache");
  }
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
