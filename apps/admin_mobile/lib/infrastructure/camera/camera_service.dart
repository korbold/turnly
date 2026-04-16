import 'dart:io';
import 'package:image_picker/image_picker.dart';

class CameraService {
  final ImagePicker _picker;

  CameraService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  Future<File?> pickImage({
    required ImageSource source,
    double maxWidth = 1080,
    int quality = 80,
  }) async {
    final xFile = await _picker.pickImage(
      source: source,
      maxWidth: maxWidth,
      imageQuality: quality,
    );
    if (xFile == null) return null;
    return File(xFile.path);
  }
}
