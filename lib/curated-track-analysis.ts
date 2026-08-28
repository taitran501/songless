import type { AudioAnalysisStatus } from "@/lib/tracks"

export interface CuratedTrackAnalysis {
  id: string
  detectedAudioStartSeconds?: number
  manualAudioStartSeconds?: number
  manualReason?: string
  confidence: number
  status: AudioAnalysisStatus
  audioFirst?: boolean
  reason: string
  analyzedAt: string
  analyzerVersion: string
}

export const CURATED_TRACK_ANALYSIS: Record<string, CuratedTrackAnalysis> = {
  "rap-bai-nay-chill-phet": {
    "id": "rap-bai-nay-chill-phet",
    "detectedAudioStartSeconds": 0.61,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:14.903Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-bigcityboi": {
    "id": "rap-bigcityboi",
    "detectedAudioStartSeconds": 4.79,
    "confidence": 0.89,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:14.493Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-exs-hate-me": {
    "id": "rap-exs-hate-me",
    "detectedAudioStartSeconds": 0.68,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:15.325Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-gods-plan": {
    "id": "rap-gods-plan",
    "detectedAudioStartSeconds": 12.34,
    "confidence": 0.82,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.86 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:13.681Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-see-you-again": {
    "id": "rap-see-you-again",
    "detectedAudioStartSeconds": 11.34,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:13.291Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-sicko-mode": {
    "id": "rap-sicko-mode",
    "detectedAudioStartSeconds": 0.68,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:14.077Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-as-it-was": {
    "id": "usuk-as-it-was",
    "detectedAudioStartSeconds": 5.49,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.77 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:05.796Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-bad-guy": {
    "id": "usuk-bad-guy",
    "detectedAudioStartSeconds": 0.01,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and reaches audible level near the beginning.",
    "analyzedAt": "2026-07-02T16:07:04.524Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-believer": {
    "id": "usuk-believer",
    "detectedAudioStartSeconds": 0.17,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and reaches audible level near the beginning.",
    "analyzedAt": "2026-07-02T16:07:06.674Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-blank-space": {
    "id": "usuk-blank-space",
    "detectedAudioStartSeconds": 8.06,
    "confidence": 0.95,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.90 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:04.951Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-blinding-lights": {
    "id": "usuk-blinding-lights",
    "detectedAudioStartSeconds": 0.77,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:03.228Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-hello": {
    "id": "usuk-hello",
    "detectedAudioStartSeconds": 0.4,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:04.073Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-levitating": {
    "id": "usuk-levitating",
    "detectedAudioStartSeconds": 0.24,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:05.374Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-roar": {
    "id": "usuk-roar",
    "detectedAudioStartSeconds": 0.38,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:07.108Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-shape-of-you": {
    "id": "usuk-shape-of-you",
    "detectedAudioStartSeconds": 8.18,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.74 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:03.654Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-someone-like-you": {
    "id": "usuk-someone-like-you",
    "detectedAudioStartSeconds": 0.68,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:07.530Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-sunflower": {
    "id": "usuk-sunflower",
    "detectedAudioStartSeconds": 5.25,
    "confidence": 0.85,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:07.996Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-uptown-funk": {
    "id": "usuk-uptown-funk",
    "detectedAudioStartSeconds": 15.08,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.78 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:06.228Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-anh-nha-o-dau-the": {
    "id": "vpop-anh-nha-o-dau-the",
    "detectedAudioStartSeconds": 3.72,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.77 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:12.509Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-buoc-qua-nhau": {
    "id": "vpop-buoc-qua-nhau",
    "detectedAudioStartSeconds": 30.56,
    "confidence": 0.96,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.93 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:10.044Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-chac-yeu-la-day": {
    "id": "vpop-co-chac-yeu-la-day",
    "detectedAudioStartSeconds": 18.51,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:09.646Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-chang-trai-viet-len-cay": {
    "id": "vpop-co-chang-trai-viet-len-cay",
    "detectedAudioStartSeconds": 2.82,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:12.907Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-em-cho": {
    "id": "vpop-co-em-cho",
    "detectedAudioStartSeconds": 0.1,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:11.701Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-de-vuong": {
    "id": "vpop-de-vuong",
    "detectedAudioStartSeconds": 15.98,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:10.463Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-hay-trao-cho-anh": {
    "id": "vpop-hay-trao-cho-anh",
    "detectedAudioStartSeconds": 11.27,
    "confidence": 0.9,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.81 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:08.422Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-lac-troi": {
    "id": "vpop-lac-troi",
    "detectedAudioStartSeconds": 0.08,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:11.290Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-nang-tho": {
    "id": "vpop-nang-tho",
    "detectedAudioStartSeconds": 0.68,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Source is audio-first and has an audible soft intro near the beginning.",
    "analyzedAt": "2026-07-02T16:07:09.215Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-noi-nay-co-anh": {
    "id": "vpop-noi-nay-co-anh",
    "detectedAudioStartSeconds": 24.39,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:10.868Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-sau-tat-ca": {
    "id": "vpop-sau-tat-ca",
    "detectedAudioStartSeconds": 26.55,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:12.107Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-see-tinh": {
    "id": "vpop-see-tinh",
    "detectedAudioStartSeconds": 9.92,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T16:07:08.793Z",
    "analyzerVersion": "audio-start-v1"
  },
}
