'use client';

import { FrameProvider } from '~/components/providers/FrameProvider';
import { RainbowKitWrapper } from '~/components/providers/RainbowKitProvider';
import { ToastProvider } from '~/components/ui/Toast';
import { SWRConfig } from 'swr';

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RainbowKitWrapper>
      <FrameProvider>
        <ToastProvider>
          <SWRConfig
            value={{
              fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
                const res = await fetch(input, init);
                if (!res.ok) {
                  const text = await res.text().catch(() => '');
                  throw new Error(`Request failed: ${res.status} ${text || res.statusText}`);
                }
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) return res.json();
                return res.text();
              },
              revalidateOnFocus: false,
              revalidateIfStale: false,
              shouldRetryOnError: true,
              dedupingInterval: 120000,
              errorRetryInterval: 2000,
              errorRetryCount: 3,
            }}
          >
            {children}
          </SWRConfig>
        </ToastProvider>
      </FrameProvider>
    </RainbowKitWrapper>
  );
}
