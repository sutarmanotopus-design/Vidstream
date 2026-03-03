import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Database setup
const db = new Database("vidstream.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'video', 'photo', 'embed'
    filename TEXT,
    title TEXT,
    description TEXT,
    thumbnailUrl TEXT,
    embedUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Gemini setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Multer setup for media uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.use(express.json());

// API Routes
app.get("/api/media", (req, res) => {
  const type = req.query.type;
  let query = "SELECT * FROM media";
  let params: any[] = [];
  if (type) {
    query += " WHERE type = ?";
    params.push(type);
  }
  query += " ORDER BY createdAt DESC";
  const media = db.prepare(query).all(...params);
  res.json(media);
});

app.post("/api/upload/video", upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const videoFile = files['video']?.[0];
  const thumbnailFile = files['thumbnail']?.[0];

  if (!videoFile) {
    return res.status(400).json({ error: "No video file uploaded" });
  }

  const filename = videoFile.filename;
  const originalName = videoFile.originalname;
  const thumbnailUrl = thumbnailFile ? `/uploads/${thumbnailFile.filename}` : `https://picsum.photos/seed/${filename}/480/270`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a catchy YouTube-like title and a short description for a video file named: "${originalName}". Return the result as JSON with "title" and "description" fields.`,
      config: { responseMimeType: "application/json" }
    });

    const metadata = JSON.parse(response.text || "{}");
    const title = metadata.title || originalName;
    const description = metadata.description || "No description provided.";

    const stmt = db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('video', filename, title, description, thumbnailUrl);

    res.json({ id: info.lastInsertRowid, filename, title, description, thumbnailUrl });
  } catch (error) {
    const stmt = db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('video', filename, originalName, "Uploaded video", thumbnailUrl);
    res.json({ id: info.lastInsertRowid, filename, title: originalName, description: "Uploaded video", thumbnailUrl });
  }
});

app.post("/api/upload/photo", upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No photo uploaded" });
  }

  const filename = req.file.filename;
  const originalName = req.file.originalname;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a catchy title and a short description for a photo file named: "${originalName}". Return the result as JSON with "title" and "description" fields.`,
      config: { responseMimeType: "application/json" }
    });

    const metadata = JSON.parse(response.text || "{}");
    const title = metadata.title || originalName;
    const description = metadata.description || "No description provided.";

    const stmt = db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('photo', filename, title, description, `/uploads/${filename}`);

    res.json({ id: info.lastInsertRowid, filename, title, description });
  } catch (error) {
    const stmt = db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('photo', filename, originalName, "Uploaded photo", `/uploads/${filename}`);
    res.json({ id: info.lastInsertRowid, filename, title: originalName, description: "Uploaded photo" });
  }
});

