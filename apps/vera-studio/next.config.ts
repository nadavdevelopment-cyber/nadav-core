import type {NextConfig} from 'next';

const config: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  images: {formats: ['image/avif', 'image/webp']}
};

export default config;

// Vercel deployment sync
