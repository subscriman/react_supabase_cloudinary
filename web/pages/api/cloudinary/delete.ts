import type { NextApiRequest, NextApiResponse } from 'next';
import cloudinary from '../../../lib/cloudinary-server';
import { extractCloudinaryPublicId } from '../../../lib/cloudinary';

const allowedPrefix = 'subscription-manager/';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const imageUrl =
      typeof req.body?.imageUrl === 'string' ? req.body.imageUrl.trim() : '';

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    const publicId = extractCloudinaryPublicId(imageUrl);

    if (!publicId || !publicId.startsWith(allowedPrefix)) {
      return res.status(400).json({ error: 'Unsupported Cloudinary asset' });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
    });

    const deleted = result.result === 'ok' || result.result === 'not found';

    if (!deleted) {
      return res.status(502).json({
        error: 'Failed to delete Cloudinary asset',
        result: result.result,
      });
    }

    return res.status(200).json({
      deleted: true,
      publicId,
      result: result.result,
    });
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return res.status(500).json({ error: 'Failed to delete image' });
  }
}
