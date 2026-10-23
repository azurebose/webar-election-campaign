/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: false,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_R2_PUBLIC_DOMAIN: 'pub-2a862321b71a474f8dfa575716c82ab4.r2.dev',
    NEXT_PUBLIC_ADMIN_EMAIL: 'admin@electioncampaign.org'
  }
};

module.exports = nextConfig;
