"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Generate a session ID if one doesn't exist
    let sessionId = sessionStorage.getItem("page_visit_session_id");
    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("page_visit_session_id", sessionId);
    }

    const trackVisit = async () => {
      try {
        const formData = new FormData();
        formData.append("relationName", "page_visits");
        formData.append("page_path", pathname || "/");
        formData.append("session_id", sessionId);

        await fetch("/api/setEntryToTable", {
          method: "POST",
          body: formData,
        });
      } catch (error) {
        console.error("Failed to track page visit:", error);
      }
    };

    trackVisit();
  }, [pathname]);

  return null; // This component doesn't render anything
}
