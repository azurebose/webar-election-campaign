import Script from 'next/script';
import './globals.css';
import type { ReactNode } from 'react';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                  var origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
                  navigator.mediaDevices.getUserMedia = async function(constraints) {
                    try {
                      return await origGUM(constraints);
                    } catch (err) {
                      console.warn('[WebAR] Rear environment camera constraint unavailable; falling back to default webcam:', err);
                      if (constraints && constraints.video) {
                        try {
                          return await origGUM({ audio: false, video: true });
                        } catch (err2) {
                          console.error('[WebAR] Fallback webcam request failed:', err2);
                          throw err2;
                        }
                      }
                      throw err;
                    }
                  };
                }
              })();
            `
          }}
        />
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
