import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  captureProductEvent,
  sanitizeProductEvent,
} from "../../lib/analytics"

describe("privacy-safe product analytics", () => {
  it("is a no-op without an initialized provider", () => {
    assert.equal(
      captureProductEvent({
        name: "home_viewed",
      }),
      false
    )
  })

  it("captures only allow-listed non-sensitive properties", () => {
    const captured: Array<{ name: string; properties?: Record<string, unknown> }> = []
    const unsafeEvent = {
      name: "guess_submitted",
      properties: {
        kind: "lyrics",
        playbackMode: "lyrics",
        trackNumber: 1,
        stage: 2,
        correct: false,
        title: "Secret Song",
        artist: "Secret Artist",
        guess: "raw user input",
        playlistId: "private-id",
      },
    } as const

    const sanitized = sanitizeProductEvent(unsafeEvent as never)
    captureProductEvent(unsafeEvent as never, {
      capture(name, properties) {
        captured.push({ name, properties })
      },
    })

    assert.deepEqual(sanitized.properties, {
      kind: "lyrics",
      playbackMode: "lyrics",
      trackNumber: 1,
      stage: 2,
      correct: false,
    })
    assert.deepEqual(captured, [{ name: "guess_submitted", properties: sanitized.properties }])
  })

  it("swallows provider errors", () => {
    assert.equal(
      captureProductEvent(
        { name: "home_viewed" },
        {
          capture() {
            throw new Error("offline")
          },
        }
      ),
      false
    )
  })
})
