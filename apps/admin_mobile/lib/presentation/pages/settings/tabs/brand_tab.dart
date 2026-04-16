import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

class _Palette {
  final String name;
  final Color primary;
  final Color accent;

  const _Palette({
    required this.name,
    required this.primary,
    required this.accent,
  });
}

const _palettes = [
  _Palette(name: 'Indigo', primary: Color(0xFF4F46E5), accent: Color(0xFFEEF2FF)),
  _Palette(name: 'Azul', primary: Color(0xFF2563EB), accent: Color(0xFFDBEAFE)),
  _Palette(name: 'Cielo', primary: Color(0xFF0EA5E9), accent: Color(0xFFE0F2FE)),
  _Palette(name: 'Esmeralda', primary: Color(0xFF10B981), accent: Color(0xFFD1FAE5)),
  _Palette(name: 'Teal', primary: Color(0xFF14B8A6), accent: Color(0xFFCCFBF1)),
  _Palette(name: 'Ambar', primary: Color(0xFFF59E0B), accent: Color(0xFFFEF3C7)),
  _Palette(name: 'Naranja', primary: Color(0xFFF97316), accent: Color(0xFFFFF7ED)),
  _Palette(name: 'Rojo', primary: Color(0xFFEF4444), accent: Color(0xFFFEE2E2)),
  _Palette(name: 'Rosa', primary: Color(0xFFEC4899), accent: Color(0xFFFCE7F3)),
  _Palette(name: 'Violeta', primary: Color(0xFF8B5CF6), accent: Color(0xFFEDE9FE)),
  _Palette(name: 'Gris', primary: Color(0xFF64748B), accent: Color(0xFFF1F5F9)),
  _Palette(name: 'Zinc', primary: Color(0xFF3F3F46), accent: Color(0xFFF4F4F5)),
];

class BrandTab extends StatefulWidget {
  const BrandTab({super.key});

  @override
  State<BrandTab> createState() => _BrandTabState();
}

class _BrandTabState extends State<BrandTab> {
  int _selectedIdx = 0; // Default: Indigo

  @override
  Widget build(BuildContext context) {
    final selected = _palettes[_selectedIdx];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Marca')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Preview card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: selected.accent,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: selected.primary.withAlpha(51)),
            ),
            child: Column(
              children: [
                Text(
                  'Vista previa',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: selected.primary,
                      ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _previewButton(selected.primary, 'Primario', true),
                    const SizedBox(width: 12),
                    _previewButton(selected.primary, 'Secundario', false),
                  ],
                ),
                const SizedBox(height: 12),
                LinearProgressIndicator(
                  value: 0.6,
                  backgroundColor: selected.primary.withAlpha(51),
                  valueColor:
                      AlwaysStoppedAnimation<Color>(selected.primary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          Text('Selecciona una paleta',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),

          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate:
                const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.0,
            ),
            itemCount: _palettes.length,
            itemBuilder: (context, index) {
              final palette = _palettes[index];
              final isSelected = index == _selectedIdx;

              return GestureDetector(
                onTap: () => setState(() => _selectedIdx = index),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: palette.accent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected
                          ? palette.primary
                          : AppColors.cardBorder,
                      width: isSelected ? 2.5 : 1,
                    ),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: palette.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              palette.name,
                              style: TextStyle(
                                color: palette.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isSelected)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: palette.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check,
                              color: Colors.white,
                              size: 14,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _previewButton(Color primary, String label, bool filled) {
    if (filled) {
      return ElevatedButton(
        onPressed: () {},
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
        ),
        child: Text(label),
      );
    }
    return OutlinedButton(
      onPressed: () {},
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        side: BorderSide(color: primary),
      ),
      child: Text(label),
    );
  }
}
