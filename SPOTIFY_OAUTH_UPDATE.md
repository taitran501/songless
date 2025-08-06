# Spotify OAuth Configuration Update

## Changes Made

### 1. Updated Redirect URI
- **From:** `http://localhost:3000/callback`
- **To:** `http://127.0.0.1:3000/callback`

### 2. Files Updated

#### `app/page.tsx`
- Updated redirect URI in login page
- Now uses centralized config from `lib/spotify-config.ts`

#### `app/api/spotify/callback/route.ts`
- Updated redirect URI in token exchange
- Now uses centralized config from `lib/spotify-config.ts`

#### `lib/utils.ts`
- Updated token refresh function to use centralized config

### 3. New Files Created

#### `lib/spotify-config.ts`
Centralized Spotify OAuth configuration:
```typescript
export const SPOTIFY_CONFIG = {
  CLIENT_ID: "1daec2519aeb40c7aa27fff905d4a99b",
  CLIENT_SECRET: "5771de91e45a4fa08e5fe1b22c6746b4",
  REDIRECT_URI: "http://127.0.0.1:3000/callback",
  SCOPES: [
    "user-read-playback-state",
    "user-modify-playback-state", 
    "playlist-read-private",
    "playlist-read-collaborative"
  ].join(" "),
  AUTH_STATE: "STATE"
}
```

#### `hooks/use-spotify-auth.ts`
Custom hook for managing Spotify authentication:
- Token management
- Automatic token refresh
- Error handling
- Logout functionality

### 4. Benefits

1. **Centralized Configuration**: All Spotify OAuth settings in one place
2. **Consistent URI**: All endpoints use `127.0.0.1:3000` instead of `localhost:3000`
3. **Better Token Management**: Hook-based approach for token handling
4. **Type Safety**: Proper TypeScript types for all configurations
5. **Maintainability**: Easy to update OAuth settings across the app

### 5. Testing Checklist

- [ ] OAuth flow works with new redirect URI
- [ ] Token exchange completes successfully
- [ ] Token refresh works when access token expires
- [ ] All API calls use the correct authorization headers
- [ ] Game functionality works with updated authentication

### 6. Next Steps

1. Test the complete OAuth flow
2. Verify token refresh functionality
3. Test with real Spotify playlists
4. Monitor for any authentication errors 