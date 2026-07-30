import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildRunShareText,
  buildShareText,
  copyShareText,
  resolveShareUrl,
} from "../../lib/sharing"

describe("result sharing", () => {
  it("uses the configured URL or falls back to the current origin", () => {
    assert.equal(resolveShareUrl("https://songless.example/", "http://localhost:3100"), "https://songless.example")
    assert.equal(resolveShareUrl(undefined, "http://localhost:3100/"), "http://localhost:3100")
  })

  it("builds deterministic share text", () => {
    assert.equal(
      buildShareText({
        correct: true,
        guesses: ["wrong", "answer"],
        trackIndex: 0,
        mode: "lyrics",
        dailyDate: null,
        score: 80,
        appUrl: "http://localhost:3100",
      }),
      "SonglessUnlimited Lyrics #1\nScore: 80\n📝 🟥🟩⬛⬛⬛⬛\nhttp://localhost:3100"
    )
  })

  it("builds a complete run without exposing song metadata or guesses", () => {
    const text = buildRunShareText({
      kind: "daily",
      dateKey: "2026-07-30",
      score: 140,
      solved: 2,
      totalTracks: 3,
      bestRunStreak: 2,
      results: [
        {
          trackId: "secret-track-id",
          status: "solved",
          attempts: ["wrong", "correct"],
          completedStage: 1,
          points: 80,
        },
        {
          trackId: "another-secret",
          status: "failed",
          attempts: ["skip", "wrong"],
          completedStage: 5,
          points: 0,
        },
      ],
      appUrl: "https://songless.example",
    })

    assert.equal(
      text,
      [
        "SonglessUnlimited Daily 2026-07-30",
        "2/3 solved · 140 points",
        "Best run streak: 2",
        "🟥🟩⬛⬛⬛⬛",
        "⬜🟥⬛⬛⬛⬛",
        "❔❔❔❔❔❔",
        "https://songless.example",
      ].join("\n")
    )
    assert.doesNotMatch(text, /secret-track-id|another-secret|wrong/)
  })

  it("resolves only after clipboard succeeds", async () => {
    let copied = ""
    await copyShareText(
      {
        async writeText(value: string) {
          copied = value
        },
      },
      "share me"
    )
    assert.equal(copied, "share me")
  })

  it("propagates clipboard rejection", async () => {
    await assert.rejects(
      copyShareText(
        {
          async writeText() {
            throw new Error("permission denied")
          },
        },
        "share me"
      ),
      /permission denied/
    )
  })
})
