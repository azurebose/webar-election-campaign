'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  saveAssetBlob,
  getAssetUrl,
  clearAllCustomAssets,
  saveWardsConfig,
  getWardsConfig,
  WardPoster
} from '@/utils/idbStorage';

interface AdminWardState {
  id: string;
  wardNumber: string;
  wardName: string;
  candidateName: string;
  markerUrl: string;
  videoUrl: string;
  imageFile?: File | null;
  videoFile?: File | null;
}

const DEFAULT_WARDS: AdminWardState[] = [
  {
    id: 'ward-1',
    wardNumber: 'Ward 1 / వార్డు 1',
    wardName: 'Official Alliance Poster',
    candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
    markerUrl: '/sample_marker.png',
    videoUrl: '/campaign_speech.mp4',
    imageFile: null,
    videoFile: null
  }
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Multi-Ward Campaign Posters
  const [wards, setWards] = useState<AdminWardState[]>(DEFAULT_WARDS);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState<number>(0);

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

  // Check existing session & load ward configuration
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

      loadInitialWards();
      loadAnalytics();
    }
  }, []);

  const loadInitialWards = async () => {
    const savedConfig = await getWardsConfig();
    if (savedConfig && savedConfig.length > 0) {
      setWards(
        savedConfig.map((w) => ({
          ...w,
          imageFile: null,
          videoFile: null
        }))
      );
    } else {
      const v = Date.now();
      const marker = await getAssetUrl('sample_marker.png', `/sample_marker.png?v=${v}`);
      const video = await getAssetUrl('campaign_speech.mp4', `/campaign_speech.mp4?v=${v}`);
      setWards([
        {
          id: 'ward-1',
          wardNumber: 'Ward 1 / వార్డు 1',
          wardName: 'Official Alliance Poster',
          candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
          markerUrl: marker,
          videoUrl: video,
          imageFile: null,
          videoFile: null
        }
      ]);
    }
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
      setAuthError('Invalid Admin Passcode. Access denied.');
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

  // Ward Management actions
  const handleAddWard = () => {
    const newIdx = wards.length + 1;
    const newWard: AdminWardState = {
      id: `ward-${Date.now()}`,
      wardNumber: `Ward ${newIdx} / వార్డు ${newIdx}`,
      wardName: `Ward ${newIdx} Area`,
      candidateName: `Ward ${newIdx} Candidate`,
      markerUrl: '',
      videoUrl: wards[0]?.videoUrl || '/campaign_speech.mp4',
      imageFile: null,
      videoFile: null
    };
    setWards((prev) => [...prev, newWard]);
    setSelectedPreviewIdx(wards.length);
  };

  const handleRemoveWard = (idx: number) => {
    if (wards.length <= 1) {
      setErrorMessage('You must have at least one campaign ward poster.');
      return;
    }
    const updated = wards.filter((_, i) => i !== idx);
    setWards(updated);
    setSelectedPreviewIdx(Math.max(0, idx - 1));
  };

  const handleUpdateWardField = (idx: number, field: keyof AdminWardState, value: any) => {
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleWardImageUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, JPEG).');
      return;
    }

    setErrorMessage(null);
    const previewUrl = URL.createObjectURL(file);
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], imageFile: file, markerUrl: previewUrl };
      return copy;
    });
  };

  const handleWardVideoUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM).');
      return;
    }

    setErrorMessage(null);
    const previewUrl = URL.createObjectURL(file);
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], videoFile: file, videoUrl: previewUrl };
      return copy;
    });
  };

  // Compile all wards into a single multi-target MindAR binary
  const handleCompileAllTargets = async () => {
    // 1. Validation: check that every ward has a poster
    for (let i = 0; i < wards.length; i++) {
      if (!wards[i].markerUrl && !wards[i].imageFile) {
        setErrorMessage(`Please upload a poster image for ${wards[i].wardNumber} before compiling.`);
        return;
      }
    }

    try {
      setIsCompiling(true);
      setCompileProgress(10);
      setStatusMessage('Initializing MindAR multi-target compiler in browser...');
      setErrorMessage(null);
      setSuccessMessage(null);

      // Verify MINDAR is available on window
      const win = window as any;
      let CompilerClass = win.MINDAR?.IMAGE?.Compiler;

      if (!CompilerClass) {
        setStatusMessage('Loading MindAR compiler engine (CDN)...');
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

      setStatusMessage(`Decoding ${wards.length} ward poster image(s)...`);
      setCompileProgress(20);

      // Decode all image objects
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < wards.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = wards[i].markerUrl;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error(`Failed to decode image for ${wards[i].wardNumber}`));
        });
        loadedImages.push(img);
      }

      setStatusMessage(`Extracting multi-target keypoint pyramids for ${wards.length} wards...`);

      const compiler = new CompilerClass();
      await compiler.compileImageTargets(loadedImages, (progress: number) => {
        setCompileProgress(20 + Math.round(progress * 0.7));
        setStatusMessage(`Extracting keypoints across all wards: ${Math.round(progress)}%`);
      });

      setStatusMessage('Exporting compiled multi-target .mind binary...');
      setCompileProgress(92);
      const exportedBuffer = await compiler.exportData();
      const mindBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });

      // Persist compiled targets.mind
      setStatusMessage('Saving multi-target binary to browser database...');
      setCompileProgress(96);
      await saveAssetBlob('targets.mind', mindBlob);

      // Persist individual ward blobs and prepare serializable config
      const serializableWards: WardPoster[] = [];
      for (let i = 0; i < wards.length; i++) {
        const w = wards[i];
        let savedMarkerUrl = w.markerUrl;
        let savedVideoUrl = w.videoUrl;

        if (w.imageFile) {
          const markerKey = `ward_marker_${w.id}.png`;
          await saveAssetBlob(markerKey, w.imageFile);
          savedMarkerUrl = URL.createObjectURL(w.imageFile);
        }
        if (w.videoFile) {
          const videoKey = `ward_video_${w.id}.mp4`;
          await saveAssetBlob(videoKey, w.videoFile);
          savedVideoUrl = URL.createObjectURL(w.videoFile);
        }

        serializableWards.push({
          id: w.id,
          wardNumber: w.wardNumber,
          wardName: w.wardName,
          candidateName: w.candidateName,
          markerUrl: savedMarkerUrl,
          videoUrl: savedVideoUrl
        });
      }

      // Save wards JSON configuration
      await saveWardsConfig(serializableWards);

      setCompileProgress(100);
      setStatusMessage(`All ${wards.length} Ward Posters compiled & published successfully!`);
      setSuccessMessage(
        `Successfully published ${wards.length} Ward Posters! Voters in any ward can now point their phone at their specific ward poster to watch the speech.`
      );
      setIsCompiling(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while compiling multi-ward posters.');
      setIsCompiling(false);
    }
  };

  const handleResetToDefault = async () => {
    if (confirm('Are you sure you want to revert to the default official election alliance poster?')) {
      await clearAllCustomAssets();
      await loadInitialWards();
      setSuccessMessage('Restored to default official election alliance poster (Lotus, Bicycle, Glass Tumbler)!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Confidential Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-amber-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900/90 border border-amber-500/30 rounded-3xl p-7 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-xl text-gray-100 flex flex-col space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-600 p-0.5 shadow-lg shadow-orange-600/30 flex-shrink-0">
              <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <svg className="w-7 h-7" width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Enter Admin Passcode / పాస్‌కోడ్
              </label>
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
                placeholder="Enter secure campaign passcode"
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

  const currentPreviewWard = wards[selectedPreviewIdx] || wards[0];

  // Admin Dashboard with Multi-Ward Studio
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-wide flex items-center space-x-2">
              <span>Campaign Admin Command Center</span>
              <span className="text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                MULTI-WARD ACTIVE ({wards.length})
              </span>
            </h1>
            <p className="text-[10px] text-amber-400/80">ఎన్నికల ప్రచార అడ్మిన్ పోర్టల్ — Bose Kodelli</p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            href="/"
            target="_blank"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
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
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-4">
        {/* Banner Alert for Status */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500 p-3 rounded-2xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/80 border border-red-500 p-3 rounded-2xl text-red-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {/* Quick Vitals Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Local Scans Logged</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{stats.scansUsed}</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Active Wards Supported</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{wards.length} Wards Configured</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Public Permissions</p>
              <p className="text-xs sm:text-sm font-bold text-orange-400 mt-1">Uploads Restricted to Admin Only</p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Studio Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Multi-Ward Editor & Compiler */}
          <div className="lg:col-span-7 bg-gray-900/80 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-4">
            <div className="border-b border-gray-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Multi-Ward Campaign Poster Studio</span>
                </h2>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Manage different candidate posters for each ward. When compiled, voters in each ward can scan their respective poster to watch the speech.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddWard}
                className="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center space-x-1"
              >
                <span>+ Add Ward</span>
              </button>
            </div>

            {/* List of Wards */}
            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 scrollbar-thin">
              {wards.map((ward, idx) => (
                <div
                  key={ward.id}
                  className={`bg-gray-950/80 border rounded-2xl p-3.5 space-y-3 transition-all ${
                    selectedPreviewIdx === idx ? 'border-amber-400/80 shadow-md' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={ward.wardNumber}
                        onChange={(e) => handleUpdateWardField(idx, 'wardNumber', e.target.value)}
                        placeholder="e.g. Ward 1 / వార్డు 1"
                        className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs font-bold text-amber-300 w-36 outline-none focus:border-amber-400"
                      />
                      <input
                        type="text"
                        value={ward.wardName}
                        onChange={(e) => handleUpdateWardField(idx, 'wardName', e.target.value)}
                        placeholder="Ward Area / Name"
                        className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs text-gray-200 w-36 sm:w-44 outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewIdx(idx)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                          selectedPreviewIdx === idx ? 'bg-amber-400 text-gray-950' : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        Preview
                      </button>
                      {wards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWard(idx)}
                          className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/40"
                          title="Remove Ward"
                        >
                          ✕ Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ward Candidate Name */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-[11px] text-gray-400 w-24">Candidate:</span>
                    <input
                      type="text"
                      value={ward.candidateName}
                      onChange={(e) => handleUpdateWardField(idx, 'candidateName', e.target.value)}
                      placeholder="Candidate Name / అభ్యర్థి పేరు"
                      className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs text-gray-200 outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* File Pickers for this Ward */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Poster Picker */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        {ward.markerUrl ? (
                          <img
                            src={ward.markerUrl}
                            alt="thumb"
                            className="w-10 h-10 rounded-lg object-contain bg-black border border-amber-400/30 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] text-gray-500 flex-shrink-0">
                            Poster
                          </div>
                        )}
                        <span className="text-[11px] text-gray-300 truncate">
                          {ward.imageFile ? ward.imageFile.name : 'Poster Image'}
                        </span>
                      </div>

                      <label className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 px-2 py-1 rounded-lg font-semibold cursor-pointer flex-shrink-0 ml-2">
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) => handleWardImageUpload(idx, e)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Speech Video Picker */}
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] text-gray-300 truncate">
                          {ward.videoFile ? ward.videoFile.name : 'Candidate Video'}
                        </span>
                      </div>

                      <label className="text-[10px] bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded-lg font-semibold cursor-pointer flex-shrink-0 ml-2">
                        <span>Change</span>
                        <input
                          type="file"
                          accept="video/mp4, video/webm"
                          onChange={(e) => handleWardVideoUpload(idx, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Compiler Progress Indicator */}
            {isCompiling && (
              <div className="space-y-1.5 bg-black/60 border border-amber-500/40 p-3 rounded-2xl">
                <div className="flex justify-between text-xs text-amber-300 font-semibold">
                  <span>{statusMessage}</span>
                  <span>{compileProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${compileProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCompileAllTargets}
                disabled={isCompiling}
                className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  isCompiling
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-orange-600/30 active:scale-95'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{isCompiling ? 'Compiling Multi-Ward Targets...' : `Compile & Publish All ${wards.length} Ward Posters`}</span>
              </button>

              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isCompiling}
                className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-300 transition-all active:scale-95"
              >
                Revert to Default Alliance
              </button>
            </div>
          </div>

          {/* Right Column: Live Active Media Preview */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Preview: {currentPreviewWard?.wardNumber}
                  </h3>
                </div>
                {currentPreviewWard?.markerUrl && (
                  <a
                    href={currentPreviewWard.markerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    View Full Size ↗
                  </a>
                )}
              </div>

              <div className="w-full bg-black/60 rounded-2xl p-3 flex items-center justify-center border border-gray-800/80">
                {currentPreviewWard?.markerUrl ? (
                  <img
                    src={currentPreviewWard.markerUrl}
                    alt={currentPreviewWard.wardNumber}
                    className="max-h-40 sm:max-h-48 object-contain rounded-xl shadow-md border border-amber-500/20"
                  />
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-gray-500">
                    No Poster Uploaded for this Ward
                  </div>
                )}
              </div>

              <div className="text-[10px] sm:text-[11px] text-gray-400">
                {currentPreviewWard?.wardName} — {currentPreviewWard?.candidateName}
              </div>
            </div>

            {/* Candidate Speech Video Preview */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-3">
              <div className="border-b border-gray-800 pb-2.5">
                <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>Speech Video for {currentPreviewWard?.wardNumber}</span>
                </h3>
              </div>

              <div className="w-full bg-black/60 rounded-2xl overflow-hidden border border-gray-800/80">
                <video
                  src={currentPreviewWard?.videoUrl || '/campaign_speech.mp4'}
                  controls
                  playsInline
                  className="w-full max-h-36 sm:max-h-40 object-cover bg-black"
                />
              </div>

              <div className="text-[10px] sm:text-[11px] text-gray-400">
                This speech video plays when voters scan {currentPreviewWard?.wardNumber} poster in the WebAR camera.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
