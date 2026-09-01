export type FixtureGenre = "usuk" | "vpop" | "rap"
export type FixtureTrack = {
  /** Legacy Spotify is retained only for explicit migration/preview tests. */
  source: "spotify" | "youtube"
  uri: string
  name: string
  artists: string
  duration_ms: number
  albumImage: string | null
  preview_url: string | null
  videoId?: string
  genre?: FixtureGenre
  genreEvidence?: "provider" | "allowlist"
  lyricsSnippets?: string[]
  challengeId?: string
  dailyEligible?: boolean
  audioStartSeconds?: number
  audioFirstManifest?: boolean
  sourceType?: "official_audio" | "lyric_video" | "music_video" | "performance" | "unknown"
  audioAnalysisStatus?: "approved" | "needs_review" | "failed"
  audioStartConfidence?: number
}

export function createTrack(
  overrides: Partial<FixtureTrack> & Pick<FixtureTrack, "uri" | "name" | "artists">
): FixtureTrack {
  const source = overrides.source ?? "youtube"
  const videoId = overrides.videoId ?? overrides.uri.replace(/^youtube:/, "")
  return {
    source,
    uri: overrides.uri,
    name: overrides.name,
    artists: overrides.artists,
    duration_ms: overrides.duration_ms ?? 180_000,
    albumImage: overrides.albumImage ?? null,
    preview_url: overrides.preview_url ?? null,
    ...(source === "youtube"
      ? { videoId }
      : {}),
    ...(overrides.genre ? { genre: overrides.genre } : {}),
    ...(overrides.genreEvidence ? { genreEvidence: overrides.genreEvidence } : {}),
    ...(overrides.lyricsSnippets ? { lyricsSnippets: overrides.lyricsSnippets } : {}),
    ...(overrides.challengeId ? { challengeId: overrides.challengeId } : {}),
    ...(overrides.dailyEligible !== undefined ? { dailyEligible: overrides.dailyEligible } : {}),
    ...(overrides.audioStartSeconds !== undefined
      ? { audioStartSeconds: overrides.audioStartSeconds }
      : {}),
    ...(overrides.audioFirstManifest !== undefined
      ? { audioFirstManifest: overrides.audioFirstManifest }
      : {}),
    ...(overrides.sourceType ? { sourceType: overrides.sourceType } : {}),
    ...(overrides.audioAnalysisStatus
      ? { audioAnalysisStatus: overrides.audioAnalysisStatus }
      : {}),
    ...(overrides.audioStartConfidence !== undefined
      ? { audioStartConfidence: overrides.audioStartConfidence }
      : {}),
  }
}

export const dailyTracks: FixtureTrack[] = [
  createTrack({
    source: "youtube",
    uri: "youtube:daily-vpop",
    videoId: "daily-vpop",
    name: "Daily VPop",
    artists: "VPop Artist",
    genre: "vpop",
    genreEvidence: "allowlist",
    challengeId: "daily-2026-08-27-vpop",
    dailyEligible: true,
    sourceType: "official_audio",
    audioStartSeconds: 12,
    audioAnalysisStatus: "approved",
    audioStartConfidence: 0.98,
  }),
  createTrack({
    source: "youtube",
    uri: "youtube:daily-usuk",
    videoId: "daily-usuk",
    name: "Daily USUK",
    artists: "USUK Artist",
    genre: "usuk",
    genreEvidence: "allowlist",
    challengeId: "daily-2026-08-27-usuk",
    dailyEligible: true,
    sourceType: "official_audio",
    audioStartSeconds: 9,
    audioAnalysisStatus: "approved",
    audioStartConfidence: 0.96,
  }),
  createTrack({
    source: "youtube",
    uri: "youtube:daily-rap",
    videoId: "daily-rap",
    name: "Daily Rap",
    artists: "Rap Artist",
    genre: "rap",
    genreEvidence: "allowlist",
    challengeId: "daily-2026-08-27-rap",
    dailyEligible: true,
    sourceType: "official_audio",
    audioStartSeconds: 15,
    audioAnalysisStatus: "approved",
    audioStartConfidence: 0.94,
  }),
]

const genreTrackNames: Record<FixtureGenre, string> = {
  vpop: "VPop Practice",
  usuk: "USUK Practice",
  rap: "Rap Practice",
}

