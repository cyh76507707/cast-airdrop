import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 미니앱에서 필요한 설정
  experimental: {
    // esmExternals 경고 제거
  },
};

export default nextConfig;
