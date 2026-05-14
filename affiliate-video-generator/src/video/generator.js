const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ffmpeg = require("fluent-ffmpeg");

let ffmpegStaticPath = null;
try {
  ffmpegStaticPath = require("ffmpeg-static");
} catch (_) {
  ffmpegStaticPath = null;
}

/**
 * Resolve the ffmpeg binary path. In a packaged Electron app the binary lives
 * inside app.asar.unpacked; in dev it can be the ffmpeg-static path or a
 * system ffmpeg.
 */
function resolveFfmpegPath() {
  let candidate = ffmpegStaticPath;
  if (candidate) {
    if (candidate.includes("app.asar")) {
      candidate = candidate.replace("app.asar", "app.asar.unpacked");
    }
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fallback to system ffmpeg (useful for dev on Linux/macOS).
  return "ffmpeg";
}

ffmpeg.setFfmpegPath(resolveFfmpegPath());

const W = 1080;
const H = 1920;
const FPS = 30;

const SEGMENT_DURATIONS = {
  intro: 3,
  front: 5,
  back: 5,
  closeup: 5,
  outro: 5,
};

const XFADE = 0.5;
const TOTAL_DURATION =
  SEGMENT_DURATIONS.intro +
  SEGMENT_DURATIONS.front +
  SEGMENT_DURATIONS.back +
  SEGMENT_DURATIONS.closeup +
  SEGMENT_DURATIONS.outro -
  4 * XFADE; // 21s

// Absolute start time of each segment in the concatenated output (xfade
// reduces each boundary by XFADE seconds). Used for ASS event timing.
const SEGMENT_STARTS = (() => {
  const starts = [0];
  let acc = 0;
  const order = ["intro", "front", "back", "closeup", "outro"];
  for (let i = 0; i < order.length - 1; i += 1) {
    acc += SEGMENT_DURATIONS[order[i]] - XFADE;
    starts.push(acc);
  }
  return Object.fromEntries(order.map((k, i) => [k, starts[i]]));
})();

/**
 * Build the per-segment filter chain that turns an input image into a
 * 1080x1920 video clip of the requested duration with a Ken Burns motion
 * and a bottom darken gradient. Text is drawn separately via libass at
 * the concat stage (no drawtext dependency).
 */
function buildSegmentFilter({ duration, zoomMode, withGradient = true }) {
  const totalFrames = Math.round(duration * FPS);

  const baseScale = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2}`;

  let zoomExpr;
  let xExpr = "iw/2-(iw/zoom/2)";
  let yExpr = "ih/2-(ih/zoom/2)";
  switch (zoomMode) {
    case "in":
      zoomExpr = `'min(1.05+on/${totalFrames}*0.10,1.20)'`;
      break;
    case "out":
      zoomExpr = `'max(1.15-on/${totalFrames}*0.10,1.00)'`;
      break;
    case "kenburns-front":
      zoomExpr = `'min(1.00+on/${totalFrames}*0.20,1.25)'`;
      break;
    case "kenburns-back":
      zoomExpr = `'min(1.00+on/${totalFrames}*0.20,1.25)'`;
      xExpr = `'iw/2-(iw/zoom/2)+sin(on/${totalFrames}*PI)*30'`;
      break;
    case "kenburns-closeup":
      zoomExpr = `'max(1.25-on/${totalFrames}*0.20,1.00)'`;
      break;
    default:
      zoomExpr = "1.0";
  }

  const zoompan = `zoompan=z=${zoomExpr}:x=${xExpr}:y=${yExpr}:d=1:s=${W}x${H}:fps=${FPS}`;
  const filters = [baseScale, zoompan];
  if (withGradient) {
    filters.push(
      `drawbox=x=0:y=ih-360:w=iw:h=360:color=black@0.40:t=fill`,
    );
  }
  filters.push(
    `fps=${FPS}`,
    `format=yuv420p`,
    `trim=duration=${duration}`,
    `setpts=PTS-STARTPTS`,
  );
  return filters.join(",");
}

/**
 * Escape a string for use inside an ASS dialogue line. Backslashes have
 * special meaning, and we must not let user input introduce ASS tags.
 */
function escapeAss(text) {
  if (text == null) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")");
}

function secondsToAssTime(sec) {
  const totalCs = Math.max(0, Math.round(sec * 100));
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

/**
 * Generate a single ASS subtitle file holding all text events (product
 * name in the front scene, then the outro name / price / Shop Now). We use
 * `\fad` inline tags for fade-in/fade-out and `\pos` for explicit placement.
 *
 * Styling: bold white, black outline (acts as the soft drop shadow per spec).
 */
function buildAssSubtitles({ productName, price }) {
  const lines = [];
  lines.push("[Script Info]");
  lines.push("ScriptType: v4.00+");
  lines.push("WrapStyle: 2");
  lines.push(`PlayResX: ${W}`);
  lines.push(`PlayResY: ${H}`);
  lines.push("ScaledBorderAndShadow: yes");
  lines.push("");

  lines.push("[V4+ Styles]");
  lines.push(
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  );
  // BorderStyle 1 = outline + drop shadow.
  // PrimaryColour &H00FFFFFF = opaque white (BGR order with leading AA).
  // OutlineColour &H00000000 = opaque black outline.
  // BackColour with alpha used as shadow color (&H80000000 = semi-transparent black).
  lines.push(
    "Style: ProductName,Inter,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,3,2,30,30,260,1",
  );
  lines.push(
    "Style: OutroName,Inter,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,3,5,30,30,0,1",
  );
  lines.push(
    "Style: OutroPrice,Inter,68,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,3,5,30,30,0,1",
  );
  lines.push(
    "Style: OutroCTA,Inter,108,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,4,5,30,30,0,1",
  );
  lines.push("");

  lines.push("[Events]");
  lines.push(
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  );

  // 1) Product name during the "front shirt" segment.
  // Hold roughly from a bit after segment start to a bit before xfade out.
  const frontStart = SEGMENT_STARTS.front + 0.2;
  const frontEnd = SEGMENT_STARTS.front + SEGMENT_DURATIONS.front - XFADE;
  if (productName) {
    lines.push(
      `Dialogue: 0,${secondsToAssTime(frontStart)},${secondsToAssTime(
        frontEnd,
      )},ProductName,,0,0,260,,{\\fad(400,400)}${escapeAss(productName)}`,
    );
  }

  // 2) Outro: product name → price → Shop Now, sequential fade-in.
  const outroStart = SEGMENT_STARTS.outro;
  const outroEnd = outroStart + SEGMENT_DURATIONS.outro;

  if (productName) {
    const t = outroStart + 0.3;
    lines.push(
      `Dialogue: 0,${secondsToAssTime(t)},${secondsToAssTime(
        outroEnd - 0.5,
      )},OutroName,,0,0,0,,{\\fad(700,500)\\pos(${W / 2},${H / 2 - 180})}${escapeAss(
        productName,
      )}`,
    );
  }
  if (price) {
    const t = outroStart + 1.3;
    lines.push(
      `Dialogue: 0,${secondsToAssTime(t)},${secondsToAssTime(
        outroEnd - 0.5,
      )},OutroPrice,,0,0,0,,{\\fad(700,500)\\pos(${W / 2},${H / 2 - 20})}${escapeAss(
        price,
      )}`,
    );
  }
  const ctaT = outroStart + 2.4;
  lines.push(
    `Dialogue: 0,${secondsToAssTime(ctaT)},${secondsToAssTime(
      outroEnd - 0.5,
    )},OutroCTA,,0,0,0,,{\\fad(700,500)\\pos(${W / 2},${H / 2 + 160})}Shop Now!`,
  );

  return lines.join("\n");
}

/**
 * Render a single segment to a temp MP4 file (no text).
 */
function renderSegment({ imagePath, duration, filterChain, outputFile }) {
  return new Promise((resolve, reject) => {
    const labelledChain = `[0:v]${filterChain}[v]`;
    ffmpeg()
      .input(imagePath)
      .inputOptions([
        "-loop 1",
        `-framerate ${FPS}`,
        `-t ${duration}`,
      ])
      .complexFilter(labelledChain, ["v"])
      .outputOptions([
        "-an",
        `-r ${FPS}`,
        "-c:v libx264",
        "-pix_fmt yuv420p",
        "-preset veryfast",
        "-crf 20",
        `-t ${duration}`,
      ])
      .save(outputFile)
      .on("end", () => resolve(outputFile))
      .on("error", (err) => reject(err));
  });
}

/**
 * Final compose pass: xfade transitions + subtitles overlay + audio.
 * `fontsdir` is escaped for ffmpeg's filter-option parser (colons in
 * Windows paths and special chars must be backslash-escaped at TWO levels:
 * once for the filter graph, again for the filter option parser).
 */
function escapeFilterPath(p) {
  // Convert backslashes to forward slashes (works on Windows for ffmpeg).
  let s = p.replace(/\\/g, "/");
  // Escape : and , (filter graph separators).
  s = s.replace(/:/g, "\\:").replace(/,/g, "\\,");
  // Escape the single quote.
  s = s.replace(/'/g, "\\'");
  return s;
}

function concatWithTransitions({
  segmentFiles,
  musicPath,
  assPath,
  fontDir,
  outputFile,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    for (const file of segmentFiles) {
      cmd.input(file);
    }
    cmd.input(musicPath).inputOptions(["-stream_loop -1"]);

    const durations = [
      SEGMENT_DURATIONS.intro,
      SEGMENT_DURATIONS.front,
      SEGMENT_DURATIONS.back,
      SEGMENT_DURATIONS.closeup,
      SEGMENT_DURATIONS.outro,
    ];
    const transitions = ["fade", "slideleft", "fade", "fade"];

    let lastLabel = "[0:v]";
    let cumulativeOffset = 0;
    const filterParts = [];
    for (let i = 0; i < segmentFiles.length - 1; i += 1) {
      const offset = cumulativeOffset + durations[i] - XFADE;
      const out = `v${i + 1}`;
      filterParts.push(
        `${lastLabel}[${i + 1}:v]xfade=transition=${transitions[i]}:duration=${XFADE}:offset=${offset.toFixed(2)}[${out}]`,
      );
      lastLabel = `[${out}]`;
      cumulativeOffset = offset;
    }

    // Apply subtitles overlay on top of the xfade result.
    const subsArg = `subtitles=filename='${escapeFilterPath(assPath)}':fontsdir='${escapeFilterPath(fontDir)}'`;
    filterParts.push(
      `${lastLabel}${subsArg},fade=t=out:st=${(TOTAL_DURATION - 1).toFixed(2)}:d=1[vfinal]`,
    );

    // Audio: trim, then fade out last 2s.
    const musicIndex = segmentFiles.length;
    filterParts.push(
      `[${musicIndex}:a]atrim=duration=${TOTAL_DURATION.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=out:st=${(TOTAL_DURATION - 2).toFixed(2)}:d=2[afinal]`,
    );

    cmd
      .complexFilter(filterParts, ["vfinal", "afinal"])
      .outputOptions([
        "-c:v libx264",
        "-pix_fmt yuv420p",
        "-preset veryfast",
        "-crf 20",
        "-c:a aac",
        "-b:a 192k",
        "-movflags +faststart",
        `-t ${TOTAL_DURATION.toFixed(2)}`,
      ])
      .on("progress", (p) => {
        if (onProgress && typeof p.percent === "number") {
          onProgress({ stage: "compose", percent: Math.min(99, p.percent) });
        }
      })
      .on("end", () => resolve(outputFile))
      .on("error", (err) => reject(err))
      .save(outputFile);
  });
}

async function generateVideo({
  frontImagePath,
  backImagePath,
  modelImagePath,
  productName,
  price,
  musicPath,
  fontDir,
  outputFile,
  onProgress,
}) {
  if (!fs.existsSync(frontImagePath))
    throw new Error("Gambar tampak depan tidak ditemukan.");
  if (!fs.existsSync(backImagePath))
    throw new Error("Gambar tampak belakang tidak ditemukan.");
  if (!fs.existsSync(modelImagePath))
    throw new Error("Foto model tidak ditemukan.");
  if (!fs.existsSync(musicPath))
    throw new Error("File musik latar tidak ditemukan.");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "avg-render-"));

  const segmentSpecs = [
    {
      name: "intro",
      image: modelImagePath,
      duration: SEGMENT_DURATIONS.intro,
      filter: buildSegmentFilter({
        duration: SEGMENT_DURATIONS.intro,
        zoomMode: "in",
        withGradient: false,
      }),
    },
    {
      name: "front",
      image: frontImagePath,
      duration: SEGMENT_DURATIONS.front,
      filter: buildSegmentFilter({
        duration: SEGMENT_DURATIONS.front,
        zoomMode: "kenburns-front",
        withGradient: true,
      }),
    },
    {
      name: "back",
      image: backImagePath,
      duration: SEGMENT_DURATIONS.back,
      filter: buildSegmentFilter({
        duration: SEGMENT_DURATIONS.back,
        zoomMode: "kenburns-back",
        withGradient: false,
      }),
    },
    {
      name: "closeup",
      image: modelImagePath,
      duration: SEGMENT_DURATIONS.closeup,
      filter: buildSegmentFilter({
        duration: SEGMENT_DURATIONS.closeup,
        zoomMode: "kenburns-closeup",
        withGradient: false,
      }),
    },
    {
      name: "outro",
      image: modelImagePath,
      duration: SEGMENT_DURATIONS.outro,
      filter: buildSegmentFilter({
        duration: SEGMENT_DURATIONS.outro,
        zoomMode: "static",
        withGradient: true,
      }),
    },
  ];

  const segmentFiles = [];
  for (let i = 0; i < segmentSpecs.length; i += 1) {
    const spec = segmentSpecs[i];
    const segFile = path.join(tmpDir, `seg-${i}-${spec.name}.mp4`);
    if (onProgress) {
      onProgress({
        stage: "segment",
        percent: Math.round((i / segmentSpecs.length) * 70),
        message: `Merender adegan ${i + 1}/${segmentSpecs.length}`,
      });
    }
    await renderSegment({
      imagePath: spec.image,
      duration: spec.duration,
      filterChain: spec.filter,
      outputFile: segFile,
    });
    segmentFiles.push(segFile);
  }

  // Write the subtitle file describing all on-screen text.
  const assPath = path.join(tmpDir, "overlay.ass");
  fs.writeFileSync(
    assPath,
    buildAssSubtitles({ productName, price }),
    "utf8",
  );

  if (onProgress) {
    onProgress({ stage: "compose", percent: 75, message: "Menggabungkan video" });
  }

  await concatWithTransitions({
    segmentFiles,
    musicPath,
    assPath,
    fontDir,
    outputFile,
    onProgress: (p) =>
      onProgress &&
      onProgress({ stage: "compose", percent: 75 + p.percent * 0.24 }),
  });

  try {
    for (const f of segmentFiles) fs.unlinkSync(f);
    fs.unlinkSync(assPath);
    fs.rmdirSync(tmpDir);
  } catch (_) {
    /* ignore */
  }

  if (onProgress) {
    onProgress({ stage: "done", percent: 100, message: "Selesai" });
  }

  return outputFile;
}

module.exports = { generateVideo, TOTAL_DURATION };
