// commands/mute.js
// BMEDIA-MD — immediate group mute/lock
//
// .mute
// .mute 30
//
// If minutes are supplied, the auto-unmute is persisted and survives restart.

import {
  canManageGroup,
  mentionTag,
} from "../control/groupLockAccess.js";

import {
  setTemporaryMute,
  clearTemporaryMute,
  startGroupLockScheduler,
} from "../control/groupLockScheduler.js";

export default {
  name: "mute",

  aliases: [
    "close",
    "lock",
    "groupmute",
    "gcmute",
  ],

  category: "GROUP",

  description:
    "Mute/lock the current group immediately. Optional minutes for auto-unmute.",

  usage:
    "mute [minutes]",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
    } = ctx;

    const access =
      await canManageGroup(ctx);

    if (!access.ok) {
      return sock.sendMessage(
        from,
        { text: access.reason },
        { quoted: m }
      );
    }

    // Ensures temporary jobs begin working immediately even before a restart.
    startGroupLockScheduler(sock);

    const rawMinutes =
      String(args[0] || "").trim();

    let minutes = null;

    if (rawMinutes) {
      const n = Number(rawMinutes);

      if (!Number.isFinite(n) || n <= 0) {
        return sock.sendMessage(
          from,
          {
            text:
              "❌ Minutes must be a number greater than 0.\n" +
              "Example: .mute 30",
          },
          { quoted: m }
        );
      }

      minutes = n;
    }

    try {
      await sock.groupSettingUpdate(
        from,
        "announcement"
      );
    } catch (error) {
      return sock.sendMessage(
        from,
        {
          text:
            `❌ Failed to mute group: ` +
            `${error?.message || error}`,
        },
        { quoted: m }
      );
    }

    const tag =
      mentionTag(access.sender);

    if (minutes !== null) {
      setTemporaryMute(
        from,
        minutes,
        access.sender
      );

      return sock.sendMessage(
        from,
        {
          text:
            `🔇 ${tag || "Admin"} muted the group for ` +
            `*${minutes} minute(s)*.\n` +
            `⏳ It will reopen automatically, even after a bot restart.`,
          mentions:
            access.sender ? [access.sender] : [],
        },
        { quoted: m }
      );
    }

    // Plain manual mute should not retain an old temporary expiry.
    clearTemporaryMute(from);

    return sock.sendMessage(
      from,
      {
        text:
          `🔇 ${tag || "Admin"} muted the group.`,
        mentions:
          access.sender ? [access.sender] : [],
      },
      { quoted: m }
    );
  },
};
