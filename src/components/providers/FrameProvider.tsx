"use client";

import { useEffect, useState, useCallback } from "react";
import { sdk } from "~/lib/farcaster.client";
import React from "react";

interface FrameContextType {
  isSDKLoaded: boolean;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
}

const FrameContext = React.createContext<FrameContextType | undefined>(undefined);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(async (url: string) => {
    try {
      await sdk.actions.openUrl(url);
    } catch (error) {
      // Fallback to browser
      window.open(url, '_blank');
    }
  }, []);

  const close = useCallback(async () => {
    try {
      await sdk.actions.close();
    } catch (error) {
      // Fallback to browser
      window.close();
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        console.log("🔍 FrameProvider: Starting SDK initialization...");
        // SDK is ready to use immediately
        setIsSDKLoaded(true);
        console.log("🔍 FrameProvider: isSDKLoaded set to true");
      } catch (error) {
        console.error("Error in SDK initialization:", error);
        // Continue even if error occurs
        setIsSDKLoaded(true);
      }
    };

    console.log("Starting SDK initialization");
    load();
  }, []); // Empty dependency array to run only once

  return {
    isSDKLoaded,
    openUrl,
    close,
  };
}

export function FrameProvider({ children }: { children: React.ReactNode }) {
  const frameContext = useFrame();
  
  console.log("🔍 FrameProvider render - isSDKLoaded:", frameContext.isSDKLoaded);

  if (!frameContext.isSDKLoaded) {
    console.log("🔍 FrameProvider: Still loading, showing loading div");
    return <div>Loading...</div>;
  }

  console.log("🔍 FrameProvider: SDK loaded, rendering children");
  return (
    <FrameContext.Provider value={frameContext}>
      {children}
    </FrameContext.Provider>
  );
}
