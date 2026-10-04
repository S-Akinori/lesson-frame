import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  turbopack: {root: process.cwd()},
  serverExternalPackages: [
    "@aws-sdk/client-s3",
  ],
};

export default nextConfig;
