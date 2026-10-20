import Script from 'next/script';
import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Election WebAR Portal - Vote for Development | అభివృద్ధికి ఓటు వేయండి',
  description: 'Welcome to Election WebAR Portal - Vote for Development | ఎన్నికల WebAR పోర్టల్‌కు స్వాగతం - అభివృద్ధికి ఓటు వేయండి. Developed by Bose Kodelli.',
  authors: [{ name: 'Bose Kodelli' }]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
        <Script
          src="https://aframe.io/releases/1.5.0/aframe.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"
          strategy="beforeInteractive"
        />
        <Script
          type="module"
          src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
