import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  turbopack: {root: process.cwd()},
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@aws-sdk/client-s3",
  ],
};

export default nextConfig;
