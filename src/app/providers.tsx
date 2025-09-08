'use client';

import { FrameProvider } from '~/components/providers/FrameProvider';
import { RainbowKitWrapper } from '~/components/providers/RainbowKitProvider';
import { ToastProvider } from '~/components/ui/Toast';

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RainbowKitWrapper>
      <FrameProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </FrameProvider>
    </RainbowKitWrapper>
  );
}
