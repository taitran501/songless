import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { parseDailyResponse } from "@/lib/daily-response"

const fixturesDir = path.join(process.cwd(), "tests", "fixtures", "providers")

test("daily API fixture contract", () => {
  const success = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "daily-success.json"), "utf8")
  ) as { dateKey?: string; snapshotVersion?: number; tracks?: unknown[] }
  assert.match(success.dateKey ?? "", /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(success.tracks?.length, 3)
  assert.equal(success.snapshotVersion, 1)
  assert.equal(parseDailyResponse(success, success.dateKey ?? "").length, 3)

  const failure = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "daily-failure.json"), "utf8")
  ) as { error?: string }
  assert.equal(typeof failure.error, "string")
})
