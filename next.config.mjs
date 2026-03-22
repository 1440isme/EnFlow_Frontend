/** @type {import('next').NextConfig} */
const backend =
  (process.env.API_PROXY_TARGET || 'http://localhost:8080').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/enflow/:path*',
        destination: `${backend}/enflow/:path*`,
      },
    ];
  },
};

export default nextConfig;
