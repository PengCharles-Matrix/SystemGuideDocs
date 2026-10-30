import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID, randomBytes, createHmac, timingSafeEqual, scryptSync } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(root, "data", "uploads");
await mkdir(uploadsDir, { recursive: true });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
const port = Number(process.env.PORT || 3001);
const maxFileSize = 50 * 1024 * 1024;
const mongoUri = process.env.MONGODB_URI;
const mongoDbName = process.env.MONGODB_DB || "systemguidedocs";
// Use an ephemeral secret for local guest-only access when no secret is configured.
 // Production admin access still requires an explicitly configured SESSION_SECRET.
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD;
let users;
let workspaceContent;
let mongoReady = false;

let mongoConnecting = false;
async function connectMongo() {
  if (!mongoUri || mongoReady || mongoConnecting) return;
  mongoConnecting = true;
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  try {
    await client.connect();
    const database = client.db(mongoDbName);
    const nextUsers = database.collection("users");
    const nextWorkspaceContent = database.collection("workspaceContent");
    await nextUsers.createIndex({ username: 1 }, { unique: true });
    users = nextUsers;
    workspaceContent = nextWorkspaceContent;
    mongoReady = true;
    console.log("MongoDB connected.");
  } catch (error) {
    await client.close().catch(() => {});
    console.error("MongoDB connection failed; will retry automatically:", error.message);
  } finally {
    mongoConnecting = false;
  }
}

if (mongoUri) {
  // Start the HTTP server even if Atlas is temporarily unreachable, and keep
  // retrying in the background so the app recovers without a manual restart.
  await connectMongo();
  const mongoRetryTimer = setInterval(() => { void connectMongo(); }, 15000);
  mongoRetryTimer.unref();
} else {
  console.warn("MONGODB_URI is not configured. Authentication is unavailable until MongoDB is configured.");
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.warn("SESSION_SECRET is not configured; guest sessions will be temporary and reset when the server restarts.");
}

