import { useState, useEffect } from "react"

interface SpotifyAuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number // ms epoch
  isLoading: boolean
  error: string | null
}

interface SpotifyRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export function useSpotifyAuth() {
  const [authState, setAuthState] = useState<SpotifyAuthState>({
    accessToken: null,
    refreshToken: null,
    expiresAt: 0,
    isLoading: true,
    error: null
  })

  // Detect if we are running in the Playwright E2E test environment.
  // Port 3100 is used for testing as defined in package.json.
  const isTestEnvironment = () => {
    if (typeof window === "undefined") return false
    return window.location.port === "3100" || window.localStorage.getItem("is_test") === "true"
  }

  useEffect(() => {
    const loadSession = async () => {
      try {
        // 1. Try to load from secure session endpoint (cookies)
        const res = await fetch("/api/spotify/session")
        if (res.ok) {
          const data = await res.json()
          if (data.accessToken) {
            setAuthState({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresAt: data.expiresAt,
              isLoading: false,
              error: null
            })
            return
          }
        }
      } catch (err) {
        console.warn("Failed to fetch session from cookies:", err)
      }

      // 2. Fallback to localStorage (mostly for E2E tests)
      const accessToken = localStorage.getItem("spotify_access_token")
      const refreshToken = localStorage.getItem("spotify_refresh_token")
      const expiresAt = localStorage.getItem("spotify_expires_at")
      
      setAuthState({
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? parseInt(expiresAt) : 0,
        isLoading: false,
        error: null
      })
    }

    loadSession()
  }, [])

  const ensureValidToken = async (): Promise<string | null> => {
    const now = Date.now()
    // We consider the token expired if it's missing or past the threshold.
    // If we're in cookie mode, authState.accessToken might be valid on the server, but let's check.
    const isExpired = !authState.accessToken || now > authState.expiresAt - 60000 // 1 min buffer
    
    if (isExpired) {
      const refreshedToken = await refreshTokens()
      return refreshedToken
    }
    
    return authState.accessToken
  }

  const refreshTokens = async (): Promise<string | null> => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // For E2E tests, pass the refresh token in request body.
      // Otherwise, the server reads the HTTP-only cookie.
      const testRefreshToken = authState.refreshToken || localStorage.getItem("spotify_refresh_token")
      const body = testRefreshToken ? JSON.stringify({ refresh_token: testRefreshToken }) : undefined

      const response = await fetch("/api/spotify/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || "Failed to refresh token")
      }

      const result: SpotifyRefreshResponse = await response.json()
      
      if (result) {
        const expiresAt = Date.now() + result.expires_in * 1000
        
        if (isTestEnvironment()) {
          localStorage.setItem("spotify_access_token", result.access_token)
          localStorage.setItem("spotify_refresh_token", result.refresh_token)
          localStorage.setItem("spotify_expires_at", expiresAt.toString())
        }
        
        setAuthState({
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt,
          isLoading: false,
          error: null
        })
        return result.access_token
      } else {
        setAuthState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: "Failed to refresh token" 
        }))
        return null
      }
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Token refresh failed" 
      }))
      return null
    }
  }

  const logout = () => {
    // Delete server-side cookies
    fetch("/api/spotify/logout", { method: "POST" }).catch(() => {})

    // Always clear localStorage for completeness
    localStorage.removeItem("spotify_access_token")
    localStorage.removeItem("spotify_refresh_token")
    localStorage.removeItem("spotify_expires_at")

    setAuthState({
      accessToken: null,
      refreshToken: null,
      expiresAt: 0,
      isLoading: false,
      error: null
    })
  }

  const setTokens = (accessToken: string, refreshToken: string, expiresIn: number) => {
    const expiresAt = Date.now() + expiresIn * 1000
    
    // Only persist sensitive tokens in client storage if we are in an E2E test run
    if (isTestEnvironment()) {
      localStorage.setItem("spotify_access_token", accessToken)
      localStorage.setItem("spotify_refresh_token", refreshToken)
      localStorage.setItem("spotify_expires_at", expiresAt.toString())
    }
    
    setAuthState({
      accessToken,
      refreshToken,
      expiresAt,
      isLoading: false,
      error: null
    })
  }

  return {
    ...authState,
    ensureValidToken,
    refreshTokens,
    logout,
    setTokens
  }
}
