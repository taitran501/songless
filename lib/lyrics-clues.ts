import type { GameTrack } from "@/lib/tracks"

const REVEAL_RATIOS = [0.22, 0.32, 0.44, 0.58, 0.74, 1] as const

function removeVietnameseTones(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
}

function clueTokens(value: string, minimumLength: number) {
  return removeVietnameseTones(value)
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= minimumLength)
}

function isTargetWord(word: string, tokens: Set<string>) {
  const cleanWord = removeVietnameseTones(word).replace(/[^A-Za-z0-9]/g, "").toLowerCase()
  return cleanWord.length >= 2 && tokens.has(cleanWord)
}

function targetTokens(track: Pick<GameTrack, "name" | "artists">) {
  const titleTokens = clueTokens(track.name, 2)
  const artistTokens = clueTokens(track.artists, 2)
  return new Set([...titleTokens, ...artistTokens].map((token) => token.toLowerCase()))
}

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function selectLyricsSnippetIndex(track: GameTrack, sessionSeed: string) {
  const snippetCount = track.lyricsSnippets?.length || 0
  if (snippetCount <= 1) return 0
  const trackKey = track.challengeId || track.uri
  return hashString(`${sessionSeed}:${trackKey}`) % snippetCount
}

export function maskTitleAndArtistWords(text: string, track: Pick<GameTrack, "name" | "artists">) {
  const tokens = targetTokens(track)
  
  const words = text.split(/\s+/)
  return words.map(word => {
    if (isTargetWord(word, tokens)) {
      return word.replace(/[A-Za-z0-9\u00C0-\u1EF9]/gi, "_")
    }
    return word
  }).join(" ")
}

export function buildLyricsClue(track: GameTrack, stage: number, snippetIndex = 0) {
  const snippets = track.lyricsSnippets || []
  const boundedSnippetIndex =
    snippets.length > 0
      ? Math.max(0, Math.min(snippetIndex, snippets.length - 1))
      : 0
  const snippet = snippets[boundedSnippetIndex] || "No lyric clue is available for this track."
  const tokens = targetTokens(track)
  
  const words = snippet.split(/\s+/).filter(Boolean)
  
  const revealableIndices: number[] = []
  words.forEach((word, index) => {
    if (!isTargetWord(word, tokens)) {
      revealableIndices.push(index)
    }
  })

  const boundedStage = Math.max(0, Math.min(stage, REVEAL_RATIOS.length - 1))
  const ratio = REVEAL_RATIOS[boundedStage]
  const revealableCount = revealableIndices.length
  const revealCount =
    ratio === 1
      ? revealableCount
      : Math.max(1, Math.min(revealableCount - 1, Math.floor(revealableCount * ratio)))

  let revealed = 0
  return words
    .map((word, index) => {
      if (isTargetWord(word, tokens)) {
        return word.replace(/[a-zA-Z0-9\u00C0-\u1EF9]/g, "_")
      }
      
      if (revealed < revealCount) {
        revealed++
        return word
      }
      
      return word.replace(/[a-zA-Z0-9\u00C0-\u1EF9]/g, "-")
    })
    .join(" ")
}
