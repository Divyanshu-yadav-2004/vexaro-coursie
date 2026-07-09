import React from 'react';
import { User, FileText, CheckCircle } from 'lucide-react';

export default function StepTracker({ currentStep }) {
  const steps = [
    { number: 1, label: 'Profile Details', icon: User },
    { number: 2, label: 'Document KYC', icon: FileText },
    { number: 3, label: 'Review & Confirm', icon: CheckCircle },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-4">
      <div className="bg-brand-navy rounded-2xl p-4 shadow-xl border border-slate-800">
        <div className="flex items-center justify-between md:justify-around relative">
          {/* Connector lines behind steps (desktop) */}
          <div className="absolute hidden md:block left-[15%] right-[15%] top-1/2 h-0.5 bg-slate-700 -translate-y-1/2 z-0" />
          <div 
            className="absolute hidden md:block left-[15%] top-1/2 h-0.5 bg-brand-orange -translate-y-1/2 z-0 transition-all duration-500" 
            style={{ width: `${(currentStep - 1) * 35}%` }}
          />

          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.number;
            const isActive = currentStep === s.number;

            return (
              <div key={s.number} className="flex flex-col items-center z-10 flex-1 md:flex-none">
                <div 
                  className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-brand-orange border-brand-orange text-white' 
                      : isActive 
                        ? 'bg-brand-navy border-brand-orange text-brand-orange shadow-lg shadow-brand-orange/20 animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                
                <span 
                  className={`mt-2 text-[10px] sm:text-xs md:text-sm font-semibold transition-colors duration-300 ${
                    isActive 
                      ? 'text-brand-orange' 
                      : isCompleted 
                        ? 'text-slate-300' 
                        : 'text-slate-500'
                  }`}
                >
                  {s.number}. {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
