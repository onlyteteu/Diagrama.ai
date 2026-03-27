/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['bpmn-auto-layout', 'bpmn-moddle']
  }
};
export default nextConfig;
