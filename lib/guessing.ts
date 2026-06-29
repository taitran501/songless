import type { GameTrack } from "@/lib/tracks"

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
    .replace(/\s*\((feat|ft|featuring|with)\.?.*?\)/g, "")
    .replace(/\s*-\s*(remaster(ed)?|radio edit|single version|official audio|official music video|official video|music video|lyric video|lyrics|audio|mv).*$/g, "")
    .replace(/\s*\((remaster(ed)?|radio edit|single version|official audio|official music video|official video|music video|lyric video|lyrics|audio|mv).*?\)/g, "")
    .replace(/\b(official music video|official video|music video|lyric video|official audio|lyrics|audio|mv)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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

  if (!targetTitle || !selectedTitle) return false
  if (selectedTitle === targetTitle) return true
  if (targetTitle.length < 4) return includesTitle(selectedCombined, targetTitle)

  const minPartialLength = Math.ceil(targetTitle.length * 0.75)
  if (selectedTitle.length < minPartialLength) return false

  return selectedTitle.includes(targetTitle) || targetTitle.includes(selectedTitle)
}

export function isCorrectGuess({ guess, target, selectedUri, selectedSuggestion }: GuessInput): boolean {
  if (selectedUri && selectedUri === target.uri) return true
  if (isSelectedSuggestionMatch(target, selectedSuggestion)) return true

  const cleanGuess = normalizeGuessText(guess)
  const cleanTarget = normalizeGuessText(target.name)

  if (!cleanGuess || !cleanTarget) return false
  if (cleanGuess === cleanTarget) return true
  if (cleanGuess.length < 4) return false

  const minPartialLength = Math.ceil(cleanTarget.length * 0.6)
  if (cleanGuess.length < minPartialLength) return false

  return cleanTarget.includes(cleanGuess) || cleanGuess.includes(cleanTarget)
}
