import type { GameTrack, TrackGenre } from "@/lib/tracks"

export const GAME_MODE_STORAGE_KEY = "songless_game_mode"
export const DAILY_DATE_STORAGE_KEY = "songless_daily_date"

export const DAILY_GENRE_TARGETS: Record<TrackGenre, number> = {
  usuk: 2,
  vpop: 2,
  rap: 1,
}

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function youtubeTrack(input: {
  id: string
  name: string
  artists: string
  genre: TrackGenre
  videoId: string
  lyricsSnippets?: string[]
}): GameTrack {
  return {
    source: "youtube",
    uri: `youtube:${input.videoId}`,
    videoId: input.videoId,
    name: input.name,
    artists: input.artists,
    duration_ms: 0,
    albumImage: `https://i.ytimg.com/vi/${input.videoId}/hqdefault.jpg`,
    preview_url: null,
    genre: input.genre,
    challengeId: input.id,
    dailyEligible: true,
    ...(input.lyricsSnippets ? { lyricsSnippets: input.lyricsSnippets } : {}),
  }
}

export const CURATED_TRACKS: GameTrack[] = [
  youtubeTrack({
    id: "usuk-blinding-lights",
    name: "Blinding Lights",
    artists: "The Weeknd",
    genre: "usuk",
    videoId: "4NRXx6U8ABQ",
    lyricsSnippets: ["A city night keeps a lonely heart awake under bright signs."],
  }),
  youtubeTrack({
    id: "usuk-shape-of-you",
    name: "Shape of You",
    artists: "Ed Sheeran",
    genre: "usuk",
    videoId: "JGwWNGJdvx8",
    lyricsSnippets: ["A dance floor meeting turns into a playful love story."],
  }),
  youtubeTrack({
    id: "usuk-hello",
    name: "Hello",
    artists: "Adele",
    genre: "usuk",
    videoId: "YQHsXMglC9A",
    lyricsSnippets: ["An old call carries regret across a long quiet distance."],
  }),
  youtubeTrack({
    id: "usuk-bad-guy",
    name: "bad guy",
    artists: "Billie Eilish",
    genre: "usuk",
    videoId: "DyDfgMOUjCI",
    lyricsSnippets: ["A whispery character plays with danger and a crooked smile."],
  }),
  youtubeTrack({
    id: "usuk-blank-space",
    name: "Blank Space",
    artists: "Taylor Swift",
    genre: "usuk",
    videoId: "e-ORhEE9VVg",
    lyricsSnippets: ["A glamorous romance turns messy inside a sharp pop diary."],
  }),
  youtubeTrack({
    id: "usuk-levitating",
    name: "Levitating",
    artists: "Dua Lipa",
    genre: "usuk",
    videoId: "TUVcZfQe-Kw",
    lyricsSnippets: ["A disco sky lifts two people above the ordinary night."],
  }),
  youtubeTrack({
    id: "vpop-hay-trao-cho-anh",
    name: "Hay Trao Cho Anh",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "knW7-x7Y7RE",
    lyricsSnippets: ["A tropical crush asks for attention with glossy summer confidence."],
  }),
  youtubeTrack({
    id: "vpop-see-tinh",
    name: "See Tinh",
    artists: "Hoang Thuy Linh",
    genre: "vpop",
    videoId: "gJHSDZfJrRY",
    lyricsSnippets: ["A bright folk-pop flirt spins around a playful heartbeat."],
  }),
  youtubeTrack({
    id: "vpop-nang-tho",
    name: "Nang Tho",
    artists: "Hoang Dung",
    genre: "vpop",
    videoId: "Zzn9-ATB9aU",
    lyricsSnippets: ["A soft memory paints someone gentle like a poem in sunlight."],
  }),
  youtubeTrack({
    id: "vpop-co-chac-yeu-la-day",
    name: "Co Chac Yeu La Day",
    artists: "Son Tung M-TP",
    genre: "vpop",
    videoId: "6t-MjBazs3o",
    lyricsSnippets: ["A sweet question turns a crush into a colorful confession."],
  }),
  youtubeTrack({
    id: "vpop-buoc-qua-nhau",
    name: "Buoc Qua Nhau",
    artists: "Vu",
    genre: "vpop",
    videoId: "Llw9Q6akRo4",
    lyricsSnippets: ["Two people pass each other while the city keeps moving."],
  }),
  youtubeTrack({
    id: "vpop-de-vuong",
    name: "De Vuong",
    artists: "Dinh Dung",
    genre: "vpop",
    videoId: "U1IgyEtrPjA",
    lyricsSnippets: ["A dramatic heart holds on after love becomes unfinished."],
  }),
  youtubeTrack({
    id: "rap-see-you-again",
    name: "See You Again",
    artists: "Wiz Khalifa, Charlie Puth",
    genre: "rap",
    videoId: "RgKAFK5djSk",
    lyricsSnippets: ["A goodbye becomes a promise to meet beyond the road."],
  }),
  youtubeTrack({
    id: "rap-gods-plan",
    name: "God's Plan",
    artists: "Drake",
    genre: "rap",
    videoId: "xpVfcZ0ZcFM",
    lyricsSnippets: ["Success, pressure, and gratitude move through a calm flex."],
  }),
  youtubeTrack({
    id: "rap-sicko-mode",
    name: "SICKO MODE",
    artists: "Travis Scott",
    genre: "rap",
    videoId: "6ONRf7h3Mdk",
    lyricsSnippets: ["A beat switch turns a night ride into a stadium rush."],
  }),
  youtubeTrack({
    id: "rap-bigcityboi",
    name: "Bigcityboi",
    artists: "Binz",
    genre: "rap",
    videoId: "jS7sT1JRF3c",
    lyricsSnippets: ["A confident city character walks through nightlife with style."],
  }),
]

function hashString(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleTracks(tracks: GameTrack[], seed: string) {
  const random = seededRandom(hashString(seed))
  const copy = [...tracks]
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function selectDailyTracks(dateKey = getUtcDateKey()) {
  return (Object.keys(DAILY_GENRE_TARGETS) as TrackGenre[]).flatMap((genre) => {
    const target = DAILY_GENRE_TARGETS[genre]
    const pool = CURATED_TRACKS.filter((track) => track.dailyEligible && track.genre === genre)
    return shuffleTracks(pool, `${dateKey}-${genre}`).slice(0, target)
  })
}

export function getLyricsModeTracks() {
  return CURATED_TRACKS.filter((track) => track.lyricsSnippets && track.lyricsSnippets.length > 0)
}
