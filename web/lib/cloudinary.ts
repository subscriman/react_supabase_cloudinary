export function isCloudinaryConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
}

export function extractCloudinaryPublicId(imageUrl: string) {
  try {
    const parsed = new URL(imageUrl);
    const uploadIndex = parsed.pathname.indexOf('/upload/');
    if (uploadIndex < 0) return null;
    const rest = parsed.pathname.slice(uploadIndex + '/upload/'.length);
    const withoutVersion = rest.replace(/^v\d+\//, '');
    return withoutVersion.replace(/\.[a-z0-9]+$/i, '');
  } catch {
    return null;
  }
}

export async function deleteCloudinaryImage(imageUrl: string) {
  if (!imageUrl || !isCloudinaryConfigured()) return false;

  const response = await fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  return response.ok;
}
