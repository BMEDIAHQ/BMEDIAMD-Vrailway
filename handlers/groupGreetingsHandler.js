// handlers/groupGreetingsHandler.js
// BMEDIA-MD — group-specific welcome + goodbye handler
// Welcome uses the joining member's profile picture when available.
// No external dependencies.

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "group-greetings.json");

const DEFAULT_WELCOME = [
  "Hello {user}",
  "Welcome to *{group}*",
  "You are member #{count}",
].join("\n");

const DEFAULT_GOODBYE = [
  "Goodbye {user}",
  "Thanks for being part of *{group}*",
].join("\n");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, "{}\n", "utf8");
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    const data = JSON.parse(raw || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeStore(data) {
  ensureStore();
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, CONFIG_FILE);
}

function defaultsFor(type) {
  return type === "welcome"
    ? { enabled: false, message: DEFAULT_WELCOME }
    : { enabled: false, message: DEFAULT_GOODBYE };
}

function normalizeGroupJid(groupJid = "") {
  return String(groupJid || "").trim().toLowerCase();
}

function ensureGroupRecord(store, groupJid) {
  const gid = normalizeGroupJid(groupJid);
  if (!store[gid] || typeof store[gid] !== "object") store[gid] = {};

  for (const type of ["welcome", "goodbye"]) {
    const current = store[gid][type];
    if (!current || typeof current !== "object") {
      store[gid][type] = defaultsFor(type);
      continue;
    }
    if (typeof current.enabled !== "boolean") current.enabled = false;
    if (typeof current.message !== "string" || !current.message.trim()) {
      current.message = defaultsFor(type).message;
    }
  }

  return store[gid];
}

export function getGreetingConfig(groupJid, type) {
  const store = readStore();
  const group = ensureGroupRecord(store, groupJid);
  const chosen = type === "goodbye" ? "goodbye" : "welcome";
  return {
    enabled: !!group[chosen].enabled,
    message: String(group[chosen].message || defaultsFor(chosen).message),
  };
}

export function setGreetingEnabled(groupJid, type, enabled) {
  const store = readStore();
  const group = ensureGroupRecord(store, groupJid);
  const chosen = type === "goodbye" ? "goodbye" : "welcome";
  group[chosen].enabled = !!enabled;
  writeStore(store);
  return { ...group[chosen] };
}

export function setGreetingMessage(groupJid, type, message) {
  const text = String(message || "").trim();
  if (!text) throw new Error("Message cannot be empty.");

  const store = readStore();
  const group = ensureGroupRecord(store, groupJid);
  const chosen = type === "goodbye" ? "goodbye" : "welcome";
  group[chosen].message = text;
  writeStore(store);
  return { ...group[chosen] };
}

export function resetGreeting(groupJid, type) {
  const store = readStore();
  const group = ensureGroupRecord(store, groupJid);
  const chosen = type === "goodbye" ? "goodbye" : "welcome";
  const enabled = !!group[chosen].enabled;
  group[chosen] = { ...defaultsFor(chosen), enabled };
  writeStore(store);
  return { ...group[chosen] };
}

function participantJid(participant) {
  if (typeof participant === "string") return participant.trim();
  return String(
    participant?.id ||
    participant?.jid ||
    participant?.phoneNumber ||
    participant?.phone ||
    participant?.lid ||
    ""
  ).trim();
}

function jidNumber(jid = "") {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d]/g, "");
}

function mentionText(jid = "") {
  const n = jidNumber(jid);
  return n ? `@${n}` : "@member";
}

export function renderGreeting(template, values = {}) {
  const replacements = {
    "{user}": values.user ?? "@member",
    "{group}": values.group ?? "this group",
    "{count}": values.count ?? "?",
    "{number}": values.number ?? "",
  };

  let output = String(template || "");
  for (const [token, value] of Object.entries(replacements)) {
    output = output.split(token).join(String(value));
  }
  return output;
}

function decorateGreeting(type, renderedText) {
  const title = type === "goodbye" ? "GOODBYE" : "WELCOME";
  const lines = String(renderedText || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!lines.length) lines.push(type === "goodbye" ? "Goodbye" : "Welcome");

  return [
    `╭─〔 *${title}* 〕`,
    ...lines.map((line, index) =>
      index === lines.length - 1 ? `╰◦ ${line}` : `├◦ ${line}`
    ),
    "",
    "> POWERED BY BMEDIA",
  ].join("\n");
}

async function safeGroupMetadata(sock, groupJid) {
  try {
    return await sock.groupMetadata(groupJid);
  } catch {
    return null;
  }
}

async function safeProfilePictureUrl(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    return url ? String(url) : "";
  } catch {
    return "";
  }
}

async function sendGreetingMessage(sock, groupJid, type, participant, force = false) {
  const participantId = participantJid(participant);
  if (!participantId) return false;

  const config = getGreetingConfig(groupJid, type);
  if (!force && !config.enabled) return false;

  const metadata = await safeGroupMetadata(sock, groupJid);
  const groupName = String(metadata?.subject || "this group");
  const count = Array.isArray(metadata?.participants)
    ? String(metadata.participants.length)
    : "?";

  const rendered = renderGreeting(config.message, {
    user: mentionText(participantId),
    group: groupName,
    count,
    number: jidNumber(participantId),
  });

  const decorated = decorateGreeting(type, rendered);
  const mentions = [participantId];

  // Try the member's profile picture for BOTH welcome and goodbye.
  // On goodbye, WhatsApp privacy or the member leaving the group may make
  // the picture unavailable; in that case we safely fall back to text.
  const ppUrl = await safeProfilePictureUrl(sock, participantId);

  if (ppUrl) {
    await sock.sendMessage(groupJid, {
      image: { url: ppUrl },
      caption: decorated,
      mentions,
    });
    return true;
  }

  await sock.sendMessage(groupJid, {
    text: decorated,
    mentions,
  });
  return true;
}

export async function sendGreetingPreview(sock, groupJid, type, participantJidValue) {
  return sendGreetingMessage(sock, groupJid, type, participantJidValue, true);
}

export async function handleGroupParticipantsUpdate(sock, update) {
  const groupJid = normalizeGroupJid(update?.id);
  if (!groupJid || !groupJid.endsWith("@g.us")) return;

  const action = String(update?.action || "").toLowerCase();
  const type = action === "add" ? "welcome" : action === "remove" ? "goodbye" : null;
  if (!type) return;

  const participants = (Array.isArray(update?.participants) ? update.participants : [])
    .map(participantJid)
    .filter(Boolean);

  if (!participants.length) return;

  for (const jid of participants) {
    try {
      await sendGreetingMessage(sock, groupJid, type, jid, false);
    } catch (error) {
      console.error(
        `[groupGreetings] ${type} send failed in ${groupJid}:`,
        error?.message || error
      );
    }
  }
}

const registeredSockets = new WeakSet();

export function registerGroupGreetingsHandler(sock) {
  if (!sock?.ev || registeredSockets.has(sock)) return false;
  registeredSockets.add(sock);

  sock.ev.on("group-participants.update", async (update) => {
    try {
      await handleGroupParticipantsUpdate(sock, update);
    } catch (error) {
      console.error(
        "[groupGreetings] participant update failed:",
        error?.message || error
      );
    }
  });

  return true;
}
