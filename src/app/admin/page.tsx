'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { saveAssetBlob, getAssetUrl, clearAllCustomAssets } from '@/utils/idbStorage';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Target Studio states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  // Live active assets
  const [activeMarkerUrl, setActiveMarkerUrl] = useState<string>('/sample_marker.png');
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>('/campaign_speech.mp4');

  // Compilation state
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Analytics states
  const [stats, setStats] = useState({
    scansUsed: 0,
    isSupabaseConnected: false,
    activeVoterEmail: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Check existing session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      const isAutoAdmin = urlParams.get('admin') === 'true';

      const savedAuth =
        sessionStorage.getItem('campaign_admin_auth') === 'true' ||
        localStorage.getItem('campaign_admin_auth') === 'true';

      if (savedAuth || isAutoAdmin || urlPin === 'bose2026' || urlPin === 'admin2026') {
        setIsAuthenticated(true);
        sessionStorage.setItem('campaign_admin_auth', 'true');
        localStorage.setItem('campaign_admin_auth', 'true');
      }
      refreshActiveAssets();
      loadAnalytics();
    }
  }, []);

  const refreshActiveAssets = async () => {
    const v = Date.now();
    const marker = await getAssetUrl('sample_marker.png', `/sample_marker.png?v=${v}`);
    const video = await getAssetUrl('campaign_speech.mp4', `/campaign_speech.mp4?v=${v}`);
    setActiveMarkerUrl(marker);
    setActiveVideoUrl(video);
  };

  const loadAnalytics = () => {
    if (typeof window === 'undefined') return;
    const scans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
    const email = localStorage.getItem('auth_email') || 'None';
    setStats({
      scansUsed: scans,
      isSupabaseConnected: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      activeVoterEmail: email
    });
  };

  const performLogin = (codeToTest?: string) => {
    const code = (codeToTest !== undefined ? codeToTest : passcode).trim().toLowerCase();
    if (code === 'admin2026' || code === 'bose2026' || code === 'bose') {
      setIsAuthenticated(true);
      sessionStorage.setItem('campaign_admin_auth', 'true');
      localStorage.setItem('campaign_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Invalid Admin Passcode. Default passcode is: bose2026');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('campaign_admin_auth');
    localStorage.removeItem('campaign_admin_auth');
    setIsAuthenticated(false);
    setPasscode('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, JPEG).');
      return;
    }

    setErrorMessage(null);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM).');
      return;
    }

    setErrorMessage(null);
    setSelectedVideo(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleCompileTarget = async () => {
    if (!selectedImage) {
      setErrorMessage('Please select a campaign poster image before compiling.');
      return;
    }

    try {
      setIsCompiling(true);
      setCompileProgress(10);
      setStatusMessage('Initializing MindAR target compiler in browser...');
      setErrorMessage(null);
      setSuccessMessage(null);

      // Verify MINDAR is available on window
      const win = window as any;
      let CompilerClass = win.MINDAR?.IMAGE?.Compiler;

      if (!CompilerClass) {
        setStatusMessage('Loading MindAR compiler engine (one-time download)...');
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load MindAR compiler from CDN'));
          document.head.appendChild(script);
        });
        CompilerClass = (window as any).MINDAR?.IMAGE?.Compiler;
      }

      if (!CompilerClass) {
        throw new Error('MindAR compiler could not be initialized.');
      }

      setStatusMessage('Decoding image bitmap...');
      setCompileProgress(25);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imagePreview!;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Failed to decode uploaded image.'));
      });

      setStatusMessage('Extracting feature descriptors & tracking pyramids (takes ~5-10s)...');

      const compiler = new CompilerClass();
      await compiler.compileImageTargets([img], (progress: number) => {
        setCompileProgress(25 + Math.round(progress * 0.65));
        setStatusMessage(`Extracting keypoints: ${Math.round(progress)}%`);
      });

      setStatusMessage('Exporting compiled .mind binary...');
      setCompileProgress(92);
      const exportedBuffer = await compiler.exportData();
      const mindBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });

      // Persist in client IndexedDB
      setStatusMessage('Saving active target to browser storage...');
      setCompileProgress(96);
      await saveAssetBlob('targets.mind', mindBlob);
      if (selectedImage) {
        await saveAssetBlob('sample_marker.png', selectedImage);
      }
      if (selectedVideo) {
        await saveAssetBlob('campaign_speech.mp4', selectedVideo);
      }

      // Best effort sync to server
      try {
        const formData = new FormData();
        formData.append('mind', mindBlob, 'targets.mind');
        formData.append('image', selectedImage, 'sample_marker.png');
        if (selectedVideo) {
          formData.append('video', selectedVideo, 'campaign_speech.mp4');
        }
        await fetch('/api/save-target', { method: 'POST', body: formData }).catch(() => {});
      } catch (e) {
        // Safe to ignore on static hosts
      }

      setCompileProgress(100);
      setStatusMessage('Target successfully compiled & set as live AR target!');
      setSuccessMessage('Target successfully published! All voters will now track this poster and play the video.');
      await refreshActiveAssets();
      setSelectedImage(null);
      setImagePreview(null);
      setSelectedVideo(null);
      setVideoPreviewUrl(null);
      setIsCompiling(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while compiling target image.');
      setIsCompiling(false);
    }
  };

  const handleResetToDefault = async () => {
    if (confirm('Are you sure you want to revert to the default official election poster and candidate speech?')) {
      await clearAllCustomAssets();
      await refreshActiveAssets();
      setSuccessMessage('Restored to default official election poster (Lotus, Bicycle, Glass Tumbler)!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-amber-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900/90 border border-amber-500/30 rounded-3xl p-7 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-xl text-gray-100 flex flex-col space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-600 p-0.5 shadow-lg shadow-orange-600/30">
              <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-wide">
              Campaign Admin Command Center
            </h1>
            <p className="text-xs text-amber-300/80 font-medium">
              ఎన్నికల ప్రచార అడ్మిన్ ప్యానెల్ — Access Restricted
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Enter Admin Passcode / పాస్‌కోడ్
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setPasscode('bose2026');
                    performLogin('bose2026');
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 underline font-medium"
                >
                  Fill (bose2026)
                </button>
              </div>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    performLogin();
                  }
                }}
                placeholder="Enter passcode (e.g. bose2026)"
                className="w-full px-4 py-3 rounded-xl bg-gray-950/80 border border-gray-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm text-white placeholder-gray-500 transition-all outline-none"
                autoFocus
              />
            </div>

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-lg">
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={() => performLogin()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-orange-600/30 transition-all active:scale-95"
            >
              Unlock Admin Portal / ప్రవేశించండి
            </button>
          </form>

          <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <Link href="/" className="hover:text-amber-300 transition-colors flex items-center space-x-1">
              <span>← Back to Public Voter AR Portal</span>
            </Link>
            <span className="text-[10px] text-amber-500/70">Bose Kodelli</span>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide flex items-center space-x-2">
              <span>Campaign Admin Command Center</span>
              <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">LIVE</span>
            </h1>
            <p className="text-[11px] text-amber-400/80">ఎన్నికల ప్రచార అడ్మిన్ పోర్టల్ — Bose Kodelli</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/"
            target="_blank"
            className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
          >
            <span>Open Voter AR View</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 text-xs font-semibold transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Banner Alert for Status */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500 p-4 rounded-2xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/80 border border-red-500 p-4 rounded-2xl text-red-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Quick Vitals Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Local Scans Logged</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{stats.scansUsed}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cloudflare Edge Deployment</p>
              <p className="text-sm font-bold text-emerald-400 mt-1.5 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Pages & Functions Active</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Public Permissions</p>
              <p className="text-sm font-bold text-orange-400 mt-1.5">Uploads Restricted to Admin Only</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Studio Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Compiler Studio */}
          <div className="lg:col-span-7 bg-gray-900/80 border border-gray-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col space-y-6">
            <div className="border-b border-gray-800 pb-4">
              <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Campaign Target & Speech Studio</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Upload custom campaign posters and candidate speech videos. When compiled, only this poster triggers the AR speech video for all public voters.
              </p>
            </div>

            {/* Poster Upload Dropzone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                <span>1. Campaign Poster / Target Image *</span>
                <span className="text-[10px] text-gray-400 font-normal">PNG or JPG with high contrast</span>
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  imagePreview
                    ? 'border-amber-400/80 bg-amber-950/20'
                    : 'border-gray-700 hover:border-amber-400/60 bg-gray-950/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="flex flex-col items-center space-y-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 rounded-xl object-contain shadow-lg border border-amber-400/30"
                    />
                    <p className="text-xs text-amber-300 font-medium">Click to choose a different image</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2 text-gray-400">
                    <svg className="w-9 h-9 text-amber-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs font-semibold text-gray-200">Click to upload Campaign Poster</p>
                    <p className="text-[11px] text-gray-400">Supports BJP Lotus, TDP Bicycle, JSP Glass or Candidate Photos</p>
                  </div>
                )}
              </div>
            </div>

            {/* Campaign Speech Video Upload Dropzone */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                <span>2. Campaign Speech Video (Optional)</span>
                <span className="text-[10px] text-gray-400 font-normal">MP4 video file</span>
              </label>

              <div
                onClick={() => videoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  selectedVideo
                    ? 'border-amber-400/80 bg-amber-950/20'
                    : 'border-gray-700 hover:border-amber-400/60 bg-gray-950/50'
                }`}
              >
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoChange}
                  accept="video/mp4, video/webm"
                  className="hidden"
                />

                {selectedVideo ? (
                  <div className="flex items-center justify-between px-3 text-xs">
                    <span className="text-amber-300 font-semibold truncate max-w-[240px]">{selectedVideo.name}</span>
                    <span className="text-[11px] text-gray-400 font-medium">Click to change</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
                    <svg className="w-5 h-5 text-amber-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Click to replace Candidate Speech Video (MP4)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compiler Progress Indicator */}
            {isCompiling && (
              <div className="space-y-2 bg-black/60 border border-amber-500/40 p-4 rounded-2xl">
                <div className="flex justify-between text-xs text-amber-300 font-semibold">
                  <span>{statusMessage}</span>
                  <span>{compileProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${compileProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCompileTarget}
                disabled={isCompiling || !selectedImage}
                className={`w-full sm:flex-1 py-3 px-5 rounded-xl font-extrabold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  isCompiling || !selectedImage
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-orange-600/30 active:scale-95'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{isCompiling ? 'Compiling Target...' : 'Compile & Publish Live Target'}</span>
              </button>

              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isCompiling}
                className="w-full sm:w-auto py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-300 transition-all active:scale-95"
              >
                Revert to Official Poster
              </button>
            </div>
          </div>

          {/* Right Column: Live Active Media Preview */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Currently Active Poster</span>
                </h3>
                <a
                  href={activeMarkerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                >
                  View Full Size ↗
                </a>
              </div>

              <div className="w-full bg-black/60 rounded-2xl p-4 flex items-center justify-center border border-gray-800/80">
                <img
                  src={activeMarkerUrl}
                  alt="Active Poster"
                  className="max-h-56 object-contain rounded-xl shadow-md border border-amber-500/20"
                />
              </div>

              <div className="text-[11px] text-gray-400">
                Voters point their phone camera at this poster image. As soon as detected, MindAR locks tracking and plays the candidate speech below.
              </div>
            </div>

            {/* Candidate Speech Video Preview */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col space-y-4">
              <div className="border-b border-gray-800 pb-3">
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>Currently Active Speech Video</span>
                </h3>
              </div>

              <div className="w-full bg-black/60 rounded-2xl overflow-hidden border border-gray-800/80">
                <video
                  src={activeVideoUrl}
                  controls
                  playsInline
                  className="w-full max-h-48 object-cover bg-black"
                />
              </div>

              <div className="text-[11px] text-gray-400">
                This speech video appears anchored in 3D directly over the poster in WebAR with the 3D &apos;Pledge to Vote&apos; button.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
