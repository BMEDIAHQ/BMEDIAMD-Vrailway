// commands/enhance_worker.mjs
import sharp from "sharp";

const [, , inputPath, outputPath, level = "normal"] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Missing input/output path.");
  process.exit(1);
}

try {
  sharp.cache(false);
  sharp.concurrency(1);

  let img = sharp(inputPath, { failOn: "none" }).rotate();
  const meta = await img.metadata();

  const width = Number(meta?.width || 0);
  const height = Number(meta?.height || 0);

  if (width > 0 && height > 0 && Math.max(width, height) < 900) {
    const factor = level === "strong" ? 1.8 : level === "soft" ? 1.25 : 1.5;
    img = img.resize({
      width: Math.round(width * factor),
      height: Math.round(height * factor),
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    });
  }

  img = img
    .normalise()
    .modulate({
      brightness: level === "strong" ? 1.06 : level === "soft" ? 1.02 : 1.04,
      saturation: level === "strong" ? 1.18 : level === "soft" ? 1.08 : 1.12,
    })
    .sharpen(
      level === "strong"
        ? { sigma: 1.2, m1: 1.6, m2: 2.4, x1: 2.0, y2: 12.0, y3: 18.0 }
        : level === "soft"
        ? { sigma: 0.9, m1: 0.8, m2: 1.3, x1: 2.0, y2: 8.0, y3: 12.0 }
        : { sigma: 1.0, m1: 1.1, m2: 1.8, x1: 2.0, y2: 10.0, y3: 14.0 }
    )
    .jpeg({
      quality: level === "strong" ? 95 : 92,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    });

  await img.toFile(outputPath);
  process.exit(0);
} catch (e) {
  console.error(e?.message || String(e));
  process.exit(1);
}
