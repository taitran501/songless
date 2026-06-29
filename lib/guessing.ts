import type { GameTrack } from "@/lib/tracks"

export interface GuessInput {
  guess: string
  target: GameTrack
  selectedUri?: string | null
}

export function normalizeGuessText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*\((feat|ft|featuring|with)\.?.*?\)/g, "")
    .replace(/\s*-\s*(remaster(ed)?|radio edit|single version|official audio).*$/g, "")
    .replace(/\s*\((remaster(ed)?|radio edit|single version|official audio).*?\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function isCorrectGuess({ guess, target, selectedUri }: GuessInput): boolean {
  if (selectedUri && selectedUri === target.uri) return true

  const cleanGuess = normalizeGuessText(guess)
  const cleanTarget = normalizeGuessText(target.name)

  if (!cleanGuess || !cleanTarget) return false
  if (cleanGuess === cleanTarget) return true
  if (cleanGuess.length < 4) return false

  const minPartialLength = Math.ceil(cleanTarget.length * 0.6)
  if (cleanGuess.length < minPartialLength) return false

  return cleanTarget.includes(cleanGuess) || cleanGuess.includes(cleanTarget)
}
