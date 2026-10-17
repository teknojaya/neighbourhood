import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { AI_LIMITS } from '@neighbourhood/shared';
import express, { type Request, type Response, Router } from 'express';
import { HttpError } from '../../lib/http.js';
import { logger } from '../../lib/logger.js';
import { type LocalFileObjectStorage, SAFE_PATH } from '../../lib/storage.js';

/**
 * Creates the local file storage router for local development and test environments.
 * Endpoints are unauthenticated to mimic S3/GCS signed URL behavior (where signatures are in query strings).
 */
export function localStorageRouter(storage: LocalFileObjectStorage): Router {
  const router = Router();
  const baseDir = path.resolve(process.cwd(), storage.getBaseDir());

  // PUT /api/v1/storage/upload?path=listings/...
  router.put(
    '/storage/upload',
    express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: `${AI_LIMITS.imageMaxBytes}b`,
    }),
    async (req: Request, res: Response, next) => {
      try {
        const storagePath = req.query.path;
        if (typeof storagePath !== 'string' || !SAFE_PATH.test(storagePath)) {
          throw new HttpError('BAD_REQUEST', 'Invalid or missing storage path parameter');
        }

        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          throw new HttpError('BAD_REQUEST', 'Empty or invalid image payload');
        }

        const fullPath = path.resolve(baseDir, storagePath);
        // Security check: ensure resolved path is within baseDir
        if (!fullPath.startsWith(baseDir)) {
          throw new HttpError('FORBIDDEN', 'Path traversal attempt detected');
        }

        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, req.body);

        logger.info('local_storage_file_saved', { storagePath, bytes: req.body.length });
        res.status(200).json({ ok: true, path: storagePath });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/v1/storage/file?path=listings/...
  router.get('/storage/file', async (req: Request, res: Response, next) => {
    try {
      const storagePath = req.query.path;
      if (typeof storagePath !== 'string' || !SAFE_PATH.test(storagePath)) {
        throw new HttpError('BAD_REQUEST', 'Invalid or missing storage path parameter');
      }

      const fullPath = path.resolve(baseDir, storagePath);
      if (!fullPath.startsWith(baseDir)) {
        throw new HttpError('FORBIDDEN', 'Path traversal attempt detected');
      }

      if (!fs.existsSync(fullPath)) {
        throw new HttpError('NOT_FOUND', 'File not found');
      }

      const ext = path.extname(fullPath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(fullPath).pipe(res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
