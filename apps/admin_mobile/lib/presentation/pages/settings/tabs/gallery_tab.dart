import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../application/blocs/settings/settings_bloc.dart';
import '../../../../infrastructure/camera/camera_service.dart';
import '../../../../injection.dart';
import '../../../../shared/constants/colors.dart';

class GalleryTab extends StatelessWidget {
  const GalleryTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => getIt<SettingsBloc>()..add(const LoadSettings()),
      child: const _GalleryView(),
    );
  }
}

class _GalleryView extends StatefulWidget {
  const _GalleryView();

  @override
  State<_GalleryView> createState() => _GalleryViewState();
}

class _GalleryViewState extends State<_GalleryView> {
  static const _maxPhotos = 10;
  List<String> _imageUrls = [];
  final List<File> _localFiles = [];
  bool _populated = false;

  void _populate(Map<String, dynamic> data) {
    if (_populated) return;
    _populated = true;
    final imgs = data['gallery'] as List<dynamic>? ?? [];
    _imageUrls = imgs.map((e) => e.toString()).toList();
  }

  int get _totalCount => _imageUrls.length + _localFiles.length;

  Future<void> _addImage() async {
    if (_totalCount >= _maxPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Maximo $_maxPhotos fotos permitidas')),
      );
      return;
    }
    final cam = getIt<CameraService>();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Camara'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Galeria'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null || !mounted) return;

    final file = await cam.pickImage(source: source);
    if (file != null && mounted) {
      setState(() => _localFiles.add(file));
    }
  }

  void _confirmDelete(int index) {
    final isRemote = index < _imageUrls.length;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar foto'),
        content:
            const Text('Seguro que deseas eliminar esta foto?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                if (isRemote) {
                  _imageUrls.removeAt(index);
                } else {
                  _localFiles.removeAt(index - _imageUrls.length);
                }
              });
            },
            style: FilledButton.styleFrom(
                backgroundColor: AppColors.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Galeria')),
      body: BlocConsumer<SettingsBloc, SettingsState>(
        listener: (context, state) {
          if (state is SettingsLoaded) _populate(state.data);
          if (state is SettingsError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: AppColors.error,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is SettingsLoading && !_populated) {
            return Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                ),
                itemCount: 6,
                itemBuilder: (_, _) => Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            );
          }

          return Column(
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Text(
                      '$_totalCount/$_maxPhotos fotos',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed:
                          _totalCount < _maxPhotos ? _addImage : null,
                      icon: const Icon(Icons.add_photo_alternate, size: 18),
                      label: const Text('Agregar'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _totalCount == 0
                    ? const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.photo_library,
                                size: 48, color: AppColors.textMuted),
                            SizedBox(height: 12),
                            Text(
                              'Sin fotos en la galeria',
                              style: TextStyle(color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                        ),
                        itemCount: _totalCount,
                        itemBuilder: (context, index) {
                          final isRemote = index < _imageUrls.length;
                          return GestureDetector(
                            onLongPress: () => _confirmDelete(index),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: isRemote
                                  ? CachedNetworkImage(
                                      imageUrl: _imageUrls[index],
                                      fit: BoxFit.cover,
                                      placeholder: (_, _) =>
                                          Container(
                                        color: AppColors.primaryMuted,
                                        child: const Center(
                                          child:
                                              CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        ),
                                      ),
                                      errorWidget: (_, _, _) =>
                                          Container(
                                        color: AppColors.errorMuted,
                                        child: const Icon(
                                          Icons.broken_image,
                                          color: AppColors.error,
                                        ),
                                      ),
                                    )
                                  : Image.file(
                                      _localFiles[
                                          index - _imageUrls.length],
                                      fit: BoxFit.cover,
                                    ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
