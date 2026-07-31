/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@legacy/core",
    "@legacy/succession",
    "@legacy/death-verification",
    "@legacy/oracle",
    "@legacy/fraud",
    "@legacy/health",
    "@legacy/blockchain",
    "@legacy/bitcoin",
    "@legacy/demo-data",
  ],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
