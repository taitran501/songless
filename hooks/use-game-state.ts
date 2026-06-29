"use client"

import { useEffect, useState } from "react"
import type { GameTrack } from "@/lib/tracks"

export const STAGE_DURATIONS = [500, 1000, 2000, 4000, 8000, 15000] as const

interface UseGameStateOptions {
  tracks: GameTrack[]
  tracksLoading: boolean
}

export function clearSavedGame() {
  const playlistId = localStorage.getItem("current_playlist_id") || "default"
  localStorage.removeItem(`songless_state_${playlistId}`)
  localStorage.removeItem("current_playlist_id")
  localStorage.removeItem("game_tracks")
}

export function useGameState({ tracks, tracksLoading }: UseGameStateOptions) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [guesses, setGuesses] = useState<string[]>([])

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
      JSON.stringify({ currentIndex, currentStage, guesses })
    )
  }, [currentIndex, currentStage, guesses, tracks.length, tracksLoading])

  const resetRound = () => {
    setCurrentStage(0)
    setGuesses([])
  }

  return {
    currentIndex,
    setCurrentIndex,
    currentStage,
    setCurrentStage,
    guesses,
    setGuesses,
    resetRound,
    stageDurations: STAGE_DURATIONS,
  }
}
