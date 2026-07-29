import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getGameNavigation, hasGameProgress } from "@/lib/game-navigation"
import type { GameSessionKind } from "@/lib/game-session"

describe("game navigation", () => {
  it("routes daily, lyrics and genre sessions home", () => {
    for (const kind of ["daily", "lyrics", "genre"] satisfies GameSessionKind[]) {
      const navigation = getGameNavigation({ kind })
      assert.equal(navigation.exitLabel, "Exit to Home")
      assert.equal(navigation.exitRoute, "/")
    }
  })

  it("routes playlist sessions back to playlist setup", () => {
    const navigation = getGameNavigation({ kind: "playlist" })
    assert.equal(navigation.exitLabel, "Back to Playlist Setup")
    assert.equal(navigation.exitRoute, "/playlist")
  })

  it("only considers a run started after gameplay progress", () => {
    const empty = {
      currentIndex: 0,
      currentStage: 0,
      guesses: [],
      score: 0,
      correctCount: 0,
    }
    assert.equal(hasGameProgress(empty), false)
    assert.equal(hasGameProgress({ ...empty, currentStage: 1 }), true)
    assert.equal(hasGameProgress({ ...empty, guesses: ["SKIPPED"] }), true)
    assert.equal(hasGameProgress({ ...empty, currentIndex: 1 }), true)
    assert.equal(hasGameProgress({ ...empty, score: 100 }), true)
  })
})
