"use client";

import React from "react";
import { useUIContext } from "../contexts/UIContext";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DemoModeDialog() {
  const { isDemoModeDialogOpen, setIsDemoModeDialogOpen } = useUIContext();

  if (!isDemoModeDialogOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop with premium blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
        onClick={() => setIsDemoModeDialogOpen(false)}
      />
      
      {/* Dialog Card */}
      <div className="relative w-full max-w-lg scale-100 transform overflow-hidden rounded-2xl bg-white p-8 shadow-2xl transition-all animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon Container */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          </div>
          
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Demo Mode Active
          </h2>
          
          <p className="mb-8 text-lg leading-relaxed text-gray-600">
            This hosted version of ICV is only for demonstration. 
            <span className="block mt-2 font-medium text-gray-600">
              Functionalities that change the database are disabled.
            </span>
            <span className="block mt-4 text-sm">
              However, the full functionality is available via the public 
              <a 
                href="https://github.com/MarcoSchaeferT/ICV-framework" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mx-1 text-amber-600 hover:underline font-medium"
              >
                ICV-framework
              </a>GitHub repository. 
              To run your own instance you can use the prebuild Docker images            
              or build the code yourself.
            </span>
          </p>
          
          <Button 
            onClick={() => setIsDemoModeDialogOpen(false)}
            className="w-full bg-amber-600 py-6 text-lg font-semibold text-white hover:bg-amber-700 active:scale-[0.98] transition-all"
          >
            Understood
          </Button>
        </div>
        
        {/* Close Button */}
        <button 
          onClick={() => setIsDemoModeDialogOpen(false)}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
