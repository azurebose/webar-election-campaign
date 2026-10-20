'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QuotaModal from '@/components/QuotaModal';
import WardPosterModal from '@/components/WardPosterModal';
import { getAssetUrl, getWardsConfig, WardPoster } from '@/utils/idbStorage';

interface ARViewProps {
  onExit?: () => void;
}

const DEFAULT_WARD: WardPoster = {
  id: 'ward-default',
  wardNumber: 'Ward 1 / వార్డు 1',
  wardName: 'Official Alliance Poster',
  candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
  markerUrl: '/sample_marker.png',
  videoUrl: '/campaign_speech.mp4'
};

export default function ARView({ onExit }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showQuota, setShowQuota] = useState<boolean>(false);
  const [isPledged, setIsPledged] = useState<boolean>(false);
  const [activeWardIndex, setActiveWardIndex] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Multi-Ward Configuration & Assets
  const [wards, setWards] = useState<WardPoster[]>([DEFAULT_WARD]);
  const [isWardModalOpen, setIsWardModalOpen] = useState<boolean>(false);
  const [targetVersion] = useState<number>(Date.now());
  const [targetSrc, setTargetSrc] = useState<string>(`/targets.mind?v=${Date.now()}`);

  // Load compiled targets.mind and multi-ward configuration from IndexedDB / Defaults
  useEffect(() => {
    let active = true;
    async function loadCampaignAssets() {
      const customTargets = await getAssetUrl('targets.mind', `/targets.mind?v=${targetVersion}`);
      const savedWards = await getWardsConfig();

      if (active) {
        setTargetSrc(customTargets);
        if (savedWards && savedWards.length > 0) {
          setWards(savedWards);
        } else {
          // Fall back to default ward with any cached singular assets
          const marker = await getAssetUrl('sample_marker.png', `/sample_marker.png?v=${targetVersion}`);
          const speech = await getAssetUrl('campaign_speech.mp4', `/campaign_speech.mp4?v=${targetVersion}`);
          setWards([
            {
              id: 'ward-1',
              wardNumber: 'Ward 1 / వార్డు 1',
              wardName: 'Official Alliance Campaign Poster',
              candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
              markerUrl: marker,
              videoUrl: speech
            }
          ]);
        }
      }
    }
    loadCampaignAssets();
    return () => {
      active = false;
    };
  }, [targetVersion]);

  // Sync scan quota with localStorage on mount
  useEffect(() => {
    const storedScans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
    setScanCount(storedScans);
    const storedEmail = localStorage.getItem('auth_email');
    setIsAuthenticated(!!storedEmail);
  }, []);

  const handlePledge = useCallback(async () => {
    if (isPledged) return;
    setIsPledged(true);

    const email = localStorage.getItem('auth_email') || 'anonymous@voter.local';
    const pledgeBtn = document.getElementById('pledge-button');
    if (pledgeBtn) {
      pledgeBtn.setAttribute('material', 'color: #ffd700'); // Visual micro-feedback: swap to bright gold
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

  // Handle detection of any ward poster
  const handleTargetFound = useCallback(
    async (wardIdx: number) => {
      setActiveWardIndex(wardIdx);

      // Play matching ward video and pause all others
      wards.forEach((_, idx) => {
        const vid = document.getElementById(`campaign-speech-video-${idx}`) as HTMLVideoElement | null;
        if (vid) {
          if (idx === wardIdx) {
            vid.currentTime = 0;
            vid.play().catch((err) => console.log('Autoplay deferred:', err));
          } else {
            vid.pause();
          }
        }
      });

      // Verify scan quota
      const currentScans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
      const authed = !!localStorage.getItem('auth_email');

      if (currentScans >= 2 && !authed) {
        const currentVid = document.getElementById(`campaign-speech-video-${wardIdx}`) as HTMLVideoElement | null;
        if (currentVid) {
          currentVid.pause();
        }
        setShowQuota(true);
        return;
      }

      // Increment scan allowance once per detection
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
    },
    [wards]
  );

  const handleTargetLost = useCallback(
    (wardIdx: number) => {
      const vid = document.getElementById(`campaign-speech-video-${wardIdx}`) as HTMLVideoElement | null;
      if (vid) {
        vid.pause();
      }
      setActiveWardIndex((prev) => (prev === wardIdx ? null : prev));
    },
    []
  );

  // Register A-Frame components & target listeners for each ward
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

    // Attach targetFound / targetLost listeners for all ward anchors
    const attachedListeners: Array<{ el: HTMLElement; onFound: () => void; onLost: () => void }> = [];

    wards.forEach((_, idx) => {
      const targetEl = document.getElementById(`target-anchor-${idx}`);
      if (targetEl) {
        const onFound = () => handleTargetFound(idx);
        const onLost = () => handleTargetLost(idx);
        targetEl.addEventListener('targetFound', onFound);
        targetEl.addEventListener('targetLost', onLost);
        attachedListeners.push({ el: targetEl, onFound, onLost });
      }
    });

    const sceneEl = document.querySelector('a-scene');
    const handleArError = (event: any) => {
      console.error('MindAR error:', event);
      setCameraError('Unable to access camera. Please allow camera permissions or access via localhost/HTTPS.');
    };

    if (sceneEl) {
      sceneEl.addEventListener('arError', handleArError);
    }

    return () => {
      attachedListeners.forEach(({ el, onFound, onLost }) => {
        el.removeEventListener('targetFound', onFound);
        el.removeEventListener('targetLost', onLost);
      });
      if (sceneEl) {
        sceneEl.removeEventListener('arError', handleArError);
      }
    };
  }, [wards, handlePledge, handleTargetFound, handleTargetLost, targetVersion]);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setShowQuota(false);
    if (activeWardIndex !== null) {
      const vid = document.getElementById(`campaign-speech-video-${activeWardIndex}`) as HTMLVideoElement | null;
      if (vid) {
        vid.play().catch(console.error);
      }
    }
  };

  const activeWard = activeWardIndex !== null ? wards[activeWardIndex] : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-transparent select-none">
      {/* MindAR A-Frame WebAR Scene Viewport */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0">
        <a-scene
          key={`${targetVersion}-${wards.length}`}
          mindar-image={`imageTargetSrc: ${targetSrc}; filterMinCF: 0.0001; filterBeta: 0.001; autoStart: true; uiLoading: no; uiScanning: no;`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights; alpha: true"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          embedded
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          {/* Preload Candidate Speech Videos for all Wards */}
          <a-assets timeout="10000">
            {wards.map((ward, idx) => (
              <video
                key={`vid-asset-${ward.id || idx}`}
                id={`campaign-speech-video-${idx}`}
                src={ward.videoUrl}
                preload="auto"
                playsInline
                webkit-playsinline="true"
                loop
                crossOrigin="anonymous"
              />
            ))}
          </a-assets>

          <a-camera
            position="0 0 0"
            look-controls="enabled: false"
            cursor="rayOrigin: mouse"
            raycaster="objects: .clickable"
          />

          {/* Dynamic MindAR Target Anchors for each Ward Poster */}
          {wards.map((ward, idx) => (
            <a-entity
              key={`target-anchor-${ward.id || idx}`}
              id={`target-anchor-${idx}`}
              mindar-image-target={`targetIndex: ${idx}`}
            >
              {/* Ward Candidate Speech Video Plane attached to poster */}
              <a-video
                src={`#campaign-speech-video-${idx}`}
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
          ))}
        </a-scene>
      </div>

      {/* Top Left: Scan Quota Pill styled in Election Palette */}
      <div className="absolute top-4 left-4 z-20 bg-gray-950/90 backdrop-blur-md px-4 py-2 rounded-full border border-amber-500/40 text-xs tracking-wider text-amber-100 shadow-xl flex items-center space-x-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
        <span>
          Scans Used: <strong className="text-amber-300 font-extrabold">{scanCount}</strong>{' '}
          {isAuthenticated ? '(Unlimited)' : '/ 2 Free'}{' '}
          <span className="text-[10px] text-amber-400/80 font-normal">(స్కాన్లు)</span>
        </span>
      </div>

      {/* Top Right Actions: View Ward Posters Modal & Exit */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
        <button
          type="button"
          onClick={() => setIsWardModalOpen(true)}
          className="bg-gray-950/90 hover:bg-gray-900 backdrop-blur-md px-3.5 py-2 rounded-full border border-amber-500/40 text-xs font-semibold tracking-wide text-amber-300 hover:text-amber-200 flex items-center space-x-1.5 transition-all shadow-xl active:scale-95"
          title="Browse all ward candidate posters"
        >
          <span>View Posters ({wards.length}) / పోస్టర్లు</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

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
      {activeWardIndex === null && !showQuota && (
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
              <p className="text-xs font-bold text-amber-300">Point at Any Ward Poster</p>
              <p className="text-[11px] font-semibold text-amber-200/90 mt-0.5">ఏదైనా వార్డు పోస్టర్ వైపు చూపించండి</p>
            </div>
          </div>
        </div>
      )}

      {/* Ward Detected HUD Badge with Active Ward Details */}
      {activeWard && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-[90vw] bg-gradient-to-r from-red-950/95 via-orange-950/95 to-amber-950/95 border border-amber-400/70 backdrop-blur-md px-5 py-2.5 rounded-full text-xs text-amber-200 font-bold tracking-wide flex items-center space-x-2.5 shadow-[0_0_25px_rgba(245,158,11,0.4)] animate-in fade-in zoom-in-95 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399] flex-shrink-0" />
          <span className="truncate">
            🎯 <strong className="text-white">{activeWard.wardNumber}</strong>: {activeWard.wardName || 'Speech Playing!'} — {activeWard.candidateName}
          </span>
        </div>
      )}

      {/* Camera Access Error Alert */}
      {cameraError && (
        <div className="absolute bottom-6 inset-x-4 max-w-md mx-auto z-30 bg-red-950/95 border border-red-700 p-4 rounded-2xl text-center backdrop-blur-md text-red-200 text-xs shadow-2xl">
          <p className="font-bold text-red-100 mb-1">Camera Permission Notice / కెమెరా అనుమతి అవసరం</p>
          <p>{cameraError}</p>
        </div>
      )}

      {/* Multi-Ward Poster Browse & Download Modal */}
      <WardPosterModal
        isOpen={isWardModalOpen}
        onClose={() => setIsWardModalOpen(false)}
        wards={wards}
      />

      {/* Zero-Button Passwordless Email Capture Modal */}
      {showQuota && <QuotaModal onAuthenticated={handleAuthenticated} />}

      {/* Developer Attribution & Admin Command Link */}
      <div className="absolute bottom-2.5 right-3.5 z-20 text-[10px] text-amber-200/50 font-medium tracking-wider select-none flex items-center space-x-1">
        <span>Developed by / రూపొందించినది:</span>
        <span className="text-amber-400 font-bold">Bose Kodelli</span>
        <a
          href="/admin"
          className="ml-1.5 text-amber-400/50 hover:text-amber-300 transition-colors pointer-events-auto p-0.5"
          title="Campaign Admin Portal"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
