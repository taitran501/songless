"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface GameModalProps {
  isOpen: boolean
  onClose: () => void
  correct: boolean
  answer: string
  onNext: () => void
  onBack?: () => void
}

export function GameModal({ isOpen, onClose, correct, answer, onNext, onBack }: GameModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className={`text-center text-xl ${correct ? "text-green-400" : "text-red-400"}`}>
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

          <div className="flex gap-3 justify-center pt-4">
            {onBack && (
              <Button 
                variant="outline" 
                className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                onClick={onBack}
              >
                ← BACK
              </Button>
            )}
            <Button onClick={onNext} className="bg-green-600 hover:bg-green-700">
              NEXT SONG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
