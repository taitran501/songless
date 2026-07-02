import type { AudioAnalysisStatus } from "@/lib/tracks"

export interface CuratedTrackAnalysis {
  id: string
  detectedAudioStartSeconds?: number
  manualAudioStartSeconds?: number
  manualReason?: string
  confidence: number
  status: AudioAnalysisStatus
  reason: string
  analyzedAt: string
  analyzerVersion: string
}

export const CURATED_TRACK_ANALYSIS: Record<string, CuratedTrackAnalysis> = {
  "rap-bai-nay-chill-phet": {
    "id": "rap-bai-nay-chill-phet",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:19.048Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-bigcityboi": {
    "id": "rap-bigcityboi",
    "detectedAudioStartSeconds": 4.27,
    "confidence": 0.89,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:18.632Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-exs-hate-me": {
    "id": "rap-exs-hate-me",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:19.442Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-gods-plan": {
    "id": "rap-gods-plan",
    "detectedAudioStartSeconds": 12.26,
    "confidence": 0.82,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.86 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:17.814Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-see-you-again": {
    "id": "rap-see-you-again",
    "detectedAudioStartSeconds": 10.75,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:17.409Z",
    "analyzerVersion": "audio-start-v1"
  },
  "rap-sicko-mode": {
    "id": "rap-sicko-mode",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:18.214Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-as-it-was": {
    "id": "usuk-as-it-was",
    "detectedAudioStartSeconds": 5.41,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.77 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:09.952Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-bad-guy": {
    "id": "usuk-bad-guy",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:08.697Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-believer": {
    "id": "usuk-believer",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:10.795Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-blank-space": {
    "id": "usuk-blank-space",
    "detectedAudioStartSeconds": 7.98,
    "confidence": 0.95,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.90 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:09.133Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-blinding-lights": {
    "id": "usuk-blinding-lights",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:07.422Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-hello": {
    "id": "usuk-hello",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:08.270Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-levitating": {
    "id": "usuk-levitating",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:09.540Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-roar": {
    "id": "usuk-roar",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:11.202Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-shape-of-you": {
    "id": "usuk-shape-of-you",
    "detectedAudioStartSeconds": 8.1,
    "confidence": 0.86,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.74 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:07.867Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-someone-like-you": {
    "id": "usuk-someone-like-you",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:11.616Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-sunflower": {
    "id": "usuk-sunflower",
    "detectedAudioStartSeconds": 4.85,
    "confidence": 0.85,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:12.024Z",
    "analyzerVersion": "audio-start-v1"
  },
  "usuk-uptown-funk": {
    "id": "usuk-uptown-funk",
    "detectedAudioStartSeconds": 14.37,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.78 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:10.366Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-anh-nha-o-dau-the": {
    "id": "vpop-anh-nha-o-dau-the",
    "detectedAudioStartSeconds": 3.64,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.77 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:16.545Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-buoc-qua-nhau": {
    "id": "vpop-buoc-qua-nhau",
    "detectedAudioStartSeconds": 30.48,
    "confidence": 0.96,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.93 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:14.046Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-chac-yeu-la-day": {
    "id": "vpop-co-chac-yeu-la-day",
    "detectedAudioStartSeconds": 18.43,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:13.635Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-chang-trai-viet-len-cay": {
    "id": "vpop-co-chang-trai-viet-len-cay",
    "detectedAudioStartSeconds": 2.57,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.80 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:16.982Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-co-em-cho": {
    "id": "vpop-co-em-cho",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:15.693Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-de-vuong": {
    "id": "vpop-de-vuong",
    "detectedAudioStartSeconds": 15.62,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:14.463Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-hay-trao-cho-anh": {
    "id": "vpop-hay-trao-cho-anh",
    "detectedAudioStartSeconds": 10.86,
    "confidence": 0.9,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.81 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:12.429Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-lac-troi": {
    "id": "vpop-lac-troi",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:15.276Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-nang-tho": {
    "id": "vpop-nang-tho",
    "detectedAudioStartSeconds": 0,
    "confidence": 0.88,
    "status": "approved",
    "reason": "Source is audio-first and has stable signal at the beginning.",
    "analyzedAt": "2026-07-02T15:50:13.222Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-noi-nay-co-anh": {
    "id": "vpop-noi-nay-co-anh",
    "detectedAudioStartSeconds": 24.31,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:14.870Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-sau-tat-ca": {
    "id": "vpop-sau-tat-ca",
    "detectedAudioStartSeconds": 26.47,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:16.101Z",
    "analyzerVersion": "audio-start-v1"
  },
  "vpop-see-tinh": {
    "id": "vpop-see-tinh",
    "detectedAudioStartSeconds": 9.31,
    "confidence": 0.8,
    "status": "approved",
    "reason": "Detected sustained onset with energy ratio 0.72 and flux ratio 1.00.",
    "analyzedAt": "2026-07-02T15:50:12.807Z",
    "analyzerVersion": "audio-start-v1"
  },
}
