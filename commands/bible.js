// commands/bible.js
// BMEDIA-MD — Combined Bible lookup + daily Bible scheduler.
//
// Lookup:
//   .bible John 3:16
//   .bible John 3:16-18
//   .bible 1 John 3:16-18
//
// Daily:
//   .bible on
//   .bible off
//   .bible now
//   .bible time 07:00
//   .bible status

import {
  enableDailyBible,
  disableDailyBible,
  setDailyBibleTime,
  getDailyBibleStatus,
  generateDailyBibleVerse,
  getBibleUserJid,
  attachBibleSock,
  fetchBibleReference,
  getBibleTimezone,
  getBibleDefaultTime,
  getDateParts,
} from "../control/dailyBibleHandler.js";

function footer() {
  return "> POWERED BY BMEDIA";
}

function box(lines = []) {
  return [
    "╭─〔 *DAILY BIBLE* 〕",
    ...lines.map((line, index) =>
      index === lines.length - 1 ? `╰◦ ${line}` : `├◦ ${line}`
    ),
  ].join("\n");
}

function clean(value = "") {
  return String(value || "").trim();
}

function formatLookup(verse) {
  const count = verse.versesCount !== null
    ? ` • *${verse.versesCount}* verse${verse.versesCount === 1 ? "" : "s"}`
    : "";

  const msg = [
    `📖 *${verse.reference}*`,
    `_${verse.translation}_${count}`,
    "",
    verse.text || "No text returned.",
    "",
    footer(),
  ].join("\n");

  return msg.length > 6500 ? msg.slice(0, 6500) + "\n…(truncated)" : msg;
}

const DAILY_ACTIONS = new Set([
  "on", "enable", "start",
  "off", "disable", "stop",
  "now", "test", "send",
  "time", "settime",
  "status", "settings",
]);

export default {
  name: "bible",
  aliases: ["dailybible", "verse", "scripture", "dailyverse"],
  category: "RELIGION",
  description: "Look up Bible verses or schedule a daily Bible verse.",
  usage: "bible John 3:16 | bible on/off/now/time 07:00/status",

  async execute(ctx) {
    const { sock, m, from, args = [], senderJid, prefix = "." } = ctx;

    // Also starts the scheduler if it has not already been started.
    attachBibleSock(sock);

    const first = clean(args[0] || "");
    const action = first.toLowerCase();

    // Anything that is not a scheduler keyword is treated as a Bible reference.
    if (args.length > 0 && !DAILY_ACTIONS.has(action)) {
      const reference = args.join(" ").trim();

      try {
        await sock.sendMessage(from, { react: { text: "📖", key: m.key } }).catch(() => {});
        const verse = await fetchBibleReference(reference);
        await sock.sendMessage(from, { text: formatLookup(verse) }, { quoted: m });
        await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
        return;
      } catch (error) {
        return sock.sendMessage(
          from,
          { text: `❌ Bible lookup failed.\nReason: ${error?.message || error}\n\n${footer()}` },
          { quoted: m }
        );
      }
    }

    const userJid = getBibleUserJid(m, senderJid);

    if (!userJid) {
      return sock.sendMessage(
        from,
        {
          text: [
            box(["Could not detect your phone JID", "Try again in private chat"]),
            "",
            footer(),
          ].join("\n"),
        },
        { quoted: m }
      );
    }

    if (!action || action === "status" || action === "settings") {
      const status = getDailyBibleStatus(userJid);
      const timezone = getBibleTimezone();
      const current = getDateParts(timezone);

      return sock.sendMessage(
        from,
        {
          text: [
            box([
              `Status   : *${status?.enabled ? "ON" : "OFF"}*`,
              `Time     : *${status?.time || getBibleDefaultTime()}*`,
              `Timezone : *${timezone}*`,
              `Now      : *${current.time}*`,
              `Usage    : ${prefix}bible John 3:16`,
              `Daily    : ${prefix}bible on/off/now/time 07:00`,
            ]),
            "",
            footer(),
          ].join("\n"),
        },
        { quoted: m }
      );
    }

    if (["on", "enable", "start"].includes(action)) {
      const timeArg = clean(args[1] || "");
      const user = enableDailyBible(userJid, { time: timeArg });
      const timezone = getBibleTimezone();

      const text = [
        box([
          "Daily Bible verse enabled ✅",
          `Time     : *${user.time}*`,
          `Timezone : *${timezone}*`,
          "Verse will be sent to your DM",
        ]),
        "",
        footer(),
      ].join("\n");

      await sock.sendMessage(from, { text }, { quoted: m });
      if (from !== userJid) await sock.sendMessage(userJid, { text }).catch(() => {});
      return;
    }

    if (["off", "disable", "stop"].includes(action)) {
      disableDailyBible(userJid);
      return sock.sendMessage(
        from,
        { text: [box(["Daily Bible verse disabled"]), "", footer()].join("\n") },
        { quoted: m }
      );
    }

    if (["time", "settime"].includes(action)) {
      try {
        const time = clean(args[1] || "");
        const user = setDailyBibleTime(userJid, time);

        return sock.sendMessage(
          from,
          {
            text: [
              box([
                "Daily Bible time updated ✅",
                `Time     : *${user.time}*`,
                `Timezone : *${getBibleTimezone()}*`,
              ]),
              "",
              footer(),
            ].join("\n"),
          },
          { quoted: m }
        );
      } catch (error) {
        return sock.sendMessage(
          from,
          {
            text: [
              box(["Invalid time format", `Use: ${prefix}bible time 07:00`]),
              "",
              footer(),
            ].join("\n"),
          },
          { quoted: m }
        );
      }
    }

    if (["now", "test", "send"].includes(action)) {
      try {
        await sock.sendMessage(
          from,
          { text: [box(["Fetching today's Bible verse..."]), "", footer()].join("\n") },
          { quoted: m }
        );

        const verse = await generateDailyBibleVerse({ timezone: getBibleTimezone() });
        await sock.sendMessage(userJid, { text: verse });

        if (from !== userJid) {
          return sock.sendMessage(
            from,
            { text: [box(["Bible verse sent to your DM ✅"]), "", footer()].join("\n") },
            { quoted: m }
          );
        }
        return;
      } catch (error) {
        return sock.sendMessage(
          from,
          {
            text: [
              "❌ Failed to fetch daily Bible verse",
              `Reason: ${error?.message || error}`,
              "",
              footer(),
            ].join("\n"),
          },
          { quoted: m }
        );
      }
    }
  },
};
