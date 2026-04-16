abstract class TenantRepository {
  Future<Map<String, dynamic>> getSettings();
  Future<Map<String, dynamic>> updateSettings(Map<String, dynamic> data);
  Future<List<Map<String, dynamic>>> getImages();
  Future<Map<String, dynamic>> addImage(String filePath);
  Future<void> deleteImage(int id);
  Future<void> reorderImages(List<int> ids);
}
