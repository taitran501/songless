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
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className={`text-center text-xl font-bold ${correct ? "text-green-400" : "text-red-400"}`}>
            {correct ? "🎉 Correct!" : "❌ Game Over"}
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-4">
          <p className="text-gray-300">
            {correct ? "Great job! You guessed it right!" : "Nice try! The correct answer was:"}
          </p>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">{answer}</h3>
          </div>

          {/* Emoji Grid Display */}
          <div className="bg-gray-950/60 p-4 rounded-lg border border-gray-800 inline-block mx-auto">
            <p className="text-lg tracking-widest font-mono select-all mb-1">
              {generateEmojiGrid()}
            </p>
            <p className="text-xs text-gray-500">Track #{trackIndex + 1}</p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={handleShare}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              SHARE RESULTS
            </Button>
            
            <div className="flex gap-3 justify-center w-full">
              {onBack && (
                <Button 
                  variant="outline" 
                  className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  onClick={onBack}
                >
                  ← BACK
                </Button>
              )}
              <Button onClick={onNext} className="flex-1 bg-green-600 hover:bg-green-700">
                NEXT SONG
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
