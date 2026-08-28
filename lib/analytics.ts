import posthog from "posthog-js"
import type { GameSessionKind, GameSessionMeta } from "@/lib/game-session"
import type { GameMode, TrackGenre } from "@/lib/tracks"

export type RunAnalyticsContext = {
  kind: GameSessionKind
  playbackMode: GameMode
  genre?: TrackGenre
  playlistSource?: "spotify" | "youtube"
}

export type AudioRetryOutcome = "requested" | "succeeded" | "exhausted"

export type ProductEvent =
  | { name: "home_viewed"; properties?: Record<string, never> }
  | { name: "run_started"; properties: RunAnalyticsContext & { totalTracks: number } }
  | {
      name: "run_resumed"
      properties: RunAnalyticsContext & { trackNumber: number; stage: number; totalTracks: number }
    }
  | {
      name: "guess_submitted"
      properties: RunAnalyticsContext & { trackNumber: number; stage: number; correct: boolean }
    }
  | {
      name: "clue_advanced"
      properties: RunAnalyticsContext & {
        trackNumber: number
        stage: number
        reason: "wrong" | "skip"
      }
    }
  | {
      name: "track_completed"
      properties: RunAnalyticsContext & {
        trackNumber: number
        stage: number
        solved: boolean
        score: number
      }
    }
  | {
      name: "run_completed"
      properties: RunAnalyticsContext & {
        totalTracks: number
        solvedCount: number
        score: number
        durationMs?: number
      }
    }
  | {
      name: "run_abandoned"
      properties: RunAnalyticsContext & { trackNumber: number; stage: number }
    }
  | {
      name: "result_shared"
      properties: RunAnalyticsContext & { scope: "track" | "run"; success: boolean }
    }
  | {
      name: "audio_retry"
      properties: RunAnalyticsContext & {
        trackNumber: number
        success?: boolean
        outcome?: AudioRetryOutcome
      }
    }

export interface AnalyticsCaptureClient {
  capture(name: string, properties?: Record<string, unknown>): unknown
}

const ALLOWED_PROPERTIES = new Set([
  "kind",
  "playbackMode",
  "genre",
  "playlistSource",
  "totalTracks",
  "trackNumber",
  "stage",
  "correct",
  "reason",
  "solved",
  "score",
  "solvedCount",
  "durationMs",
  "scope",
  "success",
  "outcome",
])

let initialized = false

export function getRunAnalyticsContext(
  session: GameSessionMeta
): RunAnalyticsContext {
  return {
    kind: session.kind,
    playbackMode: session.playbackMode,
    ...(session.genre ? { genre: session.genre } : {}),
    ...(session.playlistSource ? { playlistSource: session.playlistSource } : {}),
  }
}

export function sanitizeProductEvent(event: ProductEvent) {
  const properties = Object.fromEntries(
    Object.entries(event.properties ?? {}).filter(
      ([key, value]) =>
        ALLOWED_PROPERTIES.has(key) &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean")
    )
  )
  return { name: event.name, properties }
}

export function initProductAnalytics(config?: { token?: string; host?: string }) {
  if (typeof window === "undefined") return false
  const token = config?.token ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = config?.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!token?.trim() || !host?.trim()) return false

  try {
    posthog.init(token, {
      api_host: host,
      persistence: "localStorage",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      defaults: "2026-05-30",
    })
    initialized = true
    return true
  } catch {
    initialized = false
    return false
  }
}

export function captureProductEvent(
  event: ProductEvent,
  client?: AnalyticsCaptureClient
) {
  const captureClient = client ?? (initialized ? posthog : null)
  if (!captureClient) return false

  try {
    const sanitized = sanitizeProductEvent(event)
    captureClient.capture(sanitized.name, sanitized.properties)
    return true
  } catch {
    return false
  }
}
