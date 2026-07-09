import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, Trash2, ArrowLeft, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { redactFileName } from '../utils/storage';

export default function Step2DocumentUpload({ initialData, onNext, onBack }) {
  const [docs, setDocs] = useState({
    aadhaarFront: initialData.aadhaarFront || null,
    aadhaarBack: initialData.aadhaarBack || null,
    panCard: initialData.panCard || null
  });

  const [uploadStatus, setUploadStatus] = useState({
    aadhaarFront: docs.aadhaarFront ? 'attached' : 'empty', // 'empty' | 'uploading' | 'attached'
    aadhaarBack: docs.aadhaarBack ? 'attached' : 'empty',
    panCard: docs.panCard ? 'attached' : 'empty'
  });

  const [progress, setProgress] = useState({
    aadhaarFront: 0,
    aadhaarBack: 0,
    panCard: 0
  });

  const handleFileChange = (key, file) => {
    if (!file) return;

    // Transition to uploading state
    setUploadStatus(prev => ({ ...prev, [key]: 'uploading' }));
    setProgress(prev => ({ ...prev, [key]: 0 }));

    // Simulate progress animation
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setProgress(prev => ({ ...prev, [key]: currentProgress }));

      if (currentProgress >= 100) {
        clearInterval(interval);
        
        // Mock file loading (using mock info + name redaction)
        const redactedName = redactFileName(file.name, key);
        
        setDocs(prev => ({
          ...prev,
          [key]: {
            originalName: file.name,
            name: redactedName,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            type: file.type,
            uploadedAt: Date.now()
          }
        }));
        setUploadStatus(prev => ({ ...prev, [key]: 'attached' }));
      }
    }, 200);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, key) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileChange(key, file);
    }
  };

  const handleRemoveFile = (key) => {
    setDocs(prev => ({ ...prev, [key]: null }));
    setUploadStatus(prev => ({ ...prev, [key]: 'empty' }));
    setProgress(prev => ({ ...prev, [key]: 0 }));
  };

  const handleNext = () => {
    if (
      uploadStatus.aadhaarFront === 'attached' &&
      uploadStatus.aadhaarBack === 'attached' &&
      uploadStatus.panCard === 'attached'
    ) {
      onNext(docs);
    }
  };

  const isFormValid = 
    uploadStatus.aadhaarFront === 'attached' &&
    uploadStatus.aadhaarBack === 'attached' &&
    uploadStatus.panCard === 'attached';

  const renderDropzone = (key, label) => {
    const status = uploadStatus[key];
    const fileInfo = docs[key];
    const fileProgress = progress[key];

    return (
      <div 
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, key)}
        className={`w-full relative group border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[170px] ${
          status === 'attached' 
            ? 'border-green-800 bg-slate-950/80 shadow-inner'
            : status === 'uploading'
              ? 'border-slate-700 bg-slate-900/30'
              : 'border-slate-800 bg-slate-950/30 hover:border-brand-orange hover:bg-slate-900/10'
        }`}
      >
        {status === 'empty' && (
          <label className="cursor-pointer flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center mb-3 border border-slate-800 group-hover:scale-105 transition-transform duration-300">
              <UploadCloud className="w-5 h-5 text-brand-orange" />
            </div>
            <span className="text-xs font-bold text-slate-300 mb-1">{label}</span>
            <span className="text-[10px] text-slate-500">Drag & Drop or Click to browse</span>
            <input 
              type="file" 
              accept="image/*,application/pdf" 
              className="hidden" 
              onChange={(e) => handleFileChange(key, e.target.files[0])} 
            />
          </label>
        )}

        {status === 'uploading' && (
          <div className="w-full flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-6 h-6 text-brand-orange animate-spin mb-3" />
            <span className="text-xs font-semibold text-slate-400 mb-2">Uploading Document...</span>
            <div className="w-full max-w-[200px] h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-brand-orange transition-all duration-200" 
                style={{ width: `${fileProgress}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-slate-500 mt-1">{fileProgress}%</span>
          </div>
        )}

        {status === 'attached' && fileInfo && (
          <div className="w-full flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mb-2 animate-bounce" />
            <span className="text-xs font-bold text-slate-300 block max-w-full truncate px-4">{fileInfo.name}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{fileInfo.size}</span>
            
            {/* Redacted Compliance Badge */}
            <div className="mt-2.5 inline-flex items-center gap-1 bg-green-950/40 text-green-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-green-800/60 uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              Auto-Redacted Secures
            </div>

            <button 
              type="button"
              onClick={() => handleRemoveFile(key)}
              className="absolute top-3 right-3 text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-900 rounded-lg transition-all"
              title="Remove File"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-brand-navy rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-fadeIn m-4">
      {/* Header Band */}
      <div className="bg-brand-grayLight px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span>Document KYC Upload</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">Upload clear, scanned copies of your government identities. Documents are processed securely.</p>
      </div>

      <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">
        {/* Aadhaar Section */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              Aadhaar Card Attachment
            </h3>
            <span className="text-[10px] text-slate-500">Supports PDF, PNG, or JPG (Max 5MB)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderDropzone('aadhaarFront', 'Aadhaar Card - Front Side')}
            {renderDropzone('aadhaarBack', 'Aadhaar Card - Back Side')}
          </div>
        </div>

        {/* PAN Section */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-orange" />
              PAN Card Attachment
            </h3>
            <span className="text-[10px] text-slate-500">Must be a single page card upload</span>
          </div>
          {renderDropzone('panCard', 'PAN Card')}
        </div>

        {/* Action Panel */}
        <div className="flex justify-between items-center pt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </button>
          
          <button
            type="button"
            onClick={handleNext}
            disabled={!isFormValid}
            className={`flex items-center gap-2 font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg ${
              isFormValid 
                ? 'bg-brand-orange hover:bg-brand-orangeHover text-white shadow-brand-orange/20 cursor-pointer' 
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
            }`}
          >
            Proceed to Review
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
