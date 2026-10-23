'use client';

import { useState } from 'react';
import { WardPoster } from '@/types/campaign';

interface WardPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  wards: WardPoster[];
  onSelectWard?: (wardIdx: number) => void;
}

export default function WardPosterModal({ isOpen, onClose, wards, onSelectWard }: WardPosterModalProps) {
  const [selectedWardIdx, setSelectedWardIdx] = useState<number>(0);

  if (!isOpen || wards.length === 0) return null;

  const currentWard = wards[selectedWardIdx] || wards[0];

  const handleScanWard = () => {
    if (onSelectWard) {
      onSelectWard(selectedWardIdx);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-gray-900 border border-amber-500/35 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-[0_0_50px_rgba(245,158,11,0.2)] p-4 sm:p-6 flex flex-col space-y-3 sm:space-y-4 text-gray-200 max-h-[92vh] my-auto overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-orange-600/20 border border-amber-400/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white">
                Ward Campaign Posters / వార్డుల పోస్టర్లు
              </h3>
              <p className="text-[9px] sm:text-[10px] text-amber-400/80">
                Choose a ward poster to view, download, or scan in AR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ward Selector Horizontal Tabs */}
        {wards.length > 1 && (
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {wards.map((ward, idx) => (
              <button
                key={ward.id || idx}
                type="button"
                onClick={() => setSelectedWardIdx(idx)}
                className={`flex-shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold transition-all ${
                  selectedWardIdx === idx
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-600/30 border border-amber-300/40'
                    : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700'
                }`}
              >
                <span>{ward.wardNumber || `Ward ${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Ward Info Details */}
        <div className="bg-gray-950/80 border border-gray-800/80 rounded-xl p-2.5 sm:p-3 flex items-center justify-between text-xs">
          <div className="truncate mr-2">
            <p className="font-extrabold text-amber-300 text-xs sm:text-sm truncate">{currentWard.wardNumber}</p>
            <p className="text-gray-300 text-[10px] sm:text-[11px] font-medium truncate">{currentWard.wardName || 'Constituency Area'}</p>
            {currentWard.candidateName && (
              <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 truncate">{currentWard.candidateName}</p>
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
            🎯 AR Target {selectedWardIdx + 1}
          </span>
        </div>

        {/* Responsive Poster Image Preview */}
        <div className="bg-black/70 rounded-xl p-2 sm:p-2.5 border border-amber-500/20 flex flex-col items-center justify-center">
          <img
            src={currentWard.markerUrl}
            alt={currentWard.wardNumber}
            className="max-h-44 sm:max-h-56 object-contain rounded-lg shadow-lg border border-amber-400/20"
          />
        </div>

        {/* Action Link & Dismiss */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleScanWard}
            className="py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white text-[11px] sm:text-xs font-bold text-center shadow-lg transition-all flex items-center justify-center space-x-1"
          >
            <span>🎯 Scan Now / స్కాన్ చేయండి</span>
          </button>
          <a
            href={currentWard.markerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 sm:py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-200 text-[11px] sm:text-xs font-semibold text-center border border-gray-700 transition-all flex items-center justify-center space-x-1"
          >
            <span>HD Download ↗</span>
          </a>
        </div>

        <p className="text-[9px] sm:text-[10px] text-center text-gray-400">
          Point camera at this poster in the AR view to watch candidate speech!
        </p>
      </div>
    </div>
  );
}
