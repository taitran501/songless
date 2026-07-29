import type { GameSessionMeta } from "@/lib/game-session"

export interface GameNavigationConfig {
  exitLabel: string
  exitRoute: "/" | "/playlist"
  replayLabel: string
  secondaryLabel: string
  secondaryRoute: "/" | "/playlist"
}

export interface GameProgressSnapshot {
  currentIndex: number
  currentStage: number
  guesses: string[]
  score: number
  correctCount: number
}

export function getGameNavigation(
  session: Pick<GameSessionMeta, "kind"> | null
): GameNavigationConfig {
  switch (session?.kind) {
    case "lyrics":
      return {
        exitLabel: "Exit to Home",
        exitRoute: "/",
        replayLabel: "PLAY ANOTHER 5",
        secondaryLabel: "HOME",
        secondaryRoute: "/",
      }
    case "daily":
      return {
        exitLabel: "Exit to Home",
        exitRoute: "/",
        replayLabel: "REPLAY DAILY",
        secondaryLabel: "HOME",
        secondaryRoute: "/",
      }
    case "genre":
      return {
        exitLabel: "Exit to Home",
        exitRoute: "/",
        replayLabel: "REPLAY GENRE",
        secondaryLabel: "HOME",
        secondaryRoute: "/",
      }
    case "playlist":
      return {
        exitLabel: "Back to Playlist Setup",
        exitRoute: "/playlist",
        replayLabel: "REPLAY PLAYLIST",
        secondaryLabel: "BACK TO PLAYLIST SETUP",
        secondaryRoute: "/playlist",
      }
    default:
      return {
        exitLabel: "Exit to Home",
        exitRoute: "/",
        replayLabel: "REPLAY",
        secondaryLabel: "HOME",
        secondaryRoute: "/",
      }
  }
}

export function hasGameProgress({
  currentIndex,
  currentStage,
  guesses,
  score,
  correctCount,
}: GameProgressSnapshot) {
  return (
    currentIndex > 0 ||
    currentStage > 0 ||
    guesses.length > 0 ||
    score > 0 ||
    correctCount > 0
  )
}
