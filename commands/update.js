// commands/update.js

import { isOwner } from "../checks/isOwner.js";

import fsp from "fs/promises";

import path from "path";

import os from "os";

import cp from "child_process";

const ROOT = process.cwd();

const CONTROL_DIR = path.join(ROOT, "control");

const STATE_PATH = path.join(CONTROL_DIR, "repo-update.json");

const STATIC_PRESERVE = new Set([

  ".env",

  "control",

  "temp",

  "tmp",

  "node_modules",

  "session",

  "sessions",

  "auth_info_baileys",

  "baileys_auth_info",

  "auth_info_bmedia",

]);

function shouldPreserve(name) {

  const n = String(name || "").trim();

  if (!n) return false;

  if (STATIC_PRESERVE.has(n)) return true;

  if (n.startsWith("auth_info")) return true;

  if (n.startsWith("session")) return true;

  if (n.includes("baileys_auth")) return true;

  if (n.includes("auth_info")) return true;

  return false;

}

function run(cmd, args, opts = {}) {

  const res = cp.spawnSync(cmd, args, {

    cwd: opts.cwd || ROOT,

    stdio: opts.stdio || "pipe",

    shell: false,

    env: process.env,

    encoding: "utf8",

  });

  if (res.status !== 0) {

    throw new Error((res.stderr || res.stdout || `${cmd} failed`).trim());

  }

  return (res.stdout || "").trim();

}

async function pathExists(p) {

  try {

    await fsp.access(p);

    return true;

  } catch {

    return false;

  }

}

async function rmSafe(p) {

  try {

    await fsp.rm(p, {

      recursive: true,

      force: true,

      maxRetries: 5,

      retryDelay: 200,

    });

  } catch {}

}

async function readState() {

  try {

    const raw = await fsp.readFile(STATE_PATH, "utf8");

    const j = JSON.parse(raw);

    return {

      currentCommit: String(j?.currentCommit || "").trim(),

      branch: String(j?.branch || "").trim(),

      repo: String(j?.repo || "").trim(),

      updatedAt: String(j?.updatedAt || "").trim(),

    };

  } catch {

    return {

      currentCommit: "",

      branch: "",

      repo: "",

      updatedAt: "",

    };

  }

}

async function writeState(state) {

  await fsp.mkdir(CONTROL_DIR, { recursive: true });

  await fsp.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");

}

async function copyDir(src, dst, opts = {}) {

  const entries = await fsp.readdir(src, { withFileTypes: true });

  await fsp.mkdir(dst, { recursive: true });

  for (const entry of entries) {

    const srcPath = path.join(src, entry.name);

    const dstPath = path.join(dst, entry.name);

    if (opts.skip && opts.skip(entry.name, srcPath, dstPath)) continue;

    if (entry.isDirectory()) {

      await copyDir(srcPath, dstPath, opts);

    } else if (entry.isSymbolicLink()) {

      const real = await fsp.readlink(srcPath);

      try {

        await fsp.symlink(real, dstPath);

      } catch {}

    } else {

      await fsp.mkdir(path.dirname(dstPath), { recursive: true });

      await fsp.copyFile(srcPath, dstPath);

    }

  }

}

async function cleanRoot() {

  const entries = await fsp.readdir(ROOT, { withFileTypes: true });

  for (const entry of entries) {

    const name = entry.name;

    if (shouldPreserve(name)) continue;

    await rmSafe(path.join(ROOT, name));

  }

}

