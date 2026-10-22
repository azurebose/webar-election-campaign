# WebAR Multi-Ward Election Campaign Platform

A high-performance, production-ready WebAR election campaigning platform built with **Next.js**, **MindAR**, **A-Frame**, **Cloudflare R2** ($0 egress storage & CDN), and **Firebase** (passwordless magic-link authentication & scan quota engine).

Designed for large-scale election campaigns with multi-ward candidate poster management, instant in-browser feature compilation, and interactive 3D voter pledge engagement.

---

## 🌟 Key Features

### 1. WebAR Multi-Ward Image Tracking & Speech Overlays
- **Real-Time AR Tracking**: Anchors high-definition candidate speech videos directly onto physical campaign posters when viewed through any mobile browser or desktop webcam.
- **Audio Context Priming**: Mobile Safari (iOS) and Chrome (Android) gesture priming ensures seamless audio unlock without user frustration.
- **Dedicated Single-Ward & Combined Tracking**:
  - **Single-Ward Mode**: Print QR codes with `/?ward=1`, `/?ward=2`, etc. Loads dedicated `ward_X_targets.mind` for 100% focused, instant tracking with zero cross-talk.
  - **Multi-Ward Mode**: Opening `/?` dynamically detects and tracks any active ward poster in the constituency.

### 2. Multi-Ward Campaign Studio & Individual Poster Compiler (`/admin`)
- **Individual Ward Poster Compilation**: Compile each candidate's poster individually in 2–4 seconds without needing all ward posters upfront.
- **Bulk Compilation**: Rebuild all ward targets at once whenever needed.
- **Pre-Signed Direct Ingestion**: Securely uploads compiled `.mind` tracking files, poster images, and speech videos directly from the browser to Cloudflare R2 using AWS S3 pre-signed PUT URLs.
- **Interactive Ward Preview**: Instant side-by-side preview of poster markers, candidate speech videos, and scannable ward details.

### 3. Cloudflare R2 Media Storage ($0 Egress CDN)
- **Zero-Egress Delivery**: Serves heavy media assets (videos, high-res posters, compiled MindAR descriptors) globally with zero bandwidth/egress costs.
- **Restricted Administrative Ingestion**: Only requests authorized with `ADMIN_EMAIL` can generate pre-signed upload URLs. Public voters are restricted to read-only CDN access.

### 4. Voter Quota Engine & Passwordless Magic-Link Authentication
- **2 Free Scans Anonymously**: First 2 poster scans are free for unregistered voters tracked via device fingerprinting.
- **Zero-Button Email Capture**: Automatically debounces email input (750ms) or responds to Enter to send a passwordless Firebase Auth sign-in link pointing to `/auth/verify-link`.
- **Unlimited Scan Unlock**: Once verified via email magic link, voter sessions unlock unlimited scans stored securely in Firestore (`voter_profiles/{uid}`).

### 5. Interactive 3D "Pledge to Vote" Button
- **A-Frame 3D Element**: Floating interactive 3D button attached to candidate posters with raycasting cursor interaction.
- **Visual Micro-Feedback**: Transitions from election red to bright gold upon click.
- **Dual Persistence**: Records voter pledges atomically in Firebase Firestore (`voter_profiles/{uid}.pledged_to_vote = true`) with optional Supabase fallback.

### 6. Bilingual Localization
- Designed for grassroots voter accessibility with seamless bilingual **Telugu (తెలుగు) & English** typography and prompts.

---

## 🏗️ Architecture & Project Structure

```text
ar-tech/
├── firestore.rules                 # Security rules for visitor sessions & voter profiles
├── next.config.js                  # Static export configuration for Cloudflare Pages
├── package.json                    # Project dependencies (AWS S3 SDK, Firebase, MindAR)
├── .env.example                    # Template for Cloudflare R2 & Firebase credentials
├── public/
│   ├── sample_marker.png           # Default official election alliance poster
│   ├── targets.mind                # Pre-compiled MindAR tracking descriptors
│   ├── campaign_speech.mp4         # Default campaign speech video
│   └── wards.json                  # Multi-ward configuration registry
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx            # Campaign Admin Studio (Individual & Bulk Compiling + R2 Sync)
│   │   ├── api/
│   │   │   └── admin/
│   │   │       └── upload-url/     # Next.js Route generating signed S3 PUT URLs for R2
│   │   ├── auth/
│   │   │   └── verify-link/        # Magic-link verification & session unlock handler
│   │   ├── layout.tsx              # Root HTML shell with MindAR & A-Frame CDNs
│   │   └── page.tsx                # Main voter entry point
│   ├── components/
│   │   ├── ARView.tsx              # MindAR + A-Frame viewport, single/multi-ward anchors
│   │   ├── QuotaModal.tsx          # Passwordless email verification modal
│   │   ├── StartOverlay.tsx        # Camera permission gesture & audio unlock overlay
│   │   └── WardPosterModal.tsx     # Voter dialog to view & download all ward posters
│   ├── lib/
│   │   ├── firebase.ts             # Firebase singleton initialization (Auth & Firestore)
│   │   ├── quota.ts                # Quota enforcement, device fingerprinting, and pledge tracking
│   │   └── r2.ts                   # AWS S3-compatible client for Cloudflare R2 storage
│   └── utils/
│       ├── idbStorage.ts           # IndexedDB client-side asset caching & session re-hydration
│       └── supabaseClient.ts       # Optional Supabase integration
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ or 20+
- A modern mobile browser (Safari on iOS, Chrome on Android) or desktop with a webcam

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/azurebose/webar-election-campaign.git
cd webar-election-campaign

# Install dependencies
npm install
```