app.post("/api/upload/embed", async (req, res) => {
  const { url, title: userTitle } = req.body;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  // Clean the embed code (remove <embed>, <iframe>, etc. and extract the src)
  let cleanUrl = url;
  const srcMatch = url.match(/src="([^"]+)"/);
  if (srcMatch) {
    cleanUrl = srcMatch[1];
  } else {
    // If it's a direct YouTube link, convert to embed
    if (url.includes("youtube.com/watch?v=")) {
      cleanUrl = url.replace("watch?v=", "embed/");
    } else if (url.includes("youtu.be/")) {
      cleanUrl = url.replace("youtu.be/", "youtube.com/embed/");
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a catchy title and a short description for an embedded video from this URL: "${cleanUrl}". Return the result as JSON with "title" and "description" fields.`,
      config: { responseMimeType: "application/json" }
    });

    const metadata = JSON.parse(response.text || "{}");
    const title = userTitle || metadata.title || "Embedded Video";
    const description = metadata.description || "No description provided.";
    
    // Simple thumbnail heuristic for YouTube
    let thumbnailUrl = `https://picsum.photos/seed/${encodeURIComponent(cleanUrl)}/480/270`;
    if (cleanUrl.includes("youtube.com/embed/")) {
      const videoId = cleanUrl.split("/").pop()?.split("?")[0];
      if (videoId) thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    const stmt = db.prepare("INSERT INTO media (type, embedUrl, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('embed', cleanUrl, title, description, thumbnailUrl);

    res.json({ id: info.lastInsertRowid, embedUrl: cleanUrl, title, description, thumbnailUrl });
  } catch (error) {
    const stmt = db.prepare("INSERT INTO media (type, embedUrl, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)");
    const info = stmt.run('embed', cleanUrl, userTitle || "Embedded Video", "No description provided.", `https://picsum.photos/seed/${encodeURIComponent(cleanUrl)}/480/270`);
    res.json({ id: info.lastInsertRowid, embedUrl: cleanUrl, title: userTitle || "Embedded Video" });
  }
});

// Sync folder API (updated for media table)
app.post("/api/sync", async (req, res) => {
  // Cleanup: Remove any entries that were incorrectly added as photos but are actually thumbnails
  db.prepare(`
    DELETE FROM media 
    WHERE type = 'photo' 
    AND filename IN (
      SELECT REPLACE(thumbnailUrl, '/uploads/', '') 
      FROM media 
      WHERE thumbnailUrl LIKE '/uploads/%'
    )
  `).run();

  const files = fs.readdirSync(UPLOADS_DIR);
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  const photoExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const results = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    
    // Check if file is already in database as a main file
    const existing = db.prepare("SELECT id FROM media WHERE filename = ?").get(file);
    
    // Check if file is already in database as a thumbnail
    const isThumbnail = db.prepare("SELECT id FROM media WHERE thumbnailUrl = ?").get(`/uploads/${file}`);
    
    if (!existing && !isThumbnail) {
      let type = "";
      if (videoExtensions.includes(ext)) type = "video";
      else if (photoExtensions.includes(ext)) type = "photo";

      if (type) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a catchy title and a short description for a ${type} file named: "${file}". Return the result as JSON with "title" and "description" fields.`,
            config: { responseMimeType: "application/json" }
          });
          const metadata = JSON.parse(response.text || "{}");
          const title = metadata.title || file;
          const description = metadata.description || `Automatically detected ${type}.`;
          const thumbnailUrl = type === 'photo' ? `/uploads/${file}` : `https://picsum.photos/seed/${file}/480/270`;

          db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)")
            .run(type, file, title, description, thumbnailUrl);
          results.push({ file, status: "added", type });
        } catch (e) {
          db.prepare("INSERT INTO media (type, filename, title, description, thumbnailUrl) VALUES (?, ?, ?, ?, ?)")
            .run(type, file, file, `Automatically detected ${type}.`, type === 'photo' ? `/uploads/${file}` : `https://picsum.photos/seed/${file}/480/270`);
          results.push({ file, status: "added_fallback", type });
        }
      }
    }
  }
  res.json({ message: "Sync complete", results });
});

app.delete("/api/media/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Attempting to delete media ID: ${id}`);
  
  try {
    const item = db.prepare("SELECT * FROM media WHERE id = ?").get(id) as any;

    if (!item) {
      console.log(`Media with ID ${id} not found`);
      return res.status(404).json({ error: "Media not found" });
    }

    // Delete main file if it exists
    if (item.filename) {
      const filePath = path.join(UPLOADS_DIR, item.filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error unlinking file ${filePath}:`, err);
      }
    }

    // Delete thumbnail if it's a local file and not the main file
    if (item.thumbnailUrl && item.thumbnailUrl.startsWith("/uploads/")) {
      const thumbFilename = item.thumbnailUrl.replace("/uploads/", "");
      if (thumbFilename !== item.filename) {
        const thumbPath = path.join(UPLOADS_DIR, thumbFilename);
        try {
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
            console.log(`Deleted thumbnail: ${thumbPath}`);
          }
        } catch (err) {
          console.error(`Error unlinking thumbnail ${thumbPath}:`, err);
        }
      }
    }

    db.prepare("DELETE FROM media WHERE id = ?").run(id);
    console.log(`Deleted media record ID: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error in delete route:", error);
    res.status(500).json({ error: "Internal server error during deletion" });
  }
});

// Serve video files
app.use("/uploads", express.static(UPLOADS_DIR));

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist/index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
