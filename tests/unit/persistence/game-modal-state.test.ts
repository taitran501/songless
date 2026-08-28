import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  clearSavedGameModal,
  getGameModalStorageKey,
  readSavedGameModal,
  writeSavedGameModal,
} from "@/lib/game-modal-state"

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

const session = { runId: "modal-test-run" }
const modal = {
  correct: true,
  trackId: "youtube:track-one",
  guesses: ["Track One"],
  trackIndex: 0,
  pointsEarned: 100,
}

describe("saved result modal checkpoint", () => {
  it("round-trips a modal checkpoint", () => {
    const storage = new MemoryStorage()
    writeSavedGameModal(storage, session, modal)

    assert.deepEqual(readSavedGameModal(storage, session), modal)
    assert.equal(storage.getItem(getGameModalStorageKey(session)), JSON.stringify(modal))
  })

  it("clears malformed checkpoints", () => {
    const storage = new MemoryStorage()
    storage.setItem(getGameModalStorageKey(session), "{broken")

    assert.equal(readSavedGameModal(storage, session), null)
    assert.equal(storage.getItem(getGameModalStorageKey(session)), null)
  })

  it("clears the checkpoint when the result is consumed", () => {
    const storage = new MemoryStorage()
    writeSavedGameModal(storage, session, modal)
    clearSavedGameModal(storage, session)

    assert.equal(readSavedGameModal(storage, session), null)
  })
})
