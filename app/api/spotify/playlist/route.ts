import { type NextRequest, NextResponse } from "next/server"
import type { GameTrack } from "@/lib/tracks"
import { getSpotifyConfig, SPOTIFY_ENDPOINTS } from "@/lib/spotify-config"

const SPOTIFY_REQUEST_TIMEOUT_MS = 8000
const MAX_PLAYLIST_TRACKS = 1000
const MAX_PLAYLIST_PAGES = 20
const SPOTIFY_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/

type SpotifyErrorCode =
  | "spotify_not_configured"
  | "spotify_credentials_rejected"
  | "spotify_playlist_private_or_unavailable"
  | "spotify_playlist_not_found"
  | "spotify_rate_limited"
  | "spotify_provider_unavailable"

class SpotifyProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: string | null,
    public code: SpotifyErrorCode = "spotify_provider_unavailable"
  ) {
    super(message)
    this.name = "SpotifyProviderError"
  }
}

type TokenCache = {
  clientId: string
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

async function fetchSpotify(input: string, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SPOTIFY_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SpotifyProviderError("Spotify request timed out. Please try again.", 504)
    }
    throw new SpotifyProviderError("Spotify is temporarily unavailable. Please try again.", 502)
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new SpotifyProviderError("Spotify returned an invalid response.", 502)
  }
}

async function readProviderErrorMessage(response: Response) {
  try {
    const payload = await response.json()
    if (!payload || typeof payload !== "object") return ""

    const error = (payload as { error?: unknown }).error
    if (typeof error === "string") return error
    if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message
    }
  } catch {
    // The status code still gives us a safe, user-facing classification.
  }
  return ""
}

function getRetryAfter(response: Response) {
  const value = response.headers.get("Retry-After")
  return value && /^\d{1,6}$/.test(value.trim()) ? value.trim() : null
}

function getSpotifyTokenError(status: number) {
  if (status === 400 || status === 401 || status === 403) {
    return {
      message: "Spotify credentials were rejected. Check the server credentials and try again.",
      status: 503,
      code: "spotify_credentials_rejected" as const,
    }
  }
  if (status === 429) {
    return {
      message: "Spotify is rate-limiting requests. Please try again shortly.",
      status: 429,
      code: "spotify_rate_limited" as const,
    }
  }
  return {
    message:
      status >= 500
        ? "Spotify is temporarily unavailable. Please try again."
        : "Spotify playlist loading failed. Please try again.",
    status: status >= 500 ? 502 : 503,
    code: "spotify_provider_unavailable" as const,
  }
}

function getSpotifyPlaylistError(status: number, upstreamMessage = "") {
  const normalizedMessage = upstreamMessage.toLowerCase()
  if (status === 404 || /not found/.test(normalizedMessage)) {
    return {
      message: "This Spotify playlist could not be found.",
      status: 404,
      code: "spotify_playlist_not_found" as const,
    }
  }
  if (status === 401) {
    return {
      message: "Spotify authorization was rejected. Check the server credentials and try again.",
      status: 503,
      code: "spotify_credentials_rejected" as const,
    }
  }
  if (status === 403) {
    if (/private|unavailable/.test(normalizedMessage)) {
      return {
        message: "This Spotify playlist is private or unavailable.",
        status: 403,
        code: "spotify_playlist_private_or_unavailable" as const,
      }
    }
    return {
      message:
        "Spotify denied access to this request. The playlist may be private, or Spotify access is not enabled for this deployment.",
      status: 503,
      code: "spotify_provider_unavailable" as const,
    }
  }
  if (status === 429) {
    return {
      message: "Spotify is rate-limiting requests. Please try again shortly.",
      status: 429,
      code: "spotify_rate_limited" as const,
    }
  }
  if (status >= 500) {
    return {
      message: "Spotify is temporarily unavailable. Please try again.",
      status: 502,
      code: "spotify_provider_unavailable" as const,
    }
  }
  return {
    message: "Spotify playlist loading failed. Please try again.",
    status: 502,
    code: "spotify_provider_unavailable" as const,
  }
}

function providerErrorResponse(error: SpotifyProviderError) {
  const headers = error.retryAfter ? { "Retry-After": error.retryAfter } : undefined
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status, headers }
  )
}

async function getClientCredentialsToken() {
  const { CLIENT_ID, CLIENT_SECRET } = getSpotifyConfig()
  if (!CLIENT_ID || !CLIENT_SECRET) return null

  if (
    tokenCache &&
    tokenCache.clientId === CLIENT_ID &&
    tokenCache.expiresAt > Date.now() + 30_000
  ) {
    return tokenCache.accessToken
  }

  const response = await fetchSpotify(SPOTIFY_ENDPOINTS.TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  })

  if (!response.ok) {
    const error = getSpotifyTokenError(response.status)
    throw new SpotifyProviderError(
      error.message,
      error.status,
      getRetryAfter(response),
      error.code
    )
  }

  const data = await readJson(response)
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { access_token?: unknown }).access_token !== "string"
  ) {
    throw new SpotifyProviderError("Spotify returned an invalid access token.", 502)
  }

  const expiresIn = Number((data as { expires_in?: unknown }).expires_in)
  tokenCache = {
    clientId: CLIENT_ID,
    accessToken: (data as { access_token: string }).access_token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3600_000),
  }
  return tokenCache.accessToken
}

