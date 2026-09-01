import express from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { uploadMedia, listMedia, getMediaStream, deleteMedia } from '../../services/storageAdapter';
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

router.get(/^\/media\/(.*)/, async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).send('Key required');

  try {
    const { Body, ContentType, ContentLength } = await getMediaStream(key);
    
    res.set('Content-Type', ContentType);
    if (ContentLength) res.set('Content-Length', ContentLength.toString());
    res.set('Cache-Control', 'public, max-age=31536000');
    
    if (Body && typeof (Body as any).pipe === 'function') {
      (Body as any).pipe(res);
    } else if (Body) {
      (Body as any).pipe(res);
    } else {
      res.status(404).send('Not found');
    }
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      res.status(404).send('Not found');
    } else {
      console.error('Stream media error:', error);
      res.status(500).send('Stream error');
    }
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
