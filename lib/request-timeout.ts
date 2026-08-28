export class RequestTimeoutError extends Error {
  constructor(message = "The provider took too long to respond. Please try again.") {
    super(message)
    this.name = "RequestTimeoutError"
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000
) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const externalSignal = init.signal
  const abortFromCaller = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener("abort", abortFromCaller, { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError()
    throw error
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener("abort", abortFromCaller)
  }
}
