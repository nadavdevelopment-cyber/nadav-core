import type {NextConfig} from 'next';
const config: NextConfig = {
  agentRules: false,
  transpilePackages: ['@nadav/core', '@nadav/sdk'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {protocol: 'https', hostname: '**'},
      {protocol: 'http', hostname: 'localhost'}
    ]
  }
};
export default config;
