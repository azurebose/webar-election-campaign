'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

export default function VerifyLinkPage() {
  const [status, setStatus] = useState<'verifying' | 'prompt_email' | 'success' | 'error'>('verifying');
  const [emailInput, setEmailInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const completeSignIn = async (emailToUse: string) => {
    setStatus('verifying');
    setErrorMessage('');

    try {
      const userCredential = await signInWithEmailLink(auth, emailToUse.trim(), window.location.href);
      const user = userCredential.user;

      // Update or create document in voter_profiles/{uid} with unlocked unlimited scans
      if (user) {
        const voterRef = doc(db, 'voter_profiles', user.uid);
        await setDoc(
          voterRef,
          {
            email: user.email || emailToUse.trim(),
            unlocked_unlimited_scans: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Store session in localStorage for local component synchronization
        localStorage.setItem('auth_email', user.email || emailToUse.trim());
        localStorage.setItem('auth_uid', user.uid);
        localStorage.removeItem('emailForSignIn');
      }

      setStatus('success');
    } catch (err: any) {
      console.error('[AuthVerify] Magic link verification error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Invalid or expired magic link. Please request a new link.');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isSignInWithEmailLink(auth, window.location.href)) {
      const storedEmail = window.localStorage.getItem('emailForSignIn');
      if (storedEmail) {
        completeSignIn(storedEmail);
      } else {
        // Email missing from this device/browser; prompt user to enter their email
        setStatus('prompt_email');
      }
    } else {
      setStatus('error');
      setErrorMessage('This verification link is invalid or has already been used.');
    }
  }, []);

  const handleManualEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim()) {
      completeSignIn(emailInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-['Noto_Sans_Telugu',sans-serif]">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-radial-gradient from-amber-600/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-gray-900/90 border border-amber-500/30 rounded-3xl p-7 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Verification Icon Header */}
        <div className="p-3 bg-amber-500/15 border border-amber-400/40 rounded-2xl text-amber-400 shadow-sm">
          {status === 'success' ? (
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          ) : status === 'error' ? (
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-amber-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </div>

        {/* Status: Verifying */}
        {status === 'verifying' && (
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-amber-300">Verifying Magic Link...</h1>
            <p className="text-xs text-amber-200/80">ధృవీకరణ లింక్‌ను పరీక్షిస్తున్నాము...</p>
            <p className="text-xs text-gray-400 pt-2">Unlocking unlimited WebAR candidate video scans for your account.</p>
          </div>
        )}

        {/* Status: Prompt Email (opened on another device/browser) */}
        {status === 'prompt_email' && (
          <div className="space-y-4 w-full">
            <div>
              <h1 className="text-xl font-extrabold text-amber-300">Confirm Your Email</h1>
              <p className="text-xs text-amber-200/80 mt-1">మీ ఇమెయిల్ చిరునామాను నిర్ధారించండి</p>
              <p className="text-xs text-gray-400 mt-2">
                Please re-enter the email you provided to finalize your passwordless authentication.
              </p>
            </div>

            <form onSubmit={handleManualEmailSubmit} className="space-y-3 w-full">
              <input
                type="email"
                required
                autoFocus
                placeholder="voter@domain.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-amber-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg active:scale-95"
              >
                Verify & Unlock Unlimited Scans
              </button>
            </form>
          </div>
        )}

        {/* Status: Success */}
        {status === 'success' && (
          <div className="space-y-4 w-full">
            <div className="space-y-1.5">
              <h1 className="text-xl font-extrabold text-emerald-400">Unlimited Scans Unlocked!</h1>
              <p className="text-xs font-semibold text-emerald-300">అపరిమిత స్కాన్లు విజయవంతంగా అన్‌లాక్ చేయబడ్డాయి!</p>
              <p className="text-xs text-gray-300 pt-2 leading-relaxed">
                Your email has been verified. You now have unrestricted access to all Ward Candidate AR posters and speeches.
              </p>
            </div>

            <Link
              href="/"
              className="w-full inline-block py-3 px-6 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/30 active:scale-95"
            >
              Launch WebAR Portal / AR పోర్టల్‌కు వెళ్ళండి ➔
            </Link>
          </div>
        )}

        {/* Status: Error */}
        {status === 'error' && (
          <div className="space-y-4 w-full">
            <div className="space-y-1.5">
              <h1 className="text-xl font-extrabold text-red-400">Verification Failed</h1>
              <p className="text-xs font-semibold text-red-300">ధృవీకరణ విఫలమైంది</p>
              <p className="text-xs text-red-200/80 bg-red-950/40 border border-red-800/40 p-3 rounded-xl mt-2 leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <Link
              href="/"
              className="w-full inline-block py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold rounded-xl text-xs transition-all border border-amber-500/20 active:scale-95"
            >
              Return to WebAR Home / హోమ్‌కు తిరిగి వెళ్లండి
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
