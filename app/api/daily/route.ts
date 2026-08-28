import { type NextRequest } from "next/server"
import { handleDailyGet } from "@/lib/daily-route-handler"

export const dynamic = "force-dynamic"
export const maxDuration = 30
export const revalidate = 0

export async function GET(request: NextRequest) {
  return handleDailyGet(request)
}
