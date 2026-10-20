'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import StartOverlay from '@/components/StartOverlay';

const ARView = dynamic(() => import('@/components/ARView'), { ssr: false });

export default function Home() {
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <main className="w-screen h-screen fixed inset-0 overflow-hidden bg-gray-950">
      {!hasStarted ? (
        <StartOverlay onStart={() => setHasStarted(true)} />
      ) : (
        <ARView onExit={() => setHasStarted(false)} />
      )}
    </main>
  );
}
