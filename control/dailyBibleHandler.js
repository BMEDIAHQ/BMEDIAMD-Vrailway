// control/dailyBibleHandler.js
// BMEDIA-MD — Daily Bible scheduler + Bible API helper.
// Uses TIMEZONE from .env at runtime.
// No external npm dependency. No Groq dependency.

import fs from "fs";
import path from "path";
import https from "https";

const CONTROL_DIR = path.join(process.cwd(), "control");
const STORE_FILE = path.join(CONTROL_DIR, "daily-bible.json");
const BIBLE_API = "https://apis.davidcyril.name.ng/bible?reference=";

let schedulerStarted = false;
let schedulerSock = null;
let schedulerTimer = null;

function clean(value = "") {
  return String(value || "").trim();
}

function getEnvTimezone() {
  const requested = clean(process.env.TIMEZONE) || "Africa/Douala";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: requested }).format(new Date());
    return requested;
  } catch {
    return "Africa/Douala";
  }
}

function getEnvDefaultTime() {
  return normalizeTime(process.env.DAILY_BIBLE_TIME || "07:00") || "07:00";
}

function ensureStore() {
  if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify({ users: {}, updatedAt: Date.now() }, null, 2) + "\n",
      "utf8"
    );
  }
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8") || "{}");
    if (!parsed.users || typeof parsed.users !== "object") parsed.users = {};
    return parsed;
  } catch {
    return { users: {}, updatedAt: Date.now() };
  }
}

function writeStore(data) {
  ensureStore();
  data.updatedAt = Date.now();
  const tmp = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, STORE_FILE);
}

function cleanNumber(value = "") {
  return String(value || "").replace(/[^\d]/g, "");
}

function toPhoneJid(value = "") {
  const raw = clean(value);
  if (!raw) return "";

  if (raw.endsWith("@s.whatsapp.net")) {
    const num = cleanNumber(raw.split("@")[0].split(":")[0]);
    return num ? `${num}@s.whatsapp.net` : "";
  }

  if (raw.includes("@lid")) return "";

  if (raw.includes("@")) {
    const num = cleanNumber(raw.split("@")[0].split(":")[0]);
    return num ? `${num}@s.whatsapp.net` : "";
  }

  const num = cleanNumber(raw);
  return num ? `${num}@s.whatsapp.net` : "";
}

export function getBibleUserJid(m = {}, senderJid = "") {
  return (
    toPhoneJid(senderJid) ||
    toPhoneJid(m?.key?.participantPn) ||
    toPhoneJid(m?.key?.participantAlt) ||
    toPhoneJid(m?.participantPn) ||
    toPhoneJid(m?.participantAlt) ||
    toPhoneJid(m?.key?.remoteJidAlt) ||
    toPhoneJid(m?.key?.remoteJid) ||
    ""
  );
}

export function normalizeTime(value = "") {
  const text = clean(value);
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return "";
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

export function getBibleTimezone() {
  return getEnvTimezone();
}

export function getBibleDefaultTime() {
  return getEnvDefaultTime();
}

export function getDateParts(timezone = getEnvTimezone(), date = new Date()) {
  const tz = clean(timezone) || getEnvTimezone();

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type) => parts.find((p) => p.type === type)?.value || "";

    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      time: `${get("hour")}:${get("minute")}`,
      timezone: tz,
    };
  } catch {
    const fallback = "Africa/Douala";
    if (tz !== fallback) return getDateParts(fallback, date);
    throw new Error(`Invalid TIMEZONE: ${tz}`);
  }
}

function httpsGetJson(urlString) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      urlString,
      {
        headers: {
          accept: "application/json",
          "user-agent": "BMEDIA-MD/Bible",
        },
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(body);
          } catch {}

          if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
            return reject(new Error(data?.message || `Bible API HTTP ${res.statusCode}`));
          }

          if (!data) return reject(new Error("Bible API returned invalid JSON."));
          resolve(data);
        });
      }
    );

    req.setTimeout(15000, () => {
      req.destroy(new Error("Bible API request timed out."));
    });

    req.on("error", reject);
  });
}

