import Link from 'next/link';
import { CalendarCheck, Building2, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div>
      {/* Hero (nav integrated inside the gradient) */}
      <section className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 animate-mesh overflow-hidden">
        {/* Nav */}
        <nav className="relative z-20">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
            <span className="text-xl font-bold text-white tracking-tight">Turnly</span>
            <div className="flex items-center gap-6">
              <Link href="/login" className="text-sm text-white/80 hover:text-white transition-colors">
                Iniciar sesion
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 bg-white/15 backdrop-blur border border-white/20 text-white text-sm font-medium rounded-full hover:bg-white/25 transition-colors"
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl mx-auto text-center px-6 pt-16 pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-white/90 text-sm font-medium mb-8">
            <Sparkles className="h-4 w-4" />
            La plataforma #1 de reservas
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-6">
            Gestiona tu negocio, acepta reservas online
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto mb-10">
            Turnly es la plataforma de citas y servicios para cualquier negocio
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-white text-indigo-600 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors shadow-elevated"
            >
              Registra tu negocio gratis
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 glass text-white text-sm font-semibold rounded-full hover:bg-white/20 transition-colors"
            >
              Iniciar sesion
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4 tracking-tight">
            Todo lo que necesitas
          </h2>
          <p className="text-slate-500 text-center mb-12 max-w-xl mx-auto">
            Herramientas poderosas para gestionar tu negocio de forma eficiente
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: CalendarCheck,
                title: 'Reservas online',
                desc: 'Tus clientes reservan desde cualquier lugar, 24/7',
              },
              {
                icon: Building2,
                title: 'Multi-negocio',
                desc: 'Barberias, spas, consultorios, gimnasios y mas',
              },
              {
                icon: LayoutDashboard,
                title: 'Panel de administracion',
                desc: 'Gestiona servicios, equipo y reportes en un solo lugar',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-8 border border-slate-200/50 shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl btn-gradient mb-5">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="px-6 py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-slate-400 uppercase tracking-widest font-medium mb-3">
            Negocios que confian en Turnly
          </p>
          <p className="text-4xl font-bold text-slate-900">+500 negocios activos</p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
              Empieza gratis hoy
            </h2>
            <p className="text-white/70 mb-8">Sin tarjeta de credito requerida</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-600 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Crear cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-slate-400 border-t border-slate-200/50">
        &copy; 2026 Turnly. Todos los derechos reservados.
      </footer>
    </div>
  );
}
