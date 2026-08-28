import { CURATED_SONG_SEEDS } from "@/lib/curated-song-seeds"
import type { GenreEvidenceSource, TrackGenre } from "@/lib/tracks"

export interface GenreClassification {
  genre: TrackGenre
  evidence: GenreEvidenceSource
  confidence: number
}

export interface GenreClassificationInput {
  name: string
  artists: string
  region: "vn" | "us"
  providerGenres?: readonly string[]
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function key(name: string, artists: string) {
  return `${normalize(artists)}::${normalize(name)}`
}

const curatedTrackGenres = new Map(
  CURATED_SONG_SEEDS.map((seed) => [key(seed.name, seed.artists), seed.genre])
)

const curatedArtistGenres = new Map<string, TrackGenre>()
for (const seed of CURATED_SONG_SEEDS) {
  const artist = normalize(seed.artists)
  if (!artist) continue
  const current = curatedArtistGenres.get(artist)
  if (!current || current === seed.genre) curatedArtistGenres.set(artist, seed.genre)
  else curatedArtistGenres.delete(artist)
}

const RAP_GENRE_MARKERS = ["rap", "hip hop", "hip-hop", "trap", "drill", "grime"]
const NON_RAP_USUK_MARKERS = [
  "pop",
  "rock",
  "alternative",
  "r&b",
  "soul",
  "electronic",
  "dance",
  "country",
  "folk",
  "indie",
]

function hasMarker(genres: readonly string[], markers: readonly string[]) {
  return genres.some((genre) => {
    const normalized = normalize(genre)
    const tokens = normalized.split(" ").filter(Boolean)
    return markers.some((marker) => {
      const markerTokens = normalize(marker).split(" ").filter(Boolean)
      if (markerTokens.length === 0 || markerTokens.length > tokens.length) return false
      return markerTokens.every((token, index) => tokens[index] === token) ||
        tokens.some((_, index) => markerTokens.every((token, offset) => tokens[index + offset] === token))
    })
  })
}

function classifyProviderGenres(
  input: GenreClassificationInput
): GenreClassification | null {
  const genres = input.providerGenres?.filter((genre) => typeof genre === "string") || []
  if (genres.length === 0) return null

  if (hasMarker(genres, RAP_GENRE_MARKERS)) {
    return { genre: "rap", evidence: "provider", confidence: 0.98 }
  }

  if (input.region === "vn" && hasMarker(genres, ["v-pop", "vietnamese pop"])) {
    return { genre: "vpop", evidence: "provider", confidence: 0.95 }
  }

  if (input.region === "us" && hasMarker(genres, NON_RAP_USUK_MARKERS)) {
    return { genre: "usuk", evidence: "provider", confidence: 0.9 }
  }

  return null
}

export function classifyChartGenre(
  input: GenreClassificationInput
): GenreClassification | null {
  const providerClassification = classifyProviderGenres(input)
  if (providerClassification) return providerClassification

  const exactGenre = curatedTrackGenres.get(key(input.name, input.artists))
  if (exactGenre) {
    return { genre: exactGenre, evidence: "allowlist", confidence: 1 }
  }

  const artistGenre = curatedArtistGenres.get(normalize(input.artists))
  if (artistGenre) {
    return { genre: artistGenre, evidence: "allowlist", confidence: 0.98 }
  }

  return null
}

export function isRapGenreMetadata(providerGenres: readonly string[]) {
  return hasMarker(providerGenres, RAP_GENRE_MARKERS)
}
