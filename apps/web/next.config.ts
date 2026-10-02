import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Proxy pengembangan: /api/v1 diteruskan ke API lokal, sehingga cookie tamu dan
  // refresh berjalan same-origin — tanpa CORS, tanpa SameSite=None. Di produksi
  // peran ini milik reverse proxy, bukan Next.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env['API_URL'] ?? 'http://127.0.0.1:3001'}/api/v1/:path*`,
      },
    ];
  },
  // packages/ui dikirim sebagai TypeScript/CSS mentah dan ditranspilasi di sini,
  // sehingga token tetap satu sumber tanpa langkah build tersendiri.
  transpilePackages: ['@snouty/ui', '@snouty/shared-types'],
  poweredByHeader: false,
};

export default config;
