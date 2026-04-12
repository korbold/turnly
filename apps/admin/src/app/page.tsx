import Link from 'next/link';
import { CalendarCheck, Building2, LayoutDashboard } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-200">
        <span className="text-xl font-bold text-gray-900">Turnly</span>
        <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
          Iniciar sesión
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 flex-1">
        <h1 className="text-4xl font-bold text-gray-900 max-w-2xl leading-tight mb-4">
          Gestiona tu negocio, acepta reservas online
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mb-8">
          Turnly es la plataforma de citas y servicios para cualquier negocio
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/register"
            className="px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Registra tu negocio gratis
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <CalendarCheck className="w-8 h-8 text-gray-700 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">Reservas online</h3>
            <p className="text-sm text-gray-500">Tus clientes reservan desde cualquier lugar, 24/7</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <Building2 className="w-8 h-8 text-gray-700 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">Multi-negocio</h3>
            <p className="text-sm text-gray-500">Barberías, spas, consultorios, gimnasios y más</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <LayoutDashboard className="w-8 h-8 text-gray-700 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">Panel de administración</h3>
            <p className="text-sm text-gray-500">Gestiona servicios, equipo y reportes en un solo lugar</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-400 border-t border-gray-200">
        © 2026 Turnly. Todos los derechos reservados.
      </footer>
    </div>
  );
}
