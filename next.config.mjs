/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'limitlesstcg.nyc3.cdn.digitaloceanspaces.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
