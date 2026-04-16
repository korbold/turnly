export interface UploadResult {
  url: string;
}

export interface UploadRepository {
  upload(file: File, folder: string): Promise<UploadResult>;
}
