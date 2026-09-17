import type {NextConfig} from 'next';

const config: NextConfig = {
  transpilePackages: ['@nadav/core', '@nadav/adapters', '@nadav/admin-ui'],
  poweredByHeader: false,
  async headers() {
    return [{source: '/(.*)', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'X-Frame-Options', value: 'DENY'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
      {key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://api.mercadopago.com https://api.printnode.com https://*.supabase.co; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"}
    ]}];
  }
};
export default config;
