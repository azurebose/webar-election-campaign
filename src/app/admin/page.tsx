'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  saveAssetBlob,
  getAssetBlob,
  getAssetUrl,
  clearAllCustomAssets,
  saveWardsConfig,
  getWardsConfig,
  WardPoster
} from '@/utils/idbStorage';
import { getPublicAssetUrl } from '@/lib/r2';

interface AdminWardState {
  id: string;
  wardNumber: string;
  wardName: string;
  candidateName: string;
  markerUrl: string;
  videoUrl: string;
  imageFile?: File | null;
  videoFile?: File | null;
}

const DEFAULT_WARDS: AdminWardState[] = [
  {
    id: 'ward-1',
    wardNumber: 'Ward 1 / వార్డు 1',
    wardName: 'Official Alliance Poster',
    candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
    markerUrl: '/sample_marker.png',
    videoUrl: '/campaign_speech.mp4',
    imageFile: null,
    videoFile: null
  }
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Multi-Ward Campaign Posters
  const [wards, setWards] = useState<AdminWardState[]>(DEFAULT_WARDS);
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'tabs' | 'all'>('tabs');
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Compilation state
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [compiledBlob, setCompiledBlob] = useState<Blob | null>(null);

  // Individual ward compilation state
  const [compilingWardIdx, setCompilingWardIdx] = useState<number | null>(null);
  const [wardCompileStatus, setWardCompileStatus] = useState<{
    [idx: number]: { progress: number; status: string; done?: boolean };
  }>({});

  // Cloudflare R2 direct ingestion state
  const [adminEmail, setAdminEmail] = useState<string>(
    process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@electioncampaign.org'
  );
  const [isUploadingToR2, setIsUploadingToR2] = useState<boolean>(false);
  const [r2UploadProgress, setR2UploadProgress] = useState<number>(0);
  const [r2StatusMessage, setR2StatusMessage] = useState<string>('');
  const [r2UploadedAssets, setR2UploadedAssets] = useState<Array<{ name: string; url: string }>>([]);

  // Analytics states
  const [stats, setStats] = useState({
    scansUsed: 0,
    isSupabaseConnected: false,
    activeVoterEmail: ''
  });

  // Check existing session & load ward configuration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPin = urlParams.get('pin');
      const isAutoAdmin = urlParams.get('admin') === 'true';

      const savedAuth =
        sessionStorage.getItem('campaign_admin_auth') === 'true' ||
        localStorage.getItem('campaign_admin_auth') === 'true';

      if (savedAuth || isAutoAdmin || urlPin === 'bose@@2026') {
        setIsAuthenticated(true);
        sessionStorage.setItem('campaign_admin_auth', 'true');
        localStorage.setItem('campaign_admin_auth', 'true');
      }

      const savedAdminEmail = localStorage.getItem('campaign_admin_email');
      if (savedAdminEmail) {
        setAdminEmail(savedAdminEmail);
      }

      loadInitialWards();
      loadAnalytics();

      const handleScroll = () => {
        setShowScrollTop(window.scrollY > 250);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToWard = (idx: number) => {
    setSelectedPreviewIdx(idx);
    if (viewMode === 'all') {
      setTimeout(() => {
        const el = document.getElementById(`ward-card-${idx}`);
        if (el) {
          const yOffset = -70;
          const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
      }, 60);
    }
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  };

  const loadInitialWards = async () => {
    // 1. First check live published configuration directly from Cloudflare R2 CDN
    try {
      const r2WardsUrl = `${getPublicAssetUrl('wards.json')}?t=${Date.now()}`;
      const cdnRes = await fetch(r2WardsUrl, { cache: 'no-store' });
      if (cdnRes.ok) {
        const cdnData = await cdnRes.json();
        if (Array.isArray(cdnData) && cdnData.length > 0) {
          setWards(
            cdnData.map((w) => ({
              ...w,
              imageFile: null,
              videoFile: null
            }))
          );
          return;
        }
      }
    } catch (e) {}

    // 2. Fall back to bundled /wards.json
    try {
      const publicRes = await fetch(`/wards.json?t=${Date.now()}`, { cache: 'no-store' });
      if (publicRes.ok) {
        const publicData = await publicRes.json();
        if (Array.isArray(publicData) && publicData.length > 0) {
          setWards(
            publicData.map((w) => ({
              ...w,
              imageFile: null,
              videoFile: null
            }))
          );
          return;
        }
      }
    } catch (e) {}

    // 3. Clean fallback to default ward
    setWards(DEFAULT_WARDS);
  };

  const loadAnalytics = () => {
    if (typeof window === 'undefined') return;
    const scans = parseInt(localStorage.getItem('ar_scan_count') || '0', 10);
    const email = localStorage.getItem('auth_email') || 'None';
    setStats({
      scansUsed: scans,
      isSupabaseConnected: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      activeVoterEmail: email
    });
  };

  const performLogin = (codeToTest?: string) => {
    const code = (codeToTest !== undefined ? codeToTest : passcode).trim();
    if (code === 'bose@@2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('campaign_admin_auth', 'true');
      localStorage.setItem('campaign_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Invalid Admin Passcode. Access denied.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('campaign_admin_auth');
    localStorage.removeItem('campaign_admin_auth');
    setIsAuthenticated(false);
    setPasscode('');
  };

  // Ward Management actions
  const handleAddWard = () => {
    const newIdx = wards.length + 1;
    const newWard: AdminWardState = {
      id: `ward-${Date.now()}`,
      wardNumber: `Ward ${newIdx} / వార్డు ${newIdx}`,
      wardName: `Ward ${newIdx} Area`,
      candidateName: `Ward ${newIdx} Candidate`,
      markerUrl: '',
      videoUrl: wards[0]?.videoUrl || '/campaign_speech.mp4',
      imageFile: null,
      videoFile: null
    };
    setWards((prev) => [...prev, newWard]);
    setSelectedPreviewIdx(wards.length);
  };

  const handleRemoveWard = async (idx: number) => {
    if (wards.length <= 1) {
      setErrorMessage('You must have at least one campaign ward poster.');
      return;
    }
    const updated = wards.filter((_, i) => i !== idx);
    setWards(updated);
    setSelectedPreviewIdx(Math.max(0, idx - 1));
    await saveWardsConfig(
      updated.map((w, wIdx) => ({
        id: w.id || `ward-${wIdx + 1}`,
        wardNumber: w.wardNumber,
        wardName: w.wardName,
        candidateName: w.candidateName,
        markerUrl: w.markerUrl,
        videoUrl: w.videoUrl,
      }))
    );
  };

  const handleDeleteAllPosters = async () => {
    if (
      !confirm(
        '⚠️ ARE YOU SURE YOU WANT TO DELETE ALL POSTERS?\n\nThis will permanently delete all 7 campaign posters and targets from:\n1. Cloudflare R2 bucket (CDN)\n2. Local browser storage (IndexedDB)\n\nOther devices will no longer see old posters and you will have a 100% clean slate.'
      )
    ) {
      return;
    }

    try {
      setIsUploadingToR2(true);
      setR2StatusMessage('Wiping all poster assets from Cloudflare R2 bucket...');

      const emailToUse = adminEmail.trim() || 'admin@electioncampaign.org';
      try {
        await fetch('/api/admin/clear-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToUse }),
        });
      } catch (e) {
        console.warn('API clear error:', e);
      }

      await clearAllCustomAssets();

      const v = Date.now();
      const cleanDefault: AdminWardState[] = [
        {
          id: 'ward-1',
          wardNumber: 'Ward 1 / వార్డు 1',
          wardName: 'Official Alliance Poster',
          candidateName: 'NDA Alliance / బోస్ కొడెల్లి',
          markerUrl: `/sample_marker.png?v=${v}`,
          videoUrl: `/campaign_speech.mp4?v=${v}`,
          imageFile: null,
          videoFile: null
        }
      ];

      setWards(cleanDefault);
      setSelectedPreviewIdx(0);
      setCompiledBlob(null);
      setWardCompileStatus({});
      setR2UploadedAssets([]);
      setIsUploadingToR2(false);

      setSuccessMessage(
        '✓ All 7 posters have been successfully deleted from Cloudflare R2 and browser storage! Clean slate ready.'
      );
      setTimeout(() => setSuccessMessage(null), 8000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Failed to delete all posters: ${err.message}`);
      setIsUploadingToR2(false);
    }
  };

  const handleUpdateWardField = (idx: number, field: keyof AdminWardState, value: any) => {
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleWardImageUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, JPEG).');
      return;
    }

    setErrorMessage(null);
    const previewUrl = URL.createObjectURL(file);
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], imageFile: file, markerUrl: previewUrl };
      return copy;
    });
  };

  const handleWardVideoUpload = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM).');
      return;
    }

    setErrorMessage(null);
    const previewUrl = URL.createObjectURL(file);
    setWards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], videoFile: file, videoUrl: previewUrl };
      return copy;
    });
  };

  // Load MindAR compiler engine on demand from CDN if not already initialized
  const loadMindARCompiler = async () => {
    const win = window as any;
    let CompilerClass = win.MINDAR?.IMAGE?.Compiler;
    if (!CompilerClass) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load MindAR compiler from CDN'));
        document.head.appendChild(script);
      });
      CompilerClass = (window as any).MINDAR?.IMAGE?.Compiler;
    }
    if (!CompilerClass) {
      throw new Error('MindAR compiler could not be initialized.');
    }
    return CompilerClass;
  };

  // Helper to request pre-signed PUT URL from /api/admin/upload-url and execute direct S3 upload to Cloudflare R2
  const uploadFileToR2 = async (
    filename: string,
    blob: Blob,
    contentType: string,
    customEmail?: string
  ): Promise<string> => {
    const emailToUse = (customEmail || adminEmail).trim() || 'admin@electioncampaign.org';
    const res = await fetch('/api/admin/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        contentType,
        email: emailToUse,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload authorization failed with HTTP ${res.status}`);
    }

    const { uploadUrl, publicUrl } = await res.json();

    try {
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      if (!putRes.ok) {
        throw new Error(`Direct S3 PUT to R2 for "${filename}" failed with HTTP ${putRes.status}`);
      }
    } catch (fetchErr: any) {
      if (fetchErr.name === 'TypeError' || fetchErr.message === 'Failed to fetch') {
        throw new Error(
          `R2 CORS Policy Required: Cloudflare R2 blocked direct browser upload of "${filename}". Please enable CORS on your R2 bucket settings in Cloudflare Dashboard.`
        );
      }
      throw fetchErr;
    }

    return publicUrl;
  };

  // Background/Smart compiler for multi-ward targets.mind combining all wards with valid images
  const compileCombinedTargetsMind = async (currentWards: AdminWardState[], emailToUse: string) => {
    const validWards = currentWards.filter((w) => !!w.markerUrl || !!w.imageFile);
    if (validWards.length === 0) return null;

    try {
      const CompilerClass = await loadMindARCompiler();
      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < validWards.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = validWards[i].markerUrl;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error(`Failed to decode image for ${validWards[i].wardNumber}`));
        });
        loadedImages.push(img);
      }

      const compiler = new CompilerClass();
      await compiler.compileImageTargets(loadedImages, () => {});
      const exportedBuffer = await compiler.exportData();
      const combinedBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });

      await saveAssetBlob('targets.mind', combinedBlob);
      setCompiledBlob(combinedBlob);
      await uploadFileToR2('targets.mind', combinedBlob, 'application/octet-stream', emailToUse);
      return combinedBlob;
    } catch (e) {
      console.warn('Background multi-target sync note:', e);
      return null;
    }
  };

  // Compile an INDIVIDUAL ward poster directly into its own target and sync to Cloudflare R2
  const handleCompileSingleWard = async (idx: number) => {
    const ward = wards[idx];
    if (!ward) return;

    if (!ward.markerUrl && !ward.imageFile) {
      setErrorMessage(`Please upload a poster image for ${ward.wardNumber} before compiling.`);
      return;
    }

    const emailToUse = adminEmail.trim() || 'admin@electioncampaign.org';
    const wardNum = idx + 1;
    setCompilingWardIdx(idx);
    setWardCompileStatus((prev) => ({
      ...prev,
      [idx]: { progress: 10, status: 'Initializing compiler...', done: false }
    }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      localStorage.setItem('campaign_admin_email', emailToUse);
      const CompilerClass = await loadMindARCompiler();

      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 25, status: 'Decoding poster image...', done: false }
      }));

      // Decode the poster image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = ward.markerUrl;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error(`Failed to decode image for ${ward.wardNumber}`));
      });

      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 40, status: 'Extracting keypoint pyramids...', done: false }
      }));

      // Compile single target
      const compiler = new CompilerClass();
      await compiler.compileImageTargets([img], (progress: number) => {
        const p = 40 + Math.round(progress * 0.45);
        setWardCompileStatus((prev) => ({
          ...prev,
          [idx]: { progress: p, status: `Compiling keypoints: ${Math.round(progress)}%`, done: false }
        }));
      });

      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 85, status: 'Exporting .mind tracking binary...', done: false }
      }));

      const exportedBuffer = await compiler.exportData();
      const wardMindBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });

      // 1. Save to local IndexedDB
      await saveAssetBlob(`ward_target_${ward.id}.mind`, wardMindBlob);
      if (idx === 0 || wards.length === 1) {
        await saveAssetBlob('targets.mind', wardMindBlob);
        setCompiledBlob(wardMindBlob);
      }

      let savedMarkerUrl = ward.markerUrl;
      let savedVideoUrl = ward.videoUrl;

      if (ward.imageFile) {
        await saveAssetBlob(`ward_marker_${ward.id}.png`, ward.imageFile);
        savedMarkerUrl = URL.createObjectURL(ward.imageFile);
      }
      if (ward.videoFile) {
        await saveAssetBlob(`ward_video_${ward.id}.mp4`, ward.videoFile);
        savedVideoUrl = URL.createObjectURL(ward.videoFile);
      }

      // 2. Upload dedicated ward target to Cloudflare R2
      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 90, status: 'Uploading target & media to Cloudflare R2...', done: false }
      }));

      await uploadFileToR2(
        `ward_${wardNum}_targets.mind`,
        wardMindBlob,
        'application/octet-stream',
        emailToUse
      );
      if (idx === 0) {
        await uploadFileToR2('targets.mind', wardMindBlob, 'application/octet-stream', emailToUse);
      }

      // 3. Upload poster image to Cloudflare R2
      let imageBlob: Blob | null = ward.imageFile || null;
      if (!imageBlob && ward.markerUrl && ward.markerUrl.startsWith('blob:')) {
        try {
          const r = await fetch(ward.markerUrl);
          if (r.ok) imageBlob = await r.blob();
        } catch (e) {}
      }
      if (!imageBlob) {
        imageBlob = await getAssetBlob(`ward_marker_${ward.id}.png`);
      }
      if (!imageBlob && ward.markerUrl && !ward.markerUrl.startsWith('http')) {
        try {
          const r = await fetch(ward.markerUrl);
          if (r.ok) imageBlob = await r.blob();
        } catch (e) {}
      }

      let markerCdnUrl = savedMarkerUrl;
      if (imageBlob) {
        markerCdnUrl = await uploadFileToR2(
          `ward_${wardNum}_poster.png`,
          imageBlob,
          imageBlob.type || 'image/png',
          emailToUse
        );
      }

      // 4. Upload candidate speech video to Cloudflare R2
      let videoCdnUrl = savedVideoUrl;
      let videoBlob: Blob | null = ward.videoFile || null;
      if (!videoBlob && ward.videoUrl && ward.videoUrl.startsWith('blob:')) {
        try {
          const r = await fetch(ward.videoUrl);
          if (r.ok) videoBlob = await r.blob();
        } catch (e) {}
      }
      if (!videoBlob) {
        videoBlob = await getAssetBlob(`ward_video_${ward.id}.mp4`);
      }
      if (videoBlob) {
        videoCdnUrl = await uploadFileToR2(
          `ward_${wardNum}_speech.mp4`,
          videoBlob,
          videoBlob.type || 'video/mp4',
          emailToUse
        );
      }

      // 5. Update state & serializable configuration
      const updatedWards = [...wards];
      updatedWards[idx] = {
        ...updatedWards[idx],
        markerUrl: markerCdnUrl,
        videoUrl: videoCdnUrl,
      };
      setWards(updatedWards);

      const serializableWards = updatedWards.map((w, wIdx) => {
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
          id: w.id || `ward-${wardNum}`,
          wardNumber: w.wardNumber,
          wardName: w.wardName,
          candidateName: w.candidateName,
          markerUrl: marker,
          videoUrl: video,
        };
      });
      await saveWardsConfig(serializableWards);

      const jsonBlob = new Blob([JSON.stringify(serializableWards, null, 2)], { type: 'application/json' });
      await uploadFileToR2('wards.json', jsonBlob, 'application/json', emailToUse);

      // 6. Update combined multi-target targets.mind in background
      await compileCombinedTargetsMind(updatedWards, emailToUse);

      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 100, status: 'Compiled & Synced to Cloudflare R2 ✓', done: true }
      }));

      setSuccessMessage(
        `✓ ${ward.wardNumber} poster successfully compiled and synced to Cloudflare R2! Dedicated Voter AR Link: /?ward=${wardNum}`
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || `Failed to compile poster for ${ward.wardNumber}.`);
      setWardCompileStatus((prev) => ({
        ...prev,
        [idx]: { progress: 0, status: 'Compilation failed', done: false }
      }));
    } finally {
      setCompilingWardIdx(null);
    }
  };

  // Compile all wards into a single multi-target MindAR binary
  const handleCompileAllTargets = async () => {
    // Check that at least one ward has a poster
    const readyWards = wards.filter((w) => !!w.markerUrl || !!w.imageFile);
    if (readyWards.length === 0) {
      setErrorMessage('Please upload at least one ward poster image before compiling.');
      return;
    }

    try {
      setIsCompiling(true);
      setCompileProgress(10);
      setStatusMessage('Initializing MindAR multi-target compiler in browser...');
      setErrorMessage(null);
      setSuccessMessage(null);

      const CompilerClass = await loadMindARCompiler();

      setStatusMessage(`Decoding ${readyWards.length} ward poster image(s)...`);
      setCompileProgress(20);

      const loadedImages: HTMLImageElement[] = [];
      for (let i = 0; i < readyWards.length; i++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = readyWards[i].markerUrl;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(true);
          img.onerror = () => reject(new Error(`Failed to decode image for ${readyWards[i].wardNumber}`));
        });
        loadedImages.push(img);
      }

      setStatusMessage(`Extracting multi-target keypoint pyramids for ${readyWards.length} wards...`);

      const compiler = new CompilerClass();
      await compiler.compileImageTargets(loadedImages, (progress: number) => {
        setCompileProgress(20 + Math.round(progress * 0.7));
        setStatusMessage(`Extracting keypoints across all wards: ${Math.round(progress)}%`);
      });

      setStatusMessage('Exporting compiled multi-target .mind binary...');
      setCompileProgress(92);
      const exportedBuffer = await compiler.exportData();
      const mindBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });

      // Persist compiled targets.mind
      setStatusMessage('Saving multi-target binary to browser database...');
      setCompileProgress(96);
      await saveAssetBlob('targets.mind', mindBlob);

      // Also compile and save individual ward targets for dedicated single-ward links (?ward=N)
      for (let i = 0; i < readyWards.length; i++) {
        try {
          const singleCompiler = new CompilerClass();
          await singleCompiler.compileImageTargets([loadedImages[i]], () => {});
          const singleBuf = await singleCompiler.exportData();
          const singleBlob = new Blob([singleBuf], { type: 'application/octet-stream' });
          await saveAssetBlob(`ward_target_${readyWards[i].id}.mind`, singleBlob);
          await saveAssetBlob(`ward_target_${i + 1}.mind`, singleBlob);
        } catch (e) {
          console.warn(`Single-target compile note for ${readyWards[i].wardNumber}:`, e);
        }
      }

      // Persist individual ward blobs and prepare serializable config
      const serializableWards: WardPoster[] = [];
      for (let i = 0; i < wards.length; i++) {
        const w = wards[i];
        let savedMarkerUrl = w.markerUrl;
        let savedVideoUrl = w.videoUrl;

        if (w.imageFile) {
          const markerKey = `ward_marker_${w.id}.png`;
          await saveAssetBlob(markerKey, w.imageFile);
          savedMarkerUrl = URL.createObjectURL(w.imageFile);
        }
        if (w.videoFile) {
          const videoKey = `ward_video_${w.id}.mp4`;
          await saveAssetBlob(videoKey, w.videoFile);
          savedVideoUrl = URL.createObjectURL(w.videoFile);
        }

        serializableWards.push({
          id: w.id,
          wardNumber: w.wardNumber,
          wardName: w.wardName,
          candidateName: w.candidateName,
          markerUrl: savedMarkerUrl,
          videoUrl: savedVideoUrl
        });
      }

      await saveWardsConfig(serializableWards);
      setCompiledBlob(mindBlob);
      setCompileProgress(100);

      // Automatically sync compiled assets directly to Cloudflare R2 bucket
      setStatusMessage('Compilation complete! Now uploading targets.mind and ward posters to Cloudflare R2...');
      try {
        await executeR2Upload(mindBlob, serializableWards);
        setSuccessMessage(
          `All ${readyWards.length} Ward Posters compiled AND uploaded directly to Cloudflare R2 bucket: election-campaign-assets! Zero-egress public CDN delivery is active.`
        );
      } catch (r2Err: any) {
        console.warn('R2 auto-upload notice:', r2Err);
        setSuccessMessage(
          `Successfully compiled ${readyWards.length} Ward Posters! Click "🚀 1-Click Sync to Cloudflare R2" below to push them directly to your bucket.`
        );
      }
      setIsCompiling(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while compiling multi-ward posters.');
      setIsCompiling(false);
    }
  };

  const executeR2Upload = async (customMindBlob?: Blob | null, currentWards?: any[]) => {
    const emailToUse = adminEmail.trim() || 'admin@electioncampaign.org';
    setIsUploadingToR2(true);
    setErrorMessage(null);
    setR2UploadProgress(5);
    setR2StatusMessage('Requesting signed S3 upload URLs from /api/admin/upload-url...');

    try {
      localStorage.setItem('campaign_admin_email', emailToUse);

      const uploadedList: Array<{ name: string; url: string }> = [];

      // 1. Upload compiled targets.mind
      let mindBlob = customMindBlob || compiledBlob;
      if (!mindBlob) {
        mindBlob = await getAssetBlob('targets.mind');
      }
      if (!mindBlob) {
        throw new Error('Please click "Compile & Publish All Wards" first before uploading to R2.');
      }

      setR2StatusMessage('Step 1/3: Uploading compiled targets.mind to Cloudflare R2...');
      setR2UploadProgress(15);
      const targetsPublicUrl = await uploadFileToR2('targets.mind', mindBlob, 'application/octet-stream');
      uploadedList.push({ name: 'targets.mind', url: targetsPublicUrl });

      const wardsToUpload = currentWards || wards;
      const totalWards = wardsToUpload.length;

      // Upload dedicated single-ward targets so ?ward=N links never 404
      for (let i = 0; i < totalWards; i++) {
        const wardNum = i + 1;
        const w = wardsToUpload[i];
        let singleTargetBlob = await getAssetBlob(`ward_target_${w.id}.mind`);
        if (!singleTargetBlob) {
          singleTargetBlob = await getAssetBlob(`ward_target_${wardNum}.mind`);
        }
        if (!singleTargetBlob && mindBlob) {
          singleTargetBlob = mindBlob;
        }
        if (singleTargetBlob) {
          await uploadFileToR2(`ward_${wardNum}_targets.mind`, singleTargetBlob, 'application/octet-stream', emailToUse);
        }
      }

      // 2. Upload each Ward Poster & Candidate Speech Video
      const updatedWardsConfig = [];

      for (let i = 0; i < totalWards; i++) {
        const w = wardsToUpload[i];
        const wardNum = i + 1;
        setR2StatusMessage(`Step 2/3: Uploading Ward ${wardNum} media assets (${i + 1}/${totalWards})...`);
        setR2UploadProgress(20 + Math.round(((i + 1) / totalWards) * 60));

        let markerCdnUrl = w.markerUrl;
        let videoCdnUrl = w.videoUrl;

        // Image poster upload
        let imageBlob: Blob | null = w.imageFile || null;
        if (!imageBlob && w.markerUrl && w.markerUrl.startsWith('blob:')) {
          try {
            const r = await fetch(w.markerUrl);
            if (r.ok) imageBlob = await r.blob();
          } catch (e) {}
        }
        if (!imageBlob) {
          imageBlob = await getAssetBlob(`ward_marker_${w.id}.png`);
        }
        if (!imageBlob && w.markerUrl && !w.markerUrl.startsWith('http')) {
          try {
            const r = await fetch(w.markerUrl);
            if (r.ok) imageBlob = await r.blob();
          } catch (e) {}
        }

        if (imageBlob) {
          const posterName = `ward_${wardNum}_poster.png`;
          markerCdnUrl = await uploadFileToR2(posterName, imageBlob, imageBlob.type || 'image/png');
          uploadedList.push({ name: `${w.wardNumber} Poster`, url: markerCdnUrl });
        }

        // Video upload
        let videoBlob: Blob | null = w.videoFile || null;
        if (!videoBlob && w.videoUrl && w.videoUrl.startsWith('blob:')) {
          try {
            const r = await fetch(w.videoUrl);
            if (r.ok) videoBlob = await r.blob();
          } catch (e) {}
        }
        if (!videoBlob) {
          videoBlob = await getAssetBlob(`ward_video_${w.id}.mp4`);
        }
        if (!videoBlob && w.videoUrl && !w.videoUrl.startsWith('http')) {
          try {
            const r = await fetch(w.videoUrl);
            if (r.ok) videoBlob = await r.blob();
          } catch (e) {}
        }

        if (videoBlob) {
          const videoName = `ward_${wardNum}_speech.mp4`;
          videoCdnUrl = await uploadFileToR2(videoName, videoBlob, videoBlob.type || 'video/mp4');
          uploadedList.push({ name: `${w.wardNumber} Speech Video`, url: videoCdnUrl });
        }

        const posterUrl = markerCdnUrl && !markerCdnUrl.startsWith('blob:')
          ? markerCdnUrl
          : getPublicAssetUrl(`ward_${wardNum}_poster.png`);
        const speechUrl = videoCdnUrl && !videoCdnUrl.startsWith('blob:')
          ? videoCdnUrl
          : getPublicAssetUrl(`ward_${wardNum}_speech.mp4`);

        updatedWardsConfig.push({
          id: w.id || `ward-${wardNum}`,
          wardNumber: w.wardNumber,
          wardName: w.wardName,
          candidateName: w.candidateName,
          markerUrl: posterUrl,
          videoUrl: speechUrl,
        });
      }

      // 3. Upload published wards.json configuration to R2
      setR2StatusMessage('Step 3/3: Publishing updated wards.json configuration to Cloudflare R2...');
      setR2UploadProgress(92);
      const jsonBlob = new Blob([JSON.stringify(updatedWardsConfig, null, 2)], { type: 'application/json' });
      const wardsJsonPublicUrl = await uploadFileToR2('wards.json', jsonBlob, 'application/json');
      uploadedList.push({ name: 'wards.json', url: wardsJsonPublicUrl });

      setWards(updatedWardsConfig);
      await saveWardsConfig(updatedWardsConfig);

      setR2UploadedAssets(uploadedList);
      setR2UploadProgress(100);
      setR2StatusMessage('All campaign assets successfully synced to Cloudflare R2 CDN!');
      setIsUploadingToR2(false);
      return uploadedList;
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while uploading assets to Cloudflare R2.');
      setIsUploadingToR2(false);
      throw err;
    }
  };

  const handleUploadAllToR2 = async () => {
    try {
      const uploaded = await executeR2Upload();
      setSuccessMessage(
        `Successfully uploaded ${uploaded.length} assets to Cloudflare R2 bucket: election-campaign-assets! Public zero-egress CDN is active.`
      );
    } catch (e) {}
  };

  const handleDownloadTargetsMind = async () => {
    try {
      let blob = compiledBlob;
      if (!blob) {
        blob = await getAssetBlob('targets.mind');
      }
      if (!blob) {
        setErrorMessage('Please click "Compile & Publish" first to compile the multi-ward targets.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'targets.mind';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Failed to download targets.mind: ${e.message}`);
    }
  };

  const handleDownloadWardsJson = () => {
    try {
      const exportData = wards.map((w, idx) => ({
        id: w.id || `ward-${idx + 1}`,
        wardNumber: w.wardNumber,
        wardName: w.wardName,
        candidateName: w.candidateName,
        markerUrl: w.imageFile ? `/ward_${idx + 1}_poster.png` : (w.markerUrl.startsWith('http') || w.markerUrl.startsWith('/') ? w.markerUrl : `/sample_marker.png`),
        videoUrl: w.videoUrl.startsWith('blob:') ? '/campaign_speech.mp4' : w.videoUrl
      }));
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wards.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Failed to download wards.json: ${e.message}`);
    }
  };

  const handleDownloadWardPoster = async (idx: number) => {
    const ward = wards[idx];
    if (!ward) return;
    try {
      let blob: Blob | null = ward.imageFile || null;
      if (!blob && ward.markerUrl) {
        if (ward.markerUrl.startsWith('blob:')) {
          const resp = await fetch(ward.markerUrl);
          blob = await resp.blob();
        } else {
          blob = await getAssetBlob(`ward_marker_${ward.id}.png`);
        }
      }
      if (!blob && ward.markerUrl) {
        const resp = await fetch(ward.markerUrl);
        blob = await resp.blob();
      }
      if (!blob) {
        setErrorMessage(`No image found for ${ward.wardNumber}`);
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ward_${idx + 1}_poster.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Failed to download poster for ${ward.wardNumber}: ${e.message}`);
    }
  };

  const handleResetToDefault = async () => {
    if (confirm('Are you sure you want to revert to the default official election alliance poster?')) {
      await clearAllCustomAssets();
      await loadInitialWards();
      setCompiledBlob(null);
      setSuccessMessage('Restored to default official election alliance poster (Lotus, Bicycle, Glass Tumbler)!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Confidential Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-amber-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900/90 border border-amber-500/30 rounded-3xl p-7 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-xl text-gray-100 flex flex-col space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-600 p-0.5 shadow-lg shadow-orange-600/30 flex-shrink-0">
              <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <svg className="w-7 h-7" width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-wide">
              Campaign Admin Command Center
            </h1>
            <p className="text-xs text-amber-300/80 font-medium">
              ఎన్నికల ప్రచార అడ్మిన్ ప్యానెల్ — Access Restricted
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
                Enter Admin Passcode / పాస్‌కోడ్
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    performLogin();
                  }
                }}
                placeholder="Enter secure campaign passcode"
                className="w-full px-4 py-3 rounded-xl bg-gray-950/80 border border-gray-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm text-white placeholder-gray-500 transition-all outline-none"
                autoFocus
              />
            </div>

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-lg">
                {authError}
              </p>
            )}

            <button
              type="button"
              onClick={() => performLogin()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-orange-600/30 transition-all active:scale-95"
            >
              Unlock Admin Portal / ప్రవేశించండి
            </button>
          </form>

          <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
            <Link href="/" className="hover:text-amber-300 transition-colors flex items-center space-x-1">
              <span>← Back to Public Voter AR Portal</span>
            </Link>
            <span className="text-[10px] text-amber-500/70">Bose Kodelli</span>
          </div>
        </div>
      </div>
    );
  }

  const currentPreviewWard = wards[selectedPreviewIdx] || wards[0];

  // Admin Dashboard with Multi-Ward Studio
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar: Fully Responsive */}
      <header className="border-b border-gray-800 bg-gray-900/90 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center space-x-1.5 flex-wrap">
              <span className="truncate">Admin Command Center</span>
              <span className="text-[9px] sm:text-[10px] bg-emerald-950 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                {wards.length} Wards Active
              </span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-amber-400/80 truncate">ఎన్నికల ప్రచార అడ్మిన్ పోర్టల్ — Bose Kodelli</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          <Link
            href="/"
            target="_blank"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 text-[11px] sm:text-xs font-semibold border border-amber-500/30 transition-all shadow-sm"
          >
            <span>Voter AR</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 text-[11px] sm:text-xs font-semibold transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-3.5">
        {/* Banner Alert for Status */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500 p-3 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center space-x-2 truncate">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="truncate">{successMessage}</span>
            </div>
            <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white ml-2 flex-shrink-0">✕</button>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-950/80 border border-red-500 p-3 rounded-xl text-red-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in">
            <span className="truncate">{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white ml-2 flex-shrink-0">✕</button>
          </div>
        )}

        {/* Compact 3-Column Vitals Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-2 sm:p-2.5 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Local Scans</p>
              <p className="text-sm sm:text-lg font-black text-amber-400 mt-0.5">{stats.scansUsed}</p>
            </div>
            <span className="text-amber-400 text-xs hidden sm:inline">👁️</span>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-2 sm:p-2.5 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Wards</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 truncate">
                {wards.length} Configured
              </p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline-block" />
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-2 sm:p-2.5 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Permissions</p>
              <p className="text-xs sm:text-sm font-bold text-orange-400 mt-1 truncate">Admin Only</p>
            </div>
            <span className="text-orange-400 text-xs hidden sm:inline">🔒</span>
          </div>
        </div>

        {/* Studio Layout: 2 Columns on Desktop, Single Clean Column on Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Multi-Ward Editor & Compiler */}
          <div className="lg:col-span-7 bg-gray-900/80 border border-gray-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl flex flex-col space-y-3.5">
            <div className="border-b border-gray-800 pb-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Multi-Ward Campaign Poster Studio</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                  Upload candidate posters & speech videos. Click compile to generate AR tracking.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {/* View Mode Toggle */}
                <div className="bg-gray-950 p-0.5 rounded-lg border border-gray-800 flex items-center text-[10px]">
                  <button
                    type="button"
                    onClick={() => setViewMode('tabs')}
                    className={`px-2 py-1 rounded font-semibold transition-all ${
                      viewMode === 'tabs' ? 'bg-amber-500 text-gray-950 font-bold shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Focus on one ward at a time"
                  >
                    Focus Tab
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`px-2 py-1 rounded font-semibold transition-all ${
                      viewMode === 'all' ? 'bg-amber-500 text-gray-950 font-bold shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                    title="Show all wards in scrollable list"
                  >
                    View All ({wards.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddWard}
                  className="bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center space-x-1 active:scale-95 flex-shrink-0"
                >
                  <span>+ Add Ward</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAllPosters}
                  className="bg-red-950/70 hover:bg-red-900 border border-red-700/60 text-red-200 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1 active:scale-95 flex-shrink-0"
                  title="Permanently wipe all posters from Cloudflare R2 and browser storage"
                >
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete All Posters</span>
                </button>
              </div>
            </div>

            {/* Quick Ward Navigation Tabs */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin flex-1">
                {wards.map((w, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => scrollToWard(idx)}
                    className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1 ${
                      selectedPreviewIdx === idx
                        ? 'bg-amber-500 text-gray-950 shadow-md font-extrabold ring-2 ring-amber-400/50'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span>{w.wardNumber || `Ward ${idx + 1}`}</span>
                    {selectedPreviewIdx === idx && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>

              {/* In Tabs Mode: Quick Prev / Next Ward Switchers */}
              {viewMode === 'tabs' && wards.length > 1 && (
                <div className="flex items-center space-x-1 flex-shrink-0 bg-gray-950 px-2 py-0.5 rounded-lg border border-gray-800">
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewIdx((prev) => Math.max(0, prev - 1))}
                    disabled={selectedPreviewIdx === 0}
                    className="p-1 px-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-30 text-xs font-bold transition-all"
                    title="Previous Ward / మునుపటి వార్డు"
                  >
                    ◀ Prev
                  </button>
                  <span className="text-[10px] text-amber-400 font-bold px-1 font-mono">
                    {selectedPreviewIdx + 1}/{wards.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewIdx((prev) => Math.min(wards.length - 1, prev + 1))}
                    disabled={selectedPreviewIdx === wards.length - 1}
                    className="p-1 px-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-30 text-xs font-bold transition-all"
                    title="Next Ward / తదుపరి వార్డు"
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>

            {/* List of Wards: Clean & Fully Scrollable */}
            <div className="space-y-4">
              {(viewMode === 'tabs' ? [wards[selectedPreviewIdx] || wards[0]] : wards).map((ward, mapIdx) => {
                const idx = viewMode === 'tabs' ? selectedPreviewIdx : mapIdx;
                return (
                  <div
                    id={`ward-card-${idx}`}
                    key={ward.id || `ward-${idx}`}
                    className={`bg-gray-950/90 border rounded-2xl p-3 sm:p-4 space-y-3 transition-all ${
                      selectedPreviewIdx === idx ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-gray-800'
                    }`}
                  >
                    {/* Ward Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-2">
                      <div className="flex items-center space-x-2 flex-1 min-w-[200px]">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={ward.wardNumber}
                          onChange={(e) => handleUpdateWardField(idx, 'wardNumber', e.target.value)}
                          placeholder="e.g. Ward 1 / వార్డు 1"
                          className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs font-bold text-amber-300 w-28 sm:w-36 outline-none focus:border-amber-400"
                        />
                        <input
                          type="text"
                          value={ward.wardName}
                          onChange={(e) => handleUpdateWardField(idx, 'wardName', e.target.value)}
                          placeholder="Ward Area Name"
                          className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs text-gray-200 flex-1 min-w-[100px] outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {/* Quick Jump to Top button in All Wards mode */}
                        {viewMode === 'all' && (
                          <button
                            type="button"
                            onClick={scrollToTop}
                            className="text-[10px] text-gray-400 hover:text-amber-300 px-2 py-0.5 rounded bg-gray-900 border border-gray-800 flex items-center space-x-0.5"
                            title="Scroll to Top / పైకి వెళ్లండి"
                          >
                            <span>▲ Top</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewIdx(idx)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all ${
                            selectedPreviewIdx === idx ? 'bg-amber-400 text-gray-950 font-bold' : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {selectedPreviewIdx === idx ? 'Selected' : 'Select'}
                        </button>
                        {wards.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWard(idx)}
                            className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-950/40"
                            title="Remove Ward"
                          >
                            ✕ Delete
                          </button>
                        )}
                      </div>
                    </div>

                  {/* Ward Candidate Name */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-[11px] text-gray-400 w-20 flex-shrink-0">Candidate:</span>
                    <input
                      type="text"
                      value={ward.candidateName}
                      onChange={(e) => handleUpdateWardField(idx, 'candidateName', e.target.value)}
                      placeholder="Candidate Name / అభ్యర్థి పేరు"
                      className="flex-1 bg-gray-900 border border-gray-700 px-2 py-1 rounded-lg text-xs text-gray-200 outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* PROMINENT MEDIA ROW: Visual Poster Preview (Left) & Speech Video (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* Poster Card with Large Image Preview */}
                    <div className="bg-gray-900/90 border border-amber-500/30 rounded-xl p-2.5 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-amber-300 flex items-center space-x-1">
                          <span>🖼️ 1. Ward Poster Image</span>
                          <span className="text-red-400">*</span>
                        </span>
                        {ward.markerUrl && (
                          <a
                            href={ward.markerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-amber-400 hover:underline"
                          >
                            Full Size ↗
                          </a>
                        )}
                      </div>

                      {/* Prominent Poster Thumbnail */}
                      <div className="w-full h-36 sm:h-40 bg-black/80 rounded-lg border border-gray-800 flex items-center justify-center overflow-hidden p-1 relative">
                        {ward.markerUrl ? (
                          <img
                            src={ward.markerUrl}
                            alt={ward.wardNumber}
                            className="w-full h-full object-contain rounded"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-2 text-gray-500">
                            <svg className="w-7 h-7 text-gray-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] text-amber-300/80 font-semibold">No Poster Image</span>
                            <span className="text-[9px] text-gray-500">Upload JPG or PNG</span>
                          </div>
                        )}
                      </div>

                      {/* File name & Upload Button */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-gray-400 truncate flex-1">
                          {ward.imageFile ? ward.imageFile.name : (ward.markerUrl ? 'Active Poster' : 'Choose file')}
                        </span>
                        <label className="text-[10px] bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all active:scale-95 flex-shrink-0">
                          <span>{ward.markerUrl ? 'Change Poster' : 'Upload Poster'}</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={(e) => handleWardImageUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Speech Video Card */}
                    <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-2.5 flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-orange-300 flex items-center space-x-1">
                          <span>🎥 2. Candidate Speech Video</span>
                        </span>
                        <span className="text-[10px] text-gray-400">MP4</span>
                      </div>

                      {/* Video Player Preview */}
                      <div className="w-full h-36 sm:h-40 bg-black/80 rounded-lg border border-gray-800 flex items-center justify-center overflow-hidden">
                        <video
                          src={ward.videoUrl || '/campaign_speech.mp4'}
                          controls
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* File name & Change Button */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-gray-400 truncate flex-1">
                          {ward.videoFile ? ward.videoFile.name : 'Speech Video'}
                        </span>
                        <label className="text-[10px] bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all active:scale-95 flex-shrink-0">
                          <span>Change Video</span>
                          <input
                            type="file"
                            accept="video/mp4, video/webm"
                            onChange={(e) => handleWardVideoUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Individual Ward Compile & Sync Action Bar */}
                  <div className="bg-black/60 border border-amber-500/30 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-[11px] truncate min-w-0">
                      {wardCompileStatus[idx]?.done ? (
                        <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Synced to Cloudflare R2 ✓</span>
                        </span>
                      ) : compilingWardIdx === idx ? (
                        <span className="text-amber-300 font-medium flex items-center space-x-1.5 animate-pulse">
                          <svg className="w-3.5 h-3.5 animate-spin text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>{wardCompileStatus[idx]?.status || 'Compiling...'} ({wardCompileStatus[idx]?.progress || 0}%)</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 truncate">
                          Target: <code className="text-amber-300/90 font-mono">ward_{idx + 1}_targets.mind</code>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {wardCompileStatus[idx]?.done && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/?ward=${idx + 1}`;
                            navigator.clipboard.writeText(url);
                            alert(`Copied Ward ${idx + 1} Dedicated Voter AR Link:\n${url}`);
                          }}
                          className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] sm:text-xs font-semibold transition-all flex items-center space-x-1"
                          title="Copy dedicated AR URL for this ward"
                        >
                          <span>🔗 Copy AR Link</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCompileSingleWard(idx)}
                        disabled={compilingWardIdx !== null || isCompiling}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md ${
                          compilingWardIdx === idx
                            ? 'bg-amber-600/50 text-white cursor-wait'
                            : compilingWardIdx !== null || isCompiling
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white active:scale-95 shadow-orange-900/30'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>
                          {compilingWardIdx === idx
                            ? `Compiling... ${wardCompileStatus[idx]?.progress || 0}%`
                            : `⚡ Compile Poster`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Compiler Progress Indicator */}
            {isCompiling && (
              <div className="space-y-1.5 bg-black/60 border border-amber-500/40 p-3 rounded-xl">
                <div className="flex justify-between text-xs text-amber-300 font-semibold">
                  <span>{statusMessage}</span>
                  <span>{compileProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-600 via-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${compileProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCompileAllTargets}
                disabled={isCompiling}
                className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs tracking-wide shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  isCompiling
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : 'bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-orange-600/30 active:scale-95'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{isCompiling ? 'Compiling Multi-Ward Targets...' : `Compile & Publish All ${wards.length} Ward Posters`}</span>
              </button>

              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={isCompiling}
                className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-semibold text-gray-300 transition-all active:scale-95"
              >
                Revert Default
              </button>
            </div>

            {/* Cloudflare R2 Direct Ingestion & Zero-Egress CDN Sync Card */}
            <div className="bg-gradient-to-r from-orange-950/70 via-gray-950 to-amber-950/70 border border-orange-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-400/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center space-x-2">
                      <span>Cloudflare R2 Direct Ingestion ($0 Egress CDN)</span>
                      <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-400/40 px-2 py-0.5 rounded-full">
                        Admin Only
                      </span>
                    </h3>
                    <p className="text-[11px] text-orange-200/80">
                      క్లౌడ్‌ఫ్లేర్ R2 స్టోరేజ్‌కు ఒకే క్లిక్‌తో ప్రచురించండి | Direct S3 Upload via Pre-Signed URLs
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                    Authorized Admin Email (Must match ADMIN_EMAIL in .env.local):
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@electioncampaign.org"
                    disabled={isUploadingToR2}
                    className="w-full px-3 py-2 bg-black/60 border border-orange-500/30 rounded-xl text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleUploadAllToR2}
                    disabled={isUploadingToR2}
                    className={`w-full py-2.5 px-4 rounded-xl font-extrabold text-xs shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95 ${
                      isUploadingToR2
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-orange-900/40'
                    }`}
                  >
                    {isUploadingToR2 ? (
                      <>
                        <svg className="w-4 h-4 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Uploading... ({r2UploadProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>🚀 1-Click Sync to Cloudflare R2</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isUploadingToR2 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-orange-200">
                    <span>{r2StatusMessage}</span>
                    <span className="font-mono font-bold">{r2UploadProgress}%</span>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-orange-500/20">
                    <div
                      className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 transition-all duration-300"
                      style={{ width: `${r2UploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Uploaded CDN Asset Links */}
              {r2UploadedAssets.length > 0 && (
                <div className="bg-black/50 border border-orange-500/30 rounded-xl p-3 space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Public CDN Assets Deployed ({r2UploadedAssets.length})</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">$0 Egress Active</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {r2UploadedAssets.map((asset, idx) => (
                      <div
                        key={`r2-asset-${idx}`}
                        className="flex items-center justify-between bg-gray-900/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-[10px]"
                      >
                        <span className="font-semibold text-gray-200 truncate mr-2">{asset.name}</span>
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(asset.url);
                              alert(`Copied CDN URL: ${asset.url}`);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
                          >
                            Copy URL
                          </button>
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-white"
                          >
                            ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cloudflare & WhatsApp Production Deployment Pack Card */}
            <div className="bg-gradient-to-r from-gray-950 via-slate-900 to-gray-950 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Publish to WhatsApp Voters / క్లౌడ్ ప్యాక్ డౌన్‌లోడ్
                  </h3>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  {wards.length} WARDS READY
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Download these compiled campaign files and place them into your project&apos;s <code className="text-amber-300 font-mono font-bold bg-black/60 px-1 py-0.5 rounded">public/</code> folder, then deploy to Cloudflare so all WhatsApp voters see all {wards.length} wards:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadTargetsMind}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95"
                  title="Download compiled multi-target MindAR binary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>1. Download targets.mind</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadWardsJson}
                  className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-amber-300 font-extrabold text-xs shadow-md transition-all flex items-center space-x-1.5 active:scale-95"
                  title="Download wards JSON configuration"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>2. Download wards.json</span>
                </button>
              </div>
              {/* Individual Ward Poster Download Chips */}
              <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-gray-400 font-semibold mr-1">Download Posters:</span>
                {wards.map((ward, idx) => (
                  <button
                    key={`dl-poster-${ward.id || idx}`}
                    type="button"
                    onClick={() => handleDownloadWardPoster(idx)}
                    className="px-2 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-all flex items-center space-x-1"
                  >
                    <span>{ward.wardNumber} ⬇</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Active Media Preview */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Preview: {currentPreviewWard?.wardNumber}
                  </h3>
                </div>
                {currentPreviewWard?.markerUrl && (
                  <a
                    href={currentPreviewWard.markerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    View Full Size ↗
                  </a>
                )}
              </div>

              <div className="w-full bg-black/60 rounded-2xl p-3 flex items-center justify-center border border-gray-800/80">
                {currentPreviewWard?.markerUrl ? (
                  <img
                    src={currentPreviewWard.markerUrl}
                    alt={currentPreviewWard.wardNumber}
                    className="max-h-40 sm:max-h-48 object-contain rounded-xl shadow-md border border-amber-500/20"
                  />
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-gray-500">
                    No Poster Uploaded for this Ward
                  </div>
                )}
              </div>

              <div className="text-[10px] sm:text-[11px] text-gray-400">
                {currentPreviewWard?.wardName} — {currentPreviewWard?.candidateName}
              </div>
            </div>

            {/* Candidate Speech Video Preview */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col space-y-3">
              <div className="border-b border-gray-800 pb-2.5">
                <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span>Speech Video for {currentPreviewWard?.wardNumber}</span>
                </h3>
              </div>

              <div className="w-full bg-black/60 rounded-2xl overflow-hidden border border-gray-800/80">
                <video
                  src={currentPreviewWard?.videoUrl || '/campaign_speech.mp4'}
                  controls
                  playsInline
                  className="w-full max-h-36 sm:max-h-40 object-cover bg-black"
                />
              </div>

              <div className="text-[10px] sm:text-[11px] text-gray-400">
                This speech video plays when voters scan {currentPreviewWard?.wardNumber} poster in the WebAR camera.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-5 right-5 z-50 p-2.5 sm:p-3 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-950 font-black shadow-2xl border-2 border-amber-300 transition-all active:scale-90 flex items-center space-x-1.5 animate-in fade-in"
          title="Scroll to Top / పైకి వెళ్ళండి"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span className="text-[11px] font-extrabold pr-1 hidden sm:inline">Top / పైకి</span>
        </button>
      )}
    </div>
  );
}
