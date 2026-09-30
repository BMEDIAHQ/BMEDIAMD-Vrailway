import fs from "fs/promises";
import path from "path";

const CONTROL_DIR = path.join(process.cwd(), "control");
const CONFIG_PATH = path.join(CONTROL_DIR, "po-chatbot.json");
const MEMORY_PATH = path.join(CONTROL_DIR, "po-chatbot-memory.json");
const MAX_TURNS_PER_CHAT = 12;

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

export async function readPOChatbotConfig() {
  return readJson(CONFIG_PATH, {
    botName: "PO",
    enabledChats: {},
    updatedAt: nowIso(),
  });
}

export async function writePOChatbotConfig(config) {
  return writeJson(CONFIG_PATH, config || {
    botName: "PO",
    enabledChats: {},
    updatedAt: nowIso(),
  });
}

export async function setPOChatbotEnabled(chatJid, enabled) {
  const cfg = await readPOChatbotConfig();
  cfg.enabledChats ||= {};
  cfg.enabledChats[chatJid] ||= {};
  cfg.enabledChats[chatJid].enabled = !!enabled;
  cfg.enabledChats[chatJid].updatedAt = nowIso();
  cfg.updatedAt = nowIso();
  await writePOChatbotConfig(cfg);
  return cfg.enabledChats[chatJid];
}

export async function getPOChatbotChat(chatJid) {
  const cfg = await readPOChatbotConfig();
  return cfg.enabledChats?.[chatJid] || { enabled: false };
}

export async function readPOChatbotMemory() {
  return readJson(MEMORY_PATH, {});
}

export async function writePOChatbotMemory(memory) {
  return writeJson(MEMORY_PATH, memory || {});
}

export async function getPOChatHistory(chatJid) {
  const mem = await readPOChatbotMemory();
  const history = Array.isArray(mem?.[chatJid]) ? mem[chatJid] : [];
  return history;
}

export async function pushPOChatHistory(chatJid, role, content) {
  const mem = await readPOChatbotMemory();
  mem[chatJid] ||= [];
  mem[chatJid].push({
    role: String(role || "user"),
    content: String(content || "").trim(),
    at: nowIso(),
  });
  mem[chatJid] = mem[chatJid]
    .filter((x) => x?.content)
    .slice(-MAX_TURNS_PER_CHAT);
  await writePOChatbotMemory(mem);
  return mem[chatJid];
}

export async function clearPOChatHistory(chatJid) {
  const mem = await readPOChatbotMemory();
  if (mem[chatJid]) delete mem[chatJid];
  await writePOChatbotMemory(mem);
}
