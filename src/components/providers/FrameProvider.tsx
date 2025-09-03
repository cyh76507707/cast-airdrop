"use client";

import { useEffect, useState, useCallback } from "react";
import { farcasterSdk as sdk } from "~/lib/farcaster.client";
import type { Context, FrameNotificationDetails } from "@farcaster/frame-sdk";
import { createStore } from "mipd";
import React from "react";

interface FrameContextType {
  isSDKLoaded: boolean;
  context: Context.FrameContext | undefined;
  openUrl: (url: string) => Promise<void>;
  close: () => Promise<void>;
  added: boolean;
  notificationDetails: FrameNotificationDetails | null;
  lastEvent: string;
  addFrame: () => Promise<void>;
  addFrameResult: string;
}

const FrameContext = React.createContext<FrameContextType | undefined>(undefined);

export function useFrame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [added, setAdded] = useState(false);
  const [notificationDetails, setNotificationDetails] = useState<FrameNotificationDetails | null>(null);
  const [lastEvent, setLastEvent] = useState("");
  const [addFrameResult, setAddFrameResult] = useState("");

  // SDK actions only work in mini app clients, so this pattern supports browser actions as well
  const openUrl = useCallback(async (url: string) => {
    if (context) {
      await sdk.actions.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  }, [context]);

  const close = useCallback(async () => {
    if (context) {
      await sdk.actions.close();
    } else {
      window.close();
    }
  }, [context]);

  const addFrame = useCallback(async () => {
    try {
      setNotificationDetails(null);
      const result = await sdk.actions.addFrame();

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails);
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details"
      );
    } catch (error) {
      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        console.log("🔍 FrameProvider: Starting context loading...");
        // ready()는 page.tsx에서 호출하므로 여기서는 제거
        const context = await sdk.context;
        console.log("🔍 FrameProvider: Context loaded:", context);
        setContext(context);
        setIsSDKLoaded(true);
        console.log("🔍 FrameProvider: isSDKLoaded set to true");

        // Set up event listeners
        sdk.on("frameAdded", ({ notificationDetails }) => {
          console.log("Frame added", notificationDetails);
          setAdded(true);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Frame added");
        });

        sdk.on("frameAddRejected", ({ reason }) => {
          console.log("Frame add rejected", reason);
          setAdded(false);
          setLastEvent(`Frame add rejected: ${reason}`);
        });

        sdk.on("frameRemoved", () => {
          console.log("Frame removed");
          setAdded(false);
          setLastEvent("Frame removed");
        });

        sdk.on("notificationsEnabled", ({ notificationDetails }) => {
          console.log("Notifications enabled", notificationDetails);
          setNotificationDetails(notificationDetails ?? null);
          setLastEvent("Notifications enabled");
        });

        sdk.on("notificationsDisabled", () => {
          console.log("Notifications disabled");
          setNotificationDetails(null);
          setLastEvent("Notifications disabled");
        });

        sdk.on("primaryButtonClicked", () => {
          console.log("Primary button clicked");
          setLastEvent("Primary button clicked");
        });

        // Set up MIPD Store
        const store = createStore();
        store.subscribe((providerDetails) => {
          console.log("PROVIDER DETAILS", providerDetails);
        });
      } catch (error) {
        console.error("Error in SDK initialization:", error);
        // Clap과 동일하게 에러가 발생해도 계속 진행
        setIsSDKLoaded(true);
      }
    };

    // Clap과 동일하게 즉시 실행 (의존성 없이)
    console.log("Starting SDK initialization");
    load();
    return () => {
      sdk.removeAllListeners();
    };
  }, []); // 빈 의존성 배열로 한 번만 실행

  return {
    isSDKLoaded,
    context,
    added,
    notificationDetails,
    lastEvent,
    addFrame,
    addFrameResult,
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
