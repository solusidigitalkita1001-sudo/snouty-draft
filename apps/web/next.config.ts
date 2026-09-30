import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // packages/ui dikirim sebagai TypeScript/CSS mentah dan ditranspilasi di sini,
  // sehingga token tetap satu sumber tanpa langkah build tersendiri.
  transpilePackages: ['@snouty/ui', '@snouty/shared-types'],
  poweredByHeader: false,
};

export default config;
