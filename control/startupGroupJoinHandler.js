import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "config.json");

let startupGroupJoinExecuted = false;

function nowIso() {
  return new Date().toISOString();
}

function extractInviteCode(inviteLink = "") {
  const clean = String(inviteLink || "").trim();
  const match = clean.match(/(?:chat\.whatsapp\.com|whatsapp\.com\/chat)\/([A-Za-z0-9]+)/i);
  return match ? match[1] : null;
}

function defaultSection() {
  return {
    enabled: true,
    joined: false,
    inviteCode: null,
    inviteLink: null,
    groupJid: null,
    checkedAt: null,
    joinedAt: null,
    updatedAt: null,
  };
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      const initial = { prefix: null, updatedAt: Date.now() };
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return { prefix: null, updatedAt: Date.now() };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function resolveGroupJidFromInvite(sock, inviteCode) {
  const info = await sock.groupGetInviteInfo(inviteCode);
  return info?.id || info?.jid || null;
}

async function isAlreadyInTargetGroup(sock, groupJid) {
  if (!groupJid) return false;
  const groups = await sock.groupFetchAllParticipating();
  return Boolean(groups?.[groupJid]);
}

export async function handleStartupGroupJoin(sock, inviteLink = process.env.STARTUP_GROUP_LINK || "") {
  if (startupGroupJoinExecuted) return;
  startupGroupJoinExecuted = true;

  try {
    const inviteCode = extractInviteCode(inviteLink);

    if (!inviteCode) {
      console.log("[startupGroupJoin] skipped: no valid STARTUP_GROUP_LINK found");
      return;
    }

    const config = readConfig();
    const saved = {
      ...defaultSection(),
      ...(config.startupGroupJoin || {}),
    };

    // If same invite code was saved before, prefer the saved group JID first.
    let groupJid =
      saved.inviteCode === inviteCode && saved.groupJid
        ? saved.groupJid
        : null;

    // Always do a real membership check on startup.
    if (groupJid && await isAlreadyInTargetGroup(sock, groupJid)) {
      config.startupGroupJoin = {
        ...saved,
        enabled: true,
        joined: true,
        inviteCode,
        inviteLink,
        groupJid,
        checkedAt: nowIso(),
        joinedAt: saved.joinedAt || nowIso(),
        updatedAt: nowIso(),
      };
      writeConfig(config);
      console.log("[startupGroupJoin] bot already in target group");
      return;
    }

    // Resolve group JID from invite link when needed.
    groupJid = await resolveGroupJidFromInvite(sock, inviteCode);
    if (!groupJid) {
      console.log("[startupGroupJoin] failed: could not resolve target group from invite");
      return;
    }

    if (await isAlreadyInTargetGroup(sock, groupJid)) {
      config.startupGroupJoin = {
        ...saved,
        enabled: true,
        joined: true,
        inviteCode,
        inviteLink,
        groupJid,
        checkedAt: nowIso(),
        joinedAt: saved.joinedAt || nowIso(),
        updatedAt: nowIso(),
      };
      writeConfig(config);
      console.log("[startupGroupJoin] bot already joined, config updated");
      return;
    }

    await sock.groupAcceptInvite(inviteCode);

    config.startupGroupJoin = {
      ...saved,
      enabled: true,
      joined: true,
      inviteCode,
      inviteLink,
      groupJid,
      checkedAt: nowIso(),
      joinedAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeConfig(config);

    console.log("[startupGroupJoin] joined target group and saved state to control/config.json");
  } catch (err) {
    console.log("[startupGroupJoin] error:", err?.message || err);
  }
}
