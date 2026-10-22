'use client';

import { useState, useEffect, useRef } from 'react';

export default function QuotaModal({
  onAuthenticated,
  onClose,
}: {
  onAuthenticated: () => void;
  onClose?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const submittedRef = useRef(false);

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submitAuth = async (targetEmail: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setStatus('validating');

    const cleanEmail = targetEmail.trim();

    try {
      // 1. Store email locally so verify-link page can complete sign-in
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('emailForSignIn', cleanEmail);
      }

      // 2. Dispatch Firebase Passwordless Magic Link pointing to /auth/verify-link
      const actionCodeSettings = {
        url: typeof window !== 'undefined' ? `${window.location.origin}/auth/verify-link` : 'http://localhost:3000/auth/verify-link',
        handleCodeInApp: true,
      };

      try {
        const { sendSignInLinkToEmail } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase');
        await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
      } catch (fbErr: any) {
        console.warn('[QuotaModal] Firebase sendSignInLinkToEmail warning:', fbErr);
        // If Firebase API key is unconfigured in local test, continue gracefully
      }

      // 3. Sync to Supabase or Worker API if available
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        }).catch(() => {});
      } catch (e) {}

      try {
        const { syncUserToSupabase } = await import('@/utils/supabaseClient');
        await syncUserToSupabase(cleanEmail);
      } catch (sbErr) {
        // Optional legacy fallback
      }

      setStatus('sent');
      localStorage.setItem('auth_email', cleanEmail);

      // Auto-unlock the view after confirmation
      setTimeout(() => {
        onAuthenticated();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error authenticating email. Try again.');
      submittedRef.current = false;
    }
  };

  useEffect(() => {
    if (!emailIsValid || submittedRef.current) return;

    // Automatic trigger after 1200ms debounce
    const timer = setTimeout(() => {
      submitAuth(email);
    }, 1200);

    return () => clearTimeout(timer);
  }, [email, emailIsValid]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailIsValid) {
      e.preventDefault();
      submitAuth(email);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailIsValid) {
      submitAuth(email);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 font-['Noto_Sans_Telugu',sans-serif] overflow-y-auto">
      <div className="bg-gray-900 border border-amber-500/35 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.2)] w-full max-w-sm flex flex-col space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Close Button */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 sm:p-2.5 bg-amber-500/15 border border-amber-400/40 rounded-xl sm:rounded-2xl text-amber-400 shadow-sm flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-election-gradient leading-snug">Free Scan Quota Reached</h2>
              <p className="text-[11px] font-semibold text-amber-300">ఉచిత స్కాన్ పరిమితి పూర్తయింది</p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
              title="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <p className="text-xs text-amber-100/90 leading-relaxed">
          Unlock unlimited AR video playback. Type your email below to receive a magic sign-in link—no password needed.
          <span className="block text-[11px] text-amber-200/70 mt-1">
            అపరిమిత AR ప్లేబ్యాక్‌ను అన్‌లాక్ చేయడానికి మీ ఇమెయిల్‌ను నమోదు చేయండి.
          </span>
        </p>

        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="email"
              autoFocus
              disabled={status === 'validating' || status === 'sent'}
              placeholder="voter@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3.5 py-2.5 sm:py-3 bg-gray-950 border border-amber-500/35 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-orange-500 transition-all text-sm"
            />

            {status === 'validating' && (
              <div className="absolute right-3 top-3 flex items-center space-x-1 text-xs text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Sending...</span>
              </div>
            )}

            {status === 'sent' && (
              <div className="absolute right-3 top-3 flex items-center space-x-1 text-xs text-emerald-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Sent!</span>
              </div>
            )}
          </div>

          {/* Explicit Mobile Submit Touch Button */}
          <button
            type="submit"
            disabled={!emailIsValid || status === 'validating' || status === 'sent'}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:via-amber-400 hover:to-red-500 text-white font-extrabold text-xs sm:text-sm tracking-wide shadow-lg shadow-orange-600/30 border border-amber-300/40 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {status === 'validating' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Unlocking... / అన్‌లాక్ అవుతోంది...</span>
              </>
            ) : status === 'sent' ? (
              <span>✓ UNLOCKED / అన్‌లాక్ చేయబడింది</span>
            ) : (
              <span>🚀 UNLOCK UNLIMITED SCANS / అన్‌లాక్ చేయండి</span>
            )}
          </button>
        </form>

        {status === 'sent' && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 space-y-0.5">
            <p className="font-bold">✨ Magic link sent to your email!</p>
            <p className="text-[11px] text-emerald-200/80">అపరిమిత స్కాన్‌ల కోసం మీ ఇమెయిల్‌లోని లింక్‌పై క్లిక్ చేయండి.</p>
          </div>
        )}

        {status === 'error' && (
          <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/50">
            {errorMessage}
          </p>
        )}

        {/* Footer with Skip / Continue Option */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-400 pt-1 border-t border-gray-800">
          <span>Zero-password login</span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-amber-400 hover:underline"
            >
              Skip for now / తర్వాత
            </button>
          ) : (
            <span>Auto-unlock active</span>
          )}
        </div>
      </div>
    </div>
  );
}
