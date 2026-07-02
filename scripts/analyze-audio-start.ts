import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { CURATED_SONG_SEEDS } from "@/lib/curated-song-seeds"
import { CURATED_TRACK_ANALYSIS, type CuratedTrackAnalysis } from "@/lib/curated-track-analysis"
import { detectAudioStart } from "@/lib/audio-start-detector"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE_DIR = path.join(ROOT, ".audio-start-cache")
const ANALYSIS_FILE = path.join(ROOT, "lib", "curated-track-analysis.ts")
const REPORT_FILE = path.join(ROOT, "audio-start-report.md")
const ANALYZER_VERSION = "audio-start-v1"
const SAMPLE_RATE = 22050
const ANALYZE_SECONDS = 90
const TOOL_PATHS = {
  ytDlp: resolveTool("yt-dlp"),
  ffmpeg: resolveTool("ffmpeg"),
}

function hasArg(name: string) {
  return process.argv.includes(name)
}

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function resolveTool(name: string) {
  const lookupCommand = process.platform === "win32" ? "where.exe" : "which"
  const result = spawnSync(lookupCommand, [name], { encoding: "utf8" })
  const found = result.stdout
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (found) return found

  if (process.platform === "win32") {
    const powershellResult = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `(Get-Command ${JSON.stringify(name)} -ErrorAction SilentlyContinue).Source`],
      { encoding: "utf8" }
    )
    const powershellFound = powershellResult.stdout
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (powershellFound) return powershellFound
  }

  return name
}

function assertTool(name: string, command: string) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8" })
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim()
  if (result.error || output.length === 0) {
    throw new Error(`${name} is required. Install ${name}, then rerun npm.cmd run analyze:audio-start.`)
  }
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 64,
  })

  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.error?.message || "unknown error"}`)
  }

  return result.stdout
}

function cachePrefix(seed: (typeof CURATED_SONG_SEEDS)[number]) {
  return `${seed.id}-${seed.videoId}`
}

function findCachedAudio(seed: (typeof CURATED_SONG_SEEDS)[number]) {
  if (!existsSync(CACHE_DIR)) return null
  const prefix = cachePrefix(seed)
  const file = readdirSync(CACHE_DIR).find((name) => name.startsWith(`${prefix}.`))
  return file ? path.join(CACHE_DIR, file) : null
}

function downloadAudio(seed: (typeof CURATED_SONG_SEEDS)[number], fresh: boolean) {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cached = fresh ? null : findCachedAudio(seed)
  if (cached) return cached

  const outputPattern = path.join(CACHE_DIR, `${cachePrefix(seed)}.%(ext)s`)
  run(TOOL_PATHS.ytDlp, [
    "--force-overwrites",
    "--no-playlist",
    "--download-sections",
    `*0-${ANALYZE_SECONDS}`,
    "-f",
    "bestaudio",
    "-o",
    outputPattern,
    `https://www.youtube.com/watch?v=${seed.videoId}`,
  ])

  const downloaded = findCachedAudio(seed)
  if (!downloaded) throw new Error(`yt-dlp did not create an audio file for ${seed.id}.`)
  return downloaded
}

function readPcmSamples(audioFile: string) {
  const result = spawnSync(
    TOOL_PATHS.ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      audioFile,
      "-t",
      String(ANALYZE_SECONDS),
      "-ac",
      "1",
      "-ar",
      String(SAMPLE_RATE),
      "-f",
      "s16le",
      "pipe:1",
    ],
    {
      cwd: ROOT,
      encoding: "buffer",
      maxBuffer: SAMPLE_RATE * ANALYZE_SECONDS * 2 + 1024 * 1024,
    }
  )

  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : String(result.stderr || "")
    throw new Error(`ffmpeg failed: ${stderr || result.error?.message || "unknown error"}`)
  }

  const buffer = result.stdout as Buffer
  const samples = new Float32Array(buffer.length / 2)
  for (let index = 0; index < samples.length; index++) {
    samples[index] = buffer.readInt16LE(index * 2) / 32768
  }
  return samples
}

function statusFromConfidence(confidence: number) {
  if (confidence >= 0.8) return "approved"
  if (confidence >= 0.55) return "needs_review"
  return "failed"
}

