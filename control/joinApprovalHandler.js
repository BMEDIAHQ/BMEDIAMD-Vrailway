// control/joinApprovalHandler.js (ESM)

// Auto-approve/reject join requests (group-specific)

// Modes: off | approve | reject

// Call: await handleJoinApproval(sock, m, from);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "joinApprovalStore.json");

// Faster but safe: every 5s per group

const lastRun = new Map(); // groupJid -> ts

const COOLDOWN_MS = 5000;

// Process small chunks to avoid WA throttling

const BATCH_SIZE = 3;

async function readStore() {

  try {

    const raw = await fs.readFile(STORE_PATH, "utf8");

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};

  } catch {

    return {};

  }

}

async function writeStore(data) {

  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");

}

export async function getJoinApprovalMode(groupJid) {

  const store = await readStore();

  return String(store[groupJid]?.mode || "off").toLowerCase();

}

export async function setJoinApprovalMode(groupJid, mode) {

  const store = await readStore();

  const m = String(mode || "off").toLowerCase();

  store[groupJid] = store[groupJid] || {};

  store[groupJid].mode = ["off", "approve", "reject"].includes(m) ? m : "off";

  await writeStore(store);

  return store[groupJid].mode;

}

function extractJids(list) {

  if (!list) return [];

  const arr = Array.isArray(list)

    ? list

    : (list?.participants || list?.requests || list?.pending || []);

  if (!Array.isArray(arr)) return [];

  return arr

    .map((x) => (typeof x === "string" ? x : x?.jid || x?.id || x?.participant || null))

    .filter(Boolean);

}

function pickFns(sock) {

  const listFn =

    sock.groupRequestParticipantsList ||

    sock.groupRequestParticipants ||

    sock.groupRequestParticipantsRequestList ||

    null;

  const updateFn =

    sock.groupRequestParticipantsUpdate ||

    sock.groupRequestParticipantsAction ||

    null;

  return { listFn, updateFn };

}

async function applyUpdate(updateFn, groupJid, jids, mode) {

  // action fallback list (different builds)

  const actions =

    mode === "approve" ? ["approve", "accept"] : ["reject", "decline"];

  let lastErr = null;

  for (const action of actions) {

    try {

      await updateFn(groupJid, jids, action);

      return { ok: true, action };

    } catch (e) {

      lastErr = e;

    }

  }

  return { ok: false, action: null, error: lastErr };

}

export async function handleJoinApproval(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (m?.key?.fromMe) return;

    const mode = await getJoinApprovalMode(from);

    if (mode === "off") return;

    const now = Date.now();

    const last = lastRun.get(from) || 0;

    if (now - last < COOLDOWN_MS) return;

    lastRun.set(from, now);

    const { listFn, updateFn } = pickFns(sock);

    if (typeof listFn !== "function" || typeof updateFn !== "function") {

      console.log("[JOIN-APPROVAL] Not supported by this Baileys build.");

      return;

    }

    const pendingRaw = await listFn.call(sock, from).catch(() => null);

    let jids = extractJids(pendingRaw);

    if (!jids.length) return;

    // ✅ only process a small batch

    const batch = jids.slice(0, BATCH_SIZE);

    const result = await applyUpdate(

      (groupJid, ids, action) => updateFn.call(sock, groupJid, ids, action),

      from,

      batch,

      mode

    );

    if (!result.ok) {

      console.log(

        "[JOIN-APPROVAL] update failed (likely throttled / bot not admin):",

        result?.error?.message || result?.error || "unknown"

      );

      return;

    }

    console.log(

      `[JOIN-APPROVAL] ✅ ${mode.toUpperCase()} (${result.action}) batch=${batch.length}/${jids.length}`

    );

    // Optional: if there are more pending, next message will handle next batch

    // (keeps it light and avoids loops)

  } catch (e) {

    console.log("[JOIN-APPROVAL] handler error:", e?.message || e);

  }

}