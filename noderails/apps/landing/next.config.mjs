/** @type {import('next').NextConfig} */
const nextConfig = {
	async redirects() {
		return [
			{
				source: '/:path*',
				has: [{ type: 'host', value: 'noderails.com' }],
				destination: 'https://www.noderails.com/:path*',
				permanent: true,
			},
		];
	},
};

export default nextConfig;
