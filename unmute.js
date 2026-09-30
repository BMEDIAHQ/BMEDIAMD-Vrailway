// commands/unmute.js
// BMEDIA-MD — immediate group unmute/open
//
// .unmute
//
// Manual unmute cancels any pending temporary mute timer,
// but it does NOT delete the recurring .glock daily schedule.

import {
  canManageGroup,
  mentionTag,
} from "../control/groupLockAccess.js";

import {
  clearTemporaryMute,
  startGroupLockScheduler,
} from "../control/groupLockScheduler.js";

export default {
  name: "unmute",

  aliases: [
    "open",
    "unlock",
    "groupunmute",
    "gcunmute",
  ],

  category: "GROUP",

  description:
    "Unmute/open the current group immediately.",

  usage:
    "unmute",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
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

    startGroupLockScheduler(sock);

    try {
      await sock.groupSettingUpdate(
        from,
        "not_announcement"
      );
    } catch (error) {
      return sock.sendMessage(
        from,
        {
          text:
            `❌ Failed to unmute group: ` +
            `${error?.message || error}`,
        },
        { quoted: m }
      );
    }

    clearTemporaryMute(from);

    const tag =
      mentionTag(access.sender);

    return sock.sendMessage(
      from,
      {
        text:
          `🔊 ${tag || "Admin"} unmuted the group.`,
        mentions:
          access.sender ? [access.sender] : [],
      },
      { quoted: m }
    );
  },
};
