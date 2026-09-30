// commands/asvideo.js
// Animated WhatsApp sticker -> MP4.
// Does NOT require ImageMagick.
// node-webpmux demuxes the animation into static WebP frames;
// FFmpeg converts those static frames and assembles the MP4.

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import WebP from "node-webpmux";

const quoted = m =>
  m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((x, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${x}`),
    "",
    "> POWERED BY BMEDIA"
  ].join("\n");
}

async function toBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

function shellQuote(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const cmd = `ulimit -c 0; exec ${command} ${args.map(shellQuote).join(" ")}`;
    const p = spawn("bash", ["-lc", cmd], {
      stdio: ["ignore", "ignore", "pipe"]
    });

    const err = [];
    p.stderr.on("data", c => err.push(Buffer.from(c)));
    p.on("error", reject);
    p.on("close", code => {
      if (code === 0) return resolve();
      reject(new Error(
        Buffer.concat(err).toString("utf8").trim() ||
        `${command} exited with code ${code}`
      ));
    });
  });
}

export default {
  name: "asvideo",
  aliases: ["tovid", "svideo", "s-video"],
  category: "TOOLS",
  description: "Convert an animated sticker to an MP4 video.",

  async execute({ sock, m, from }) {
    const q = quoted(m);

    if (!q?.stickerMessage) {
      return sock.sendMessage(from, {
        text: box("*ASVIDEO USAGE*", [
          "Reply to an animated sticker with: asvideo",
          "Aliases: tovid, svideo, s-video"
        ])
      }, { quoted: m });
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), "bmedia_asvideo_"));
    const output = path.join(work, "output.mp4");

    try {
      const stream = await downloadContentFromMessage(
        q.stickerMessage,
        "sticker"
      );
      const sticker = await toBuffer(stream);

      const webp = new WebP.Image();
      await webp.load(sticker);

      if (!webp.hasAnim || !webp.frames?.length) {
        return sock.sendMessage(from, {
          text: box("*ASVIDEO*", [
            "Static sticker detected.",
            "Use *simage* to convert a static sticker to an image."
          ])
        }, { quoted: m });
      }

      // Pure-JS animated WebP demux. No ImageMagick/webpmux binary needed.
      const frameBuffers = await webp.demux({
        buffers: true,
        start: 0,
        end: webp.frames.length - 1
      });

      if (!frameBuffers?.length) {
        throw new Error("No animation frames could be extracted.");
      }

      const pngFiles = [];

      // Each demuxed frame is a normal/static WebP, which this server's
      // FFmpeg decoder can handle even though it cannot decode ANIM/ANMF directly.
      for (let i = 0; i < frameBuffers.length; i++) {
        const webpPath = path.join(work, `frame_${String(i).padStart(5, "0")}.webp`);
        const pngPath = path.join(work, `frame_${String(i).padStart(5, "0")}.png`);

        fs.writeFileSync(webpPath, frameBuffers[i]);

        await run("ffmpeg", [
          "-y",
          "-loglevel", "error",
          "-i", webpPath,
          "-frames:v", "1",
          pngPath
        ]);

        pngFiles.push(pngPath);
        try { fs.unlinkSync(webpPath); } catch {}
      }

      // Preserve the sticker's per-frame delays using FFmpeg concat durations.
      const concatPath = path.join(work, "frames.txt");
      const concat = [];

      for (let i = 0; i < pngFiles.length; i++) {
        const safePath = pngFiles[i].replace(/'/g, "'\\''");
        let delayMs = Number(webp.frames[i]?.delay || 100);

        // Extremely tiny WebP delays are implementation-defined.
        if (!Number.isFinite(delayMs) || delayMs <= 10) delayMs = 100;

        concat.push(`file '${safePath}'`);
        concat.push(`duration ${(delayMs / 1000).toFixed(6)}`);
      }

      // concat demuxer needs the final frame repeated so its duration is honored.
      const lastSafe = pngFiles[pngFiles.length - 1].replace(/'/g, "'\\''");
      concat.push(`file '${lastSafe}'`);

      fs.writeFileSync(concatPath, concat.join("\n"));

      await run("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-f", "concat",
        "-safe", "0",
        "-i", concatPath,
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-movflags", "+faststart",
        "-an",
        output
      ]);

      if (!fs.existsSync(output) || fs.statSync(output).size < 100) {
        throw new Error("Video conversion produced empty output.");
      }

      const video = fs.readFileSync(output);

      return await sock.sendMessage(from, {
        video,
        mimetype: "video/mp4",
        caption: "converted by BMEDIA-MD"
      }, { quoted: m });

    } catch (e) {
      return sock.sendMessage(from, {
        text: box("*ASVIDEO ERROR*", [
          String(e?.message || e).slice(0, 700)
        ])
      }, { quoted: m });
    } finally {
      try {
        fs.rmSync(work, { recursive: true, force: true });
      } catch {}
    }
  }
};
