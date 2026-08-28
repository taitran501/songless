"use client"

import { AlertTriangle, Loader2, Pause, Play, RotateCcw, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlaybackPanelProps {
  progress: number
  isPlayerReady: boolean
  isResolvingAudio: boolean
  loadingStep: string | null
  playbackError: string | null
  canRetryAudio: boolean
  isRetryingAudio: boolean
  isPlaying: boolean
  isPaused: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onRetry: () => void | Promise<void>
}

export function PlaybackPanel({
  progress,
  isPlayerReady,
  isResolvingAudio,
  loadingStep,
  playbackError,
  canRetryAudio,
  isRetryingAudio,
  isPlaying,
  isPaused,
  onPlay,
  onPause,
  onResume,
  onRetry,
}: PlaybackPanelProps) {
  const isLoading = !isPlayerReady && !playbackError
  const hasFinished = progress >= 100 && !isPlaying
  const playLabel = isPlaying
    ? "Pause playback"
    : isPaused
      ? "Resume clip"
      : hasFinished
        ? "Replay clip"
        : "Play preview"

  // Determine current step label and progress (0–3 steps)
  const steps = [
    { label: "Searching audio source", done: !isResolvingAudio && !!loadingStep },
    { label: "Loading YouTube player", done: !isLoading },
    { label: "Ready to play",          done: isPlayerReady },
  ]
  const stepIndex = isResolvingAudio ? 0 : loadingStep ? 1 : isLoading ? 2 : 3
  const stepFraction = Math.min(stepIndex / 3, 1)

  return (
    <div className="flex flex-col items-center justify-center mb-8 gap-4">
      {/* Play / Pause button */}
      <Button
        data-testid="audio-play-button"
        disabled={!isPlayerReady}
        onClick={() => {
          if (isPlaying) { onPause(); return }
          if (isPaused) onResume()
          else onPlay()
        }}
        aria-label={playLabel}
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
        ) : isLoading ? (
          <Loader2 className="w-10 h-10 text-[#10b981] animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-10 h-10 text-white" />
        ) : (
          <Play className="w-10 h-10 text-black ml-2 fill-black" />
        )}
      </Button>

      <p
        data-testid="audio-playback-status"
        role="status"
        aria-live="polite"
        className="text-center text-xs uppercase tracking-wider text-[#9ca3af]"
      >
        {isLoading
          ? "Preparing audio..."
          : isPlaying
            ? "Playing clip"
            : isPaused
              ? "Clip paused"
              : hasFinished
                ? "Clip finished · replay available"
                : "Clip ready · press play"}
      </p>

      {/* Loading progress card — only shown while loading */}
      {isLoading && !playbackError && (
        <div
          data-testid="audio-loading-status"
          role="status"
          aria-live="polite"
          className="w-full max-w-sm bg-[#090d16]/70 border border-white/8 rounded-2xl px-5 py-4 flex flex-col gap-3 shadow-xl ring-1 ring-white/5"
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-display">
              {loadingStep ?? "Preparing audio..."}
            </span>
          </div>

          {/* Step indicators */}
          <div className="flex flex-col gap-1.5">
            {steps.map((step, i) => {
              const active = i === stepIndex
              const done = step.done
              return (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                    done
                      ? "bg-[#10b981]"
                      : active
                        ? "bg-[#10b981] animate-pulse"
                        : "bg-white/10"
                  }`} />
                  <span className={`text-[11px] transition-colors ${
                    done
                      ? "text-[#10b981]"
                      : active
                        ? "text-gray-200"
                        : "text-gray-600"
                  }`}>
                    {step.label}
                  </span>
                  {active && (
                    <Loader2 className="w-3 h-3 text-[#10b981] animate-spin ml-auto" />
                  )}
                  {done && (
                    <span className="ml-auto text-[10px] text-[#10b981]">✓</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Animated progress bar */}
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#10b981] transition-all duration-700"
              style={{ width: `${stepFraction * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {(playbackError || isRetryingAudio) && (
        <div className="flex flex-col items-center gap-3">
          <p
            data-testid="audio-error"
            role={playbackError ? "alert" : "status"}
            aria-live={playbackError ? "assertive" : "polite"}
            className="max-w-xs text-center text-sm text-[#ef4444]"
          >
            {playbackError ?? "Searching for a verified fallback audio source..."}
          </p>
          {(canRetryAudio || isRetryingAudio) && (
            <Button
              type="button"
              data-testid="audio-retry"
              onClick={() => void onRetry()}
              disabled={isRetryingAudio}
              aria-busy={isRetryingAudio}
              variant="outline"
              className="h-10 rounded-xl border-[#ef4444]/40 bg-[#ef4444]/10 px-5 text-sm font-semibold text-[#fecaca] hover:bg-[#ef4444]/20"
            >
              {isRetryingAudio ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              {isRetryingAudio ? "RETRYING AUDIO..." : "RETRY AUDIO"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
