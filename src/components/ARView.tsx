'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QuotaModal from '@/components/QuotaModal';
import TargetUploadModal from '@/components/TargetUploadModal';
import { getAssetUrl } from '@/utils/idbStorage';

interface ARViewProps {
  onExit?: () => void;
}

export default function ARView({ onExit }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showQuota, setShowQuota] = useState<boolean>(false);
  const [isPledged, setIsPledged] = useState<boolean>(false);
  const [isTargetFound, setIsTargetFound] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [targetVersion, setTargetVersion] = useState<number>(Date.now());
  const [targetSrc, setTargetSrc] = useState<string>(`/targets.mind?v=${Date.now()}`);
  const [videoSrc, setVideoSrc] = useState<string>(`/campaign_speech.mp4?v=${Date.now()}`);
  const [markerSrc, setMarkerSrc] = useState<string>(`/sample_marker.png?v=${Date.now()}`);

  // Dynamically resolve custom assets from browser IndexedDB or fall back to /public defaults
  useEffect(() => {
    let active = true;
    async function resolveAssets() {
      const tUrl = await getAssetUrl('targets.mind', `/targets.mind?v=${targetVersion}`);
      const vUrl = await getAssetUrl('campaign_speech.mp4', `/campaign_speech.mp4?v=${targetVersion}`);
      const mUrl = await getAssetUrl('sample_marker.png', `/sample_marker.png?v=${targetVersion}`);
      if (active) {
        setTargetSrc(tUrl);
        setVideoSrc(vUrl);
        setMarkerSrc(mUrl);
      }
    }
    resolveAssets();
    return () => {
      active = false;
    };
  }, [targetVersion]);

  // Sync state with localStorage on mount
  useEffect(() => {
    const storedScans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
    setScanCount(storedScans);
    const storedEmail = localStorage.getItem('auth_email');
    setIsAuthenticated(!!storedEmail);
  }, []);

  const getVideoElement = (): HTMLVideoElement | null => {
    return document.getElementById('campaign-speech-video') as HTMLVideoElement | null;
  };

  const handlePledge = useCallback(async () => {
    if (isPledged) return;
    setIsPledged(true);

    const email = localStorage.getItem('auth_email') || 'anonymous@voter.local';
    const pledgeBtn = document.getElementById('pledge-button');
    if (pledgeBtn) {
      pledgeBtn.setAttribute('material', 'color: #ffd700'); // micro-feedback: color swap to bright gold
    }

    try {
      await fetch('/api/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch (err) {
      console.error('Failed to record pledge:', err);
    }

    setTimeout(() => {
      window.location.href = 'https://example.com/signup';
    }, 1200);
  }, [isPledged]);

  // Quota verification & session increment
  const handleTargetFound = useCallback(async () => {
    const currentScans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
    const authed = !!localStorage.getItem('auth_email');
    const vid = getVideoElement();

    setIsTargetFound(true);

    if (currentScans >= 2 && !authed) {
      if (vid) {
        vid.pause();
      }
      setShowQuota(true);
      return;
    }

    // Play video
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch((err) => console.log('Autoplay deferred:', err));
    }

    // Increment scan allowance once per unique detection session
    const nextScans = currentScans + 1;
    localStorage.setItem('ar_scan_count', nextScans.toString());
    setScanCount(nextScans);

    try {
      await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          increment: 1,
          email: localStorage.getItem('auth_email') || null
        })
      });
    } catch (e) {
      console.error('Error logging scan:', e);
    }
  }, []);

  const handleTargetLost = useCallback(() => {
    setIsTargetFound(false);
    const vid = getVideoElement();
    if (vid) {
      vid.pause();
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Attach A-Frame custom component if available
    const AFRAME = (window as any).AFRAME;
    if (AFRAME && !AFRAME.components['pledge-handler']) {
      AFRAME.registerComponent('pledge-handler', {
        init: function () {
          this.el.addEventListener('click', () => {
            handlePledge();
          });
        }
      });
    }

    const targetEl = document.getElementById('target-anchor');
    if (targetEl) {
      targetEl.addEventListener('targetFound', handleTargetFound);
      targetEl.addEventListener('targetLost', handleTargetLost);
    }

    const sceneEl = document.querySelector('a-scene');
    const handleArError = (event: any) => {
      console.error('MindAR error:', event);
      setCameraError('Unable to access camera. Please allow camera permissions or access via localhost/HTTPS.');
    };

    if (sceneEl) {
      sceneEl.addEventListener('arError', handleArError);
    }

    return () => {
      if (targetEl) {
        targetEl.removeEventListener('targetFound', handleTargetFound);
        targetEl.removeEventListener('targetLost', handleTargetLost);
      }
      if (sceneEl) {
        sceneEl.removeEventListener('arError', handleArError);
      }
    };
  }, [handlePledge, handleTargetFound, handleTargetLost, targetVersion]);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setShowQuota(false);
    const vid = getVideoElement();
    if (vid) {
      vid.play().catch(console.error);
    }
  };

  const handleTargetUpdated = () => {
    setTargetVersion(Date.now());
    setIsTargetFound(false);
    // Reload page to re-initialize MindAR WebGL context cleanly with new targets
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-transparent select-none">
      {/* MindAR A-Frame WebAR Scene Viewport */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0">
        <a-scene
          key={targetVersion}
          mindar-image={`imageTargetSrc: ${targetSrc}; filterMinCF: 0.0001; filterBeta: 0.001; autoStart: true; uiLoading: no; uiScanning: no;`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights; alpha: true"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          embedded
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          <a-assets timeout="10000">
            <video
              id="campaign-speech-video"
              src={videoSrc}
              preload="auto"
              playsInline
              webkit-playsinline="true"
              loop
              crossOrigin="anonymous"
            />
          </a-assets>

          <a-camera
            position="0 0 0"
            look-controls="enabled: false"
            cursor="rayOrigin: mouse"
            raycaster="objects: .clickable"
          />

          <a-entity id="target-anchor" mindar-image-target="targetIndex: 0">
            {/* Campaign Speech Video Plane attached to poster */}
            <a-video
              src="#campaign-speech-video"
              position="0 0.1 0"
              width="1"
              height="0.65"
              rotation="0 0 0"
            />

            {/* Interactive 3D 'Pledge to Vote' Button with Anti-Jitter Z-offset */}
            <a-entity
              id="pledge-button"
              className="clickable"
              pledge-handler
              geometry="primitive: box; width: 0.85; height: 0.2; depth: 0.02"
              material="color: #dc2626; roughness: 0.25; metalness: 0.15"
              position="0 -0.45 0.02"
            >
              <a-text
                value="PLEDGE TO VOTE"
                align="center"
                position="0 0 0.02"
                width="2.6"
                color="#ffffff"
                font="kelsonsans"
              />
            </a-entity>
          </a-entity>
        </a-scene>
      </div>

      {/* Top Left: Scan Quota Pill styled in Election Palette */}
      <div className="absolute top-4 left-4 z-20 bg-gray-950/90 backdrop-blur-md px-4 py-2 rounded-full border border-amber-500/40 text-xs tracking-wider text-amber-100 shadow-xl flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
        <span>Scans Used: <strong className="text-amber-300 font-extrabold">{scanCount}</strong> {isAuthenticated ? '(Unlimited)' : '/ 2 Free'} <span className="text-[10px] text-amber-400/80 font-normal">(స్కాన్లు)</span></span>
      </div>

      {/* Top Right Actions: Upload Target & View Target Poster */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 backdrop-blur-md px-3.5 py-2 rounded-full border border-amber-300/40 text-xs font-bold tracking-wide text-white flex items-center space-x-1.5 transition-all shadow-xl active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Upload Poster / అప్‌లోడ్</span>
        </button>

        <a
          href={markerSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-950/90 hover:bg-gray-900 backdrop-blur-md px-3.5 py-2 rounded-full border border-amber-500/40 text-xs font-semibold tracking-wide text-amber-300 hover:text-amber-200 flex items-center space-x-1.5 transition-all shadow-xl"
        >
          <span>View Poster / పోస్టర్</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="bg-gray-950/90 hover:bg-red-950/80 backdrop-blur-md p-2 rounded-full border border-amber-500/40 hover:border-red-500 text-amber-300 hover:text-red-300 transition-all shadow-xl active:scale-95 flex items-center justify-center"
            title="Exit AR View"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* AR Scanning Reticle / Target Finder Viewport HUD in Amber-Orange Theme */}
      {!isTargetFound && !showQuota && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center p-6">
          <div className="relative w-64 h-80 sm:w-72 sm:h-96 rounded-2xl border-2 border-dashed border-amber-400/60 flex items-center justify-center">
            {/* Viewfinder Corners */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {/* Saffron-Gold laser scanning line */}
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_14px_#f59e0b] animate-scan-laser" />

            <div className="bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-amber-500/40 text-center shadow-lg">
              <p className="text-xs font-bold text-amber-300">Point at Campaign Poster</p>
              <p className="text-[11px] font-semibold text-amber-200/90 mt-0.5">ఎన్నికల పోస్టర్ వైపు చూపించండి</p>
            </div>
          </div>
        </div>
      )}

      {/* Target Locked Pill in Election Colors */}
      {isTargetFound && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-red-950/90 via-orange-950/90 to-amber-950/90 border border-amber-400/60 backdrop-blur-md px-5 py-2.5 rounded-full text-xs text-amber-200 font-bold tracking-wide flex items-center space-x-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-in fade-in zoom-in-95 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
          <span>Poster Detected — Speech Playing | పోస్టర్ గుర్తించబడింది</span>
        </div>
      )}

      {/* Camera Access Error Alert */}
      {cameraError && (
        <div className="absolute bottom-6 inset-x-4 max-w-md mx-auto z-30 bg-red-950/95 border border-red-700 p-4 rounded-2xl text-center backdrop-blur-md text-red-200 text-xs shadow-2xl">
          <p className="font-bold text-red-100 mb-1">Camera Permission Notice / కెమెరా అనుమతి అవసరం</p>
          <p>{cameraError}</p>
        </div>
      )}

      {/* Target Upload & Compilation Modal */}
      <TargetUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onTargetUpdated={handleTargetUpdated}
      />

      {/* Zero-Button Passwordless Email Capture Modal */}
      {showQuota && <QuotaModal onAuthenticated={handleAuthenticated} />}

      {/* Developer Attribution Watermark */}
      <div className="absolute bottom-2.5 right-3.5 z-20 text-[10px] text-amber-200/50 font-medium tracking-wider pointer-events-none select-none flex items-center space-x-1">
        <span>Developed by / రూపొందించినది:</span>
        <span className="text-amber-400 font-bold">Bose Kodelli</span>
      </div>
    </div>
  );
}
