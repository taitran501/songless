import { z } from "zod"
import { trackRunResultSchema, type TrackRunResult } from "@/lib/game-state"

export const DAILY_PROGRESS_STORAGE_KEY = "songless_daily_progress_v1"
export const DAILY_HISTORY_LIMIT = 90

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const dailyHistoryRecordSchema = z.object({
  dateKey: dateKeySchema,
  bestScore: z.number().int().nonnegative(),
  bestSolved: z.number().int().nonnegative(),
  bestResults: z.array(trackRunResultSchema),
  completedRuns: z.number().int().positive(),
  completedAt: z.string().datetime(),
  lastRunId: z.string().min(1).optional(),
})

const dailyProgressStateSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  bestStreak: z.number().int().nonnegative(),
  lastCompletedDateKey: dateKeySchema.nullable(),
  history: z.array(dailyHistoryRecordSchema).max(DAILY_HISTORY_LIMIT),
})

export type DailyHistoryRecord = z.infer<typeof dailyHistoryRecordSchema>
export type DailyProgressState = z.infer<typeof dailyProgressStateSchema>

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export const EMPTY_DAILY_PROGRESS: DailyProgressState = {
  currentStreak: 0,
  bestStreak: 0,
  lastCompletedDateKey: null,
  history: [],
}

function parseUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function getUtcDayDistance(fromDateKey: string, toDateKey: string) {
  return Math.round(
    (parseUtcDate(toDateKey).getTime() - parseUtcDate(fromDateKey).getTime()) /
      86_400_000
  )
}

export function readDailyProgress(storage: StorageLike): DailyProgressState {
  const raw = storage.getItem(DAILY_PROGRESS_STORAGE_KEY)
  if (!raw) return EMPTY_DAILY_PROGRESS

  try {
    const parsed = dailyProgressStateSchema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
  } catch {
    // Corrupt JSON is removed below.
  }

  storage.removeItem(DAILY_PROGRESS_STORAGE_KEY)
  return EMPTY_DAILY_PROGRESS
}

export function completeDailyProgress(
  current: DailyProgressState,
  input: {
    dateKey: string
    score: number
    solved: number
    results: readonly TrackRunResult[]
    runId: string
    completedAt?: string
  }
): DailyProgressState {
  dateKeySchema.parse(input.dateKey)
  const existing = current.history.find((record) => record.dateKey === input.dateKey)
  if (existing?.lastRunId === input.runId) return current

  const isNewBest =
    !existing ||
    input.score > existing.bestScore ||
    (input.score === existing.bestScore && input.solved > existing.bestSolved)
  const nextRecord: DailyHistoryRecord = {
    dateKey: input.dateKey,
    bestScore: isNewBest ? input.score : existing.bestScore,
    bestSolved: isNewBest ? input.solved : existing.bestSolved,
    bestResults: isNewBest ? [...input.results] : existing.bestResults,
    completedRuns: (existing?.completedRuns ?? 0) + 1,
    completedAt: input.completedAt ?? new Date().toISOString(),
    lastRunId: input.runId,
  }

  let currentStreak = current.currentStreak
  let lastCompletedDateKey = current.lastCompletedDateKey
  if (!lastCompletedDateKey) {
    currentStreak = 1
    lastCompletedDateKey = input.dateKey
  } else {
    const distance = getUtcDayDistance(lastCompletedDateKey, input.dateKey)
    if (distance === 1) {
      currentStreak += 1
      lastCompletedDateKey = input.dateKey
    } else if (distance > 1) {
      currentStreak = 1
      lastCompletedDateKey = input.dateKey
    }
  }

  return {
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    lastCompletedDateKey,
    history: [
      nextRecord,
      ...current.history.filter((record) => record.dateKey !== input.dateKey),
    ]
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
      .slice(0, DAILY_HISTORY_LIMIT),
  }
}

export function completeDailyRun(
  storage: StorageLike,
  input: Parameters<typeof completeDailyProgress>[1]
) {
  const next = completeDailyProgress(readDailyProgress(storage), input)
  storage.setItem(DAILY_PROGRESS_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function getRecentDailyDays(
  todayDateKey: string,
  progress: DailyProgressState,
  count = 7
) {
  const records = new Map(progress.history.map((record) => [record.dateKey, record]))
  const today = parseUtcDate(dateKeySchema.parse(todayDateKey))

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (count - offset - 1))
    const dateKey = date.toISOString().slice(0, 10)
    return { dateKey, record: records.get(dateKey) ?? null }
  })
}
