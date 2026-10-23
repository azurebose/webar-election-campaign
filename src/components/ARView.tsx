'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QuotaModal from '@/components/QuotaModal';
import WardPosterModal from '@/components/WardPosterModal';
import { getAssetUrl, getAssetBlob, getWardsConfig, WardPoster } from '@/utils/idbStorage';
import { getPublicAssetUrl } from '@/lib/r2';
import { verifyAndIncrementScan, getVisitorFingerprint, recordVotePledge } from '@/lib/quota';

interface ARViewProps {
  onExit?: () => void;
}

const DEFAULT_WARD: WardPoster = {
  id: 'ward-default',
  wardNumber: 'Ward 1 / వార్డు 1',
  wardName: 'Official Alliance Poster',
  candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
  markerUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ? getPublicAssetUrl('sample_marker.png') : '/sample_marker.png',
  videoUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN ? getPublicAssetUrl('campaign_speech.mp4') : '/campaign_speech.mp4'
};

export default function ARView({ onExit }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scanCount, setScanCount] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showQuota, setShowQuota] = useState<boolean>(false);
  const [isPledged, setIsPledged] = useState<boolean>(false);
  const [activeWardIndex, setActiveWardIndex] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Multi-Ward Configuration & Readiness
  const [isReady, setIsReady] = useState<boolean>(false);
  const [wards, setWards] = useState<WardPoster[]>([DEFAULT_WARD]);
  const [isWardModalOpen, setIsWardModalOpen] = useState<boolean>(false);
  const [targetVersion] = useState<number>(Date.now());
  const [selectedWardNum, setSelectedWardNum] = useState<number | null>(null);
  const [isDedicatedSingleTarget, setIsDedicatedSingleTarget] = useState<boolean>(false);
  const [targetSrc, setTargetSrc] = useState<string>(`/targets.mind?v=${Date.now()}`);


  // 1. Install WebRTC camera fallback polyfill for laptops/desktops/front webcams
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async function (constraints) {
        try {
          return await origGUM(constraints);
        } catch (err: any) {
          console.warn('[WebAR] Rear camera constraint unavailable, falling back to default webcam:', err);
          if (constraints && constraints.video) {
            try {
              // Fallback to any active webcam device
              return await origGUM({ audio: false, video: true });
            } catch (fallbackErr) {
              console.error('[WebAR] Fallback webcam failed:', fallbackErr);
              throw fallbackErr;
            }
          }
          throw err;
        }
      };
    }
  }, []);

  // 2. Load compiled targets.mind and multi-ward configuration from IndexedDB / Defaults / R2
  useEffect(() => {
    let active = true;
    async function loadCampaignAssets() {
      try {
        const nowTs = Date.now();
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const requestedWardStr = urlParams?.get('ward');
        const requestedWardNum = requestedWardStr ? parseInt(requestedWardStr, 10) : null;
        const isSingleWard = !!(requestedWardNum && !isNaN(requestedWardNum));
        if (isSingleWard) {
          setSelectedWardNum(requestedWardNum);
        }

        let customTargets = '';
        let dedicatedSingle = false;

        // A. If single ward requested, check for dedicated single-ward target
        if (isSingleWard) {
          const wardTargetKey = `ward_${requestedWardNum}_targets.mind`;
          // Check IndexedDB
          const idbTarget = await getAssetBlob(`ward_target_ward-${requestedWardNum}.mind`);
          if (idbTarget) {
            customTargets = URL.createObjectURL(idbTarget);
            dedicatedSingle = true;
          } else if (process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN) {
            const r2WardUrl = `${getPublicAssetUrl(wardTargetKey)}?t=${nowTs}`;
            try {
              const res = await fetch(r2WardUrl, { method: 'HEAD' });
              if (res.ok) {
                customTargets = r2WardUrl;
                dedicatedSingle = true;
              }
            } catch (e) {}
          }
        }

        // B. Check master targets.mind in IndexedDB or R2 with cache-buster
        if (!customTargets) {
          const idbCombined = await getAssetBlob('targets.mind');
          if (idbCombined) {
            customTargets = URL.createObjectURL(idbCombined);
          } else if (process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN) {
            const r2MasterUrl = `${getPublicAssetUrl('targets.mind')}?t=${nowTs}`;
            try {
              const res = await fetch(r2MasterUrl, { method: 'HEAD' });
              if (res.ok) {
                customTargets = r2MasterUrl;
              }
            } catch (e) {}
          }
        }

        // C. Fall back to bundled /targets.mind
        if (!customTargets) {
          customTargets = `/targets.mind?v=${nowTs}`;
        }

        let resolvedWards: WardPoster[] | null = null;

        // 1. Fetch live published configuration directly from Cloudflare R2 CDN with cache-buster
        try {
          const r2WardsUrl = `${getPublicAssetUrl('wards.json')}?t=${nowTs}`;
          const cdnRes = await fetch(r2WardsUrl);
          if (cdnRes.ok) {
            const cdnData = await cdnRes.json();
            if (Array.isArray(cdnData) && cdnData.length > 0) {
              resolvedWards = cdnData;
            }
          }
        } catch (e) {
          console.warn('Could not load wards.json from R2 CDN:', e);
        }

        // 2. Fall back to local IndexedDB configuration
        if (!resolvedWards || resolvedWards.length === 0) {
          resolvedWards = await getWardsConfig();
        }

        // 3. Fall back to bundled /wards.json
        if (!resolvedWards || resolvedWards.length === 0) {
          try {
            const publicRes = await fetch(`/wards.json?v=${nowTs}`);
            if (publicRes.ok) {
              const publicData = await publicRes.json();
              if (Array.isArray(publicData) && publicData.length > 0) {
                resolvedWards = publicData;
              }
            }
          } catch (e) {
            console.warn('Could not load local wards.json:', e);
          }
        }

        // Sanitize any stale blob: URLs to public CDN URLs so remote mobile visitors never break
        if (resolvedWards && resolvedWards.length > 0) {
          resolvedWards = resolvedWards.map((w, wIdx) => {
            const wardNum = wIdx + 1;
            let marker = w.markerUrl;
            let video = w.videoUrl;
            if (!marker || marker.startsWith('blob:')) {
              marker = getPublicAssetUrl(`ward_${wardNum}_poster.png`);
            }
            if (!video || video.startsWith('blob:')) {
              video = getPublicAssetUrl(`ward_${wardNum}_speech.mp4`);
            }
            return {
              ...w,
              markerUrl: marker,
              videoUrl: video
            };
          });
        }

        if (active) {
          setIsDedicatedSingleTarget(dedicatedSingle);
          setTargetSrc(customTargets);
          if (resolvedWards && resolvedWards.length > 0) {
            setWards(resolvedWards);
            if (isSingleWard && requestedWardNum && (requestedWardNum > resolvedWards.length || requestedWardNum < 1)) {
              console.warn(`Requested ward ${requestedWardNum} is out of bounds (only ${resolvedWards.length} wards active). Falling back to all wards.`);
              setSelectedWardNum(null);
            }
          } else {
            // Clean fallback: single default sample poster and video
            setWards([DEFAULT_WARD]);
          }
          setIsReady(true);
        }
      } catch (err) {
        console.warn('Failed to load campaign assets:', err);
        if (active) {
          setIsReady(true);
        }
      }
    }
    loadCampaignAssets();
    return () => {
      active = false;
    };
  }, [targetVersion]);

  // 3. Sync scan quota with localStorage on mount
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

    // 1. Record pledge in Firestore under voter_profiles/{uid}.pledged_to_vote = true
    try {
      await recordVotePledge(undefined, email);
    } catch (e) {
      console.warn('Firestore pledge sync notice:', e);
    }

    // 2. Record pledge in localStorage and Supabase if configured
    localStorage.setItem('voter_pledged', 'true');
    try {
      const { syncPledgeToSupabase } = await import('@/utils/supabaseClient');
      await syncPledgeToSupabase(email);
    } catch (e) {}

    setTimeout(() => {
      window.location.href = 'https://example.com/signup';
    }, 1200);
  }, [isPledged]);

  const toggleAudio = useCallback(() => {
    if (activeWardIndex === null) return;
    const vid = document.getElementById(`campaign-speech-video-${activeWardIndex}`) as HTMLVideoElement | null;
    if (vid) {
      const nextMuted = !vid.muted;
      vid.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        vid.play().catch(console.error);
      }
    }
  }, [activeWardIndex]);

  // Handle detection of any ward poster
  const handleTargetFound = useCallback(
    async (wardIdx: number) => {
      setActiveWardIndex(wardIdx);

      // Verify scan quota in Firestore using device/session fingerprint
      const fingerprint = getVisitorFingerprint();
      const quotaAllowed = await verifyAndIncrementScan(fingerprint);

      if (!quotaAllowed) {
        // Exceeded 2 free scans: pause all playback and prompt magic-link authentication
        wards.forEach((_, idx) => {
          const vid = document.getElementById(`campaign-speech-video-${idx}`) as HTMLVideoElement | null;
          if (vid) {
            vid.pause();
          }
        });
        setShowQuota(true);
        return;
      }

      // Quota authorized: Play matching ward video and pause all others
      wards.forEach((_, idx) => {
        const vid = document.getElementById(`campaign-speech-video-${idx}`) as HTMLVideoElement | null;
        if (vid) {
          if (idx === wardIdx) {
            // Mobile browser safe autoplay: start muted if needed so mobile browsers never reject play()
            vid.muted = isMuted;
            const playPromise = vid.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                console.warn('Autoplay with audio deferred on mobile, falling back to muted stream:', err);
                vid.muted = true;
                setIsMuted(true);
                vid.play().catch((playErr) => console.log('Playback retry note:', playErr));
              });
            }
          } else {
            vid.pause();
          }
        }
      });

      // Increment scan allowance once per detection in local state
      setScanCount((prev) => prev + 1);

      // Sync with Supabase if configured
      const authed = !!localStorage.getItem('auth_email');
      if (authed) {
        const storedEmail = localStorage.getItem('auth_email');
        if (storedEmail) {
          const { syncUserToSupabase } = await import('@/utils/supabaseClient');
          await syncUserToSupabase(storedEmail);
        }
      }
    },
    [wards, isMuted]
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

  // Register A-Frame components & target listeners for each ward once ready
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

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
      console.warn('MindAR scene error detected:', event);
      setCameraError('Unable to start camera stream. Please check camera permissions or click Retry below.');
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
      // Stop lingering camera tracks to prevent camera lock
      const videoEls = document.querySelectorAll('video');
      videoEls.forEach((v) => {
        if (v.srcObject) {
          try {
            const stream = v.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            v.srcObject = null;
          } catch (e) {}
        }
      });
      if ((sceneEl as any)?.systems?.['mindar-image-system']) {
        try {
          (sceneEl as any).systems['mindar-image-system'].stop();
        } catch (e) {}
      }
    };
  }, [isReady, wards, handlePledge, handleTargetFound, handleTargetLost]);

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

  const handleRetryCamera = () => {
    setCameraError(null);
    // Stop all tracks and reload cleanly
    const videoEls = document.querySelectorAll('video');
    videoEls.forEach((v) => {
      if (v.srcObject) {
        try {
          const stream = v.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
          v.srcObject = null;
        } catch (e) {}
      }
    });
    window.location.reload();
  };

  const activeWard = activeWardIndex !== null ? wards[activeWardIndex] : null;

  // Show loading indicator until ward configuration is loaded to prevent double-mount
  if (!isReady) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-transparent select-none flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-3 animate-spin">
          <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p className="text-sm font-bold text-amber-300">Initializing AR Camera & Campaign Wards...</p>
        <p className="text-xs text-amber-200/80 mt-1">కెమెరా మరియు వార్డుల సమాచారం లోడ్ అవుతోంది...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-transparent select-none">
      {/* MindAR A-Frame WebAR Scene Viewport */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0 bg-transparent">
        <a-scene
          key={`${targetSrc}-${targetVersion}`}
          mindar-image={`imageTargetSrc: ${targetSrc}; filterMinCF: 0.0001; filterBeta: 0.001; autoStart: true; uiLoading: no; uiScanning: no;`}
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights; alpha: true"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          embedded
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        >
          {/* Candidate Speech Videos for all Wards (preload="none" prevents network congestion) */}
          <a-assets timeout="3000">
            {wards.map((ward, idx) => (
              <video
                key={`vid-asset-${ward.id || idx}`}
                id={`campaign-speech-video-${idx}`}
                src={ward.videoUrl}
                preload="none"
                playsInline
                webkit-playsinline="true"
                loop
                muted={isMuted}
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
          {wards.map((ward, idx) => {
            const isSingleWard = selectedWardNum !== null;
            const targetWardIdx = selectedWardNum !== null ? selectedWardNum - 1 : idx;
            if (isSingleWard && idx !== targetWardIdx) {
              return null;
            }

            return (
              <a-entity
                key={`target-anchor-${ward.id || idx}`}
                id={`target-anchor-${idx}`}
                mindar-image-target={`targetIndex: ${isDedicatedSingleTarget ? 0 : idx}`}
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
            );
          })}
        </a-scene>
      </div>

      {/* Top Header Bar: Responsive Non-Colliding Navigation */}
      <header className="absolute top-2.5 sm:top-4 inset-x-2.5 sm:inset-x-4 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
        {/* Left: Scan Quota Pill & Dedicated Ward Badge */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-shrink-0">
          <div className="bg-gray-950/90 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-amber-500/40 text-[11px] sm:text-xs tracking-wider text-amber-100 shadow-xl flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b] flex-shrink-0" />
            <span className="whitespace-nowrap">
              Scans: <strong className="text-amber-300 font-extrabold">{scanCount}</strong>{' '}
              {isAuthenticated ? '(Unlimited)' : '/ 2 Free'}
            </span>
          </div>

          {selectedWardNum !== null && (
            <div className="bg-orange-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-orange-500/50 text-[10px] sm:text-[11px] font-bold text-orange-200 flex items-center space-x-1 shadow-xl">
              <span>W{selectedWardNum}</span>
              <a
                href="/"
                className="text-[9px] text-amber-300 hover:text-white underline font-normal ml-0.5"
              >
                (All)
              </a>
            </div>
          )}
        </div>

        {/* Right Actions: View Ward Posters Modal & Exit */}
        <div className="pointer-events-auto flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsWardModalOpen(true)}
            className="bg-gray-950/90 hover:bg-gray-900 backdrop-blur-md px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-amber-500/40 text-[11px] sm:text-xs font-semibold tracking-wide text-amber-300 hover:text-amber-200 flex items-center space-x-1 transition-all shadow-xl active:scale-95"
            title="Browse all ward candidate posters"
          >
            <span>Posters ({wards.length})</span>
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
              className="bg-gray-950/90 hover:bg-red-950/80 backdrop-blur-md p-1.5 sm:p-2 rounded-full border border-amber-500/40 hover:border-red-500 text-amber-300 hover:text-red-300 transition-all shadow-xl active:scale-95 flex items-center justify-center"
              title="Exit AR View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* AR Scanning Reticle / Target Finder Viewport HUD in Amber-Orange Theme */}
      {activeWardIndex === null && !showQuota && !cameraError && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center p-4">
          <div className="relative w-[70vw] max-w-[270px] h-[36vh] max-h-[300px] rounded-2xl border-2 border-dashed border-amber-400/60 flex flex-col items-center justify-between p-3">
            {/* Viewfinder Corners */}
            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

            {/* Saffron-Gold laser scanning line */}
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_14px_#f59e0b] animate-scan-laser" />

            <div />

            {/* Guidance Badge */}
            <div className="bg-black/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-amber-500/40 text-center shadow-lg pointer-events-auto">
              <p className="text-xs font-bold text-amber-300">Point at Ward Poster</p>
              <p className="text-[10px] font-semibold text-amber-200/90 mt-0.5">వార్డు పోస్టర్ వైపు చూపించండి</p>
            </div>
          </div>

          {/* Quick Helper Button below Reticle */}
          <div className="mt-4 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsWardModalOpen(true)}
              className="bg-black/80 hover:bg-black/95 backdrop-blur-md px-4 py-2 rounded-full border border-amber-400/40 text-[11px] font-bold text-amber-200 hover:text-white flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
            >
              <span>🖼️ View {wards.length} Ward {wards.length === 1 ? 'Poster' : 'Posters'} / పోస్టర్లు</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Mobile 2D Action HUD: Ward Info, Audio Toggle, and Direct Pledge Button */}
      {activeWard && (
        <div className="absolute bottom-3 sm:bottom-6 inset-x-2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-20 sm:max-w-md w-auto bg-gradient-to-r from-red-950/95 via-gray-900/95 to-amber-950/95 border border-amber-400/70 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.35)] flex flex-col space-y-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
          {/* Active Ward Header Info & Audio Toggle */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399] flex-shrink-0" />
              <div className="truncate">
                <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                  🎯 {activeWard.wardNumber}: {activeWard.candidateName}
                </p>
                <p className="text-[9px] sm:text-[10px] text-amber-300/80 truncate">
                  {activeWard.wardName || 'Candidate Speech Playing'}
                </p>
              </div>
            </div>

            {/* Audio Toggle Button with clear mobile prompt */}
            <button
              type="button"
              onClick={toggleAudio}
              className={`flex-shrink-0 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border transition-all active:scale-95 flex items-center space-x-1 ${
                isMuted
                  ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 hover:bg-amber-500/35 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
              }`}
              title={isMuted ? 'Tap to unmute candidate speech' : 'Mute speech audio'}
            >
              <span>{isMuted ? '🔇 Unmute Sound' : '🔊 Sound On'}</span>
            </button>
          </div>

          {/* Action Button: 2D Screen Touch Pledge to Vote */}
          <button
            type="button"
            onClick={handlePledge}
            disabled={isPledged}
            className={`w-full py-2.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm tracking-wide shadow-lg border transition-all flex items-center justify-center space-x-1.5 active:scale-95 ${
              isPledged
                ? 'bg-amber-500 text-gray-950 border-amber-300 shadow-amber-500/30'
                : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border-amber-300/40 shadow-red-600/30'
            }`}
          >
            <span>{isPledged ? '✓ PLEDGE RECORDED / ప్రతిజ్ఞ నమోదైంది' : '🗳️ PLEDGE TO VOTE / ఓటు వేస్తానని ప్రతిజ్ఞ చేయండి'}</span>
          </button>
        </div>
      )}

      {/* Interactive Camera Notice Alert with Retry Action */}
      {cameraError && (
        <div className="absolute bottom-6 inset-x-3 max-w-md mx-auto z-30 bg-red-950/95 border border-red-700 p-4 sm:p-5 rounded-2xl text-center backdrop-blur-md text-red-200 text-xs shadow-2xl space-y-2.5 pointer-events-auto">
          <div>
            <p className="font-bold text-red-100 text-sm mb-1">Camera Stream Notice / కెమెరా సందేశం</p>
            <p className="text-[11px] text-red-200/90">{cameraError}</p>
          </div>
          <button
            type="button"
            onClick={handleRetryCamera}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg transition-all active:scale-95"
          >
            Retry Camera / కెమెరాను మళ్లీ ప్రారంభించండి
          </button>
        </div>
      )}

      {/* Multi-Ward Poster Browse & Download Modal */}
      <WardPosterModal
        isOpen={isWardModalOpen}
        onClose={() => setIsWardModalOpen(false)}
        wards={wards}
        onSelectWard={(wardIdx) => {
          const wardNum = wardIdx + 1;
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('ward', wardNum.toString());
            window.location.href = url.toString();
          }
        }}
      />

      {/* Zero-Button Passwordless Email Capture Modal */}
      {showQuota && (
        <QuotaModal
          onAuthenticated={handleAuthenticated}
          onClose={() => setShowQuota(false)}
        />
      )}

      {/* Developer Attribution & Admin Command Link */}
      <div className="absolute bottom-2 inset-x-2 z-10 text-[10px] text-amber-200/50 font-medium tracking-wider select-none flex items-center justify-between pointer-events-none">
        <span className="truncate max-w-[70%]">
          Developed by: <strong className="text-amber-400">Bose Kodelli</strong>
        </span>
        <a
          href="/admin"
          className="text-amber-400/50 hover:text-amber-300 transition-colors pointer-events-auto p-1"
          title="Campaign Admin Portal"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
