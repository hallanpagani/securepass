/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  transpilePackages: ['@auth/prisma-adapter', 'next-auth'],
};

module.exports = nextConfig;