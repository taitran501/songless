"use client"

import { useEffect, useState } from "react"
import { clearGameSession, getGameStateStorageKey, type GameSessionMeta } from "@/lib/game-session"
import {
  appendTrackResult,
  buildTrackRunResult,
  EMPTY_GAME_STATE,
  getTrackResultId,
  parseSavedGameState,
  type TrackRunResult,
} from "@/lib/game-state"
import { updateRunStreak } from "@/lib/genre-progress"
import type { GameTrack } from "@/lib/tracks"

export const STAGE_DURATIONS = [500, 1000, 2000, 4000, 8000, 15000] as const
export const STAGE_SCORES = [100, 80, 60, 40, 25, 10] as const

interface UseGameStateOptions {
  tracks: GameTrack[]
  tracksLoading: boolean
  session: GameSessionMeta | null
}

export function clearSavedGame(session?: GameSessionMeta | null) {
  clearGameSession(localStorage, session)
}

export function useGameState({ tracks, tracksLoading, session }: UseGameStateOptions) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [guesses, setGuesses] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [solvedStageTotal, setSolvedStageTotal] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)
  const [bestRunStreak, setBestRunStreak] = useState(0)
  const [trackResults, setTrackResults] = useState<TrackRunResult[]>([])
  const [hydratedStateKey, setHydratedStateKey] = useState<string | null>(null)

  useEffect(() => {
    if (tracks.length === 0 || tracksLoading || !session) return
    const stateKey = getGameStateStorageKey(session)
    const savedState = localStorage.getItem(stateKey)
    const parsed = parseSavedGameState(
      savedState,
      tracks.length,
      tracks.map(getTrackResultId)
    )

    const nextState = parsed ?? EMPTY_GAME_STATE
    setCurrentIndex(nextState.currentIndex)
    setCurrentStage(nextState.currentStage)
    setGuesses(nextState.guesses)
    setScore(nextState.score)
    setCorrectCount(nextState.correctCount)
    setSolvedStageTotal(nextState.solvedStageTotal)
    setCurrentStreak(nextState.currentStreak)
    setBestRunStreak(nextState.bestRunStreak)
    setTrackResults(nextState.trackResults)

    if (savedState && !parsed) {
      localStorage.removeItem(stateKey)
    }
    setHydratedStateKey(stateKey)
  }, [session, tracks.length, tracksLoading])

  useEffect(() => {
    if (tracks.length === 0 || tracksLoading || !session) return
    const stateKey = getGameStateStorageKey(session)
    if (hydratedStateKey !== stateKey) return
    localStorage.setItem(
      stateKey,
      JSON.stringify({
        currentIndex,
        currentStage,
        guesses,
        score,
        correctCount,
        solvedStageTotal,
        currentStreak,
        bestRunStreak,
        trackResults,
      })
    )
  }, [
    correctCount,
    currentStreak,
    currentIndex,
    currentStage,
    guesses,
    hydratedStateKey,
    bestRunStreak,
    score,
    session,
    solvedStageTotal,
    tracks.length,
    tracksLoading,
    trackResults,
  ])

  const resetRound = () => {
    setCurrentStage(0)
    setGuesses([])
  }

  const recordCorrectGuess = (
    stage: number,
    track: GameTrack,
    roundGuesses: readonly string[]
  ) => {
    const points = STAGE_SCORES[stage] || 0
    const result = buildTrackRunResult({
      trackId: getTrackResultId(track),
      guesses: roundGuesses,
      solved: true,
      completedStage: stage,
      points,
    })
    setTrackResults((current) => appendTrackResult(current, result))
    setScore((currentScore) => currentScore + points)
    setCorrectCount((currentCount) => currentCount + 1)
    setSolvedStageTotal((currentTotal) => currentTotal + stage + 1)
    setCurrentStreak((current) => {
      const next = updateRunStreak(current, bestRunStreak, true)
      setBestRunStreak(next.bestRunStreak)
      return next.currentStreak
    })
  }

  const recordFailedTrack = (
    track: GameTrack,
    roundGuesses: readonly string[],
    stage: number
  ) => {
    const result = buildTrackRunResult({
      trackId: getTrackResultId(track),
      guesses: roundGuesses,
      solved: false,
      completedStage: stage,
      points: 0,
    })
    setTrackResults((current) => appendTrackResult(current, result))
    setCurrentStreak((current) => updateRunStreak(current, bestRunStreak, false).currentStreak)
  }

  const resetGame = () => {
    setCurrentIndex(0)
    setCurrentStage(0)
    setGuesses([])
    setScore(0)
    setCorrectCount(0)
    setSolvedStageTotal(0)
    setCurrentStreak(0)
    setBestRunStreak(0)
    setTrackResults([])
  }

  return {
    currentIndex,
    setCurrentIndex,
    currentStage,
    setCurrentStage,
    guesses,
    setGuesses,
    score,
    correctCount,
    solvedStageTotal,
    currentStreak,
    bestRunStreak,
    trackResults,
    recordCorrectGuess,
    recordFailedTrack,
    resetRound,
    resetGame,
    stageDurations: STAGE_DURATIONS,
    stageScores: STAGE_SCORES,
  }
}
