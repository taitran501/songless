"use client"

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react"

interface Track {
  uri: string
  name: string
  duration_ms: number
  albumImage?: string | null
  preview_url?: string | null
}

interface TracksContextType {
  tracks: Track[]
  setTracks: (tracks: Track[]) => void
  clearTracks: () => void
  isLoading: boolean
}

const TracksContext = createContext<TracksContextType | undefined>(undefined)

export function TracksProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracksState] = useState<Track[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load tracks from localStorage on mount
  useEffect(() => {
    try {
      const savedTracks = localStorage.getItem("game_tracks")
      if (savedTracks) {
        const parsedTracks = JSON.parse(savedTracks)
        // Filter out legacy tracks that do not have a preview_url
        const validTracks = parsedTracks.filter((t: Track) => !!t.preview_url)
        setTracksState(validTracks)
        console.log("📦 [TracksProvider] Loaded tracks from localStorage:", validTracks.length)
      } else {
        console.log("📦 [TracksProvider] No saved tracks found in localStorage")
      }
    } catch (error) {
      console.error("📦 [TracksProvider] Error loading tracks from localStorage:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setTracks = (newTracks: Track[]) => {
    console.log("📦 [TracksProvider] Setting tracks:", newTracks.length)
    setTracksState(newTracks)
    localStorage.setItem("game_tracks", JSON.stringify(newTracks))
  }

  const clearTracks = () => {
    console.log("📦 [TracksProvider] Clearing tracks")
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