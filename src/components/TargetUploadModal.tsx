'use client';

import { useState, useRef } from 'react';

interface TargetUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTargetUpdated: () => void;
}

export default function TargetUploadModal({
  isOpen,
  onClose,
  onTargetUpdated
}: TargetUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreviewName, setVideoPreviewName] = useState<string | null>(null);

  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, JPEG).');
      return;
    }

    setErrorMessage(null);
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleUseCampaignBackground = async () => {
    try {
      const res = await fetch('/campaign_bg.jpg');
      const blob = await res.blob();
      const file = new File([blob], 'campaign_symbols.jpg', { type: 'image/jpeg' });
      setSelectedImage(file);
      setImagePreview('/campaign_bg.jpg');
      setErrorMessage(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('mp4')) {
      setErrorMessage('Please upload an MP4 video file.');
      return;
    }

    setErrorMessage(null);
    setSelectedVideo(file);
    setVideoPreviewName(file.name);
  };

  const handleCompileAndApply = async () => {
    if (!selectedImage && !selectedVideo) {
      setErrorMessage('Please select a target image to compile.');
      return;
    }

    setIsCompiling(true);
    setErrorMessage(null);
    setCompileProgress(5);
    setStatusMessage('Initializing MindAR feature compiler...');

    try {
      let mindBlob: Blob | null = null;

      // 1. Compile target image if a new image was selected
      if (selectedImage && imagePreview) {
        // Resolve Compiler class from window or dynamic module
        let CompilerClass = (window as any)?.MINDAR?.IMAGE?.Compiler;
        if (!CompilerClass) {
          try {
            // @ts-ignore
            const mod = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
            CompilerClass = mod.Compiler || (window as any)?.MINDAR?.IMAGE?.Compiler;
          } catch (e) {
            console.warn('Import error:', e);
          }
        }

        if (!CompilerClass) {
          throw new Error('MindAR Compiler engine not ready yet. Please ensure you are connected to the internet.');
        }

        setStatusMessage('Loading target image...');
        setCompileProgress(15);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imagePreview;

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Failed to load image for compilation.'));
        });

        setStatusMessage('Extracting feature descriptors & tracking pyramids (takes ~5-10s)...');

        const compiler = new CompilerClass();
        await compiler.compileImageTargets([img], (progress: number) => {
          setCompileProgress(15 + Math.round(progress * 0.75));
          setStatusMessage(`Compiling target keypoints: ${Math.round(progress)}%`);
        });

        setStatusMessage('Serializing binary tracking descriptor (.mind)...');
        setCompileProgress(92);
        const exportedBuffer = await compiler.exportData();
        mindBlob = new Blob([exportedBuffer], { type: 'application/octet-stream' });
      }

      // 2. Upload to server to persist in /public
      setStatusMessage('Saving target and video to project...');
      setCompileProgress(96);

      const formData = new FormData();
      if (mindBlob) {
        formData.append('mind', mindBlob, 'targets.mind');
      }
      if (selectedImage) {
        formData.append('image', selectedImage, 'sample_marker.png');
      }
      if (selectedVideo) {
        formData.append('video', selectedVideo, 'campaign_speech.mp4');
      }

      const res = await fetch('/api/save-target', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save uploaded target to server.');
      }

      setCompileProgress(100);
      setStatusMessage('Target compiled & saved! Refreshing AR tracking...');

      setTimeout(() => {
        onTargetUpdated();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while compiling target image.');
      setIsCompiling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-amber-500/30 rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(245,158,11,0.2)] p-6 sm:p-7 flex flex-col space-y-5 text-gray-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-election-gradient">Upload Custom Target Poster</h2>
              <p className="text-xs text-amber-200/70">Point at your own image to play speech video</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCompiling}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Shortcut: Use Campaign Artwork */}
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <img
              src="/campaign_bg.jpg"
              alt="Election Artwork"
              className="w-12 h-8 object-cover rounded border border-amber-400/40"
            />
            <div>
              <p className="text-xs font-bold text-amber-200">Election Emblem Artwork</p>
              <p className="text-[10px] text-amber-300/70">Use the candidate symbols as AR target</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUseCampaignBackground}
            disabled={isCompiling}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-400/40 transition-all active:scale-95"
          >
            Select This
          </button>
        </div>

        {/* Target Image Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-200">
            1. Campaign Poster / Target Image <span className="text-red-400">*</span>
          </label>
          <div
            onClick={() => !isCompiling && fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-amber-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-950/40 hover:bg-gray-900/40 transition-all text-center"
          >
            {imagePreview ? (
              <div className="flex flex-col items-center space-y-2">
                <img
                  src={imagePreview}
                  alt="Poster Preview"
                  className="max-h-40 max-w-full rounded-xl object-contain shadow-lg border border-amber-500/40 bg-white/5 p-1"
                />
                <p className="text-xs text-amber-400 font-semibold">Click to choose a different image</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2 py-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Choose Campaign Poster Image</p>
                  <p className="text-[11px] text-gray-400">Supports PNG, JPG, JPEG (high-contrast flat images work best)</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
              disabled={isCompiling}
            />
          </div>
        </div>

        {/* Optional Custom Video Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-amber-200">
            2. Campaign Speech Video (Optional)
          </label>
          <div
            onClick={() => !isCompiling && videoInputRef.current?.click()}
            className="border border-gray-800 hover:border-amber-500/40 rounded-xl p-3 flex items-center justify-between cursor-pointer bg-gray-950/40 hover:bg-gray-900/40 transition-all"
          >
            <div className="flex items-center space-x-2.5">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-xs font-medium text-white">
                  {videoPreviewName || 'Keep current speech video (/public/campaign_speech.mp4)'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {videoPreviewName ? 'Custom video selected' : 'Click to replace with your candidate’s MP4 video'}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-amber-400 font-bold">Browse</span>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={handleVideoChange}
              disabled={isCompiling}
            />
          </div>
        </div>

        {/* Progress & Status */}
        {isCompiling && (
          <div className="space-y-2 bg-gray-950/80 p-4 rounded-2xl border border-amber-500/40 shadow-inner">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200 font-semibold">{statusMessage}</span>
              <span className="text-amber-400 font-extrabold">{compileProgress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-500 via-amber-400 to-red-500 h-2.5 rounded-full transition-all duration-300 shadow-[0_0_10px_#f59e0b]"
                style={{ width: `${compileProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="text-xs text-red-300 bg-red-950/50 border border-red-700/60 p-3 rounded-xl flex items-center space-x-2">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCompiling}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCompileAndApply}
            disabled={isCompiling || (!selectedImage && !selectedVideo)}
            className="flex-2 w-full py-3 px-5 rounded-xl bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 hover:from-orange-500 hover:via-amber-400 hover:to-red-500 text-white text-xs font-extrabold shadow-lg shadow-orange-600/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isCompiling ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Compiling Target...</span>
              </>
            ) : (
              <span>Compile & Set as AR Target</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
