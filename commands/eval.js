// commands/eval.js (ESM) - OWNER + SUDO only (SAFE SANDBOX)

//

// Usage:

//   eval 2+2

//   eval (Math.sin(Math.PI/6) + Math.log10(1000)) * 3

//   eval 999999999999999999n * 888888888888888888n

//

// Notes:

// - This is NOT a full Node eval. It's sandboxed using `vm`.

// - Blocks dangerous tokens: require, process, import, fs, child_process, fetch, etc.

// - Designed for calculations + harmless expressions only.

import vm from "vm";

import util from "util";

import { isOwner } from "../checks/isOwner.js";

import { isSudo } from "../checks/isSudo.js";

function isPrivileged(ctx) {

  const jid =

    ctx?.senderJid ||

    ctx?.sender ||

    ctx?.participant ||

    ctx?.m?.key?.participant ||

    "";

  // Support both styles of isOwner signature

  try {

    if (typeof isOwner === "function") {

      if (isOwner(jid) === true) return true;

      if (isOwner({ senderJid: jid, sender: jid }) === true) return true;

    }

  } catch {}

  try {

    if (typeof isSudo === "function" && isSudo(jid)) return true;

  } catch {}

  return false;

}

function looksDangerous(code) {

  const s = String(code || "").toLowerCase();

  // Hard block obvious Node escape hatches / IO / networking / dynamic code gen

  const blocked = [

    "require",

    "process",

    "import",

    "export",

    "global",

    "globalthis",

    "__proto__",

    "prototype",

    "constructor",

    "function(",

    "=>", // arrow functions (often used to build escapes)

    "eval",

    "new function",

    "settimeout",

    "setinterval",

    "fs",

    "child_process",

    "spawn",

    "exec",

    "worker",

    "net",

    "tls",

    "http",

    "https",

    "fetch",

    "axios",

    "xmlhttprequest",

    "websocket",

    "buffer",

    "dgram",

    "dns",

    "os.",

    "path.",

  ];

  return blocked.some((k) => s.includes(k));

}

function buildSandbox() {

  // Only safe, computation-focused globals

  const sandbox = {

    Math,

    BigInt,

    Number,

    String,

    Boolean,

    Date,

    // Small helpers:

    abs: Math.abs,

    sin: Math.sin,

    cos: Math.cos,

    tan: Math.tan,

    asin: Math.asin,

    acos: Math.acos,

    atan: Math.atan,

    sqrt: Math.sqrt,

    pow: Math.pow,

    log: Math.log,

    log10: Math.log10,

    exp: Math.exp,

    floor: Math.floor,

    ceil: Math.ceil,

    round: Math.round,

    min: Math.min,

    max: Math.max,

    pi: Math.PI,

    e: Math.E,

  };

  // Freeze to reduce tampering

  Object.freeze(sandbox.Math);

  Object.freeze(sandbox);

  return sandbox;

}

function safeRun(expression) {

  // Wrap as expression so "2+2" returns

  const code = `"use strict";\n(${expression})`;

  const sandbox = buildSandbox();

  const context = vm.createContext(sandbox, { name: "safe-eval" });

  const script = new vm.Script(code, { filename: "eval.vm" });

  // Timeout prevents infinite loops (though loops are blocked anyway)

  return script.runInContext(context, { timeout: 300 }); // ms

}

function formatResult(x) {

  if (typeof x === "string") return x;

  if (typeof x === "number") {

    if (!Number.isFinite(x)) return String(x);

    return String(x);

  }

  if (typeof x === "bigint") return `${x.toString()}n`;

  return util.inspect(x, { depth: 2, maxArrayLength: 50 });

}

export default {

  name: "eval",

  aliases: ["calc"],

  category: "OWNER",

  description: "Owner/Sudo: safely evaluate math/expressions (sandboxed).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    if (!isPrivileged(ctx)) {

      return sock.sendMessage(from, { text: "❌ Owner/Sudo only." }, { quoted: m });

    }

    const expr = (args || []).join(" ").trim();

    if (!expr) {

      return sock.sendMessage(

        from,

        {

          text:

            "Usage:\n" +

            "eval 2+2\n" +

            "eval (Math.sin(Math.PI/6) + Math.log10(1000)) * 3\n" +

            "eval 999999999999999999n * 888888888888888888n\n" +

            "(alias: calc)",

        },

        { quoted: m }

      );

    }

    if (looksDangerous(expr)) {

      return sock.sendMessage(

        from,

        { text: "❌ Blocked. Only safe math/expressions are allowed (no require/process/import/fs/network/etc.)." },

        { quoted: m }

      );

    }

    try {

      const out = safeRun(expr);

      const text = `✅ Result:\n${formatResult(out)}`;

      return sock.sendMessage(from, { text }, { quoted: m });

    } catch (e) {

      const msg = e?.message ? String(e.message) : "Error";

      return sock.sendMessage(from, { text: `❌ Eval error:\n${msg}` }, { quoted: m });

    }

  },

};