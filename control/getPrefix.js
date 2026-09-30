// control/getPrefix.js (ESM)

// Reads prefix from control/config.json (fallback to process.env.PREFIX)

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, "config.json");

export async function getStoredPrefix() {

  try {

    const raw = await fs.readFile(CONFIG_PATH, "utf8");

    const cfg = JSON.parse(raw);

    // your config may store it as "prefix"

    const p = cfg?.prefix;

    // allow null / empty => no prefix

    if (p === null) return "";

    if (typeof p === "string") return p;

    return process.env.PREFIX || "!";

  } catch {

    return process.env.PREFIX || "!";

  }

}