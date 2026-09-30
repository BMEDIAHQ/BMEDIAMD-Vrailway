import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { MongoClient } from "mongodb";

let client = null;
let clientUri = "";
let lastAuthHash = "";
let lastRuntimeHash = "";

const MAX_RUNTIME_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RUNTIME_TOTAL_BYTES = 6 * 1024 * 1024;

async function getClient(mongoUri) {
  if (client && clientUri === mongoUri) return client;

  const mongo = new MongoClient(mongoUri, {
    maxPoolSize: 5,
  });

  await mongo.connect();
  client = mongo;
  clientUri = mongoUri;
  return client;
}

async function getCollection({ mongoUri, dbName, collectionName }) {
  const c = await getClient(mongoUri);
  return c.db(dbName).collection(collectionName);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmSafe(p) {
  try {
    await fs.rm(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}

async function listFilesRecursive(dir, base = dir) {
  const out = [];
  if (!(await pathExists(dir))) return out;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full, base)));
    } else if (entry.isFile()) {
      out.push({
        rel: path.relative(base, full).replace(/\\/g, "/"),
        full,
      });
    }
  }
  return out;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function bundleTextDir(dir) {
  const files = await listFilesRecursive(dir);
  const map = {};
  for (const file of files.sort((a, b) => a.rel.localeCompare(b.rel))) {
    map[file.rel] = await fs.readFile(file.full, "utf8");
  }
  return map;
}

export async function authDirHasFiles(authDir) {
  const files = await listFilesRecursive(authDir);
  return files.length > 0;
}

async function writeAuthBundleToDir(authDir, filesMap) {
  await rmSafe(authDir);
  await fs.mkdir(authDir, { recursive: true });

  for (const [rel, content] of Object.entries(filesMap || {})) {
    const target = path.join(authDir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, String(content ?? ""), "utf8");
  }
}

export function hasMongoSessionConfig({ mongoUri, dbName, collectionName }) {
  return !!String(mongoUri || "").trim() &&
         !!String(dbName || "").trim() &&
         !!String(collectionName || "").trim();
}

export async function restoreAuthFromSessionId({
  sessionId,
  mongoUri,
  dbName,
  collectionName,
  authDir,
}) {
  if (!sessionId) throw new Error("sessionId is required");
  if (!hasMongoSessionConfig({ mongoUri, dbName, collectionName })) {
    throw new Error("MONGODB_URI / SESSION_DB_NAME / SESSION_COLLECTION missing");
  }

  const collection = await getCollection({ mongoUri, dbName, collectionName });
  const doc = await collection.findOne({ sessionId: String(sessionId) });
  if (!doc) throw new Error("Session not found in MongoDB");
  if (!doc.files || typeof doc.files !== "object" || !Object.keys(doc.files).length) {
    throw new Error("Session document does not contain auth files");
  }

  await writeAuthBundleToDir(authDir, doc.files);
  lastAuthHash = stableHash(doc.files);
  return true;
}

// Once the deployment claims a pairing session, remove the pairing service's
// short-lived TTL field so cloud-host restarts can restore it indefinitely.
export async function claimSessionForRuntime({ sessionId, mongoUri, dbName, collectionName }) {
  if (!sessionId || !hasMongoSessionConfig({ mongoUri, dbName, collectionName })) return false;
  const collection = await getCollection({ mongoUri, dbName, collectionName });
  const result = await collection.updateOne(
    { sessionId: String(sessionId) },
    {
      $set: { runtimeClaimedAt: new Date(), updatedAt: new Date() },
      $unset: { expireAt: "" },
    }
  );
  return result.matchedCount > 0;
}

