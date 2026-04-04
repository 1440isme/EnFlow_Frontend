/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /** Smaller deploy artifact when using Docker / PM2 with `node .next/standalone/server.js` */
  output: 'standalone',


  async rewrites() {
    const target = (process.env.API_PROXY_TARGET || 'http://localhost:8080').replace(
      /\/$/,
      ''
    );
    return [
      {
        source: '/enflow/:path*',
        destination: `${target}/enflow/:path*`,
      },
    ];
  },
};

export default nextConfig;
