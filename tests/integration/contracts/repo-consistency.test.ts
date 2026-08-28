import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

test("test runner repository contract", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ) as { scripts?: Record<string, string> }

  assert.ok(packageJson.scripts?.["test:unit"]?.includes("tests/unit"))
  assert.ok(packageJson.scripts?.["test:integration"]?.includes("tests/integration"))
  assert.ok(packageJson.scripts?.["test:e2e"]?.includes("run-e2e"))
  assert.ok(packageJson.scripts?.verify?.includes("test:e2e"))
  assert.ok(packageJson.scripts?.["test:live:unit"]?.includes("tests/live"))
  assert.ok(fs.existsSync(path.join(root, "tests", "unit")))
  assert.ok(fs.existsSync(path.join(root, "tests", "integration")))
  assert.ok(fs.existsSync(path.join(root, "tests", "e2e")))
  assert.ok(fs.existsSync(path.join(root, "tests", "e2e", "modes")))
  assert.ok(fs.existsSync(path.join(root, "tests", "e2e", "recovery")))
  assert.ok(fs.existsSync(path.join(root, "tests", "live")))
})
