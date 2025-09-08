'use client';

import { FrameProvider } from '~/components/providers/FrameProvider';
import { RainbowKitWrapper } from '~/components/providers/RainbowKitProvider';

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RainbowKitWrapper>
      <FrameProvider>
        {children}
      </FrameProvider>
    </RainbowKitWrapper>
  );
}
