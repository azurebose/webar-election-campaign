'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import StartOverlay from '@/components/StartOverlay';

const ARView = dynamic(() => import('@/components/ARView'), { ssr: false });

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);

  const handleStart = () => {
    // Prime mobile media playback pipeline for campaign speech videos ONLY (never touch camera stream video)
    if (typeof document !== 'undefined') {
      const speechVids = document.querySelectorAll('video[id^="campaign-speech-video-"]');
      speechVids.forEach((v) => {
        const videoEl = v as HTMLVideoElement;
        videoEl.muted = true;
        videoEl.playsInline = true;
        const p = videoEl.play();
        if (p !== undefined) {
          p.then(() => {
            videoEl.pause();
          }).catch(() => {});
        }
      });
    }
    setHasStarted(true);
  };

  return (
    <main className="w-screen h-screen fixed inset-0 overflow-hidden bg-black select-none">
      <ARView onExit={() => setHasStarted(false)} />
      {!hasStarted && (
        <StartOverlay onStart={handleStart} />
      )}
    </main>
  );
}