async function installDeps() {

  const packageJson = path.join(ROOT, "package.json");

  if (!(await pathExists(packageJson))) return;

  const pnpmLock = path.join(ROOT, "pnpm-lock.yaml");

  const yarnLock = path.join(ROOT, "yarn.lock");

  const packageLock = path.join(ROOT, "package-lock.json");

  const npmShrinkwrap = path.join(ROOT, "npm-shrinkwrap.json");

  if (await pathExists(pnpmLock)) {

    run("pnpm", ["install", "--frozen-lockfile"], { stdio: "inherit" });

    return;

  }

  if (await pathExists(yarnLock)) {

    run("yarn", ["install", "--frozen-lockfile"], { stdio: "inherit" });

    return;

  }

  if ((await pathExists(packageLock)) || (await pathExists(npmShrinkwrap))) {

    run("npm", ["ci", "--omit=dev"], { stdio: "inherit" });

    return;

  }

  run("npm", ["install", "--omit=dev"], { stdio: "inherit" });

}

async function restartBot(entry = "index.js") {

  const entryAbs = path.join(ROOT, entry);

  if (typeof process.execve !== "function") {

    throw new Error(

      "This Node.js version does not support process.execve(). " +

      "Use Node 22.15.0+ or restart from the panel manually."

    );

  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  // Replace the current process in-place so Pterodactyl keeps tracking it.

  process.execve(process.execPath, [process.execPath, entryAbs], process.env);

}

export default {

  name: "update",

  aliases: ["upgrade", "pullupdate"],

  category: "OWNER",

  description: "Check repo updates and update the bot.",

  usage: "update",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const REPO_URL = String(process.env.REPO_URL || "").trim();

    const REPO_BRANCH = String(process.env.REPO_BRANCH || "main").trim();

    const REPO_ENTRY = String(process.env.REPO_ENTRY || "index.js").trim();

    if (!REPO_URL) {

      return sock.sendMessage(

        from,

        { text: "❌ REPO_URL is missing in .env" },

        { quoted: m }

      );

    }

    const tempBase = await fsp.mkdtemp(path.join(os.tmpdir(), "bmedia-update-"));

    const cloneDir = path.join(tempBase, "repo");

    try {

      await sock.sendMessage(

        from,

        { text: "🔍 Checking for updates..." },

        { quoted: m }

      );

      run("git", ["clone", "--branch", REPO_BRANCH, REPO_URL, cloneDir], {

        cwd: tempBase,

        stdio: "inherit",

      });

      const remoteHead = run("git", ["rev-parse", "HEAD"], { cwd: cloneDir });

      const state = await readState();

      let updates = 0;

      let firstSync = false;

      if (state.currentCommit) {

        try {

          updates = parseInt(

            run("git", ["rev-list", "--count", `${state.currentCommit}..HEAD`], { cwd: cloneDir }),

            10

          );

          if (!Number.isFinite(updates)) updates = 0;

        } catch {

          updates = remoteHead !== state.currentCommit ? 1 : 0;

        }

      } else {

        firstSync = true;

      }

      if (!firstSync && updates <= 0) {

        await rmSafe(tempBase);

        return sock.sendMessage(

          from,

          { text: "✅ Bot is already up to date." },

          { quoted: m }

        );

      }

      await sock.sendMessage(

        from,

        {

          text: firstSync

            ? "♻️ First update sync detected. Updating bot now..."

            : `♻️ ${updates} update(s) found. Updating bot now...`,

        },

        { quoted: m }

      );

      await rmSafe(path.join(cloneDir, ".env"));

      await cleanRoot();

      await copyDir(cloneDir, ROOT, {

        skip: (name) => name === ".git" || name === ".env",

      });

      await installDeps();

      await writeState({

        currentCommit: remoteHead,

        branch: REPO_BRANCH,

        repo: REPO_URL,

        updatedAt: new Date().toISOString(),

      });

      await rmSafe(tempBase);

      await sock.sendMessage(

        from,

        {

          text: firstSync

            ? "✅ Bot synced successfully. Restarting now..."

            : `✅ Updated successfully with ${updates} update(s). Restarting now...`,

        },

        { quoted: m }

      );

      await restartBot(REPO_ENTRY);

    } catch (e) {

      await rmSafe(tempBase);

      return sock.sendMessage(

        from,

        { text: `❌ Update failed.\n${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};
