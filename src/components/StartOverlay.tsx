'use client';

import { useState } from 'react';

interface StartOverlayProps {
  onStart: () => void;
}

export default function StartOverlay({ onStart }: StartOverlayProps) {
  const [language, setLanguage] = useState<'bilingual' | 'te' | 'en'>('bilingual');

  const handleStart = () => {
    // 1. Prime Web Audio Context
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
    <div
      onClick={handleStart}
      onTouchStart={handleStart}
      className="fixed inset-0 w-full h-full flex flex-col items-center justify-center z-50 p-4 text-center cursor-pointer overflow-hidden select-none bg-gray-950 font-['Noto_Sans_Telugu',sans-serif]"
    >
      {/* Dynamic Election Background Layer */}
      <img
        src="/campaign_bg.jpg"
        alt="Election Campaign Art"
        className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-35 brightness-75 select-none pointer-events-none"
      />

      {/* Dark Vignette Overlay for Readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/85 via-black/80 to-gray-950/95 backdrop-blur-[2px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="relative z-10 max-w-md w-full bg-gray-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Language Selector in Card Header */}
        <div className="w-full flex items-center justify-between pb-1" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Interactive AR</span>
          </span>

          <div className="flex items-center space-x-1 bg-black/50 p-1 rounded-xl border border-amber-500/30 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage('bilingual')}
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
              onClick={() => setLanguage('en')}
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
              onClick={() => setLanguage('te')}
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
        <div className="w-full h-28 sm:h-32 rounded-2xl overflow-hidden bg-white/95 border-2 border-amber-400/50 shadow-inner p-2 flex items-center justify-center">
          <img
            src="/campaign_bg.jpg"
            alt="Campaign Symbols"
            className="w-full h-full object-contain filter drop-shadow-md"
          />
        </div>

        {/* Title & Tagline in Election Palette */}
        <div className="space-y-1.5">
          {/* Welcome Tagline */}
          {(language === 'bilingual' || language === 'en') && (
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
              WELCOME TO ELECTION WEBAR PORTAL
            </p>
          )}
          {(language === 'bilingual' || language === 'te') && (
            <p className="text-xs font-semibold text-amber-300/90 tracking-wide">
              ఎన్నికల WebAR పోర్టల్‌కు స్వాగతం
            </p>
          )}

          {/* Main Headline */}
          {(language === 'bilingual' || language === 'en') && (
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-election-gradient drop-shadow leading-tight">
              VOTE FOR DEVELOPMENT
            </h1>
          )}
          {(language === 'bilingual' || language === 'te') && (
            <h2 className="text-xl sm:text-2xl font-black text-election-gradient drop-shadow leading-snug">
              అభివృద్ధికి ఓటు వేయండి
            </h2>
          )}

          {/* Description */}
          <div className="space-y-1 pt-1">
            {(language === 'bilingual' || language === 'en') && (
              <p className="text-xs text-amber-100/90 leading-relaxed max-w-xs mx-auto">
                Point your camera at the campaign symbol poster to watch candidate speech & pledge your vote in real-time AR.
              </p>
            )}
            {(language === 'bilingual' || language === 'te') && (
              <p className="text-[11px] text-amber-200/80 leading-relaxed max-w-xs mx-auto">
                అభ్యర్థి ప్రసంగాన్ని చూడటానికి & మీ ఓటును నమోదు చేయడానికి కెమెరాను ఎన్నికల పోస్టర్ వైపు చూపించండి.
              </p>
            )}
          </div>
        </div>

        {/* Quota & Passwordless Pill */}
        <div className="w-full bg-black/50 rounded-xl p-3 border border-amber-500/20 flex items-center justify-between text-xs">
          <span className="text-amber-200/90 font-medium flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {language === 'te'
                ? '2 ఉచిత స్కాన్లు అందుబాటులో ఉన్నాయి'
                : '2 Free Scans Available / 2 ఉచిత స్కాన్లు'}
            </span>
          </span>
          <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
            {language === 'te' ? 'పాస్‌వర్డ్‌లెస్' : 'Passwordless'}
          </span>
        </div>

        {/* Call to Action Button */}
        <button
          type="button"
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:via-amber-400 hover:to-red-500 text-white font-extrabold text-sm tracking-wide shadow-xl shadow-orange-600/30 border border-amber-300/40 active:scale-95 transition-all flex flex-col items-center justify-center space-y-0.5"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>TAP SCREEN TO ENTER AR</span>
          </div>
          <span className="text-[11px] font-semibold text-amber-200/90">
            AR లోకి ప్రవేశించడానికి తాకండి
          </span>
        </button>

        <p className="text-[10px] text-gray-400 tracking-wide">
          Unlocks audio context & mobile video autoplay | ఆడియో & వీడియో అనుమతులను ప్రారంభిస్తుంది
        </p>

        {/* Developer Attribution */}
        <div className="pt-2 border-t border-amber-500/20 w-full flex items-center justify-center space-x-1.5 text-xs">
          <span className="text-[11px] text-gray-400 font-normal">Developed by / రూపొందించినది:</span>
          <span className="font-bold text-amber-400 tracking-wide">Bose Kodelli</span>
        </div>
      </div>
    </div>
  );
}