export const genreTracks: Record<FixtureGenre, FixtureTrack[]> = {
  vpop: Array.from({ length: 5 }, (_, index) =>
    createTrack({
      source: "youtube",
      uri: `youtube:genre-vpop-${index + 1}`,
      name: `${genreTrackNames.vpop} ${index + 1}`,
      artists: `VPop Artist ${index + 1}`,
      genre: "vpop",
      genreEvidence: "allowlist",
      dailyEligible: true,
      sourceType: "official_audio",
      audioStartSeconds: 10 + index,
      audioAnalysisStatus: "approved",
    })
  ),
  usuk: Array.from({ length: 5 }, (_, index) =>
    createTrack({
      source: "youtube",
      uri: `youtube:genre-usuk-${index + 1}`,
      name: `${genreTrackNames.usuk} ${index + 1}`,
      artists: `USUK Artist ${index + 1}`,
      genre: "usuk",
      genreEvidence: "allowlist",
      dailyEligible: true,
      sourceType: "official_audio",
      audioStartSeconds: 10 + index,
      audioAnalysisStatus: "approved",
    })
  ),
  rap: Array.from({ length: 5 }, (_, index) =>
    createTrack({
      source: "youtube",
      uri: `youtube:genre-rap-${index + 1}`,
      name: `${genreTrackNames.rap} ${index + 1}`,
      artists: `Rap Artist ${index + 1}`,
      genre: "rap",
      genreEvidence: "allowlist",
      dailyEligible: true,
      sourceType: "official_audio",
      audioStartSeconds: 10 + index,
      audioAnalysisStatus: "approved",
    })
  ),
}

export const lyricsTracks: FixtureTrack[] = [
  ...genreTracks.vpop.slice(0, 2).map((track, index) => ({
    ...track,
    uri: `youtube:lyrics-vpop-${index + 1}`,
    source: "youtube" as const,
    videoId: `lyrics-vpop-${index + 1}`,
    preview_url: null,
    challengeId: `lyrics-vpop-${index + 1}`,
    lyricsSnippets: [
      `VPop clue ${index + 1} starts with a quiet morning beside the river`,
      `VPop clue ${index + 1} follows a silver river beneath distant clouds`,
      `VPop clue ${index + 1} ends beneath a violet sky after the rain`,
    ],
  })),
  ...genreTracks.usuk.slice(0, 2).map((track, index) => ({
    ...track,
    uri: `youtube:lyrics-usuk-${index + 1}`,
    source: "youtube" as const,
    videoId: `lyrics-usuk-${index + 1}`,
    preview_url: null,
    challengeId: `lyrics-usuk-${index + 1}`,
    lyricsSnippets: [
      `USUK clue ${index + 1} starts with a quiet morning beside the river`,
      `USUK clue ${index + 1} follows a silver river beneath distant clouds`,
      `USUK clue ${index + 1} ends beneath a violet sky after the rain`,
    ],
  })),
  {
    ...genreTracks.rap[0],
    uri: "youtube:lyrics-rap-1",
    source: "youtube",
    videoId: "lyrics-rap-1",
    preview_url: null,
    challengeId: "lyrics-rap-1",
    lyricsSnippets: [
      "Rap clue one starts with a quiet morning beside the river",
      "Rap clue one follows a silver river beneath distant clouds",
      "Rap clue one ends beneath a violet sky after the rain",
    ],
  },
]

export const playlistTracks: FixtureTrack[] = [
  createTrack({
    source: "youtube",
    uri: "youtube:playlist-one",
    name: "Playlist One",
    artists: "Playlist Artist",
  }),
  createTrack({
    source: "youtube",
    uri: "youtube:playlist-two",
    videoId: "playlist-two",
    name: "Playlist Two",
    artists: "Playlist Artist",
    preview_url: null,
  }),
]

export const unplayableYoutubeTrack = createTrack({
  source: "youtube",
  uri: "youtube:unplayable",
  videoId: "unplayable",
  name: "Unavailable Track",
  artists: "Unavailable Artist",
  sourceType: "unknown",
  audioAnalysisStatus: "failed",
  audioStartSeconds: 0,
})

export const sameTitleDifferentArtist = {
  target: createTrack({
    source: "youtube",
    uri: "youtube:home-artist-a",
    videoId: "home-artist-a",
    name: "Home",
    artists: "Artist A",
    preview_url: null,
  }),
  suggestion: {
    uri: "youtube:home-artist-b",
    name: "Home",
    artists: "Artist B",
  },
}
