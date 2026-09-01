import express from 'express';
import multer from 'multer';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { authenticate } from '../../middleware/authenticate';
import { uploadMedia, listMedia, deleteMedia, s3 as s3Client } from '../../services/storageAdapter';
import { verifySession } from '../../services/sessionService';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  let includePrivate = false;
  
  const token = req.cookies?.sexyshreya_session;
  if (token) {
    try {
      const payload = verifySession(token);
      if (payload.role === 'user' || payload.role === 'admin') {
        includePrivate = true;
      }
    } catch {
      // invalid session, default to public only
    }
  }

  try {
    const items = await listMedia(includePrivate);
    res.status(200).json(items);
  } catch (error) {
    console.error('List media error:', error);
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const { title, isPrivate } = req.body;
  const isPriv = isPrivate === 'true' || isPrivate === true;

  try {
    const url = await uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype, isPriv);
    res.status(200).json({
      id: url.replace('/api/gallery/media/', ''),
      url,
      title: title || req.file.originalname,
      isPrivate: isPriv
    });
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

router.get('/media/*key', async (req, res) => {
  try {
    const rawKey = (req.params as any).key;
    const key = Array.isArray(rawKey) ? rawKey.join('/') : (rawKey || (req.params as any)[0]);
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'sstech-storage',
      Key: key,
    });
    const response = await s3Client.send(command);
    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (response.Body) {
      (response.Body as any).pipe(res);
    } else {
      res.status(404).send('Media not found');
    }
  } catch (err) {
    console.error('Failed to stream media from R2:', err);
    res.status(404).send('Media not found');
  }
});

router.delete('/item', authenticate, async (req, res) => {
  if ((req as any).session?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin authorization required to delete assets' });
  }

  const key = req.query.key || req.body.key;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Key is required' });
  }

  try {
    await deleteMedia(key);
    res.status(200).json({ success: true, deletedKey: key });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
