"use client"

import { Quote } from "lucide-react"
import { buildLyricsClue } from "@/lib/lyrics-clues"
import type { GameTrack } from "@/lib/tracks"

interface LyricsCluePanelProps {
  track: GameTrack
  currentStage: number
}

export function LyricsCluePanel({ track, currentStage }: LyricsCluePanelProps) {
  return (
    <div className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 ring-1 ring-white/5 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center">
          <Quote className="w-5 h-5 text-[#10b981]" />
        </div>
        <div>
          <p className="font-display text-xs font-semibold text-[#10b981] uppercase tracking-widest">Partial Lyrics Mode</p>
          <h2 className="text-white font-bold text-lg">Lyric clue {currentStage + 1} / 6</h2>
        </div>
      </div>

      <p className="text-xl sm:text-2xl leading-relaxed text-white font-semibold">
        {buildLyricsClue(track, currentStage)}
      </p>
      <p className="text-xs text-[#6b7280] mt-4">
        Title and artist words are hidden. Each wrong guess reveals more of the clue.
      </p>
    </div>
  )
}
