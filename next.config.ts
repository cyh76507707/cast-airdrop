import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Clap과 동일하게 SSR 비활성화
  ssr: false,
  // 미니앱에서 필요한 설정
  experimental: {
    esmExternals: 'loose',
  },
};

export default nextConfig;
