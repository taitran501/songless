"use client"

import { useEffect, useState } from "react"
import { DAILY_DATE_STORAGE_KEY, GAME_MODE_STORAGE_KEY } from "@/lib/curated-tracks"
import type { GameTrack } from "@/lib/tracks"

export const STAGE_DURATIONS = [500, 1000, 2000, 4000, 8000, 15000] as const
export const STAGE_SCORES = [100, 80, 60, 40, 25, 10] as const

interface UseGameStateOptions {
  tracks: GameTrack[]
  tracksLoading: boolean
}

export function clearSavedGame() {
  const playlistId = localStorage.getItem("current_playlist_id") || "default"
  localStorage.removeItem(`songless_state_${playlistId}`)
  localStorage.removeItem("current_playlist_id")
  localStorage.removeItem("game_tracks")
  localStorage.removeItem(GAME_MODE_STORAGE_KEY)
  localStorage.removeItem(DAILY_DATE_STORAGE_KEY)
}

export function useGameState({ tracks, tracksLoading }: UseGameStateOptions) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [guesses, setGuesses] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [solvedStageTotal, setSolvedStageTotal] = useState(0)

  useEffect(() => {
    if (tracks.length === 0 || tracksLoading) return
    const playlistId = localStorage.getItem("current_playlist_id") || "default"
    const savedState = localStorage.getItem(`songless_state_${playlistId}`)
    if (!savedState) return

    try {
      const parsed = JSON.parse(savedState)
      if (parsed.currentIndex < tracks.length) {
        setCurrentIndex(parsed.currentIndex)
        setCurrentStage(parsed.currentStage)
        setGuesses(parsed.guesses || [])
        setScore(parsed.score || 0)
        setCorrectCount(parsed.correctCount || 0)
        setSolvedStageTotal(parsed.solvedStageTotal || 0)
      }
    } catch {
      localStorage.removeItem(`songless_state_${playlistId}`)
    }
  }, [tracks, tracksLoading])

  useEffect(() => {
    if (tracks.length === 0 || tracksLoading) return
    const playlistId = localStorage.getItem("current_playlist_id") || "default"
    localStorage.setItem(
      `songless_state_${playlistId}`,
      JSON.stringify({ currentIndex, currentStage, guesses, score, correctCount, solvedStageTotal })
    )
  }, [correctCount, currentIndex, currentStage, guesses, score, solvedStageTotal, tracks.length, tracksLoading])

  const resetRound = () => {
    setCurrentStage(0)
    setGuesses([])
  }

  const recordCorrectGuess = (stage: number) => {
    setScore((currentScore) => currentScore + (STAGE_SCORES[stage] || 0))
    setCorrectCount((currentCount) => currentCount + 1)
    setSolvedStageTotal((currentTotal) => currentTotal + stage + 1)
  }

  const resetGame = () => {
    setCurrentIndex(0)
    setCurrentStage(0)
    setGuesses([])
    setScore(0)
    setCorrectCount(0)
    setSolvedStageTotal(0)
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
    recordCorrectGuess,
    resetRound,
    resetGame,
    stageDurations: STAGE_DURATIONS,
    stageScores: STAGE_SCORES,
  }
}
