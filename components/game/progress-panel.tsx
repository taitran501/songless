"use client"

import type { GameMode } from "@/lib/tracks"

interface ProgressPanelProps {
  currentIndex: number
  totalTracks: number
  currentStage: number
  stageDurations: readonly number[]
  progress: number
  isPlaying: boolean
  score: number
  correctCount: number
  mode?: GameMode
}

export function ProgressPanel({
  currentIndex,
  totalTracks,
  currentStage,
  stageDurations,
  progress,
  isPlaying,
  score,
  correctCount,
  mode = "audio",
}: ProgressPanelProps) {
  const isLyricsMode = mode === "lyrics"
  const duration = `${(stageDurations[currentStage] / 1000).toFixed(1)}s`

  return (
    <section
      data-testid="game-hud"
      className="select-none mb-5 rounded-2xl border border-white/10 bg-[#090d16]/65 p-4 shadow-xl ring-1 ring-white/5 backdrop-blur-xl sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[120px]">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-[#10b981]">
            Track progress
          </p>
          <h2 className="font-display text-lg font-extrabold text-white">
            Track {currentIndex + 1}{" "}
            <span className="text-sm font-semibold text-[#6b7280]">of {totalTracks}</span>
          </h2>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7d8999]">Score</p>
            <p className="font-display text-base font-extrabold text-white">{score}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7d8999]">Solved</p>
            <p className="font-display text-base font-extrabold text-white">{correctCount}</p>
          </div>
          <div className="min-w-[88px] rounded-xl border border-[#10b981]/25 bg-[#10b981]/10 px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[#34d399]">
              {isLyricsMode ? "Clue" : "Clip"}
            </p>
            <p className="font-display text-base font-extrabold text-white">
              <span>{currentStage + 1} / 6</span>
              {!isLyricsMode && (
                <span className="ml-1 text-[10px] font-semibold text-[#8f9aaa]">{duration}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div
        aria-label={`${isLyricsMode ? "Clue" : "Audio"} stage ${currentStage + 1} of 6`}
        className="mt-4 grid grid-cols-6 gap-1.5"
      >
        {Array.from({ length: 6 }, (_, index) => {
          const completed = index < currentStage
          const active = index === currentStage
          const activeWidth = isLyricsMode ? 100 : Math.max(0, Math.min(100, progress))
          return (
            <div
              key={index}
              className={`h-2 overflow-hidden rounded-full border ${
                index <= currentStage
                  ? "border-[#10b981]/30 bg-[#10b981]/10"
                  : "border-white/5 bg-white/[0.03]"
              }`}
            >
              <div
                className={`h-full rounded-full bg-[#10b981] transition-[width] duration-75 ${
                  active && isPlaying ? "shadow-[0_0_12px_rgba(16,185,129,0.7)]" : ""
                }`}
                style={{ width: completed ? "100%" : active ? `${activeWidth}%` : "0%" }}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
