# Odyssey - AI-Powered Interactive Storytelling

Have you ever wanted to be a wizard in the harry potter world?
Odyssey is a storytelling platform where the user is the fist character! Just jump into your favourite story :>

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account (for deployment)
- Google Cloud Console account (for OAuth)

### 🔧 Google OAuth 2.0 Setup

#### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google+ API
   - Google OAuth2 API

#### 2. Create OAuth 2.0 Credentials

1. Navigate to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

2. **For Web Application:**
   - Application type: "Web application"
   - Name: "Odyssey Web Client"
   - Authorized redirect URIs:
     ```
     http://localhost:8787/auth/google/callback
     https://your-backend-domain.workers.dev/auth/google/callback
     ```

3. **For Mobile Application (if needed):**
   - Application type: "Android" or "iOS"
   - Add your package name and SHA-1 certificate fingerprint

#### 3. Configure Environment Variables

**Frontend (.env.local or environment):**
```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

**Backend (Cloudflare Secrets):**
```bash
# Development
wrangler secret put GOOGLE_CLIENT_ID --env development
wrangler secret put GOOGLE_CLIENT_SECRET --env development

# Production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

#### 4. Verify Configuration

Run the following to check your setup:
```bash
# Frontend
npm start
# Check console for OAuth validation messages

# Backend
wrangler dev
# Check logs for OAuth validation messages
```

### 📱 Installation

#### Backend Setup
```bash
cd backend
npm install

# Set up OAuth secrets (replace with your actual values)
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Optional: AI service keys
wrangler secret put GEMINI_API_KEY
wrangler secret put HUGGINGFACE_API_KEY

# Run locally
wrangler dev
```

#### Frontend Setup
```bash
cd frontend

# Create environment file
echo "EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id" > .env.local

npm install
npm start
```

### 🌐 Deployment

#### Backend Deployment
```bash
cd backend
wrangler deploy --env production
```

#### Frontend Deployment
```bash
cd frontend
npm run deploy
```

## 🐛 Troubleshooting OAuth Issues

### "Access Blocked: authorization error" 
This error occurs when OAuth is not properly configured:

1. **Check Client ID**: Ensure you're using real client IDs, not placeholders
2. **Verify Redirect URIs**: Make sure redirect URIs in Google Console match your app
3. **Check Environment Variables**: Verify all OAuth variables are set correctly
4. **Review Console Logs**: Check browser/server logs for OAuth validation messages

### Common OAuth Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Access Blocked" | Fake/missing client ID | Set real GOOGLE_CLIENT_ID |
| "redirect_uri_mismatch" | Wrong redirect URI | Update Google Console settings |
| "invalid_client" | Wrong client secret | Check GOOGLE_CLIENT_SECRET |
| "Configuration Error" | Missing backend secrets | Run `wrangler secret put` commands |

## 🎮 Features

- **AI-Powered Storytelling**: Dynamic narrative generation using advanced AI models
- **Interactive Choices**: Make decisions that shape your story
- **Multiple Worlds**: Explore different fictional universes
- **Cross-Platform**: Works on web, iOS, and Android
- **User Profiles**: Save your progress and favorite stories

## 🏗️ Architecture

- **Frontend**: React Native with Expo (cross-platform)
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Gemini API / HuggingFace integration
- **Auth**: Google OAuth 2.0

## 📝 Development

### Project Structure
```
odyssey/
├── backend/          # Cloudflare Workers API
├── frontend/         # React Native/Expo app
└── README.md        # This file
```

### Key Configuration Files
- `backend/wrangler.jsonc` - Cloudflare Workers config
- `frontend/src/config/oauth.ts` - OAuth configuration
- `frontend/src/config.ts` - API endpoints

## 📄 License

MIT License - see LICENSE file for details.

---

**Need help?** Check the console logs for detailed OAuth validation messages and setup instructions.
