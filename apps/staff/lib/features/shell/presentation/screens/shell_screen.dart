import 'package:flutter/material.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../shared/enums/user_role.dart';
import '../../../dashboard/presentation/screens/dashboard_screen.dart';
import '../../../reservations/presentation/screens/reservations_screen.dart';
import '../../../services/presentation/screens/services_screen.dart';
import '../../../service_log/presentation/screens/service_log_screen.dart';
import 'more_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int _currentIndex = 0;
  UserRole _role = UserRole.washer;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRole();
  }

  Future<void> _loadRole() async {
    final roleStr = await SecureStorage.getRole();
    setState(() {
      _role = roleStr != null ? UserRole.fromString(roleStr) : UserRole.washer;
      _loading = false;
    });
  }

  List<Widget> _getScreens() {
    if (_role.isAdmin) {
      return const [
        DashboardScreen(),
        ServiceLogScreen(),
        ReservationsScreen(),
        MoreScreen(),
      ];
    } else {
      return const [
        DashboardScreen(),
        ServiceLogScreen(),
        ReservationsScreen(),
        ServicesScreen(),
      ];
    }
  }

  List<NavigationDestination> _getDestinations() {
    if (_role.isAdmin) {
      return const [
        NavigationDestination(icon: Icon(Icons.dashboard), label: 'Inicio'),
        NavigationDestination(icon: Icon(Icons.menu_book), label: 'Libro Diario'),
        NavigationDestination(icon: Icon(Icons.calendar_today), label: 'Reservaciones'),
        NavigationDestination(icon: Icon(Icons.more_horiz), label: 'Más'),
      ];
    } else {
      return const [
        NavigationDestination(icon: Icon(Icons.dashboard), label: 'Inicio'),
        NavigationDestination(icon: Icon(Icons.menu_book), label: 'Libro Diario'),
        NavigationDestination(icon: Icon(Icons.calendar_today), label: 'Reservaciones'),
        NavigationDestination(icon: Icon(Icons.build), label: 'Servicios'),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final screens = _getScreens();

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        destinations: _getDestinations(),
      ),
    );
  }
}