export function normalizeBibleReference(input = "") {
  return clean(input)
    .replace(/[()]/g, "")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchBibleReference(reference) {
  const normalized = normalizeBibleReference(reference);
  if (!normalized) throw new Error("Bible reference is empty.");

  const url = BIBLE_API + encodeURIComponent(normalized.replace(/ /g, "+"));
  const data = await httpsGetJson(url);

  if (!data?.success) {
    throw new Error(data?.message || "Bible reference was not found.");
  }

  return {
    reference: clean(data.reference) || normalized,
    translation: clean(data.translation) || "Bible",
    versesCount: Number.isFinite(data.verses_count) ? data.verses_count : null,
    text: clean(data.text),
  };
}

// Curated references only. Verse text itself is fetched from the Bible API.
const DAILY_REFERENCES = [
  "Psalm 23:1", "Proverbs 3:5-6", "John 3:16", "Philippians 4:13",
  "Jeremiah 29:11", "Romans 8:28", "Isaiah 41:10", "Psalm 46:1",
  "Matthew 11:28", "Joshua 1:9", "Psalm 34:8", "Romans 12:2",
  "2 Corinthians 5:7", "Galatians 6:9", "Psalm 37:5", "John 14:6",
  "Hebrews 11:1", "James 1:5", "1 Peter 5:7", "Psalm 121:1-2",
  "Matthew 6:33", "Romans 5:8", "Isaiah 40:31", "Psalm 119:105",
  "Proverbs 18:10", "John 16:33", "Romans 15:13", "Ephesians 2:8-9",
  "Colossians 3:23", "1 Thessalonians 5:16-18", "Psalm 27:1",
  "Proverbs 16:3", "Matthew 5:16", "Luke 1:37", "John 8:12",
  "Romans 10:9", "1 Corinthians 10:13", "2 Corinthians 12:9",
  "Ephesians 6:10", "Philippians 4:6-7", "Colossians 3:2",
  "2 Timothy 1:7", "Hebrews 13:8", "James 1:22", "1 John 4:19",
  "Psalm 91:1-2", "Psalm 103:2", "Proverbs 4:23", "Isaiah 43:2",
  "Matthew 7:7", "Matthew 19:26", "John 10:10", "John 15:5",
  "Romans 1:16", "Romans 8:31", "1 Corinthians 13:13", "Galatians 5:22-23",
  "Ephesians 3:20", "Philippians 1:6", "Hebrews 4:12", "Revelation 21:4"
];

function dailyIndex(dateString) {
  let hash = 0;
  for (const ch of String(dateString || "")) {
    hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
  }
  return hash % DAILY_REFERENCES.length;
}

export async function generateDailyBibleVerse({ timezone } = {}) {
  const tz = clean(timezone) || getEnvTimezone();
  const current = getDateParts(tz);
  const reference = DAILY_REFERENCES[dailyIndex(current.date)];
  const verse = await fetchBibleReference(reference);

  const countLabel = verse.versesCount !== null
    ? ` • ${verse.versesCount} verse${verse.versesCount === 1 ? "" : "s"}`
    : "";

  return [
    "╭─〔 *DAILY BIBLE* 〕",
    `├◦ 📖 *${verse.reference}*`,
    `╰◦ _${verse.translation}_${countLabel}`,
    "",
    verse.text || "No verse text returned.",
    "",
    `Date: ${current.date}`,
    `Timezone: ${current.timezone}`,
    "",
    "> POWERED BY BMEDIA",
  ].join("\n");
}

export function enableDailyBible(jid, options = {}) {
  const userJid = toPhoneJid(jid);
  if (!userJid) throw new Error("Invalid user JID.");

  const store = readStore();
  const old = store.users[userJid] || {};
  const envTimezone = getEnvTimezone();

  store.users[userJid] = {
    ...old,
    jid: userJid,
    enabled: true,
    time: normalizeTime(options.time) || normalizeTime(old.time) || getEnvDefaultTime(),
    timezone: envTimezone,
    lastSentDate: old.lastSentDate || "",
    enabledAt: old.enabledAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStore(store);
  return store.users[userJid];
}

export function disableDailyBible(jid) {
  const userJid = toPhoneJid(jid);
  if (!userJid) throw new Error("Invalid user JID.");

  const store = readStore();
  const old = store.users[userJid] || {};

  store.users[userJid] = {
    ...old,
    jid: userJid,
    enabled: false,
    timezone: getEnvTimezone(),
    updatedAt: new Date().toISOString(),
  };

  writeStore(store);
  return store.users[userJid];
}

export function setDailyBibleTime(jid, time) {
  const userJid = toPhoneJid(jid);
  if (!userJid) throw new Error("Invalid user JID.");

  const normalized = normalizeTime(time);
  if (!normalized) throw new Error("Invalid time. Use HH:mm format, example: 07:00");

  const store = readStore();
  const old = store.users[userJid] || {};

  store.users[userJid] = {
    ...old,
    jid: userJid,
    enabled: old.enabled !== false,
    time: normalized,
    timezone: getEnvTimezone(),
    lastSentDate: old.lastSentDate || "",
    enabledAt: old.enabledAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeStore(store);
  return store.users[userJid];
}

export function getDailyBibleStatus(jid) {
  const userJid = toPhoneJid(jid);
  if (!userJid) return null;

  const store = readStore();
  const user = store.users[userJid] || null;
  if (!user) return null;

  return {
    ...user,
    timezone: getEnvTimezone(),
  };
}

export function getDailyBibleAllUsers() {
  const store = readStore();
  const envTimezone = getEnvTimezone();
  return Object.values(store.users || {}).map((user) => ({
    ...user,
    timezone: envTimezone,
  }));
}

async function sendDailyVerseToUser(sock, user) {
  const msg = await generateDailyBibleVerse({ timezone: getEnvTimezone() });
  await sock.sendMessage(user.jid, { text: msg });
}

export async function schedulerTick() {
  if (!schedulerSock) return false;

  const store = readStore();
  const envTimezone = getEnvTimezone();
  const defaultTime = getEnvDefaultTime();
  const current = getDateParts(envTimezone);
  let changed = false;

  for (const [jid, user] of Object.entries(store.users || {})) {
    try {
      if (!user?.enabled) continue;

      const targetTime = normalizeTime(user.time) || defaultTime;

      // The scheduler checks several times per minute; this minute equality is reliable
      // while still preventing late sends hours after the selected time.
      if (current.time !== targetTime) continue;
      if (user.lastSentDate === current.date) continue;

      await sendDailyVerseToUser(schedulerSock, user);

      store.users[jid] = {
        ...user,
        timezone: envTimezone,
        lastSentDate: current.date,
        lastSentAt: new Date().toISOString(),
        lastError: "",
        updatedAt: new Date().toISOString(),
      };
      changed = true;
    } catch (error) {
      store.users[jid] = {
        ...user,
        timezone: envTimezone,
        lastError: error?.message || String(error),
        lastErrorAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      changed = true;
    }
  }

  if (changed) writeStore(store);
  return changed;
}

export function startDailyBibleScheduler(sock) {
  if (sock) schedulerSock = sock;
  if (!schedulerSock) return false;

  if (schedulerStarted) return true;
  schedulerStarted = true;
  ensureStore();

  // 20 seconds makes missing the selected minute very unlikely.
  schedulerTimer = setInterval(() => {
    schedulerTick().catch((error) => {
      console.error("[dailyBible] scheduler tick failed:", error?.message || error);
    });
  }, 20 * 1000);

  try { schedulerTimer.unref?.(); } catch {}

  setTimeout(() => {
    schedulerTick().catch((error) => {
      console.error("[dailyBible] initial tick failed:", error?.message || error);
    });
  }, 3000).unref?.();

  console.log(
    `[dailyBible] scheduler started | timezone=${getEnvTimezone()} | default=${getEnvDefaultTime()}`
  );

  return true;
}

// Kept for compatibility. It now also ensures the scheduler is running.
export function attachBibleSock(sock) {
  schedulerSock = sock;
  return startDailyBibleScheduler(sock);
}
