"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Share2 } from "lucide-react"

interface GameModalProps {
  isOpen: boolean
  onClose: () => void
  correct: boolean
  answer: string
  onNext: () => void
  onBack?: () => void
  guesses: string[]
  trackIndex: number
}

export function GameModal({ 
  isOpen, 
  onClose, 
  correct, 
  answer, 
  onNext, 
  onBack, 
  guesses = [], 
  trackIndex 
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
    
    return grid.join(" ")
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0b1527]/95 backdrop-blur-xl border border-white/10 text-white max-w-md rounded-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] p-6">
        <DialogHeader>
          <DialogTitle className={`text-center text-2xl font-extrabold tracking-tight ${correct ? "text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.2)]" : "text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.2)]"}`}>
            {correct ? "🎉 Correct!" : "❌ Game Over"}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-5 pt-2">
          <p className="text-gray-400 text-sm">
            {correct ? "Great job! You guessed it right!" : "Nice try! The correct answer was:"}
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-xl font-bold tracking-tight text-white leading-snug">{answer}</h3>
          </div>

          {/* Emoji Grid Display */}
          <div className="bg-gray-950/60 p-4 rounded-xl border border-white/5 inline-block mx-auto">
            <p className="text-xl tracking-widest font-mono select-all mb-1.5 animate-fade-in">
              {generateEmojiGrid()}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Track #{trackIndex + 1}</p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button 
              onClick={handleShare}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all"
            >
              <Share2 className="w-4 h-4" />
              SHARE RESULTS
            </Button>
            
            <div className="flex gap-3 justify-center w-full">
              {onBack && (
                <Button 
                  variant="outline" 
                  className="flex-1 bg-transparent border border-white/10 text-gray-300 hover:bg-white/5 hover:text-white h-12 rounded-xl font-bold transition-all active:scale-[0.98]"
                  onClick={onBack}
                >
                  ← BACK
                </Button>
              )}
              <Button 
                onClick={onNext} 
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold h-12 rounded-xl transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
              >
                NEXT SONG
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
