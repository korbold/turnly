// lib/features/legal/presentation/screens/legal_screen.dart
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/network/api_client.dart';

enum LegalType { terms, privacy }

class LegalScreen extends StatefulWidget {
  final LegalType type;

  const LegalScreen({super.key, required this.type});

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen> {
  String? _content;
  String? _version;
  String? _updatedAt;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final slug = widget.type == LegalType.terms ? 'terms' : 'privacy';
    try {
      final res = await ApiClient.instance.get('/public/legal/$slug');
      final data = res.data['data'] as Map<String, dynamic>;
      setState(() {
        _content = data['content'] as String?;
        _version = data['version'] as String?;
        _updatedAt = data['updated_at'] as String?;
        _loading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = 'No se pudo cargar el documento (${e.response?.statusCode ?? 'red'})';
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Error inesperado';
        _loading = false;
      });
    }
  }

  String get _title => widget.type == LegalType.terms
      ? 'Términos y Condiciones'
      : 'Política de Privacidad';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_title),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: Markdown(
                        data: _content ?? '',
                        padding: const EdgeInsets.all(20),
                        styleSheet: MarkdownStyleSheet(
                          h1: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          h2: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          h3: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                          p: const TextStyle(
                            fontSize: 14,
                            height: 1.55,
                            color: AppColors.textSecondary,
                          ),
                          strong: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          listBullet: const TextStyle(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                          ),
                          tableHead: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          tableBody: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                          a: const TextStyle(color: AppColors.accent),
                        ),
                      ),
                    ),
                    if (_version != null && _updatedAt != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                        child: Text(
                          'Versión $_version · Actualizado el $_updatedAt',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
