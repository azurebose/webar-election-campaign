'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 border border-amber-500/30 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
        <h1 className="text-4xl font-extrabold text-amber-400">404</h1>
        <h2 className="text-lg font-bold text-white">Page Not Found / పేజీ కనుగొనబడలేదు</h2>
        <p className="text-xs text-gray-400">
          The requested page could not be located.
        </p>
        <Link
          href="/"
          className="inline-block py-2.5 px-5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 text-white font-bold text-xs uppercase tracking-wide hover:from-orange-500 hover:to-amber-400 transition-all shadow-lg"
        >
          Return to Voter Portal / హోమ్‌పేజీ
        </Link>
      </div>
    </div>
  );
}
