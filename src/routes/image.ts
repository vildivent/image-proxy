import { Router, Request, Response, NextFunction } from "express";
import { ImageFetcherService } from "../services/imageFetcher";
import { cacheControl } from "../middleware";
import { config } from "../config";

export const createImageRoutes = (
  imageFetcher: ImageFetcherService,
): Router => {
  const router = Router();

  router.get(
    "/image.webp",
    cacheControl(1),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const imageData = await imageFetcher.getImage();

        if (!imageData) {
          res.status(503).json({
            error: "Image temporarily unavailable",
            message: "No image available yet. Please try again later.",
          });
          return;
        }

        const cacheAge = Date.now() - imageData.lastUpdated.getTime();
        const maxAge = Math.ceil(config.cacheMaxAge / 1000);

        res.setHeader("Content-Type", imageData.contentType);
        res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
        res.setHeader("X-Last-Updated", imageData.lastUpdated.toISOString());
        res.setHeader("X-Cache-Age-Ms", String(cacheAge));
        res.setHeader("Content-Length", imageData.buffer.length.toString());

        res.send(imageData.buffer);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/image.json",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const imageData = await imageFetcher.getImage();

        if (!imageData) {
          res.status(503).json({
            error: "Image temporarily unavailable",
          });
          return;
        }

        res.json({
          success: true,
          contentType: imageData.contentType,
          lastUpdated: imageData.lastUpdated.toISOString(),
          cacheAgeMs: Date.now() - imageData.lastUpdated.getTime(),
          size: imageData.buffer.length,
          dataUrl: `data:${imageData.contentType};base64,${imageData.buffer.toString("base64")}`,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
};
