// control/groupLockScheduler.js
// BMEDIA-MD — persistent group lock scheduler
// - Daily lock/unlock schedules per group
// - Persistent temporary mute expiry
// - No external dependencies
//
// IMPORTANT:
// Call startGroupLockScheduler(sock) once after the Baileys socket is created.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_FILE = path.join(__dirname, "group-lock-schedules.json");
const TICK_MS = 20_000;

let timer = null;
let activeSock = null;
let runningTick = false;

function defaultStore() {
  return {
    groups: {},
    temporaryMutes: {},
  };
}

function ensureStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(
        STORE_FILE,
        JSON.stringify(defaultStore(), null, 2),
        "utf8"
      );
    }
  } catch {}
}

function readStore() {
  ensureStore();

  try {
    const parsed = JSON.parse(
      fs.readFileSync(STORE_FILE, "utf8") || "{}"
    );

    if (!parsed || typeof parsed !== "object") {
      return defaultStore();
    }

    if (!parsed.groups || typeof parsed.groups !== "object") {
      parsed.groups = {};
    }

    if (
      !parsed.temporaryMutes ||
      typeof parsed.temporaryMutes !== "object"
    ) {
      parsed.temporaryMutes = {};
    }

    return parsed;
  } catch {
    return defaultStore();
  }
}

function writeStore(store) {
  ensureStore();

  const tmp = `${STORE_FILE}.tmp`;

  fs.writeFileSync(
    tmp,
    JSON.stringify(store, null, 2),
    "utf8"
  );

  fs.renameSync(tmp, STORE_FILE);
}

function validGroupJid(groupJid = "") {
  return String(groupJid || "").endsWith("@g.us");
}

export function getSchedulerTimezone() {
  return String(
    process.env.TIMEZONE ||
    process.env.TZ ||
    "Africa/Douala"
  ).trim() || "Africa/Douala";
}

