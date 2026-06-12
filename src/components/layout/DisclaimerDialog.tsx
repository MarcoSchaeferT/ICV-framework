"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, val: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${val}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

export default function DisclaimerDialog() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Fetch disclaimer status from our API endpoint
    fetch("/api/disclaimer")
      .then((res) => res.json())
      .then((data) => {
        if (data.showDisclaimer) {
          const isAccepted = getCookie("icv_disclaimer_accepted");
          if (isAccepted !== "true") {
            setIsOpen(true);
          }
        }
      })
      .catch((err) => console.error("Failed to fetch disclaimer status:", err));
  }, []);

  const handleClose = () => {
    setCookie("icv_disclaimer_accepted", "true", 4 * 60); // 4 minutes
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop with premium blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={handleClose}
      />
      
      {/* Dialog Card */}
      <div className="relative w-full max-w-xl scale-100 transform overflow-hidden rounded-2xl bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95 duration-300 mx-4">
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon Container */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 animate-pulse">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          </div>
          
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Access & Usage Disclaimer
          </h2>
          
          <p className="mb-8 text-md leading-relaxed text-gray-600">
            Please note that this hosted version of the ICV-Framework is provisioned for the participants of the <span className="font-semibold text-gray-900">CLIMADAMIC Summer School 2026</span>.
            <span className="block mt-4">
              Access to this specific testing environment is temporary and will remain available for two weeks following the conclusion of the CLIMADAMIC Summer School.
            </span>
            <span className="block mt-4 font-medium text-amber-700">
              Data and access links will not be maintained after this period.
            </span>
          </p>
          
          <Button 
            onClick={handleClose}
            className="w-full bg-amber-600 py-6 text-lg font-semibold text-white hover:bg-amber-700 active:scale-[0.98] transition-all"
          >
            Understood
          </Button>
        </div>
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
