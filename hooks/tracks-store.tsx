"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"
import type { GameTrack } from "@/lib/tracks"
import { normalizeTracks } from "@/lib/tracks"

interface TracksContextType {
  tracks: GameTrack[]
  setTracks: (tracks: GameTrack[]) => void
  clearTracks: () => void
  isLoading: boolean
}

const TracksContext = createContext<TracksContextType | undefined>(undefined)

export function TracksProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracksState] = useState<GameTrack[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load tracks from localStorage on mount
  useEffect(() => {
    try {
      const savedTracks = localStorage.getItem("game_tracks")
      if (savedTracks) {
        const parsedTracks = JSON.parse(savedTracks)
        const validTracks = normalizeTracks(parsedTracks)
        setTracksState(validTracks)
      }
    } catch (error) {
      console.error("Could not load saved tracks:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setTracks = (newTracks: GameTrack[]) => {
    const normalized = normalizeTracks(newTracks)
    setTracksState(normalized)
    localStorage.setItem("game_tracks", JSON.stringify(normalized))
  }

  const clearTracks = () => {
    setTracksState([])
    localStorage.removeItem("game_tracks")
  }

  return (
    <TracksContext.Provider value={{ tracks, setTracks, clearTracks, isLoading }}>
      {children}
    </TracksContext.Provider>
  )
}

export function useTracks() {
  const context = useContext(TracksContext)
  if (context === undefined) {
    throw new Error("useTracks must be used within a TracksProvider")
  }
  return context
}
