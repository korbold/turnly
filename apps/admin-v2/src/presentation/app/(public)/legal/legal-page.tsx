import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

interface LegalDoc {
  type: string;
  version: string;
  updated_at: string;
  content: string;
}

async function fetchLegal(type: 'terms' | 'privacy'): Promise<LegalDoc | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  try {
    const res = await fetch(`${base}/public/legal/${type}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: LegalDoc };
    return json.data;
  } catch {
    return null;
  }
}

export async function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const doc = await fetchLegal(type);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
              T
            </div>
            <span className="font-semibold text-zinc-900">Turnly</span>
          </Link>
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        {!doc ? (
          <p className="text-sm text-zinc-500">No se pudo cargar el documento.</p>
        ) : (
          <article className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-a:text-[var(--color-primary)] prose-strong:text-zinc-900 prose-table:text-sm">
            <ReactMarkdown>{doc.content}</ReactMarkdown>
            <p className="mt-12 text-xs text-zinc-400">
              Versión {doc.version} · Actualizado el {doc.updated_at}
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
