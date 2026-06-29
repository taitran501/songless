"use client"

import { Check, Loader2, Music, Search, SkipForward } from "lucide-react"
import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface GuessSuggestion {
  uri: string
  name: string
  artists: string
  albumImage: string | null
}

interface GuessPanelProps {
  guess: string
  guesses: string[]
  currentStage: number
  stageDurations: readonly number[]
  suggestions: GuessSuggestion[]
  isSearching: boolean
  showSuggestions: boolean
  searchContainerRef: RefObject<HTMLDivElement | null>
  onGuessChange: (value: string) => void
  onFocus: () => void
  onSelectSuggestion: (suggestion: GuessSuggestion) => void
  onSubmitGuess: () => void
  onSkip: () => void
}

export function GuessPanel({
  guess,
  guesses,
  currentStage,
  stageDurations,
  suggestions,
  isSearching,
  showSuggestions,
  searchContainerRef,
  onGuessChange,
  onFocus,
  onSelectSuggestion,
  onSubmitGuess,
  onSkip,
}: GuessPanelProps) {
  return (
    <>
      <div className="bg-[#090d16]/40 backdrop-blur-xl border border-white/5 rounded-2xl p-4 mb-6 space-y-2.5 ring-1 ring-white/5">
        {Array.from({ length: 6 }).map((_, index) => {
          const isCurrent = index === currentStage
          const isPast = index < currentStage
          const skipped = guesses[index] === "SKIPPED"
          return (
            <div
              key={index}
              className={`h-11 flex items-center px-4 rounded-xl border ${
                isCurrent
                  ? "border-[#10b981]/50 bg-[#10b981]/5 text-gray-200"
                  : isPast
                    ? skipped
                      ? "border-white/5 bg-[#030712]/30 text-[#6b7280] line-through"
                      : "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]"
                    : "border-white/5 text-[#374151]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] mr-3 ${
                  isCurrent
                    ? "bg-[#10b981]/20 text-[#10b981]"
                    : isPast
                      ? skipped
                        ? "bg-[#030712] text-[#6b7280]"
                        : "bg-[#ef4444]/20 text-[#ef4444]"
                      : "bg-white/5"
                }`}
              >
                {index + 1}
              </div>
              {isPast ? (
                <span>{guesses[index]}</span>
              ) : isCurrent ? (
                <span className="animate-pulse text-[#6b7280]">Listening window unlocked...</span>
              ) : (
                <span>Locked</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-4">
        <div ref={searchContainerRef} className="relative">
          <Input
            type="text"
            placeholder="Know the song? Search artist or title..."
            value={guess}
            onChange={(event) => onGuessChange(event.target.value)}
            onFocus={onFocus}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmitGuess()
            }}
            className="bg-[#030712]/80 border-white/10 text-white pl-12 h-12 rounded-xl focus-visible:ring-[#10b981]/50 focus-visible:border-[#10b981]/50"
          />
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#6b7280]" />
          {isSearching && <Loader2 className="absolute right-4 top-3.5 w-5 h-5 text-[#10b981] animate-spin" />}

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-[#090d16] border border-white/10 rounded-2xl max-h-60 overflow-y-auto divide-y divide-white/5 shadow-2xl">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.uri}
                  onClick={() => onSelectSuggestion(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center space-x-3"
                >
                  {suggestion.albumImage ? (
                    <img src={suggestion.albumImage} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 bg-[#030712] rounded-lg flex items-center justify-center">
                      <Music className="w-4 h-4 text-[#6b7280]" />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-gray-200 text-sm font-bold truncate">{suggestion.name}</p>
                    <p className="text-[#6b7280] text-xs truncate">{suggestion.artists}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showSuggestions && !isSearching && guess.trim().length > 1 && suggestions.length === 0 && (
            <div className="absolute z-50 left-0 right-0 mt-2 bg-[#090d16] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
              <p className="text-sm text-[#6b7280]">No matching songs found.</p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <Button onClick={onSkip} variant="outline" className="flex-1 bg-[#030712]/60 border-white/10 hover:bg-white/5 h-12 rounded-xl text-[#dce5d9]">
            <SkipForward className="w-4 h-4 mr-2" />
            SKIP (+{currentStage === 5 ? "0" : ((stageDurations[currentStage + 1] - stageDurations[currentStage]) / 1000).toFixed(1)}s)
          </Button>
          <Button onClick={onSubmitGuess} className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90 text-black font-bold h-12 rounded-xl" disabled={!guess.trim()}>
            <Check className="w-4 h-4 mr-2" />
            SUBMIT GUESS
          </Button>
        </div>
      </div>
    </>
  )
}
