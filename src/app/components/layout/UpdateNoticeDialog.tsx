"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export default function UpdateNoticeDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dismissedUntil = localStorage.getItem("icv_update_dismissed_until");
    if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    const remindAt = Date.now() + THIRTY_MINUTES_MS;
    localStorage.setItem("icv_update_dismissed_until", remindAt.toString());
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with modern blur */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={handleDismiss}
      />
      
      {/* Dialog Card */}
      <div className="relative w-full max-w-md scale-100 transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all animate-in zoom-in-95 duration-300 dark:bg-slate-900 dark:text-white">
        <div className="flex flex-col items-center text-center">
          {/* Icon Badge */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
            <Sparkles className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            New Version Available!
          </h2>
          
          <p className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            A newer, updated version of the ICV platform is now online.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <a 
              href="http://89.168.106.64:8080/en" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button 
                className="w-full flex items-center justify-center gap-2 bg-blue-600 py-5 text-base font-semibold text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md"
              >
                Go to Newer Version
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>

            <Button 
              variant="outline"
              onClick={handleDismiss}
              className="w-full py-5 text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Remind Me Later
            </Button>
          </div>
        </div>
        
        {/* Close Button */}
        <button 
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-200 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