const cookieName = "systemguide_session";
const sign = (value) => createHmac("sha256", sessionSecret || "missing-secret").update(value).digest("base64url");
function setSession(res, session) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  res.cookie(cookieName, payload + "." + sign(payload), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    path: "/", maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
function getSession(req) {
  const raw = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  if (!raw || !sessionSecret || sessionSecret.length < 32) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.exp > Date.now() && ["admin", "guest"].includes(session.role) ? session : null;
  } catch { return null; }
}
const requireAuth = (req, res, next) => {
  req.auth = getSession(req);
  if (!req.auth) return res.status(401).json({ error: "Please log in to continue." });
  next();
};
const requireAdmin = (req, res, next) => {
  req.auth = getSession(req);
  if (!req.auth) return res.status(401).json({ error: "Please log in to continue." });
  if (req.auth.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
};
const passwordHash = (password) => scryptSync(password, process.env.PASSWORD_SALT, 64);

app.get("/api/health", (_req, res) => res.json({ ok: true, database: mongoReady ? "connected" : mongoUri ? "disconnected" : "not configured", maxFileSize }));

// Shared workspace content is stored centrally in MongoDB Atlas, not per-browser localStorage.
app.get("/api/content", async (_req, res) => {
  if (!mongoReady || !workspaceContent) {
    return res.status(503).json({ error: "MongoDB is configured but not connected. Check Atlas Network Access and the server TLS/network connection." });
  }
  try {
    const saved = await workspaceContent.findOne({ _id: "workspace" });
    if (!saved) return res.json({ content: null, updatedAt: null });
    return res.json({
      content: { docs: saved.docs, categories: saved.categories, siteTitle: saved.siteTitle },
      updatedAt: saved.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Could not load workspace content:", error.message);
    return res.status(500).json({ error: "Could not load shared documentation." });
  }
});

app.put("/api/content", requireAdmin, async (req, res) => {
  if (!mongoReady || !workspaceContent) {
    return res.status(503).json({ error: "MongoDB Atlas is configured but not connected. Check Atlas Network Access and the server TLS/network connection." });
  }
  const content = req.body;
  if (!content || !Array.isArray(content.docs) || !Array.isArray(content.categories) ||
      typeof content.siteTitle !== "string" || content.docs.length > 5000 ||
      content.categories.length > 500 || content.docs.some((doc) =>
        !doc || typeof doc.id !== "string" || typeof doc.title !== "string" ||
        typeof doc.category !== "string" || !Array.isArray(doc.sections))) {
    return res.status(400).json({ error: "Invalid workspace content format." });
  }
  try {
    const updatedAt = new Date();
    await workspaceContent.updateOne(
      { _id: "workspace" },
      { $set: { docs: content.docs, categories: content.categories, siteTitle: content.siteTitle.slice(0, 200), updatedAt } },
      { upsert: true },
    );
    return res.json({ saved: true, updatedAt });
  } catch (error) {
    console.error("Could not save workspace content:", error.message);
    return res.status(500).json({ error: "Could not save shared documentation." });
  }
});
app.get("/api/auth/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ authenticated: false, role: null });
  return res.json({ authenticated: true, role: session.role, username: session.username });
});
app.post("/api/auth/guest", (_req, res) => {
  // Guest access is read-only and intentionally does not depend on MongoDB.
  // A signed session is still required so server-protected routes can identify the guest role.
  if (!sessionSecret || sessionSecret.length < 32) {
    return res.status(503).json({ error: "Guest access is unavailable. Configure SESSION_SECRET on the server." });
  }
  const username = "guest";
  setSession(res, { username, role: "guest" });
  return res.json({ authenticated: true, role: "guest", username });
});
app.post("/api/auth/admin", async (req, res) => {
  if (!mongoReady || !users || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: "Login is unavailable. Check the MongoDB connection and SESSION_SECRET configuration." });
  }
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password || username.length > 100 || password.length > 1024) {
    return res.status(400).json({ error: "Enter your username and password." });
  }
  try {
    // Existing Atlas users are all administrators. Authenticate against the existing
    // username/userpassword fields without requiring a separate role field.
    const user = await users.findOne({ username });
    const storedPassword = user?.userpassword;
    const passwordMatches = typeof storedPassword === "string" &&
      storedPassword.length === password.length &&
      timingSafeEqual(Buffer.from(storedPassword), Buffer.from(password));
    if (!user || !passwordMatches) {
      await users.updateOne(
        { username: "admin-login-attempts" },
        { $inc: { failedAttempts: 1 }, $set: { lastFailedAt: new Date() } },
        { upsert: true },
      );
      return res.status(401).json({ error: "Invalid username or password." });
    }
    await users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    setSession(res, { username: user.username, role: "admin" });
    return res.json({ authenticated: true, role: "admin", username: user.username });
  } catch (error) {
    console.error("User login failed:", error.message);
    return res.status(500).json({ error: "Login failed." });
  }
});
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", path: "/" });
  res.json({ authenticated: false });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const original = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "file";
    cb(null, `${randomUUID()}-${original}`);
  },
});
const upload = multer({ storage, limits: { fileSize: maxFileSize, files: 1 } });
app.get("/api/uploads", requireAdmin, async (_req, res) => {
  try {
    const names = await readdir(uploadsDir);
    const files = await Promise.all(names.map(async (filename) => {
      const info = await stat(path.join(uploadsDir, filename));
      if (!info.isFile()) return null;
      const originalName = filename.replace(/^[0-9a-f-]{36}-/, "");
      return { name: originalName, url: `/uploads/${encodeURIComponent(filename)}`, size: info.size, uploadedAt: info.mtime.toISOString() };
    }));
    return res.json(files.filter(Boolean).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
  } catch { return res.status(500).json({ error: "Could not list uploaded files." }); }
});
app.post("/api/uploads", requireAdmin, (req, res) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res.status(status).json({ error: status === 413 ? "File exceeds the 50 MB upload limit." : error.message || "Upload failed." });
    }
    if (!req.file) return res.status(400).json({ error: "No file was received." });
    return res.status(201).json({ name: req.file.originalname, url: `/uploads/${encodeURIComponent(req.file.filename)}`, size: req.file.size });
  });
});
app.get("/uploads/:filename", requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename) return res.sendStatus(400);
  const filePath = path.join(uploadsDir, filename);
  if (/\.pdf$/i.test(filename)) {
    return res.type("application/pdf").sendFile(filePath, { headers: { "Content-Disposition": "inline", "Accept-Ranges": "bytes" } }, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ error: "Uploaded PDF not found." });
    });
  }
  if (/\.(png|jpe?g)$/i.test(filename)) {
    const contentType = /\.png$/i.test(filename) ? "image/png" : "image/jpeg";
    return res.type(contentType).sendFile(filePath, { headers: { "Content-Disposition": "inline" } }, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ error: "Uploaded file not found." });
    });
  }
  return res.download(filePath, filename, (error) => {
    if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ error: "Uploaded file not found." });
  });
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(root, "dist");
  app.use(express.static(distDir));
  app.get("*path", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}
app.listen(port, "0.0.0.0", () => console.log(`System Guide Docs server listening on http://0.0.0.0:${port}`));
