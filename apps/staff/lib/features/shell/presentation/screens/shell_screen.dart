import 'package:flutter/material.dart';
import '../../../../core/storage/secure_storage.dart';
import '../../../../shared/enums/user_role.dart';
import '../../../dashboard/presentation/screens/dashboard_screen.dart';
import '../../../reservations/presentation/screens/reservations_screen.dart';
import '../../../wash_log/presentation/screens/wash_log_screen.dart';
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
        WashLogScreen(),
        ReservationsScreen(),
        MoreScreen(),
      ];
    } else {
      return const [
        DashboardScreen(),
        WashLogScreen(),
        ReservationsScreen(),
        _PlaceholderTab(title: 'Servicios'),
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

// Placeholder tab for features not yet implemented
class _PlaceholderTab extends StatelessWidget {
  final String title;
  const _PlaceholderTab({required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text(title, style: Theme.of(context).textTheme.headlineSmall),
      ),
    );
  }
}