export async function syncAuthToSession({
  sessionId,
  mongoUri,
  dbName,
  collectionName,
  authDir,
  force = false,
}) {
  if (!sessionId || !hasMongoSessionConfig({ mongoUri, dbName, collectionName })) return false;
  if (!(await authDirHasFiles(authDir))) return false;

  const files = await bundleTextDir(authDir);
  const hash = stableHash(files);
  if (!force && hash === lastAuthHash) return false;

  const collection = await getCollection({ mongoUri, dbName, collectionName });
  const result = await collection.updateOne(
    { sessionId: String(sessionId) },
    {
      $set: {
        files,
        runtimeClaimedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: { expireAt: "" },
    }
  );

  if (result.matchedCount > 0) {
    lastAuthHash = hash;
    return true;
  }
  return false;
}

function isAllowedRuntimeRel(rel) {
  const clean = String(rel || "").replace(/\\/g, "/");
  if (!clean || clean.includes("..") || path.isAbsolute(clean)) return false;
  if (clean === "assets/logo.png") return true;
  if (clean.startsWith("control/") && clean.endsWith(".json")) return true;
  if (clean.startsWith("data/") && clean.endsWith(".json")) return true;
  return false;
}

async function collectRuntimeFiles(projectRoot) {
  const out = {};
  let totalBytes = 0;

  const candidates = [];
  for (const dirName of ["control", "data"]) {
    const dir = path.join(projectRoot, dirName);
    candidates.push(...(await listFilesRecursive(dir, projectRoot)));
  }
  candidates.sort((a, b) => a.rel.localeCompare(b.rel));

  for (const file of candidates) {
    if (!isAllowedRuntimeRel(file.rel)) continue;
    const stat = await fs.stat(file.full).catch(() => null);
    if (!stat || stat.size > MAX_RUNTIME_FILE_BYTES) continue;
    if (totalBytes + stat.size > MAX_RUNTIME_TOTAL_BYTES) break;
    const data = await fs.readFile(file.full, "utf8");
    out[file.rel] = { encoding: "utf8", data };
    totalBytes += Buffer.byteLength(data, "utf8");
  }

  const logoRel = "assets/logo.png";
  const logoPath = path.join(projectRoot, logoRel);
  if (await pathExists(logoPath)) {
    const stat = await fs.stat(logoPath).catch(() => null);
    if (stat && stat.size <= MAX_RUNTIME_FILE_BYTES && totalBytes + stat.size <= MAX_RUNTIME_TOTAL_BYTES) {
      const buf = await fs.readFile(logoPath);
      out[logoRel] = { encoding: "base64", data: buf.toString("base64") };
    }
  }

  return out;
}

export async function restoreRuntimeStateFromSession({
  sessionId,
  mongoUri,
  dbName,
  collectionName,
  projectRoot,
}) {
  if (!sessionId || !hasMongoSessionConfig({ mongoUri, dbName, collectionName })) return false;

  const collection = await getCollection({ mongoUri, dbName, collectionName });
  const doc = await collection.findOne(
    { sessionId: String(sessionId) },
    { projection: { runtimeFiles: 1 } }
  );

  const runtimeFiles = doc?.runtimeFiles;
  if (!runtimeFiles || typeof runtimeFiles !== "object" || !Object.keys(runtimeFiles).length) {
    return false;
  }

  for (const [rel, entry] of Object.entries(runtimeFiles)) {
    if (!isAllowedRuntimeRel(rel)) continue;
    const target = path.join(projectRoot, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });

    const encoding = entry?.encoding === "base64" ? "base64" : "utf8";
    const raw = String(entry?.data ?? "");
    if (encoding === "base64") {
      await fs.writeFile(target, Buffer.from(raw, "base64"));
    } else {
      await fs.writeFile(target, raw, "utf8");
    }
  }

  lastRuntimeHash = stableHash(runtimeFiles);
  return true;
}

export async function syncRuntimeStateToSession({
  sessionId,
  mongoUri,
  dbName,
  collectionName,
  projectRoot,
  force = false,
}) {
  if (!sessionId || !hasMongoSessionConfig({ mongoUri, dbName, collectionName })) return false;

  const runtimeFiles = await collectRuntimeFiles(projectRoot);
  const hash = stableHash(runtimeFiles);
  if (!force && hash === lastRuntimeHash) return false;

  const collection = await getCollection({ mongoUri, dbName, collectionName });
  const result = await collection.updateOne(
    { sessionId: String(sessionId) },
    {
      $set: {
        runtimeFiles,
        runtimeStateUpdatedAt: new Date(),
        runtimeClaimedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: { expireAt: "" },
    }
  );

  if (result.matchedCount > 0) {
    lastRuntimeHash = hash;
    return true;
  }
  return false;
}