function timePartsForTimezone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((p) => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function currentMinuteInfo() {
  const timeZone = getSchedulerTimezone();
  const p = timePartsForTimezone(timeZone);

  return {
    timeZone,
    hhmm: `${p.hour}:${p.minute}`,
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minuteKey: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`,
  };
}

export function parseClockTime(input = "") {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!raw) return null;

  // 24-hour: 22:30 or 22
  let m = raw.match(/^([01]?\d|2[0-3])(?::([0-5]\d))?$/);

  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2] || 0);

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  // 12-hour: 10pm, 10:30pm, 6am
  m = raw.match(/^(0?[1-9]|1[0-2])(?::([0-5]\d))?(am|pm)$/);

  if (m) {
    let hour = Number(m[1]);
    const minute = Number(m[2] || 0);
    const ampm = m[3];

    if (ampm === "am" && hour === 12) hour = 0;
    if (ampm === "pm" && hour !== 12) hour += 12;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return null;
}

export function getGroupSchedule(groupJid) {
  if (!validGroupJid(groupJid)) return null;

  const store = readStore();
  return store.groups[groupJid] || null;
}

export function setGroupSchedule(
  groupJid,
  {
    lockTime,
    unlockTime,
    enabled = true,
    updatedBy = "",
  }
) {
  if (!validGroupJid(groupJid)) {
    throw new Error("Invalid group JID.");
  }

  const lock = parseClockTime(lockTime);
  const unlock = parseClockTime(unlockTime);

  if (!lock || !unlock) {
    throw new Error("Invalid lock or unlock time.");
  }

  if (lock === unlock) {
    throw new Error("Lock and unlock times cannot be the same.");
  }

  const store = readStore();
  const previous = store.groups[groupJid] || {};

  store.groups[groupJid] = {
    lockTime: lock,
    unlockTime: unlock,
    enabled: enabled === true,
    timezone: getSchedulerTimezone(),
    updatedBy: String(updatedBy || ""),
    updatedAt: new Date().toISOString(),

    // Keep execution markers only if they still belong to the same schedule.
    lastLockMinute:
      previous.lockTime === lock &&
      previous.unlockTime === unlock
        ? previous.lastLockMinute || ""
        : "",

    lastUnlockMinute:
      previous.lockTime === lock &&
      previous.unlockTime === unlock
        ? previous.lastUnlockMinute || ""
        : "",
  };

  writeStore(store);
  return store.groups[groupJid];
}

export function setGroupScheduleEnabled(groupJid, enabled) {
  const store = readStore();
  const existing = store.groups[groupJid];

  if (!existing) {
    throw new Error("No group lock schedule has been set.");
  }

  existing.enabled = enabled === true;
  existing.updatedAt = new Date().toISOString();

  writeStore(store);
  return existing;
}

export function deleteGroupSchedule(groupJid) {
  const store = readStore();
  const existed = Boolean(store.groups[groupJid]);

  delete store.groups[groupJid];
  writeStore(store);

  return existed;
}

export function setTemporaryMute(
  groupJid,
  minutes,
  createdBy = ""
) {
  if (!validGroupJid(groupJid)) {
    throw new Error("Invalid group JID.");
  }

  const n = Number(minutes);

  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Minutes must be greater than 0.");
  }

  const store = readStore();

  const expiresAt =
    Date.now() + Math.floor(n * 60_000);

  store.temporaryMutes[groupJid] = {
    expiresAt,
    minutes: n,
    createdBy: String(createdBy || ""),
    createdAt: new Date().toISOString(),
  };

  writeStore(store);

  return store.temporaryMutes[groupJid];
}

export function clearTemporaryMute(groupJid) {
  const store = readStore();
  const existed = Boolean(store.temporaryMutes[groupJid]);

  delete store.temporaryMutes[groupJid];
  writeStore(store);

  return existed;
}

export function getTemporaryMute(groupJid) {
  const store = readStore();
  return store.temporaryMutes[groupJid] || null;
}

async function safeGroupUpdate(sock, groupJid, mode) {
  try {
    await sock.groupSettingUpdate(groupJid, mode);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || "Unknown error"),
    };
  }
}

async function processTemporaryMutes(sock, store) {
  const now = Date.now();
  let changed = false;

  for (const [groupJid, job] of Object.entries(
    store.temporaryMutes || {}
  )) {
    const expiresAt = Number(job?.expiresAt || 0);

    if (!expiresAt || expiresAt > now) continue;

    const result = await safeGroupUpdate(
      sock,
      groupJid,
      "not_announcement"
    );

    if (result.ok) {
      await sock
        .sendMessage(groupJid, {
          text:
            `🔊 *Scheduled unmute completed*\n` +
            `The temporary mute period has ended.\n\n` +
            `> POWERED BY BMEDIA-MD`,
        })
        .catch(() => {});

      delete store.temporaryMutes[groupJid];
      changed = true;
    } else {
      // Retry on the next tick. This handles temporary connection/admin issues.
      console.log(
        `[GLOCK] temporary unmute failed for ${groupJid}: ${result.error}`
      );
    }
  }

  return changed;
}

async function processDailySchedules(sock, store) {
  const nowInfo = currentMinuteInfo();
  let changed = false;

  for (const [groupJid, schedule] of Object.entries(
    store.groups || {}
  )) {
    if (!schedule?.enabled) continue;

    if (schedule.lockTime === nowInfo.hhmm) {
      if (schedule.lastLockMinute !== nowInfo.minuteKey) {
        const result = await safeGroupUpdate(
          sock,
          groupJid,
          "announcement"
        );

        if (result.ok) {
          schedule.lastLockMinute = nowInfo.minuteKey;
          changed = true;

          await sock
            .sendMessage(groupJid, {
              text:
                `🔒 *Group locked automatically*\n` +
                `Scheduled lock time: *${schedule.lockTime}*\n\n` +
                `> POWERED BY BMEDIA-MD`,
            })
            .catch(() => {});
        } else {
          console.log(
            `[GLOCK] daily lock failed for ${groupJid}: ${result.error}`
          );
        }
      }
    }

    if (schedule.unlockTime === nowInfo.hhmm) {
      if (schedule.lastUnlockMinute !== nowInfo.minuteKey) {
        const result = await safeGroupUpdate(
          sock,
          groupJid,
          "not_announcement"
        );

        if (result.ok) {
          schedule.lastUnlockMinute = nowInfo.minuteKey;
          changed = true;

          await sock
            .sendMessage(groupJid, {
              text:
                `🔓 *Group opened automatically*\n` +
                `Scheduled open time: *${schedule.unlockTime}*\n\n` +
                `> POWERED BY BMEDIA-MD`,
            })
            .catch(() => {});
        } else {
          console.log(
            `[GLOCK] daily unlock failed for ${groupJid}: ${result.error}`
          );
        }
      }
    }
  }

  return changed;
}

async function tick() {
  if (runningTick || !activeSock) return;

  runningTick = true;

  try {
    const store = readStore();

    const changedTemporary =
      await processTemporaryMutes(activeSock, store);

    const changedDaily =
      await processDailySchedules(activeSock, store);

    if (changedTemporary || changedDaily) {
      writeStore(store);
    }
  } catch (error) {
    console.log(
      "[GLOCK] scheduler error:",
      error?.message || error
    );
  } finally {
    runningTick = false;
  }
}

export function startGroupLockScheduler(sock) {
  if (!sock) return false;

  activeSock = sock;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Run shortly after attachment, then every 20 seconds.
  setTimeout(() => {
    tick().catch(() => {});
  }, 2_000);

  timer = setInterval(() => {
    tick().catch(() => {});
  }, TICK_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  console.log(
    `[GLOCK] scheduler started (${getSchedulerTimezone()})`
  );

  return true;
}

export function stopGroupLockScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  activeSock = null;
}

export default {
  startGroupLockScheduler,
  stopGroupLockScheduler,
  getSchedulerTimezone,
  parseClockTime,
  getGroupSchedule,
  setGroupSchedule,
  setGroupScheduleEnabled,
  deleteGroupSchedule,
  setTemporaryMute,
  clearTemporaryMute,
  getTemporaryMute,
};
