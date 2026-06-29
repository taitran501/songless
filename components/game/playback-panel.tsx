"use client"

import { AlertTriangle, Loader2, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlaybackPanelProps {
  isPlayerReady: boolean
  isResolvingAudio: boolean
  playbackError: string | null
  isPlaying: boolean
  isPaused: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
}

export function PlaybackPanel({
  isPlayerReady,
  isResolvingAudio,
  playbackError,
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onResume,
}: PlaybackPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center mb-8 gap-3">
      <Button
        disabled={!isPlayerReady}
        onClick={() => {
          if (isPlaying) {
            onPause()
            return
          }
          if (isPaused) onResume()
          else onPlay()
        }}
        aria-label={isPlaying ? "Pause playback" : "Play preview"}
        className={`rounded-full w-24 h-24 flex justify-center items-center transition-all ${
          !isPlayerReady
            ? "bg-[#1f2937] text-[#6b7280] cursor-not-allowed"
            : isPlaying
              ? "bg-[#ef4444] hover:bg-[#ef4444]/90 shadow-[0_0_22px_rgba(239,68,68,0.35)]"
              : "bg-[#10b981] hover:bg-[#10b981]/90 animate-pulse-glow shadow-[0_0_22px_rgba(16,185,129,0.35)]"
        }`}
      >
        {playbackError ? (
          <AlertTriangle className="w-10 h-10 text-[#ef4444]" />
        ) : !isPlayerReady || isResolvingAudio ? (
          <Loader2 className="w-10 h-10 text-[#10b981] animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-10 h-10 text-white" />
        ) : (
          <Play className="w-10 h-10 text-black ml-2 fill-black" />
        )}
      </Button>
      {playbackError && (
        <p className="max-w-xs text-center text-sm text-[#ef4444]">
          {playbackError}
        </p>
      )}
    </div>
  )
}
