# Test Flow for SonglessUnlimited

## Game Rules (Updated)
- **6 Stages**: 0.5s, 1s, 2s, 4s, 8s, 15s
- **Skip anytime**: Can skip to next stage without listening (including stage 6)
- **Pause/Resume**: Can pause during playback
- **Submit anytime**: Can submit answer even while playing
- **Game over**: After stage 6 (15s), if not guessed correctly
- **Manual start**: User must click "Start Game" button after loading playlist

## Expected Console Logs Flow

### 1. Initial Load (TracksProvider)
```
📦 [TracksProvider] Loaded tracks from localStorage: X
```

### 2. GamePage Mount
```
🔍 [GamePage] Effect 1 - Checking auth and tracks: {
  accessToken: true/false,
  tracksLength: X,
  tracksLoading: false,
  authLoading: true/false,
  isLoading: true
}
```

### 3. Auth Loading (if authLoading: true)
```
🔍 [GamePage] Auth still loading, waiting...
```

### 4. Tracks Loading (if tracksLoading: true)
```
🔍 [GamePage] Tracks still loading, waiting...
```

### 5. All Checks Passed
```
🔍 [GamePage] All checks passed, setting loading to false
```

### 6. Premium Check
```
Checking Premium status...
Player endpoint status: 200/403
Is Premium (based on player access): true/false
```

### 7. SDK Initialization (for Premium users)
```
=== INITIALIZING SDK FOR PREMIUM USER ===
=== SDK READY ===
=== PLAYER READY ===
```

### 8. Track Playback (using Spotify Web API)
```
PUT https://api.spotify.com/v1/me/player/play?device_id=...
Response: 204 (Success)
```

### 9. Game Controls
```
- Play: Start/resume playback
- Skip: Move to next stage (0.5s → 1s → 2s → 4s → 8s → 15s)
- Submit: Guess song title (anytime)
- Game Over: After stage 6 (15s) if not guessed correctly
```

## Debugging Steps

### If you see "No access token, redirecting to /":
- Check if `authLoading` is `true` - if so, this is expected, wait for it to become `false`
- Check localStorage for `spotify_access_token`

### If you see "No tracks — redirecting back to /playlist":
- Check if `tracksLoading` is `true` - if so, this is expected, wait for it to become `false`
- Check localStorage for `game_tracks`

### If you see "Skipping SDK initialization":
- Check if `premiumCheckDone` is `true`
- Check if `isPremium` is `true`
- Check if `player` already exists

### If you see "Error playing track":
- Check if `deviceId` is set correctly
- Check if `accessToken` is valid
- Check if track URI is valid
- Check Spotify Web API response status

## Common Issues

1. **Token expires**: Check `spotify_expires_at` in localStorage
2. **No tracks in localStorage**: Need to load playlist first
3. **Premium check fails**: User might not have Premium subscription
4. **SDK script fails to load**: Network issue or CDN problem

## Test Commands

```bash
# Check localStorage in browser console
localStorage.getItem("spotify_access_token")
localStorage.getItem("game_tracks")

# Clear everything for fresh test
localStorage.clear()
``` 