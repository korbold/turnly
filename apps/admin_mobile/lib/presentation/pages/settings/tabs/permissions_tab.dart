import 'package:flutter/material.dart';

import '../../../../shared/constants/colors.dart';

enum _PermLevel { full, view, none }

const _sections = [
  'Dashboard',
  'Reservas',
  'Registro',
  'Clientes',
  'Servicios',
  'Equipo',
  'Reportes',
  'Settings',
];

const _roles = ['Admin', 'Cajero', 'Lavador', 'Cliente'];

class PermissionsTab extends StatefulWidget {
  const PermissionsTab({super.key});

  @override
  State<PermissionsTab> createState() => _PermissionsTabState();
}

class _PermissionsTabState extends State<PermissionsTab> {
  // matrix[sectionIndex][roleIndex]
  late final List<List<_PermLevel>> _matrix;

  @override
  void initState() {
    super.initState();
    _matrix = List.generate(
      _sections.length,
      (si) => List.generate(_roles.length, (ri) {
        // Admin always full
        if (ri == 0) return _PermLevel.full;
        // Default: view for most, none for clients on settings
        if (si >= 6 && ri >= 2) return _PermLevel.none;
        return _PermLevel.view;
      }),
    );
  }

  void _cycle(int si, int ri) {
    // Don't allow changing admin permissions
    if (ri == 0) return;
    setState(() {
      final current = _matrix[si][ri];
      switch (current) {
        case _PermLevel.full:
          _matrix[si][ri] = _PermLevel.view;
        case _PermLevel.view:
          _matrix[si][ri] = _PermLevel.none;
        case _PermLevel.none:
          _matrix[si][ri] = _PermLevel.full;
      }
    });
  }

  Widget _permIcon(_PermLevel level) {
    switch (level) {
      case _PermLevel.full:
        return const Icon(Icons.check_circle,
            color: AppColors.success, size: 22);
      case _PermLevel.view:
        return const Icon(Icons.visibility,
            color: AppColors.info, size: 22);
      case _PermLevel.none:
        return const Icon(Icons.remove,
            color: AppColors.textMuted, size: 22);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Permisos')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor:
                WidgetStateProperty.all(AppColors.primaryMuted),
            columns: [
              const DataColumn(
                label: Text('Seccion',
                    style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              ..._roles.map(
                (r) => DataColumn(
                  label: Text(r,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600)),
                ),
              ),
            ],
            rows: List.generate(_sections.length, (si) {
              return DataRow(
                cells: [
                  DataCell(Text(_sections[si])),
                  ...List.generate(_roles.length, (ri) {
                    return DataCell(
                      GestureDetector(
                        onTap: () => _cycle(si, ri),
                        child: _permIcon(_matrix[si][ri]),
                      ),
                    );
                  }),
                ],
              );
            }),
          ),
        ),
      ),
    );
  }
}
