// control/atasaHandler.js (ESM)

// ATASA auto-reply handler (chat-specific)

// - replies to ALL messages when enabled in that chat

// - ignores ONLY messages from itself

// - uses SAME request style as T3 (simple prompt only)

// - replaces ChatGPT/OpenAI mentions with ATASA/BMEDIA

// - optional: answers repo/linking questions with your repo link (but still replies to everything)

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "atasaStore.json");

const REPO_LINK = "https://github.com/ABERYUF/BMEDIA-MD";

// ---------- store helpers ----------

async function readStore() {

  try {

    const raw = await fs.readFile(STORE_PATH, "utf8");

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};

  } catch {

    return {};

  }

}

async function writeStore(data) {

  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");

}

export async function setAtasaEnabled(chatId, enabled) {

  const store = await readStore();

  store[chatId] = Boolean(enabled);

  await writeStore(store);

  return store[chatId];

}

export async function isAtasaEnabled(chatId) {

  const store = await readStore();

  return Boolean(store[chatId]);

}

// ---------- message helpers ----------

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    m?.message?.documentMessage?.caption ||

    ""

  ).trim();

}

function normalizeReply(s) {

  let out = String(s || "").trim();

  if (!out) return out;

  // Replace common brand mentions

  out = out.replace(/chat\s*gpt|chatgpt/gi, "ATASA");

  out = out.replace(/open\s*ai|openai/gi, "BMEDIA");
    
 out = out.replace(/\bgpt\s*[- ]?\s*3\s*(?:\.\s*5)?(?:\s*[- ]?\s*turbo)?\b/gi, "V1.0.0");
    
 out = out.replace(/\b(i\s*(?:am|['’]m)\s*called|my\s*name\s*is)\s*assistant\b/gi, "I'm called *ATASA*");

  // Optional: if the API says "I'm an AI model by OpenAI", reframe it:

  out = out.replace(/i am (an|a) (ai )?language model.*$/gim, "I am ATASA, created by BMEDIA.");

  return out.trim();

}

function isRepoQuestion(t) {

  const x = t.toLowerCase();

  return (

    x.includes("repository") ||

    x.includes("repo") ||

    x.includes("github") ||

    x.includes("where can i get you") ||

    x.includes("where can i find you") ||

    x.includes("how can i get you") ||

    x.includes("how can i link you") ||

    x.includes("link you")

  );

}

// ---------- main handler ----------

export async function handleAtasaAutoReply(sock, m, from, activePrefix = "") {

  try {

    if (!from) return;

    // must be enabled in this chat

    const enabled = await isAtasaEnabled(from);

    if (!enabled) return;

    // ignore bot's own messages (prevents loops)

    if (m?.key?.fromMe) return;

    const text = getText(m);

    if (!text) return;

    // (Recommended) ignore commands so it won't reply to ".atasa on"

    if (activePrefix && text.startsWith(activePrefix)) return;

    // If user asks about repo/linking, answer directly (still not blocking other messages)

    if (isRepoQuestion(text)) {

      return sock.sendMessage(from, { text: REPO_LINK }, { quoted: m });

    }

    // ✅ EXACT T3 request style: send ONLY the user's text as prompt

    const url =

      "https://eliteprotech-apis.zone.id/chatgpt?prompt=" +

      encodeURIComponent(text);

    const res = await fetch(url, { method: "GET" });

    if (!res.ok) {

      console.log("[ATASA] API HTTP error:", res.status, res.statusText);

      return; // silent fail, or you can send a small error msg if you want

    }

    const data = await res.json().catch(() => null);

    if (!data || data.success !== true) {

      console.log("[ATASA] API bad JSON:", data);

      return;

    }

    const replyRaw = data.response ? String(data.response) : "";

    const reply = normalizeReply(replyRaw);

    if (!reply) {

      console.log("[ATASA] Empty response from API:", data);

      return;

    }

    return sock.sendMessage(from, { text: `ATASA:\n\n${reply}` }, { quoted: m });

  } catch (e) {

    console.log("[ATASA] auto-reply error:", e?.message || e);

  }

}