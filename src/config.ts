import dotenv from "dotenv";

dotenv.config();

if (!process.env.IMAGE_URL) {
  console.error("FATAL: IMAGE_URL environment variable is required");
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  imageUrl: process.env.IMAGE_URL,
  refreshInterval: parseInt(process.env.REFRESH_INTERVAL || "5000", 10),
  cacheMaxAge: parseInt(process.env.CACHE_MAX_AGE || "120000", 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  retryDelay: parseInt(process.env.RETRY_DELAY || "1000", 10),
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET"],
  },
};
