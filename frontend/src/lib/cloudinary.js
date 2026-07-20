import { api } from './api';

export async function uploadToCloudinary(file) {
  const { signature, timestamp, api_key, cloud_name, folder } =
    await api.post('/api/admin/uploads/cloudinary-signature', {});

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Upload failed');
  }

  const data = await res.json();
  return data.secure_url;
}
