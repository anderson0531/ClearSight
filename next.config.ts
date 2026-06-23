import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static', 'ffprobe-static', 'pg'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

export default nextConfig
