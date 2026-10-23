'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import StartOverlay from '@/components/StartOverlay';

const ARView = dynamic(() => import('@/components/ARView'), { ssr: false });

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);

  const handleStart = () => {
    // Prime mobile media playback pipeline during direct user gesture
    if (typeof document !== 'undefined') {
      const vids = document.querySelectorAll('video');
      vids.forEach((v) => {
        v.muted = true;
        v.playsInline = true;
        const p = v.play();
        if (p !== undefined) {
          p.then(() => {
            v.pause();
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
