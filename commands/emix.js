// commands/emix.js
// Emoji Mix (Emoji Kitchen) -> Sticker
//
// Fix: Sticker was sending blank due to incompatible WebP/exif handling in some runtimes.
// This version uses `wa-sticker-formatter` when available (most compatible),
// and falls back to a sharp->webp pipeline only if needed.
//
// Usage:
//   emix 😭 😡
//   emix 😭+😡
//   emix 😭_😡
//   emix 😭😡
//
// Pack: BMEDIA-MD.POWERED BY DMEFIA

const EMOJI_KITCHEN_BASE = "https://emojik.vercel.app/s";
const SIZE = 256;

const PACK_NAME = "BMEDIA-MD.POWERED BY DMEFIA";
const PACK_PUBLISHER = "BMEDIA";

function splitEmojis(inputArgs = []) {
  const raw = String(inputArgs.join(" ") || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/[\s+_|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    const arr = Array.from(parts[0]);
    if (arr.length >= 2) return [arr[0], arr.slice(1).join("")];
  }

  return parts.slice(0, 2);
}

function emojiToCodepoint(emoji) {
  return Array.from(String(emoji || ""))
    .map((ch) => ch.codePointAt(0).toString(16))
    .join("-");
}

function buildKitchenUrl(cp1, cp2) {
  return `${EMOJI_KITCHEN_BASE}/${cp1}_${cp2}?size=${SIZE}`;
}

async function fetchImage(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": "BMEDIA-MD/EmojiMix",
      accept: "image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Emoji mix fetch failed: ${res.status} ${res.statusText || ""}`.trim());
  }

  const ctype = String(res.headers.get("content-type") || "").toLowerCase();
  if (ctype && !ctype.startsWith("image/")) {
    // Some endpoints may return HTML; fail fast with useful info
    const txt = await res.text().catch(() => "");
    throw new Error(`Emoji mix returned non-image (${ctype || "unknown"}): ${txt.slice(0, 80)}`);
  }

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (!buf.length) throw new Error("Emoji mix fetch failed: empty body");
  return buf;
}

async function makeStickerBestEffort(imgBuf) {
  // 1) Best: wa-sticker-formatter (most compatible)
  try {
    const mod = await import("wa-sticker-formatter");
    const Sticker = mod?.Sticker || mod?.default?.Sticker || mod?.default;
    const StickerTypes = mod?.StickerTypes || mod?.default?.StickerTypes;

    if (typeof Sticker === "function") {
      const sticker = new Sticker(imgBuf, {
        pack: PACK_NAME,
        author: PACK_PUBLISHER,
        type: StickerTypes?.FULL || "full",
        quality: 70,
      });

      const out = await sticker.toBuffer();
      if (Buffer.isBuffer(out) && out.length) return out;
    }
  } catch {
    // ignore, fallback
  }

  // 2) Fallback: sharp to webp (no exif, but should still display)
  const { default: sharp } = await import("sharp");
  sharp.cache(false);
  sharp.concurrency(1);

  const out = await sharp(imgBuf, { failOn: "none" })
    .resize(512, 512, { fit: "contain", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  // Validate basic webp signature
  if (out.slice(0, 4).toString("ascii") !== "RIFF" || out.slice(8, 12).toString("ascii") !== "WEBP") {
    throw new Error("Failed to build valid WebP sticker.");
  }

  return out;
}

export default {
  name: "emix",
  aliases: ["emojimix", "mixemoji", "emojikitchen"],
  category: "FUN",
  description: "Combine two emojis into an Emoji Kitchen sticker.",
  usage: "emix 😭 😡",

  async execute(ctx) {
    const { sock, m, from, args } = ctx;

    const parts = splitEmojis(args || []);
    if (parts.length < 2) {
      return sock.sendMessage(
        from,
        { text: "❌ Usage: emix 😭 😡\nExample: emix 😂+🔥" },
        { quoted: m }
      );
    }

    const e1 = parts[0];
    const e2 = parts[1];

    const cp1 = emojiToCodepoint(e1);
    const cp2 = emojiToCodepoint(e2);

    const url1 = buildKitchenUrl(cp1, cp2);
    const url2 = buildKitchenUrl(cp2, cp1);

    try {
      await sock.sendMessage(from, { react: { text: "🧑‍🍳", key: m.key } }).catch(() => {});

      let imgBuf;
      try {
        imgBuf = await fetchImage(url1);
      } catch {
        imgBuf = await fetchImage(url2);
      }

      const stickerBuf = await makeStickerBestEffort(imgBuf);

      await sock.sendMessage(from, { sticker: stickerBuf }, { quoted: m });
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
    } catch (e) {
      return sock.sendMessage(
        from,
        { text: `❌ Failed to mix emojis.\nReason: ${e?.message || e}` },
        { quoted: m }
      );
    } finally {
      try {
        if (typeof global.gc === "function") global.gc();
      } catch {}
    }
  },
};
