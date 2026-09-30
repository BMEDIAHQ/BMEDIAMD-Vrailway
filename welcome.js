// commands/welcome.js
// BMEDIA-MD — owner-only, group-specific welcome configuration.

import { isOwner } from "../checks/isOwner.js";
import {
  getGreetingConfig,
  setGreetingEnabled,
  setGreetingMessage,
  resetGreeting,
  sendGreetingPreview,
} from "../handlers/groupGreetingsHandler.js";

const TYPE = "welcome";
const LABEL = "WELCOME";

function getSenderJid(ctx) {
  return String(
    ctx?.senderJid ||
    ctx?.sender ||
    ctx?.participant ||
    ctx?.m?.key?.participant ||
    ""
  ).trim();
}

function ownerOnly(ctx) {
  const senderJid = getSenderJid(ctx);
  if (!senderJid) return false;
  try {
    return isOwner({ senderJid }) === true;
  } catch {
    return false;
  }
}

function customText(parts = []) {
  return parts.join(" ").trim().replace(/\s*\|\s*/g, "\n");
}

function box(lines = []) {
  return [
    `╭─〔 ${LABEL} 〕`,
    ...lines.map((line, i) =>
      i === lines.length - 1 ? `╰◦ ${line}` : `├◦ ${line}`
    ),
    "",
    "> POWERED BY BMEDIA",
  ].join("\n");
}

export default {
  name: "welcome",
  aliases: ["wel", "welcomeconfig"],
  category: "OWNER",
  description: "Configure group-specific welcome messages.",

  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    if (!from?.endsWith("@g.us")) {
      return sock.sendMessage(
        from,
        { text: `❌ ${LABEL} works in groups only.` },
        { quoted: m }
      );
    }

    if (!ownerOnly(ctx)) {
      return sock.sendMessage(
        from,
        { text: "❌ Bot owner only." },
        { quoted: m }
      );
    }

    const action = String(args[0] || "status").trim().toLowerCase();

    if (["on", "enable", "enabled"].includes(action)) {
      setGreetingEnabled(from, TYPE, true);
      return sock.sendMessage(
        from,
        { text: box(["Status : ON ✅", "New members will be welcomed with their profile picture when available."]) },
        { quoted: m }
      );
    }

    if (["off", "disable", "disabled"].includes(action)) {
      setGreetingEnabled(from, TYPE, false);
      return sock.sendMessage(
        from,
        { text: box(["Status : OFF ❌", "This applies only to this group."]) },
        { quoted: m }
      );
    }

    if (action === "set") {
      const message = customText(args.slice(1));
      if (!message) {
        return sock.sendMessage(
          from,
          {
            text: box([
              "Usage: welcome set <message>",
              "Use | for a new line.",
              "Placeholders: {user} {group} {count} {number}",
            ]),
          },
          { quoted: m }
        );
      }

      setGreetingMessage(from, TYPE, message);
      return sock.sendMessage(
        from,
        { text: box(["Custom welcome message saved ✅", "This applies only to this group."]) },
        { quoted: m }
      );
    }

    if (action === "reset") {
      const config = resetGreeting(from, TYPE);
      return sock.sendMessage(
        from,
        {
          text: box([
            "Message reset to default ✅",
            `Status remains: ${config.enabled ? "ON" : "OFF"}`,
          ]),
        },
        { quoted: m }
      );
    }

    if (action === "test") {
      const senderJid = getSenderJid(ctx);
      await sendGreetingPreview(sock, from, TYPE, senderJid);
      return;
    }

    if (["status", "show", "info"].includes(action)) {
      const config = getGreetingConfig(from, TYPE);
      return sock.sendMessage(
        from,
        {
          text: box([
            `Status : ${config.enabled ? "ON ✅" : "OFF ❌"}`,
            "Style  : Uses member profile picture when available",
            "Keys   : {user} {group} {count} {number}",
          ]),
        },
        { quoted: m }
      );
    }

    return sock.sendMessage(
      from,
      {
        text: box([
          "welcome on",
          "welcome off",
          "welcome set <message>",
          "welcome reset",
          "welcome test",
          "welcome status",
        ]),
      },
      { quoted: m }
    );
  },
};
