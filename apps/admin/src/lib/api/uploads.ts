import api from './client';

export async function uploadImage(file: File, folder: 'logos' | 'covers' | 'gallery' | 'services'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.data.url;
}
