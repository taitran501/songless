# 🚀 Hướng dẫn Deploy SonglessUnlimited lên Vercel

## 📋 Prerequisites
- GitHub account
- Vercel account (free)
- Spotify Developer account

## 🔧 Bước 1: Chuẩn bị Spotify App

### 1.1 Tạo Spotify App
1. Vào [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Điền thông tin:
   - **App name**: SonglessUnlimited
   - **App description**: Music guessing game
   - **Website**: `https://your-domain.vercel.app` (sẽ cập nhật sau)
   - **Redirect URI**: `https://your-domain.vercel.app/api/spotify/callback` (sẽ cập nhật sau)

### 1.2 Lấy Credentials
- Copy **Client ID** và **Client Secret**
- Lưu lại để dùng ở bước sau

## 🚀 Bước 2: Deploy lên Vercel

### 2.1 Push code lên GitHub
```bash
# Tạo repository mới trên GitHub
# Sau đó push code lên
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/songless.git
git push -u origin main
```

### 2.2 Deploy trên Vercel
1. Vào [vercel.com](https://vercel.com)
2. Sign up/Sign in với GitHub
3. Click "New Project"
4. Import repository từ GitHub
5. Cấu hình:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### 2.3 Cấu hình Environment Variables
Trong Vercel Dashboard, vào **Settings > Environment Variables**:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-domain.vercel.app/api/spotify/callback
```

### 2.4 Deploy
1. Click "Deploy"
2. Đợi build hoàn thành (2-3 phút)
3. Lấy URL: `https://your-project.vercel.app`

## 🔄 Bước 3: Cập nhật Spotify App

### 3.1 Cập nhật Redirect URI
1. Vào Spotify Developer Dashboard
2. Chỉnh sửa app
3. Thêm Redirect URI: `https://your-domain.vercel.app/api/spotify/callback`
4. Save changes

### 3.2 Test OAuth Flow
1. Vào app URL
2. Test login với Spotify
3. Kiểm tra callback hoạt động

## 🔧 Bước 4: Custom Domain (Optional)

### 4.1 Thêm Custom Domain
1. Trong Vercel Dashboard > Settings > Domains
2. Add domain: `songless.yourdomain.com`
3. Follow DNS instructions

### 4.2 Cập nhật Spotify App
1. Cập nhật Website URL
2. Cập nhật Redirect URI với domain mới

## 🐛 Troubleshooting

### Build Errors
- Kiểm tra `next.config.mjs` đã có `ignoreBuildErrors: true`
- Kiểm tra TypeScript errors

### OAuth Errors
- Kiểm tra Redirect URI đúng format
- Kiểm tra Client ID/Secret
- Kiểm tra Environment Variables

### Runtime Errors
- Kiểm tra console logs
- Kiểm tra Vercel Function logs

## 📱 Testing

### Local Testing
```bash
npm run dev
```

### Production Testing
1. Deploy lên Vercel
2. Test tất cả features:
   - Spotify login
   - Playlist loading
   - Game functionality
   - Shuffle feature

## 🔒 Security Notes

- ✅ Environment variables được bảo mật
- ✅ HTTPS tự động với Vercel
- ✅ No sensitive data in client-side code
- ✅ OAuth flow secure

## 📈 Monitoring

- Vercel Analytics (free)
- Function logs trong Vercel Dashboard
- Error tracking với Sentry (optional)

## 🎯 Next Steps

1. **Analytics**: Thêm Google Analytics
2. **Domain**: Mua custom domain
3. **CDN**: Vercel Edge Network
4. **Database**: Thêm user progress tracking
5. **Social**: Share scores on social media

---

**🎉 Chúc mừng! App của bạn đã live trên internet!** 