async function fetchSpotifyApi(
  input: string,
  accessToken: string
): Promise<{ response: Response; accessToken: string }> {
  const request = (token: string) =>
    fetchSpotify(input, { headers: { Authorization: `Bearer ${token}` } })
  let response = await request(accessToken)
  if (response.status !== 401 && response.status !== 403) return { response, accessToken }

  // A cached token can be revoked before its advertised expiry. Refresh once
  // so a transient Spotify auth rotation does not strand the playlist run.
  tokenCache = null
  const refreshedToken = await getClientCredentialsToken()
  if (!refreshedToken || refreshedToken === accessToken) return { response, accessToken }
  response = await request(refreshedToken)
  return { response, accessToken: refreshedToken }
}

function mapSpotifyTrack(item: unknown): GameTrack | null {
  if (!item || typeof item !== "object") return null
  const track = (item as { track?: unknown }).track
  if (!track || typeof track !== "object") return null

  const value = track as {
    uri?: unknown
    name?: unknown
    artists?: unknown
    duration_ms?: unknown
    preview_url?: unknown
    album?: unknown
  }
  if (typeof value.uri !== "string" || !value.uri.trim()) return null
  if (typeof value.name !== "string" || !value.name.trim()) return null

  const artists = Array.isArray(value.artists)
    ? value.artists
        .map((artist) =>
          artist && typeof artist === "object" && typeof (artist as { name?: unknown }).name === "string"
            ? (artist as { name: string }).name.trim()
            : ""
        )
        .filter(Boolean)
    : []
  if (artists.length === 0) return null

  const album = value.album && typeof value.album === "object" ? value.album : null
  const images = album && Array.isArray((album as { images?: unknown }).images)
    ? (album as { images: unknown[] }).images
    : []
  const albumImage = images.find(
    (image) => image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string"
  ) as { url: string } | undefined

  const duration = Number(value.duration_ms)
  return {
    source: "spotify",
    uri: value.uri,
    name: value.name.trim(),
    artists: artists.join(", "),
    duration_ms: Number.isFinite(duration) && duration >= 0 ? duration : 0,
    albumImage: albumImage?.url ?? null,
    preview_url:
      typeof value.preview_url === "string" && value.preview_url.trim()
        ? value.preview_url
        : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const playlistId = searchParams.get("playlistId")?.trim() || ""

    if (!playlistId) {
      return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
    }
    if (!SPOTIFY_ID_PATTERN.test(playlistId)) {
      return NextResponse.json({ error: "Invalid Spotify playlist ID" }, { status: 400 })
    }

    let accessToken = await getClientCredentialsToken()
    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Public Spotify playlist loading is not configured.",
          code: "spotify_not_configured" satisfies SpotifyErrorCode,
        },
        { status: 503 }
      )
    }

    let playlistName = `Playlist #${playlistId}`
    const metadataResult = await fetchSpotifyApi(
      `${SPOTIFY_ENDPOINTS.API_BASE}/playlists/${encodeURIComponent(playlistId)}?fields=name`,
      accessToken
    )
    accessToken = metadataResult.accessToken
    const metadataResponse = metadataResult.response
    if (!metadataResponse.ok) {
      const providerError = getSpotifyPlaylistError(
        metadataResponse.status,
        await readProviderErrorMessage(metadataResponse)
      )
      throw new SpotifyProviderError(
        providerError.message,
        providerError.status,
        getRetryAfter(metadataResponse),
        providerError.code
      )
    }
    const metadata = await readJson(metadataResponse)
    if (
      metadata &&
      typeof metadata === "object" &&
      typeof (metadata as { name?: unknown }).name === "string" &&
      (metadata as { name: string }).name.trim()
    ) {
      playlistName = (metadata as { name: string }).name.trim()
    }

    const allTracks: GameTrack[] = []
    let offset = 0
    const limit = 100

    for (
      let page = 0;
      page < MAX_PLAYLIST_PAGES && allTracks.length < MAX_PLAYLIST_TRACKS;
      page++
    ) {
      const result = await fetchSpotifyApi(
        `${SPOTIFY_ENDPOINTS.API_BASE}/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}&offset=${offset}`,
        accessToken
      )
      accessToken = result.accessToken
      const response = result.response
      if (!response.ok) {
        const providerError = getSpotifyPlaylistError(
          response.status,
          await readProviderErrorMessage(response)
        )
        throw new SpotifyProviderError(
          providerError.message,
          providerError.status,
          getRetryAfter(response),
          providerError.code
        )
      }

      const data = await readJson(response)
      if (!data || typeof data !== "object" || !Array.isArray((data as { items?: unknown }).items)) {
        throw new SpotifyProviderError("Spotify returned an invalid playlist response.", 502)
      }

      const items = (data as { items: unknown[] }).items
      if (items.length === 0) break
      for (const item of items) {
        const track = mapSpotifyTrack(item)
        if (track) allTracks.push(track)
        if (allTracks.length >= MAX_PLAYLIST_TRACKS) break
      }

      const next = (data as { next?: unknown }).next
      if (typeof next !== "string" || !next || items.length < limit) break
      offset += items.length
    }

    return NextResponse.json(allTracks, {
      headers: {
        "x-playlist-name": encodeURIComponent(playlistName),
        "cache-control": "private, no-store",
      },
    })
  } catch (error) {
    if (error instanceof SpotifyProviderError) return providerErrorResponse(error)
    console.error("Error fetching Spotify playlist:", error)
    return NextResponse.json(
      { error: "Spotify playlist loading failed. Please try again." },
      { status: 502 }
    )
  }
}
