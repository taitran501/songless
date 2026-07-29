import type { GameTrack } from "@/lib/tracks"

const REVEAL_RATIOS = [0.22, 0.32, 0.44, 0.58, 0.74, 1] as const
const MIN_VISIBLE_WORDS = 8
const MIN_VISIBLE_CHARACTER_RATIO = 0.6

export interface LyricsSnippetQuality {
  visibleWordCount: number
  totalWordCount: number
  visibleCharacterRatio: number
  eligible: boolean
}

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
  return cleanWord.length > 0 && tokens.has(cleanWord)
}

function titleTokens(track: Pick<GameTrack, "name">) {
  const titleTokens = clueTokens(track.name, 2)
  return new Set(titleTokens.map((token) => token.toLowerCase()))
}

function titleAndArtistTokens(track: Pick<GameTrack, "name" | "artists">) {
  const artistTokens = clueTokens(track.artists, 1)
  return new Set([...titleTokens(track), ...artistTokens.map((token) => token.toLowerCase())])
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
  const eligibleIndices = getEligibleLyricsSnippetIndices(track)
  const candidateIndices =
    eligibleIndices.length > 0
      ? eligibleIndices
      : Array.from({ length: snippetCount }, (_, index) => index)
  const trackKey = track.challengeId || track.uri
  return candidateIndices[hashString(`${sessionSeed}:${trackKey}`) % candidateIndices.length]
}

export function maskTitleAndArtistWords(text: string, track: Pick<GameTrack, "name" | "artists">) {
  const tokens = titleAndArtistTokens(track)
  
  const words = text.split(/\s+/)
  return words.map(word => {
    if (isTargetWord(word, tokens)) {
      return word.replace(/[A-Za-z0-9\u00C0-\u1EF9]/gi, "_")
    }
    return word
  }).join(" ")
}

function usefulCharacterCount(value: string) {
  return Array.from(value.matchAll(/[\p{L}\p{N}]/gu)).length
}

export function analyzeLyricsSnippetQuality(
  track: Pick<GameTrack, "name" | "artists">,
  snippet: string
): LyricsSnippetQuality {
  const words = snippet.split(/\s+/).filter(Boolean)
  const titleWordTokens = titleTokens(track)
  const visibleWords = words.filter((word) => !isTargetWord(word, titleWordTokens))
  const totalUsefulCharacters = usefulCharacterCount(snippet)
  const visibleUsefulCharacters = visibleWords.reduce(
    (total, word) => total + usefulCharacterCount(word),
    0
  )
  const visibleCharacterRatio =
    totalUsefulCharacters === 0 ? 0 : visibleUsefulCharacters / totalUsefulCharacters

  return {
    visibleWordCount: visibleWords.length,
    totalWordCount: words.length,
    visibleCharacterRatio,
    eligible:
      visibleWords.length >= MIN_VISIBLE_WORDS &&
      visibleCharacterRatio >= MIN_VISIBLE_CHARACTER_RATIO,
  }
}

export function getEligibleLyricsSnippetIndices(track: GameTrack) {
  return (track.lyricsSnippets || [])
    .map((snippet, index) => ({ index, quality: analyzeLyricsSnippetQuality(track, snippet) }))
    .filter(({ quality }) => quality.eligible)
    .map(({ index }) => index)
}

function shuffledIndices(indices: number[], seed: string) {
  const copy = [...indices]
  let state = hashString(seed)
  const random = () => {
    state += 0x6d2b79f5
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function buildLyricsClue(track: GameTrack, stage: number, snippetIndex = 0) {
  const snippets = track.lyricsSnippets || []
  const boundedSnippetIndex =
    snippets.length > 0
      ? Math.max(0, Math.min(snippetIndex, snippets.length - 1))
      : 0
  const snippet = snippets[boundedSnippetIndex] || "No lyric clue is available for this track."
  const words = snippet.split(/\s+/).filter(Boolean)
  const boundedStage = Math.max(0, Math.min(stage, REVEAL_RATIOS.length - 1))
  const finalStage = boundedStage === REVEAL_RATIOS.length - 1
  const maskedTokens = finalStage ? titleTokens(track) : titleAndArtistTokens(track)
  const revealableIndices: number[] = []
  words.forEach((word, index) => {
    if (!isTargetWord(word, maskedTokens)) {
      revealableIndices.push(index)
    }
  })

  const ratio = REVEAL_RATIOS[boundedStage]
  const revealableCount = revealableIndices.length
  const revealCount =
    ratio === 1
      ? revealableCount
      : revealableCount === 0
        ? 0
        : Math.max(1, Math.min(revealableCount, Math.floor(revealableCount * ratio)))
  const trackKey = track.challengeId || track.uri
  const revealOrder = shuffledIndices(
    revealableIndices,
    `${trackKey}:${boundedSnippetIndex}:lyrics-reveal`
  )
  const revealedIndices = new Set(revealOrder.slice(0, revealCount))

  return words
    .map((word, index) => {
      if (isTargetWord(word, maskedTokens)) {
        return word.replace(/[a-zA-Z0-9\u00C0-\u1EF9]/g, "_")
      }

      if (revealedIndices.has(index)) {
        return word
      }

      return word.replace(/[a-zA-Z0-9\u00C0-\u1EF9]/g, "-")
    })
    .join(" ")
}
