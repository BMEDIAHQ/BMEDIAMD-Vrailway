// commands/amiadmin.js (ESM)

import { getAdminInfo } from "../checks/isAdmin.js";

function pickSenderId(m) {

  return (

    m?.key?.participant || // group participant

    m?.participant ||

    m?.sender ||

    m?.key?.remoteJid ||   // fallback

    ""

  );

}

function normalizeJidLike(j) {

  if (!j) return "";

  const s = String(j).trim();

  if (!s.includes("@")) return s;

  const [user, server] = s.split("@");

  const userNoDevice = user.split(":")[0];

  return `${userNoDevice}@${server}`;

}

function bareId(j) {

  if (!j) return "";

  const s = String(j).trim();

  const left = s.includes("@") ? s.split("@")[0] : s;

  return left.split(":")[0];

}

export default {

  name: "amiadmin",

  aliases: ["isadmin", "amIadmin", "amIadmin?"],

  category: "UTILITY",

  description: "Check if you are an admin/superadmin in the current group.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    // group-only

    if (!String(from).endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in *groups only*." }, { quoted: m });

    }

    const senderId = pickSenderId(m);

    const pushName = m?.pushName || "Unknown";

    const info = await getAdminInfo(sock, from, senderId); // uses the fixed matching

    if (!info.isAdmin) {

      const msg =

        `❌ *You are NOT an admin*\n\n` +

        `• Name: ${pushName}\n` +

        `• Raw ID: ${senderId || "N/A"}\n` +

        `• Normalized: ${normalizeJidLike(senderId) || "N/A"}\n` +

        `• Bare: ${bareId(senderId) || "N/A"}`;

      return sock.sendMessage(from, { text: msg }, { quoted: m });

    }

    const roleLabel = info.role === "superadmin" ? "SUPER ADMIN" : "ADMIN";

    const msg =

      `✅ *You are ${roleLabel}*\n\n` +

      `• Name: ${pushName}\n` +

      `• Raw ID: ${senderId || "N/A"}\n` +

      `• Matched ID: ${info.matchedId || "N/A"}\n` +

      `• Normalized: ${normalizeJidLike(senderId) || "N/A"}\n` +

      `• Bare: ${bareId(senderId) || "N/A"}`;

    return sock.sendMessage(from, { text: msg }, { quoted: m });

  },

};