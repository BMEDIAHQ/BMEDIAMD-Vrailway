// commands/glock.js
// BMEDIA-MD — recurring group lock schedule
//
// Examples:
// .glock 22:00 06:00
// .glock set 10pm 6am
// .glock status
// .glock off
// .glock on
// .glock delete

import {
  canManageGroup,
} from "../control/groupLockAccess.js";

import {
  startGroupLockScheduler,
  getSchedulerTimezone,
  parseClockTime,
  getGroupSchedule,
  setGroupSchedule,
  setGroupScheduleEnabled,
  deleteGroupSchedule,
} from "../control/groupLockScheduler.js";

function box(lines = []) {
  return [
    "╭─〔 *GROUP LOCK SCHEDULE* 〕",
    ...lines.map((line, i) =>
      `${i === lines.length - 1 ? "╰◦" : "├◦"} ${line}`
    ),
    "",
    "> POWERED BY BMEDIA-MD",
  ].join("\n");
}

function usage(prefix = ".") {
  return box([
    `Set    : ${prefix}glock 22:00 06:00`,
    `12-hour: ${prefix}glock set 10pm 6am`,
    `Status : ${prefix}glock status`,
    `Pause  : ${prefix}glock off`,
    `Resume : ${prefix}glock on`,
    `Delete : ${prefix}glock delete`,
  ]);
}

export default {
  name: "glock",

  aliases: [
    "schedulegrouplock",
    "schedulegclock",
    "grouplockschedule",
    "groupschedule",
    "schedulegc",
    "sgl",
    "gcl",
    "gclock",
  ],

  category: "GROUP",

  description:
    "Schedule daily group lock and unlock times.",

  usage:
    "glock <lock-time> <unlock-time>",

  async execute(ctx) {
    const {
      sock,
      m,
      from,
      args = [],
      prefix = ".",
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

    const first =
      String(args[0] || "")
        .trim()
        .toLowerCase();

    if (!first) {
      return sock.sendMessage(
        from,
        { text: usage(prefix) },
        { quoted: m }
      );
    }

    if (
      first === "status" ||
      first === "check" ||
      first === "show"
    ) {
      const schedule =
        getGroupSchedule(from);

      if (!schedule) {
        return sock.sendMessage(
          from,
          {
            text: box([
              "Status: *NOT SET*",
              `Timezone: *${getSchedulerTimezone()}*`,
              `Use: ${prefix}glock 22:00 06:00`,
            ]),
          },
          { quoted: m }
        );
      }

      return sock.sendMessage(
        from,
        {
          text: box([
            `Status: *${schedule.enabled ? "ACTIVE ✅" : "PAUSED ⏸️"}*`,
            `Lock: *${schedule.lockTime}*`,
            `Open: *${schedule.unlockTime}*`,
            `Timezone: *${getSchedulerTimezone()}*`,
          ]),
        },
        { quoted: m }
      );
    }

    if (
      ["off", "pause", "disable", "disabled"].includes(first)
    ) {
      try {
        const schedule =
          setGroupScheduleEnabled(
            from,
            false
          );

        return sock.sendMessage(
          from,
          {
            text: box([
              "Status: *PAUSED ⏸️*",
              `Lock: *${schedule.lockTime}*`,
              `Open: *${schedule.unlockTime}*`,
              "The saved times were kept.",
            ]),
          },
          { quoted: m }
        );
      } catch (error) {
        return sock.sendMessage(
          from,
          {
            text: box([
              error?.message ||
                "No schedule exists.",
            ]),
          },
          { quoted: m }
        );
      }
    }

    if (
      ["on", "resume", "enable", "enabled"].includes(first)
    ) {
      try {
        const schedule =
          setGroupScheduleEnabled(
            from,
            true
          );

        return sock.sendMessage(
          from,
          {
            text: box([
              "Status: *ACTIVE ✅*",
              `Lock: *${schedule.lockTime}*`,
              `Open: *${schedule.unlockTime}*`,
              `Timezone: *${getSchedulerTimezone()}*`,
            ]),
          },
          { quoted: m }
        );
      } catch (error) {
        return sock.sendMessage(
          from,
          {
            text: box([
              error?.message ||
                "No schedule exists.",
            ]),
          },
          { quoted: m }
        );
      }
    }

    if (
      ["delete", "remove", "clear", "reset"].includes(first)
    ) {
      const removed =
        deleteGroupSchedule(from);

      return sock.sendMessage(
        from,
        {
          text: box([
            removed
              ? "Schedule deleted successfully."
              : "No schedule was set for this group.",
          ]),
        },
        { quoted: m }
      );
    }

    let lockInput = "";
    let unlockInput = "";

    if (first === "set") {
      lockInput =
        String(args[1] || "").trim();

      unlockInput =
        String(args[2] || "").trim();
    } else {
      lockInput =
        String(args[0] || "").trim();

      unlockInput =
        String(args[1] || "").trim();
    }

    const lockTime =
      parseClockTime(lockInput);

    const unlockTime =
      parseClockTime(unlockInput);

    if (!lockTime || !unlockTime) {
      return sock.sendMessage(
        from,
        { text: usage(prefix) },
        { quoted: m }
      );
    }

    if (lockTime === unlockTime) {
      return sock.sendMessage(
        from,
        {
          text: box([
            "Lock and open times cannot be the same.",
          ]),
        },
        { quoted: m }
      );
    }

    try {
      const schedule =
        setGroupSchedule(from, {
          lockTime,
          unlockTime,
          enabled: true,
          updatedBy: access.sender,
        });

      return sock.sendMessage(
        from,
        {
          text: box([
            "Status: *ACTIVE ✅*",
            `Lock every day: *${schedule.lockTime}*`,
            `Open every day: *${schedule.unlockTime}*`,
            `Timezone: *${getSchedulerTimezone()}*`,
          ]),
        },
        { quoted: m }
      );
    } catch (error) {
      return sock.sendMessage(
        from,
        {
          text: box([
            `Failed: ${error?.message || error}`,
          ]),
        },
        { quoted: m }
      );
    }
  },
};
