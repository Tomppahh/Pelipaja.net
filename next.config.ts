import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	output: 'standalone',
	reactCompiler: true,
	serverExternalPackages: ['dockerode', 'docker-modem', 'ssh2'],
};

export default nextConfig;
