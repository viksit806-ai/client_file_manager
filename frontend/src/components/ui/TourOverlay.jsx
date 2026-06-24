'use client';
import { useState, useEffect } from 'react';
import { HelpCircle, ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

export default function TourOverlay({ role = 'user' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Check if the tour was completed for this role
    const completed = localStorage.getItem(`tour_completed_${role}`);
    if (!completed) {
      // Small timeout to let the page load
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [role]);

  if (!isOpen) return null;

  const handleSkip = () => {
    localStorage.setItem(`tour_completed_${role}`, 'true');
    setIsOpen(false);
  };

  const nextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSkip();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const steps = [
    {
      title: 'Navigation & Sidebar',
      content: 'Use the left sidebar navigation to easily switch between your Dashboard, Category filters, Document explorers, and settings.',
      highlight: 'Sidebar'
    },
    {
      title: 'Explorer & Details Panel',
      content: 'Click on folders to browse inside them, select files to preview their content instantly, view metadata, or add internal notes in the right sidebar panel.',
      highlight: 'Explorer'
    },
    {
      title: 'Automation & Uploads',
      content: 'Upload files by dragging and dropping them into the upload zones, or use fast keyboard shortcuts: Delete (delete), F2 (rename), Ctrl+N (new folder), Ctrl+E (upload files).',
      highlight: 'Speed'
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Top Gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Workspace Tour</span>
          </div>
          <button onClick={handleSkip} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
            {step}. {currentStep.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed font-normal">
            {currentStep.content}
          </p>
        </div>

        {/* Bullet Progress */}
        <div className="flex justify-center gap-1.5 mt-6 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 font-semibold hover:text-gray-600 hover:underline"
          >
            Skip Tour
          </button>
          
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="px-3 py-1.5 border border-gray-200 text-gray-700 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <button
              onClick={nextStep}
              className="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm hover:shadow-md"
            >
              {step === 3 ? 'Finish' : 'Next'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
