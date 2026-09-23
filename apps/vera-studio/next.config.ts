import type {NextConfig} from 'next';

const coreOrigin = process.env.NEXT_PUBLIC_NADAV_CORE_URL?.replace(/\/$/, '');

const config: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/nadav-core-media/**'}]
  },
  async headers() {
    const connect = ["'self'", ...(coreOrigin ? [coreOrigin] : [])].join(' ');
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
      {key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://*.supabase.co; connect-src ${connect}; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`}
    ]}];
  }
};

export default config;

// Vercel deployment sync
