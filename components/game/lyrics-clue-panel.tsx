"use client"

import { Quote } from "lucide-react"
import { buildLyricsClue } from "@/lib/lyrics-clues"
import type { GameTrack } from "@/lib/tracks"

interface LyricsCluePanelProps {
  track: GameTrack
  currentStage: number
  snippetIndex?: number
}

export function LyricsCluePanel({ track, currentStage, snippetIndex = 0 }: LyricsCluePanelProps) {
  const isFinalClue = currentStage >= 5

  return (
    <div data-testid="lyrics-clue-panel" className="select-text bg-[#090d16]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 ring-1 ring-white/5 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center">
          <Quote className="w-5 h-5 text-[#10b981]" />
        </div>
        <div>
          <p className="font-display text-xs font-semibold text-[#10b981] uppercase tracking-widest">Partial Lyrics Mode</p>
          <h2 className="text-white font-bold text-lg">
            {isFinalClue ? "Final clue" : `Lyric clue ${currentStage + 1} / 6`}
          </h2>
        </div>
      </div>

      <p data-testid="lyrics-clue" className="text-xl sm:text-2xl leading-relaxed text-white font-semibold">
        {buildLyricsClue(track, currentStage, snippetIndex)}
      </p>
      {isFinalClue ? (
        <div data-testid="final-clue-metadata" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <p className="text-gray-200">
            <span className="text-[#6b7280]">Artist:</span> {track.artists}
          </p>
          <p className="text-gray-200">
            <span className="text-[#6b7280]">Genre:</span> {(track.genre || "unknown").toUpperCase()}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[#6b7280] mt-4">
          Title and artist words are hidden. Each wrong guess reveals more of the clue.
        </p>
      )}
    </div>
  )
}
