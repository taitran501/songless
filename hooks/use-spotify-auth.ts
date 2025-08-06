import { useState, useEffect } from "react"
import { refreshSpotifyToken } from "@/lib/utils"

interface SpotifyAuthState {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number // ms epoch
  isLoading: boolean
  error: string | null
}

export function useSpotifyAuth() {
  const [authState, setAuthState] = useState<SpotifyAuthState>({
    accessToken: null,
    refreshToken: null,
    expiresAt: 0,
    isLoading: true,
    error: null
  })

  useEffect(() => {
    // Load tokens from localStorage on mount
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
  }, [])

  const ensureValidToken = async (): Promise<string | null> => {
    const now = Date.now()
    const isExpired = !authState.accessToken || now > authState.expiresAt - 60000 // 1 min buffer
    
    if (isExpired && authState.refreshToken) {
      console.log("Token expired or expiring soon, refreshing...")
      const success = await refreshTokens()
      return success ? authState.accessToken : null
    }
    
    return authState.accessToken
  }

  const refreshTokens = async () => {
    if (!authState.refreshToken) {
      setAuthState(prev => ({ ...prev, error: "No refresh token available" }))
      return false
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await refreshSpotifyToken(authState.refreshToken)
      
      if (result) {
        const expiresAt = Date.now() + result.expires_in * 1000
        
        localStorage.setItem("spotify_access_token", result.access_token)
        localStorage.setItem("spotify_refresh_token", result.refresh_token)
        localStorage.setItem("spotify_expires_at", expiresAt.toString())
        
        setAuthState({
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt,
          isLoading: false,
          error: null
        })
        return true
      } else {
        setAuthState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: "Failed to refresh token" 
        }))
        return false
      }
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Token refresh failed" 
      }))
      return false
    }
  }

  const logout = () => {
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
    
    localStorage.setItem("spotify_access_token", accessToken)
    localStorage.setItem("spotify_refresh_token", refreshToken)
    localStorage.setItem("spotify_expires_at", expiresAt.toString())
    
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