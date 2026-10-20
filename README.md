# WebAR Election Campaign App

A production-ready WebAR campaigning web app built with Next.js, MindAR, A-Frame, and Supabase.

## Features
- **WebAR Image Tracking**: Detects campaign poster marker and overlays video speech and 3D pledge button in real-time.
- **Audio Context Priming**: Full iOS Safari and Android Chrome compatibility with sound unlock upon user interaction.
- **Quota Enforcement**: First 2 scans are free anonymously. After 2 scans, AR access requires email verification.
- **Zero-Button Passwordless Email Capture**: Debounced auto-submission as soon as a valid email is typed or on Enter.
- **Interactive 3D Pledge Button**: Micro-feedback visual swap and backend recording via `/api/pledge`.

## Project Structure
```text
ar-tech/
├── public/
│   ├── targets.mind            # Compiled MindAR target file
│   └── campaign_speech.mp4     # Campaign speech video asset
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/route.ts   # Passwordless magic-link authentication
│   │   │   ├── pledge/route.ts # Voter pledge tracking
│   │   │   └── scan/route.ts   # Quota check & scan increment
│   │   ├── globals.css         # Tailwind directives & transitions
│   │   ├── layout.tsx          # App shell with A-Frame & MindAR scripts
│   │   └── page.tsx            # Home page loading WebAR scene
│   ├── components/
│   │   ├── ARView.tsx          # MindAR + A-Frame scene with raycasting & 3D button
│   │   ├── QuotaModal.tsx      # Zero-button email authentication modal
│   │   └── StartOverlay.tsx    # Audio priming & permissions gesture modal
│   └── declarations.d.ts       # TypeScript definitions for A-Frame JSX tags
├── utils/
│   └── supabaseClient.ts       # Supabase client setup
├── supabase_schema.sql         # SQL script to create tables in Supabase
└── vercel.json                 # Vercel deployment configuration
```

## Quick Start

### 1. Instant Local Testing (Pre-Configured Demo)
The repository comes pre-loaded with working demo assets:
- **Target Marker**: [public/sample_marker.png](file:///e:/desktopfolder/ar-tech/public/sample_marker.png)
- **Compiled Tracking Target**: [public/targets.mind](file:///e:/desktopfolder/ar-tech/public/targets.mind)
- **Speech Video**: [public/campaign_speech.mp4](file:///e:/desktopfolder/ar-tech/public/campaign_speech.mp4)

To test immediately:
1. Run `npm run dev` and open `http://localhost:3000` on your mobile phone (or laptop webcam).
2. Open [sample_marker.png](file:///e:/desktopfolder/ar-tech/public/sample_marker.png) on a second screen or print it.
3. Tap **"Tap Screen to Enter AR"** and point the camera at the marker. The video speech will play directly anchored on the marker with the interactive 3D **"Pledge to Vote"** button!

### 2. Using Custom Campaign Assets
When you're ready to deploy your real candidate's assets:
1. **Target Poster**:
   - Compile your poster image using the [MindAR Image Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile)
   - Or CLI: `npx @mindar/mindar-cli create -i ./your_poster.png -o ./public/targets.mind`
2. **Video Asset**:
   - Replace [public/campaign_speech.mp4](file:///e:/desktopfolder/ar-tech/public/campaign_speech.mp4) with your candidate's MP4 video file.

### 3. Database (Optional for offline demo)
1. Set up a project on [Supabase](https://supabase.com).
2. Run the queries in `supabase_schema.sql` in the Supabase SQL Editor.
3. Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` on your mobile phone or desktop with camera permissions enabled.

---

## Deployment Guides

### Option 1: Cloudflare Pages (Unlimited Bandwidth & Free SSL)
1. Push your repository to **GitHub**:
   ```bash
   git remote add origin https://github.com/<YOUR_USER>/<REPO>.git
   git branch -M main
   git push -u origin main
   ```
2. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com).
3. Navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
4. Select your `webar-election-campaign` repository.
5. In **Build Settings**:
   - **Framework Preset**: `None` or `Next.js (Static HTML Export)`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `out`
   - **Root directory**: `/`
6. Under **Environment Variables**, add:
   - `NODE_VERSION` = `20`
   - `NEXT_PUBLIC_SUPABASE_URL` = `<your-supabase-url>` (optional)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-anon-key>` (optional)
7. Under **Settings** → **Functions** → **Compatibility Flags**, add: `nodejs_compat`.
8. Click **Save and Deploy**. Cloudflare will deploy to a global HTTPS edge URL (e.g., `https://webar-election-campaign.pages.dev`).

### Option 2: Vercel (1-Click Native Deployment)
1. Import your GitHub repository on [vercel.com/new](https://vercel.com/new).
2. Add your environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. Click **Deploy**. Vercel will build and provision an SSL-secured `.vercel.app` domain.

---

## Author & Credits
**Developed by Bose Kodelli**  
A full-stack WebAR election campaigning application featuring real-time image tracking, speech video playback, interactive 3D pledge voting, quota enforcement, and zero-button passwordless email authentication.


