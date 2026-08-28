import assert from "node:assert/strict"
import test from "node:test"
import { fetchWithTimeout, RequestTimeoutError } from "@/lib/request-timeout"

const originalFetch = globalThis.fetch

test("provider request timeout boundary", async (t) => {
  t.afterEach(() => {
    globalThis.fetch = originalFetch
  })

  await t.test("converts a hung request into a retryable timeout", async () => {
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        }, { once: true })
      })

    await assert.rejects(
      fetchWithTimeout("https://provider.test", {}, 10),
      (error: unknown) => error instanceof RequestTimeoutError
    )
  })

  await t.test("preserves caller cancellation", async () => {
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        }, { once: true })
      })

    const controller = new AbortController()
    const pending = fetchWithTimeout("https://provider.test", { signal: controller.signal }, 1000)
    controller.abort()
    await assert.rejects(pending, (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError"
    )
  })
})
