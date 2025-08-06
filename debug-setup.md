# Debug Setup Guide

## ✅ Đã Fix:

### 1. Dependencies Installation
```bash
npm install --legacy-peer-deps
```
- ✅ Fixed React version conflict
- ✅ All packages installed successfully

### 2. Environment Variables
Created `.env.local`:
```env
# Spotify OAuth Configuration
SPOTIFY_CLIENT_ID=1daec2519aeb40c7aa27fff905d4a99b
SPOTIFY_CLIENT_SECRET=5771de91e45a4fa08e5fe1b22c6746b4
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
```

### 3. Server Status
- ✅ Next.js dev server running on http://127.0.0.1:3000
- ✅ API endpoints responding correctly
- ✅ 401 Unauthorized for playlist API (expected without token)

## 🧪 Testing Steps:

### 1. Test OAuth Flow
1. Open http://127.0.0.1:3000
2. Should redirect to Spotify OAuth
3. After authorization, should redirect back to /callback
4. Should then redirect to /playlist

### 2. Test Playlist API
1. Login to get access token
2. Try adding a playlist ID/URL
3. Should fetch tracks successfully

### 3. Test Game
1. Load playlist with tracks
2. Start game
3. Test Spotify Web Playback SDK

## 🔧 Troubleshooting:

### If OAuth fails:
- Check Spotify App settings in Spotify Developer Dashboard
- Verify redirect URI matches exactly: `http://127.0.0.1:3000/callback`
- Check browser console for errors

### If API calls fail:
- Check network tab for request/response
- Verify access token is valid
- Check if token refresh is working

### If Game doesn't work:
- Check Spotify Premium subscription
- Verify Web Playback SDK loads
- Check browser console for SDK errors

## 📝 Environment Variables Usage:

The app now uses environment variables from `.env.local`:
- `SPOTIFY_CLIENT_ID` - Your Spotify App Client ID
- `SPOTIFY_CLIENT_SECRET` - Your Spotify App Client Secret  
- `SPOTIFY_REDIRECT_URI` - OAuth redirect URI

If you need to change these, update `.env.local` and restart the dev server. 