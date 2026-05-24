import { fetch, Agent, Headers, Response } from "undici";
import NodeCache from "node-cache";
import sharp from "sharp";
import { config } from "../config";

interface ImageData {
  buffer: Buffer;
  contentType: string;
  lastUpdated: Date;
}

export class ImageFetcherService {
  private cache: NodeCache;
  private agent: Agent;
  private updateTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private consecutiveFailures = 0;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: Math.ceil(config.cacheMaxAge / 1000), // TTL кеша в секундах
      checkperiod: 60, // Проверка раз в минуту
    });

    this.agent = new Agent({
      keepAliveTimeout: 10000,
      keepAliveMaxTimeout: 10000,
      connections: 10,
      pipelining: 1,
    });

    this.startPeriodicUpdate();
  }

  private extractContentType(headers: Headers): string {
    try {
      const contentType = headers.get("content-type");
      if (contentType && typeof contentType === "string") {
        return contentType.toLowerCase();
      }
      return "image/jpeg";
    } catch {
      return "image/jpeg";
    }
  }

  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .webp({
          quality: 100,
          lossless: false,
          nearLossless: false,
          smartSubsample: true,
        })
        .toBuffer();
    } catch {
      return buffer;
    }
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
          dispatcher: this.agent,
          signal: controller.signal,
          headers: {
            "User-Agent": "ImageProxy/1.0",
            Accept: "image/*, */*",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        if (attempt < config.maxRetries) {
          const delay = config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Fetch failed");
  }

  private async fetchImage(): Promise<ImageData | null> {
    try {
      const response = await this.fetchWithRetry(config.imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const optimizedBuffer = await this.optimizeImage(buffer);

      this.consecutiveFailures = 0;

      return {
        buffer: optimizedBuffer,
        contentType: "image/webp",
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures === 1) {
        console.error("Image fetch failed, serving from cache");
      }

      return null;
    }
  }

  private async updateImage(): Promise<void> {
    if (this.isUpdating) return;

    this.isUpdating = true;
    try {
      const imageData = await this.fetchImage();

      if (imageData) {
        this.cache.set("current_image", imageData);
      }
      // Если imageData === null, оставляем старые данные в кеше
      // NodeCache сам удалит их по истечении TTL (2 минуты)
    } finally {
      this.isUpdating = false;
    }
  }

  private startPeriodicUpdate(): void {
    this.updateImage();

    this.updateTimer = setInterval(() => {
      this.updateImage();
    }, config.refreshInterval);
  }

  public async getImage(): Promise<ImageData | null> {
    const cached = this.cache.get<ImageData>("current_image");
    if (cached) {
      return cached;
    }

    // Кеш пуст, делаем синхронный запрос
    await this.updateImage();
    return this.cache.get<ImageData>("current_image") || null;
  }

  public async stop(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    await this.agent.close();
    this.cache.flushAll();
  }
}
