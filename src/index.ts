import express, { Express } from "express";
import cors from "cors";
import { Server } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "./config";
import { ImageFetcherService } from "./services/imageFetcher";
import { createImageRoutes } from "./routes/image";
import { errorHandler, notFoundHandler } from "./middleware";
import { formatUptime } from "./utils";

const app: Express = express();
const imageFetcher = new ImageFetcherService();

const template = readFileSync(
  join(__dirname, "templates", "index.html"),
  "utf-8",
);

app.use(
  cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
  }) as express.RequestHandler,
);

app.use(express.json());

app.get("/", (req, res) => {
  const html = template
    .replace("{{uptime}}", formatUptime(process.uptime()))
    .replace("{{sourceUrl}}", config.imageUrl)
    .replace("{{refreshInterval}}", String(config.refreshInterval / 1000))
    .replace("{{cacheMaxAge}}", String(config.cacheMaxAge / 1000));

  res.send(html);
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use(createImageRoutes(imageFetcher));

app.use(notFoundHandler);
app.use(errorHandler);

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n${signal} received. Shutting down...`);

  server.close(() => {
    console.log("Server closed");
  });

  await imageFetcher.stop();
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const server: Server = app.listen(config.port, () => {
  console.log(`Image Proxy Server started on port ${config.port}`);
  console.log(`Source: ${config.imageUrl}`);
});

export { app, server };
