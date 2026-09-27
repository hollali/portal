import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.bing.com' },
      { protocol: 'https', hostname: '**.google.com' },
      { protocol: 'https', hostname: '**.youtube.com' },
      { protocol: 'https', hostname: '**.ytimg.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
};

export default nextConfig;
