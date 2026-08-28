import assert from "node:assert/strict"
import test from "node:test"
import { recordDailyMetric } from "@/lib/daily-observability"

test("Daily observability strips song metadata from structured fields", () => {
  const env = process.env as Record<string, string | undefined>
  const previousNodeEnv = env.NODE_ENV
  const previousMetricsFlag = env.DAILY_METRICS_LOG
  const messages: string[] = []
  const originalInfo = console.info
  console.info = (...args: unknown[]) => messages.push(args.map(String).join(" "))
  env.NODE_ENV = "test"
  env.DAILY_METRICS_LOG = "1"

  try {
    recordDailyMetric("candidate_filter", {
      dateKey: "2026-08-27",
      genre: "rap",
      rejectedAudioCandidates: 1,
      title: "Secret Song",
      artist: "Secret Artist",
    })
  } finally {
    console.info = originalInfo
    if (previousNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = previousNodeEnv
    if (previousMetricsFlag === undefined) delete env.DAILY_METRICS_LOG
    else env.DAILY_METRICS_LOG = previousMetricsFlag
  }

  assert.equal(messages.length, 1)
  assert.doesNotMatch(messages[0], /Secret Song|Secret Artist/)
  assert.match(messages[0], /candidate_filter/)
  assert.match(messages[0], /rejectedAudioCandidates/)
})
