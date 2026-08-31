import type { GameTrack } from "@/lib/tracks"

export interface GuessSuggestionLike {
  name: string
  artists: string
  rawTitle?: string
}

export interface GuessInput {
  guess: string
  target: GameTrack
  selectedUri?: string | null
  selectedSuggestion?: {
    uri: string
    name: string
    artists: string
  } | null
}

export function normalizeGuessText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\((feat|ft|featuring|with)\.?.*?\)/g, "")
    .replace(/\s*-\s*(remaster(ed)?|radio edit|single version|official audio|official music video|official video|music video|lyric video|lyrics|audio|mv).*$/g, "")
    .replace(/\s*\((remaster(ed)?|radio edit|single version|official audio|official music video|official video|music video|lyric video|lyrics|audio|mv).*?\)/g, "")
    .replace(/\b(official music video|official video|music video|lyric video|official audio|lyrics|audio|mv)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const NON_MUSIC_SUGGESTION_TERMS = [
  "news",
  "broadcast",
  "weather",
  "press conference",
  "trailer",
  "documentary",
  "podcast",
]

const NON_CANONICAL_VARIANT_TERMS = [
  "cover",
  "karaoke",
  "live",
  "remix",
  "nonstop",
  "mashup",
  "sped up",
  "speed up",
  "slowed",
  "nightcore",
  "reaction",
]

function containsNormalizedTerm(value: string, term: string) {
  const normalizedValue = normalizeGuessText(value)
  const normalizedTerm = normalizeGuessText(term)
  if (!normalizedValue || !normalizedTerm) return false
  return ` ${normalizedValue} `.includes(` ${normalizedTerm} `)
}

export function getGuessSuggestionIdentity(suggestion: GuessSuggestionLike) {
  const name = typeof suggestion?.name === "string" ? normalizeGuessText(suggestion.name) : ""
  const artists = typeof suggestion?.artists === "string" ? normalizeGuessText(suggestion.artists) : ""
  return `${name}::${artists}`
}

export function getGuessSuggestionSourcePriority(suggestion: GuessSuggestionLike) {
  const rawTitle = typeof suggestion?.rawTitle === "string" ? suggestion.rawTitle.toLowerCase() : ""
  if (rawTitle.includes("official audio")) return 30
  if (rawTitle.includes("lyric video") || rawTitle.includes("lyrics")) return 20
  if (rawTitle.includes("official music video") || rawTitle.includes("official video")) return 10
  return 0
}

export function isRelevantGuessSuggestion(
  query: string,
  suggestion: GuessSuggestionLike
) {
  const normalizedQuery = normalizeGuessText(query)
  if (!normalizedQuery) return false

  if (
    !suggestion ||
    typeof suggestion.name !== "string" ||
    typeof suggestion.artists !== "string"
  ) {
    return false
  }

  const title = normalizeGuessText(suggestion.name)
  const artists = normalizeGuessText(suggestion.artists)
  const rawTitle = normalizeGuessText(typeof suggestion.rawTitle === "string" ? suggestion.rawTitle : "")
  const searchableText = `${title} ${artists} ${rawTitle}`.trim()
  const queryTokens = normalizedQuery.split(" ").filter(Boolean)
  const matchesQuery =
    searchableText.includes(normalizedQuery) ||
    queryTokens.every((token) => searchableText.includes(token))
  if (!matchesQuery) return false

  if (NON_MUSIC_SUGGESTION_TERMS.some((term) => containsNormalizedTerm(searchableText, term))) {
    return false
  }

  const queryHasVariantQualifier = NON_CANONICAL_VARIANT_TERMS.some((term) =>
    containsNormalizedTerm(normalizedQuery, term)
  )
  if (
    !queryHasVariantQualifier &&
    NON_CANONICAL_VARIANT_TERMS.some((term) => containsNormalizedTerm(searchableText, term))
  ) {
    return false
  }

  return true
}

export function dedupeGuessSuggestions<T extends GuessSuggestionLike>(suggestions: T[]) {
  const seen = new Set<string>()
  return suggestions.filter((suggestion) => {
    if (
      !suggestion ||
      typeof suggestion.name !== "string" ||
      typeof suggestion.artists !== "string"
    ) {
      return false
    }
    const identity = getGuessSuggestionIdentity(suggestion)
    if (!identity || seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function includesTitle(candidate: string, targetTitle: string): boolean {
  if (!candidate || !targetTitle) return false
  if (candidate === targetTitle) return true
  return candidate.split(" ").includes(targetTitle) || candidate.includes(` ${targetTitle} `)
}

function isSelectedSuggestionMatch(
  target: GameTrack,
  selectedSuggestion?: GuessInput["selectedSuggestion"]
): boolean {
  if (!selectedSuggestion) return false

  const targetTitle = normalizeGuessText(target.name)
  const selectedTitle = normalizeGuessText(selectedSuggestion.name)
  const selectedCombined = normalizeGuessText(`${selectedSuggestion.artists} ${selectedSuggestion.name}`)
  const targetArtist = normalizeGuessText(target.artists)
  const selectedArtist = normalizeGuessText(selectedSuggestion.artists)

  if (!targetTitle || !selectedTitle || !targetArtist || !selectedArtist) return false

  const targetArtistTokens = targetArtist.split(" ").filter((token) => token && token !== "the")
  const selectedArtistTokens = selectedArtist.split(" ").filter((token) => token && token !== "the")
  const selectedArtistIsSubset = selectedArtistTokens.every((token) =>
    targetArtistTokens.includes(token)
  )
  const targetArtistIsSubset = targetArtistTokens.every((token) =>
    selectedArtistTokens.includes(token)
  )
  if (
    targetArtistTokens.join(" ") !== selectedArtistTokens.join(" ") &&
    !(selectedArtistTokens.length >= 2 && selectedArtistIsSubset) &&
    !(targetArtistTokens.length >= 2 && targetArtistIsSubset)
  ) {
    return false
  }
  if (selectedTitle === targetTitle) return true
  if (targetTitle.length < 4) return includesTitle(selectedCombined, targetTitle)

  const minPartialLength = Math.ceil(targetTitle.length * 0.75)
  if (selectedTitle.length < minPartialLength) return false

  return selectedTitle.includes(targetTitle) || targetTitle.includes(selectedTitle)
}

export function isCorrectGuess({ guess, target, selectedUri, selectedSuggestion }: GuessInput): boolean {
  if (selectedUri && selectedUri === target.uri) return true
  // A selected suggestion is an explicit identity claim.  Do not fall back to
  // title-only free text when that claim is missing or mismatched; otherwise a
  // malformed suggestion (for example, one without an artist) can turn into a
  // false positive merely because its title matches.
  if (selectedSuggestion) return isSelectedSuggestionMatch(target, selectedSuggestion)

  const cleanGuess = normalizeGuessText(guess)
  const cleanTarget = normalizeGuessText(target.name)

  if (!cleanGuess || !cleanTarget) return false
  if (cleanGuess === cleanTarget) return true

  const combined = normalizeGuessText(`${target.artists} ${target.name}`)
  if (cleanGuess.length >= 4 && includesTitle(combined, cleanGuess)) return true

  return false
}
