'use client';

import { useState, useEffect, useRef } from 'react';

export default function QuotaModal({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
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

    try {
      const { syncUserToSupabase } = await import('@/utils/supabaseClient');
      await syncUserToSupabase(targetEmail.trim());

      setStatus('sent');
      localStorage.setItem('auth_email', targetEmail.trim());

      setTimeout(() => {
        onAuthenticated();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error authenticating email. Try again.');
      submittedRef.current = false;
    }
  };

  useEffect(() => {
    if (!emailIsValid || submittedRef.current) return;

    // Automatic trigger after 750ms debounce
    const timer = setTimeout(() => {
      submitAuth(email);
    }, 750);

    return () => clearTimeout(timer);
  }, [email, emailIsValid]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailIsValid) {
      e.preventDefault();
      submitAuth(email);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md z-50 p-4">
      <div className="bg-gray-900 border border-amber-500/30 p-7 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] w-full max-w-sm flex flex-col space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-500/15 border border-amber-400/40 rounded-2xl text-amber-400 shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-election-gradient">Free Scan Quota Reached</h2>
            <p className="text-[11px] font-semibold text-amber-300">ఉచిత స్కాన్ పరిమితి పూర్తయింది</p>
            <p className="text-[11px] text-amber-200/70 mt-0.5">Unlock unlimited AR video playback | అపరిమిత AR ప్లేబ్యాక్‌ను అన్‌లాక్ చేయండి</p>
          </div>
        </div>

        <p className="text-xs text-amber-100/90 leading-relaxed">
          Type your email below. Our system detects completion automatically—no password or login button required.
          <span className="block text-[11px] text-amber-200/70 mt-1">మీ ఇమెయిల్‌ను టైప్ చేయండి — పాస్‌వర్డ్ లేకుండా ఆటోమేటిక్‌గా అన్‌లాక్ అవుతుంది.</span>
        </p>

        <div className="relative">
          <input
            type="email"
            autoFocus
            disabled={status === 'validating' || status === 'sent'}
            placeholder="voter@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 bg-gray-950 border border-amber-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-orange-500 transition-all text-sm"
          />

          {status === 'validating' && (
            <div className="absolute right-3.5 top-3.5 flex items-center space-x-1.5 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Verifying...</span>
            </div>
          )}

          {status === 'sent' && (
            <div className="absolute right-3.5 top-3.5 flex items-center space-x-1.5 text-xs text-emerald-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Unlocked!</span>
            </div>
          )}
        </div>

        {status === 'error' && (
          <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/50">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-800">
          <span>Zero-button auto-submission</span>
          <span>Press Enter ↵ or stop typing</span>
        </div>
      </div>
    </div>
  );
}
