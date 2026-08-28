import { type NextRequest } from "next/server"
import { handleCronGet } from "@/lib/cron-daily-route-handler"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: NextRequest) {
  return handleCronGet(request)
}
