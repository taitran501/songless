"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Share2, SkipForward, Music } from "lucide-react"
import type { GameTrack } from "@/lib/tracks"

interface GameModalProps {
  isOpen: boolean
  onClose: () => void
  correct: boolean
  track: GameTrack | null
  onNext: () => void
  onBack?: () => void
  guesses: string[]
  trackIndex: number
  pointsEarned?: number
  nextLabel?: string
}

export function GameModal({
  isOpen,
  onClose,
  correct,
  track,
  onNext,
  onBack,
  guesses = [],
  trackIndex,
  pointsEarned = 0,
  nextLabel = "NEXT SONG",
}: GameModalProps) {
  const { toast } = useToast()

  const generateEmojiGrid = () => {
    const grid: string[] = guesses.map((g, i) => {
      if (correct && i === guesses.length - 1) {
        return "🟩"
      } else if (g === "SKIPPED") {
        return "⬜"
      } else {
        return "🟥"
      }
    })
    
    // Fill remaining with unplayed blocks
    while (grid.length < 6) {
      grid.push("⬛")
    }
    
    return grid.join("")
  }

  const handleShare = () => {
    try {
      const emojis = generateEmojiGrid()
      const shareText = `SonglessUnlimited #${trackIndex + 1}\n🔊 ${emojis}\nhttps://songless.vercel.app`
      
      void navigator.clipboard.writeText(shareText)
      
      toast({
        title: "Copied to clipboard!",
        description: "You can now share your results with friends.",
      })
    } catch (error) {
      console.error("Failed to copy share text:", error)
      toast({
        title: "Copy failed",
        description: "Please copy the result manually.",
        variant: "destructive"
      })
    }
  }

  const stageDurations = [0.5, 1, 2, 4, 8, 15]
  const clipListened = correct ? `${stageDurations[guesses.length - 1]}s` : "15s"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto backdrop-blur-3xl rounded-2xl p-4 sm:p-6 border-[1.5px] text-white flex flex-col items-center select-none outline-none [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:opacity-90 ${
        correct
          ? "bg-[#090d16]/90 border-[#10b981] shadow-[0_0_25px_rgba(16,185,129,0.3),inset_0_0_15px_rgba(16,185,129,0.1)]"
          : "bg-[#090d16]/90 border-[#ef4444] shadow-[0_0_25px_rgba(239,68,68,0.3),inset_0_0_15px_rgba(239,68,68,0.1)]"
      }`}>
        {/* Header */}
        <div className="text-center mb-4 pr-8">
          <DialogTitle className={`font-sans text-2xl sm:text-3xl font-extrabold tracking-tight ${
            correct ? "text-[#10b981] drop-shadow-[0_0_20px_rgba(16,185,129,0.7)]" : "text-[#ef4444] drop-shadow-[0_0_20px_rgba(239,68,68,0.7)]"
          }`}>
            {correct ? "SOLVED! 🎉" : "GAME OVER ❌"}
          </DialogTitle>
        </div>

        {/* Album Cover */}
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-lg overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.55)] mb-4 ring-1 ring-white/20 flex items-center justify-center bg-gray-900">
          {track?.albumImage ? (
            <img alt="Album Art" className="w-full h-full object-cover animate-fade-in" src={track.albumImage} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Music className="w-16 h-16 text-indigo-400" />
            </div>
          )}
        </div>

        {/* Song Metadata */}
        <div className="text-center mb-5 w-full px-4">
          <h2 className="font-sans text-lg sm:text-xl text-white mb-1 font-bold truncate">{track?.name || "Unknown Track"}</h2>
          <p className="font-sans text-sm text-[#9ca3af] truncate">{track?.artists || "Unknown Artist"}</p>
        </div>

        {/* Stat Summary Grid */}
        <div className="w-full grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white/[0.03] rounded-lg border border-white/10 p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-[0.1em] font-semibold">Guesses Used</p>
            <p className={`text-xl font-bold ${correct ? "text-[#10b981]" : "text-[#ef4444]"}`}>
              {correct ? `${guesses.length} / 6` : "6 / 6"}
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg border border-white/10 p-3 text-center">
            <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-[0.1em] font-semibold">Clip Listened</p>
            <p className="text-xl text-white font-bold">{clipListened}</p>
          </div>
          <div className="col-span-2 bg-[#10b981]/10 rounded-lg border border-[#10b981]/25 p-3 text-center">
            <p className="text-[10px] text-[#10b981] mb-1 uppercase tracking-[0.1em] font-semibold">Points Earned</p>
            <p className="text-2xl text-white font-bold">{correct ? `+${pointsEarned}` : "+0"}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          {/* Primary Action */}
          <Button
            onClick={onNext}
            className={`w-full bg-[#10b981] hover:bg-[#10b981]/80 hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] hover:scale-[1.02] active:scale-[0.98] text-black font-bold py-5 rounded-lg shadow-lg transition-all duration-300 flex items-center justify-center gap-2`}
          >
            {nextLabel}
            <SkipForward className="w-5 h-5 fill-black text-black" />
          </Button>

          {/* Secondary Action */}
          <Button
            onClick={handleShare}
            className="w-full bg-white/[0.03] border border-white/20 text-white backdrop-blur-md font-semibold py-5 rounded-lg hover:bg-white/10 transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            SHARE RESULTS
            <span className="ml-2 font-mono text-sm tracking-tighter text-gray-400">{generateEmojiGrid()}</span>
          </Button>

          {/* Tertiary Action */}
          {onBack && (
            <button
              onClick={onBack}
              className="w-full text-[#9ca3af] hover:text-white text-xs py-2 transition-colors duration-300 active:scale-95 underline-offset-4 hover:underline text-center"
            >
              Back to Playlists
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
