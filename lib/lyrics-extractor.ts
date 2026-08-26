import { analyzeLyricsSnippetQuality } from "@/lib/lyrics-clues"
import type { GameTrack } from "@/lib/tracks"

/**
 * Extracts high-quality, playable lyric snippets from raw plain text lyrics.
 * Automatically identifies verse/chorus stanzas and validates word counts & quality.
 */
export function extractDynamicSnippets(
  plainLyrics: string,
  track: Pick<GameTrack, "name" | "artists">
): string[] {
  if (!plainLyrics || typeof plainLyrics !== "string" || plainLyrics.trim().length === 0) {
    return []
  }

  // 1. Normalize line endings and strip tags like [Verse], [Chorus]
  const cleaned = plainLyrics
    .replace(/\r\n/g, "\n")
    .replace(/^\[(verse|chorus|bridge|intro|outro|hook|pre-chorus|drop).*?\]\s*$/gim, "")
    .replace(/^\((verse|chorus|bridge|intro|outro|hook|pre-chorus|drop).*?\)\s*$/gim, "")
    .trim()

  // 2. Split into stanzas (paragraphs separated by blank lines)
  let stanzas = cleaned
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

  // If there are no double newlines, group lines by 3-4 lines each
  if (stanzas.length <= 1) {
    const lines = cleaned.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
    const grouped: string[] = []
    for (let i = 0; i < lines.length; i += 3) {
      grouped.push(lines.slice(i, i + 3).join(", "))
    }
    stanzas = grouped.filter((s) => s.length > 20)
  }

  // 3. Process each stanza into candidate snippets
  const candidateSnippets: { snippet: string; score: number }[] = []

  for (const stanza of stanzas) {
    const lines = stanza
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) continue

    // Take up to 2-3 lines per snippet to form a cohesive clue
    const snippetText = lines.slice(0, 3).join(", ")
    const words = snippetText.split(/\s+/).filter(Boolean)

    if (words.length < 8 || words.length > 45) continue

    // Check snippet quality against track name/artist
    const quality = analyzeLyricsSnippetQuality(track, snippetText)
    if (!quality.eligible) continue

    // Score based on ideal length (15-30 words) and character ratio
    const lengthScore = 1 - Math.abs(words.length - 22) / 25
    const score = lengthScore * 0.5 + quality.visibleCharacterRatio * 0.5

    candidateSnippets.push({ snippet: snippetText, score })
  }

  // 4. Sort by quality score and pick top 3 distinct snippets
  candidateSnippets.sort((a, b) => b.score - a.score)

  const distinctSnippets: string[] = []
  const seenPrefixes = new Set<string>()

  for (const item of candidateSnippets) {
    const prefix = item.snippet.slice(0, 20).toLowerCase()
    if (seenPrefixes.has(prefix)) continue
    seenPrefixes.add(prefix)
    distinctSnippets.push(item.snippet)
    if (distinctSnippets.length >= 3) break
  }

  return distinctSnippets
}