function mergeAnalysis(
  seedId: string,
  detection: ReturnType<typeof detectAudioStart>,
  previous?: CuratedTrackAnalysis
): CuratedTrackAnalysis {
  const manualAudioStartSeconds = previous?.manualAudioStartSeconds
  const manualReason = previous?.manualReason
  const status = manualAudioStartSeconds !== undefined ? "approved" : statusFromConfidence(detection.confidence)

  return {
    id: seedId,
    detectedAudioStartSeconds: detection.detectedAudioStartSeconds,
    ...(manualAudioStartSeconds !== undefined ? { manualAudioStartSeconds } : {}),
    ...(manualReason ? { manualReason } : {}),
    confidence: detection.confidence,
    status,
    reason: manualAudioStartSeconds !== undefined ? `Manual override: ${manualReason || "reviewed locally"}` : detection.reason,
    analyzedAt: new Date().toISOString(),
    analyzerVersion: ANALYZER_VERSION,
  }
}

function formatAnalysisFile(analysis: Record<string, CuratedTrackAnalysis>) {
  const entries = Object.values(analysis)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `  ${JSON.stringify(item.id)}: ${JSON.stringify(item, null, 2).replace(/\n/g, "\n  ")},`)
    .join("\n")

  return `import type { AudioAnalysisStatus } from "@/lib/tracks"

export interface CuratedTrackAnalysis {
  id: string
  detectedAudioStartSeconds?: number
  manualAudioStartSeconds?: number
  manualReason?: string
  confidence: number
  status: AudioAnalysisStatus
  reason: string
  analyzedAt: string
  analyzerVersion: string
}

export const CURATED_TRACK_ANALYSIS: Record<string, CuratedTrackAnalysis> = {
${entries}
}
`
}

function formatReport(analysis: Record<string, CuratedTrackAnalysis>) {
  const rows = CURATED_SONG_SEEDS.map((seed) => {
    const item = analysis[seed.id]
    const start = item.manualAudioStartSeconds ?? item.detectedAudioStartSeconds ?? 0
    const preview = `https://youtube.com/watch?v=${seed.videoId}&t=${Math.round(start)}s`
    return `| ${seed.genre} | ${seed.name} | ${seed.artists} | ${seed.sourceType} | ${start}s | ${item.confidence} | ${item.status} | [preview](${preview}) |`
  })

  return `# Audio Start Report

Generated by \`npm.cmd run analyze:audio-start\`.

| Genre | Song | Artist | Source | Start | Confidence | Status | Link |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
${rows.join("\n")}
`
}

async function main() {
  assertTool("yt-dlp", TOOL_PATHS.ytDlp)
  assertTool("ffmpeg", TOOL_PATHS.ffmpeg)

  const trackFilter = readArg("--track")
  const limitArg = readArg("--limit")
  const limit = limitArg ? Number(limitArg) : undefined
  const fresh = hasArg("--fresh")
  const noWrite = hasArg("--no-write")

  const seeds = CURATED_SONG_SEEDS.filter((seed) => !trackFilter || seed.id === trackFilter).slice(
    0,
    limit && Number.isFinite(limit) ? limit : undefined
  )

  if (seeds.length === 0) {
    throw new Error(trackFilter ? `No curated seed found for ${trackFilter}.` : "No curated seeds found.")
  }

  const nextAnalysis: Record<string, CuratedTrackAnalysis> = { ...CURATED_TRACK_ANALYSIS }

  for (const seed of seeds) {
    process.stdout.write(`Analyzing ${seed.id}... `)
    try {
      const audioFile = downloadAudio(seed, fresh)
      const samples = readPcmSamples(audioFile)
      const detection = detectAudioStart(samples, {
        sampleRate: SAMPLE_RATE,
        preferEarlyStart: seed.sourceType === "official_audio" || seed.sourceType === "lyric_video",
      })
      nextAnalysis[seed.id] = mergeAnalysis(seed.id, detection, CURATED_TRACK_ANALYSIS[seed.id])
      process.stdout.write(`${nextAnalysis[seed.id].status} at ${nextAnalysis[seed.id].detectedAudioStartSeconds}s\n`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      nextAnalysis[seed.id] = {
        id: seed.id,
        confidence: 0,
        status: "failed",
        reason: message,
        analyzedAt: new Date().toISOString(),
        analyzerVersion: ANALYZER_VERSION,
      }
      process.stdout.write(`failed: ${message.split(/\r?\n/)[0]}\n`)
    }
  }

  if (noWrite) {
    process.stdout.write(formatReport(nextAnalysis))
    return
  }

  const previous = existsSync(ANALYSIS_FILE) ? readFileSync(ANALYSIS_FILE, "utf8") : ""
  const next = formatAnalysisFile(nextAnalysis)
  if (previous !== next) writeFileSync(ANALYSIS_FILE, next)
  writeFileSync(REPORT_FILE, formatReport(nextAnalysis))
  process.stdout.write(`Wrote ${path.relative(ROOT, ANALYSIS_FILE)} and ${path.relative(ROOT, REPORT_FILE)}.\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
