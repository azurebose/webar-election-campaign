'use client';

import { useState } from 'react';

interface StartOverlayProps {
  onStart: () => void;
}

interface PosterItem {
  ward: string;
  name: string;
  url: string;
  fallback: string;
  candidate: string;
}

const DEFAULT_POSTER: PosterItem = {
  ward: 'Official Campaign Poster / అధికారిక పోస్టర్',
  name: 'Official Alliance Poster / అధికారిక కూటమి పోస్టర్',
  url: '/sample_marker.png',
  fallback: '/sample_marker.png',
  candidate: 'NDA Alliance / బోస్ కొడెల్లి'
};

export default function StartOverlay({ onStart }: StartOverlayProps) {
  const [language, setLanguage] = useState<'bilingual' | 'te' | 'en'>('bilingual');
  const [showPosterPreview, setShowPosterPreview] = useState<boolean>(false);
  const [previewIdx, setPreviewIdx] = useState<number>(0);
  const [posters, setPosters] = useState<PosterItem[]>([DEFAULT_POSTER]);

  // Load active posters dynamically from wards.json
  useState(() => {
    if (typeof window !== 'undefined') {
      fetch(`/wards.json?t=${Date.now()}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const mapped: PosterItem[] = data.map((w: any, idx: number) => ({
              ward: w.wardNumber || `Ward ${idx + 1}`,
              name: w.wardName || `Ward ${idx + 1} Campaign Poster`,
              url: w.markerUrl || '/sample_marker.png',
              fallback: '/sample_marker.png',
              candidate: w.candidateName || 'Official Candidate',
            }));
            setPosters(mapped);
          }
        })
        .catch(() => {});
    }
  });

  const handleStart = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }

    // 1. Prime Web Audio Context for Mobile Browsers (iOS Safari & Android Chrome)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume?.();
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }

    onStart();
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-start sm:justify-center z-50 p-3 sm:p-4 text-center overflow-y-auto select-none bg-gray-950 font-['Noto_Sans_Telugu',sans-serif]">
      {/* Dynamic Election Background Layer */}
      <img
        src="/campaign_bg.jpg"
        alt="Election Campaign Art"
        className="fixed inset-0 w-full h-full object-cover blur-sm scale-105 opacity-30 brightness-75 select-none pointer-events-none"
      />

      {/* Dark Vignette Overlay for Readability */}
      <div className="fixed inset-0 bg-gradient-to-b from-gray-950/90 via-black/85 to-gray-950/95 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Glassmorphic Card (Optimized for Mobile Height & Width) */}
      <div className="relative z-10 max-w-md w-full my-auto bg-gray-900/95 border border-amber-500/35 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col items-center space-y-3 sm:space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Language Selector & AR Badge Header */}
        <div className="w-full flex items-center justify-between gap-1 pb-0.5">
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="truncate">WebAR Portal</span>
          </span>

          <div className="flex items-center space-x-1 bg-black/60 p-0.5 sm:p-1 rounded-xl border border-amber-500/30 text-[10px] sm:text-[11px] font-bold">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLanguage('bilingual');
              }}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                language === 'bilingual'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              All / ద్వైభాష
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLanguage('en');
              }}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                language === 'en'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLanguage('te');
              }}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                language === 'te'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                  : 'text-amber-200/70 hover:text-white'
              }`}
            >
              తెలుగు
            </button>
          </div>
        </div>

        {/* Election Symbol Showcase Header */}
        <div className="w-full h-20 sm:h-28 rounded-xl sm:rounded-2xl overflow-hidden bg-white/95 border-2 border-amber-400/50 shadow-inner p-1.5 sm:p-2 flex items-center justify-center">
          <img
            src="/campaign_bg.jpg"
            alt="Campaign Symbols"
            className="w-full h-full object-contain filter drop-shadow-md"
          />
        </div>

        {/* Title & Tagline in Election Palette */}
        <div className="space-y-1 sm:space-y-1.5">
          {/* Welcome Tagline */}
          {(language === 'bilingual' || language === 'en') && (
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-amber-400">
              WELCOME TO ELECTION WEBAR
            </p>
          )}
          {(language === 'bilingual' || language === 'te') && (
            <p className="text-[11px] sm:text-xs font-semibold text-amber-300/90 tracking-wide">
              ఎన్నికల WebAR పోర్టల్‌కు స్వాగతం
            </p>
          )}

          {/* Main Headline */}
          {(language === 'bilingual' || language === 'en') && (
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-election-gradient drop-shadow leading-tight">
              VOTE FOR DEVELOPMENT
            </h1>
          )}
          {(language === 'bilingual' || language === 'te') && (
            <h2 className="text-lg sm:text-xl font-black text-election-gradient drop-shadow leading-snug">
              అభివృద్ధికి ఓటు వేయండి
            </h2>
          )}

          {/* Concise Mobile-Friendly Description */}
          <div className="space-y-0.5 pt-0.5">
            {(language === 'bilingual' || language === 'en') && (
              <p className="text-[11px] sm:text-xs text-amber-100/90 leading-relaxed max-w-xs mx-auto">
                Scan campaign poster to watch speech & pledge your vote in real-time AR.
              </p>
            )}
            {(language === 'bilingual' || language === 'te') && (
              <p className="text-[10px] sm:text-[11px] text-amber-200/80 leading-relaxed max-w-xs mx-auto">
                అభ్యర్థి ప్రసంగాన్ని చూడటానికి పోస్టర్‌ను కెమెరాతో స్కాన్ చేయండి.
              </p>
            )}
          </div>
        </div>

        {/* Quota & Fast Load Badge */}
        <div className="w-full bg-black/60 rounded-xl p-2.5 sm:p-3 border border-amber-500/25 flex items-center justify-between text-[11px] sm:text-xs">
          <span className="text-amber-200/90 font-medium flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
            <span className="truncate">
              {language === 'te'
                ? '2 ఉచిత స్కాన్లు అందుబాటులో ఉన్నాయి'
                : '2 Free Scans / 2 ఉచిత స్కాన్లు'}
            </span>
          </span>
          <span className="text-emerald-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-wider px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 flex-shrink-0">
            Instant AR
          </span>
        </div>

        {/* Target Poster Clarifier / Quick Helper */}
        <div className="w-full bg-amber-500/10 border border-amber-400/30 rounded-xl p-2 sm:p-2.5 flex items-center justify-between text-xs">
          <div className="text-left">
            <p className="text-[11px] font-bold text-amber-300">Don't have a printed poster?</p>
            <p className="text-[10px] text-amber-200/70">పోస్టర్ లేకపోతే ఇక్కడ చూడండి</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPosterPreview(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-400/40 transition-all active:scale-95 flex-shrink-0"
          >
            👀 View Posters
          </button>
        </div>

        {/* Primary Call to Action Button */}
        <button
          id="enter-ar-button"
          type="button"
          onClick={handleStart}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:via-amber-400 hover:to-red-500 text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-xl shadow-orange-600/30 border border-amber-300/40 active:scale-95 transition-all flex flex-col items-center justify-center space-y-0.5 cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-100 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>START CAMERA & ENTER AR</span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-amber-200/90">
            AR లోకి ప్రవేశించడానికి తాకండి
          </span>
        </button>

        <p className="text-[9px] sm:text-[10px] text-gray-400 tracking-wide">
          Enables camera & audio permission | కెమెరా మరియు ఆడియో అనుమతులను ప్రారంభిస్తుంది
        </p>

        {/* Developer Attribution & Admin Access */}
        <div className="pt-1.5 border-t border-amber-500/20 w-full flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1 text-[10px] sm:text-[11px] text-gray-400">
            <span>By:</span>
            <span className="font-bold text-amber-400 tracking-wide">Bose Kodelli</span>
          </div>
          <a
            href="/admin"
            className="text-amber-400/50 hover:text-amber-300 transition-colors p-1 flex items-center space-x-1 text-[10px]"
            title="Campaign Admin Portal"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Admin</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Target Posters Preview Modal (To show users which poster to scan) */}
      {showPosterPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-amber-500/35 rounded-2xl w-full max-w-sm p-4 sm:p-5 flex flex-col space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-white">Target Posters to Scan</h3>
                <p className="text-[10px] text-amber-400">స్కాన్ చేయడానికి పోస్టర్లు</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPosterPreview(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Poster Tabs */}
            <div className="flex space-x-2">
              {posters.map((poster, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPreviewIdx(idx)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    previewIdx === idx
                      ? 'bg-amber-500 text-gray-950 shadow'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {poster.ward}
                </button>
              ))}
            </div>

            <div className="text-left bg-gray-950 p-2 rounded-xl border border-gray-800">
              <p className="text-[11px] font-bold text-amber-300">{posters[previewIdx]?.name}</p>
              <p className="text-[10px] text-gray-400">{posters[previewIdx]?.candidate}</p>
            </div>

            <div className="bg-black/60 rounded-xl p-2 flex items-center justify-center border border-amber-500/20">
              <img
                src={posters[previewIdx]?.url}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = posters[previewIdx]?.fallback || '/sample_marker.png';
                }}
                alt={posters[previewIdx]?.ward}
                className="max-h-48 object-contain rounded-lg"
              />
            </div>

            <p className="text-[10px] text-gray-400 text-center">
              Open this image on another device or print it, then point your camera at it in AR.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowPosterPreview(false);
                handleStart();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white text-xs font-bold shadow-md"
            >
              Start AR Scanner Now / స్కాన్ ప్రారంభించండి
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
