type DailyMetricFields = Record<string, string | number | boolean | undefined>

const ALLOWED_FIELDS = new Set([
  "dateKey",
  "genre",
  "chartCandidates",
  "rejectedAudioCandidates",
  "rejectedResolvedCandidates",
  "usedCuratedFallback",
  "durationMs",
  "trackCount",
  "reason",
])

/**
 * Structured, metadata-safe server logs for the Daily control plane. Keep
 * titles, artists, guesses, and provider payloads out of these fields.
 */
export function recordDailyMetric(event: string, fields: DailyMetricFields = {}) {
  if (process.env.NODE_ENV !== "production" && process.env.DAILY_METRICS_LOG !== "1") return
  const sanitized = Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) => ALLOWED_FIELDS.has(key) && value !== undefined
    )
  )
  console.info(`[DailyMetric] ${JSON.stringify({ event, ...sanitized })}`)
}
