// utils/cloudflarePartnerEdit.js (ESM)
// Shared Cloudflare Workers AI image-edit helper for .bf and .gf

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export function box(title, lines) {
  return [
    `╭─〔 ${title} 〕`,
    ...lines.map((x, i) => `${i === lines.length - 1 ? "╰" : "├"}◦ ${x}`),
    "",
    "> POWERED BY BMEDIA"
  ].join("\n");
}

function quotedMessage(m) {
  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });

    const err = [];
    p.stderr.on("data", c => err.push(Buffer.from(c)));
    p.on("error", reject);
    p.on("close", code => {
      if (code === 0) return resolve();
      reject(
        new Error(
          Buffer.concat(err).toString("utf8").trim() ||
          `FFmpeg exited with code ${code}`
        )
      );
    });
  });
}

function credentials() {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(process.env.CLOUDFLARE_AI_TOKEN || "").trim();

  if (!accountId || !token) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_AI_TOKEN in .env"
    );
  }

  return { accountId, token };
}

async function runCloudflare(form) {
  const { accountId, token } = credentials();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    }
  );

  const contentType = String(
    response.headers.get("content-type") || ""
  ).toLowerCase();

  if (!response.ok) {
    let details = "";
    try {
      if (contentType.includes("json")) {
        const json = await response.json();
        details =
          json?.errors?.map?.(e => e?.message || e?.code)
            ?.filter(Boolean)
            ?.join("; ") ||
          JSON.stringify(json);
      } else {
        details = await response.text();
      }
    } catch {}

    throw new Error(
      `Cloudflare AI request failed (${response.status})${
        details ? `: ${details.slice(0, 500)}` : ""
      }`
    );
  }

  if (contentType.startsWith("image/")) {
    return Buffer.from(await response.arrayBuffer());
  }

  const json = await response.json();
  const b64 =
    json?.result?.image ||
    json?.image ||
    json?.result?.data?.image ||
    json?.result?.output?.image;

  if (!b64) {
    throw new Error("Cloudflare returned no image.");
  }

  return Buffer.from(
    String(b64).includes(",") ? String(b64).split(",").pop() : String(b64),
    "base64"
  );
}

export async function createPartnerImage({
  sock,
  m,
  from,
  partnerType
}) {
  const quoted = quotedMessage(m);

  if (!quoted?.imageMessage) {
    throw new Error(
      `Reply to an image with .${partnerType === "girlfriend" ? "gf" : "bf"}`
    );
  }

  const work = fs.mkdtempSync(
    path.join(os.tmpdir(), "bmedia_partner_")
  );
  const input = path.join(work, "input.jpg");
  const resized = path.join(work, "reference.png");

  try {
    const stream = await downloadContentFromMessage(
      quoted.imageMessage,
      "image"
    );

    const original = await streamToBuffer(stream);

    if (!original?.length) {
      throw new Error("Could not download the replied image.");
    }

    fs.writeFileSync(input, original);

    await runFFmpeg([
      "-y",
      "-loglevel", "error",
      "-i", input,
      "-vf",
      "scale='min(511,iw)':'min(511,ih)':force_original_aspect_ratio=decrease",
      "-frames:v", "1",
      resized
    ]);

    const reference = fs.readFileSync(resized);

    const partner =
      partnerType === "girlfriend" ? "girlfriend" : "boyfriend";

    const prompt = [
      `Edit this photo by adding a ${partner} beside the person already in the image.`,
      `Keep the original person recognizable and preserve their face, hairstyle, skin tone, clothing, body proportions, pose, and overall identity as closely as possible.`,
      `Create a realistic, age-appropriate ${partner} who visually complements the original person naturally.`,
      `Make them look like a believable couple who suit each other well.`,
      `Match the lighting, camera angle, perspective, depth of field, shadows, color grading, and image quality of the original photo.`,
      `Place the new person naturally beside them with relaxed body language.`,
      `Do not replace, distort, beautify excessively, or alter the original person's face.`,
      `Do not add text, watermarks, borders, extra limbs, duplicated people, or unnecessary objects.`,
      `Keep the result wholesome and non-sexual.`,
      `The final image should look like one authentic photograph, not an AI collage.`
    ].join(" ");

    const form = new FormData();
    form.append("prompt", prompt);
    form.append(
      "input_image_0",
      new Blob([reference], { type: "image/png" }),
      "reference.png"
    );
    form.append("width", "1024");
    form.append("height", "1024");

    return await runCloudflare(form);
  } finally {
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {}
  }
}
