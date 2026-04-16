import type { UploadRepository, UploadResult } from '@/domain/repositories/upload.repository';
import api from '../client';

export class ApiUploadRepository implements UploadRepository {
  async upload(file: File, folder: string): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const { data } = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { url: data.url ?? data.data?.url };
  }
}