### 3. Environment Setup
Copy the template environment file:
```bash
cp .env.example .env.local
```

Fill in your Cloudflare R2 and Firebase credentials:
```env
# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=election-campaign-assets
NEXT_PUBLIC_R2_PUBLIC_DOMAIN=pub-xxxxxxxx.r2.dev
ADMIN_EMAIL=admin@electioncampaign.org

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:...
```

### 4. Enable CORS on Cloudflare R2 Bucket
To allow direct browser uploads from the Admin Studio to your R2 bucket:
1. Open the [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → Select your bucket (`election-campaign-assets`) → **Settings**.
2. Scroll to **CORS Policy** → **Add CORS Policy**.
3. Paste the following JSON:
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.pages.dev",
      "https://*.vercel.app",
      "*"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
4. Click **Save**.

### 5. Run the Local Development Server
```bash
npm run dev
```
- Open `http://localhost:3000` to test the Voter AR experience.
- Open `http://localhost:3000/admin` to access the Campaign Admin Command Center (passcode: `bose@@2026`).

---

## 📱 Campaign Workflow

### Step 1: Manage Ward Posters in `/admin`
1. Navigate to `http://localhost:3000/admin`.
2. Add or edit wards (e.g. Ward 1, Ward 2, Ward 3).
3. Upload each candidate's poster image (`.png` / `.jpg`) and speech video (`.mp4`).
4. Click **`⚡ Compile Poster`** on any ward to compile its tracking descriptors and upload it directly to Cloudflare R2 in seconds.
5. Click **`🔗 Copy AR Link`** to retrieve that ward's dedicated link:
   - `https://your-domain.com/?ward=1`
   - `https://your-domain.com/?ward=2`

### Step 2: Print Ward Campaign Posters with QR Codes
- Generate a QR code pointing to `https://your-domain.com/?ward={N}` and print it on the physical poster for Ward N.
- Voters scan the QR code with their mobile phone camera, opening the browser directly in single-ward AR mode.

### Step 3: Voter Scans & Pledge
1. Voter points phone camera at the physical poster.
2. The candidate speech video immediately anchors onto the poster with sound.
3. Voter taps the 3D **"Pledge to Vote"** button, recording their support.
4. If an unregistered voter reaches 2 scans, the quota modal smoothly invites them to enter their email for unlimited scans.

---

## 🌐 Production Deployment

### Option 1: Cloudflare Pages (Recommended)
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com), go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select `webar-election-campaign`.
4. Configure Build Settings:
   - **Framework preset**: `None` or `Next.js (Static HTML Export)`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
5. Under **Environment Variables**, add your production values from `.env.local`.
6. Click **Save and Deploy**.

### Option 2: Vercel
1. Import your GitHub repository on [vercel.com/new](https://vercel.com/new).
2. Configure environment variables (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ADMIN_EMAIL`, etc.).
3. Deploy!

---

## 🔒 Security Best Practices
- **No Secret Leaks**: `.env.local` and credentials are never checked into git.
- **Restricted Ingestion**: Only the `ADMIN_EMAIL` specified in your private environment can generate pre-signed upload URLs.
- **Read-Only Public CDN**: Voters only access Cloudflare R2 via public CDN GET requests (`$0 egress`).
- **Firestore Rules**: Strict security rules prevent tampering with scan allowances or pledging on behalf of other users.

---

## 👨‍💻 Author & Credits
**Developed by Bose Kodelli**  
Full-Stack WebAR Election Campaigning Architecture with zero-egress Cloudflare R2 storage, Firebase passwordless authentication, MindAR computer vision, and bilingual Telugu/English support.
