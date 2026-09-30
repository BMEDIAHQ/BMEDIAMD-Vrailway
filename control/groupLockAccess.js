// control/groupLockAccess.js
// BMEDIA-MD — shared permission checks for mute / unmute / glock.
//
// IMPORTANT:
// Admin verification is delegated to the existing checks/isAdmin.js.
// No separate/custom group-admin matcher is used here.

import { isOwner } from "../checks/isOwner.js";
import { isSudo } from "../checks/isSudo.js";
import { isAdmin } from "../checks/isAdmin.js";

export function pickSender(ctx) {
  return (
    ctx?.senderJid ||
    ctx?.sender ||
    ctx?.m?.key?.participant ||
    ctx?.m?.participant ||
    ctx?.m?.sender ||
    ""
  );
}

function unique(values = []) {
  return [
    ...new Set(
      values
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    ),
  ];
}

async function checkBotAdminWithExistingHelper(sock, groupJid) {
  // Baileys may expose the connected account with a normal JID,
  // device-qualified JID, or LID depending on runtime/account state.
  //
  // We still delegate ALL matching to checks/isAdmin.js.
  const candidates = unique([
    sock?.user?.id,
    sock?.user?.lid,
    sock?.authState?.creds?.me?.id,
    sock?.authState?.creds?.me?.lid,
  ]);

  for (const botId of candidates) {
    try {
      if (await isAdmin(sock, groupJid, botId)) {
        return true;
      }
    } catch {}
  }

  return false;
}

export async function canManageGroup(ctx) {
  const { sock, from } = ctx;
  const sender = pickSender(ctx);

  if (!String(from || "").endsWith("@g.us")) {
    return {
      ok: false,
      reason: "This command works in groups only.",
      sender,
    };
  }

  let ownerOk = false;
  let sudoOk = false;
  let adminOk = false;

  try {
    ownerOk =
      isOwner({
        senderJid: sender,
        sender,
      }) === true;
  } catch {}

  try {
    sudoOk =
      typeof isSudo === "function" &&
      isSudo(sender) === true;
  } catch {}

  // USER ADMIN CHECK:
  // Uses checks/isAdmin.js exactly.
  try {
    adminOk =
      await isAdmin(
        sock,
        from,
        sender
      );
  } catch {}

  if (!ownerOk && !sudoOk && !adminOk) {
    return {
      ok: false,
      reason: "❌ Group Admin/Owner/Sudo only.",
      sender,
    };
  }

  // BOT ADMIN CHECK:
  // Also uses checks/isAdmin.js exactly.
  const botAdmin =
    await checkBotAdminWithExistingHelper(
      sock,
      from
    );

  if (!botAdmin) {
    return {
      ok: false,
      reason:
        "❌ I must be a group admin to lock or unlock this group.",
      sender,
    };
  }

  return {
    ok: true,
    sender,
    ownerOk,
    sudoOk,
    adminOk,
    botAdmin,
  };
}

export function mentionTag(jid = "") {
  const value = String(jid || "");

  const bare =
    value.split("@")[0].split(":")[0];

  return bare ? `@${bare}` : "";
}
