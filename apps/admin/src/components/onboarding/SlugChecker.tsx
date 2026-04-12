'use client';

import { useEffect, useState } from 'react';
import { checkSlug } from '@/lib/api/onboarding';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SlugCheckerProps {
  slug: string;
}

export function SlugChecker({ slug }: SlugCheckerProps) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setAvailable(null);
      return;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await checkSlug(slug);
        setAvailable(result);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  if (!slug || slug.length < 3) return null;

  if (checking) {
    return (
      <span className="text-sm text-gray-400 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
      </span>
    );
  }

  if (available === true) {
    return (
      <span className="text-sm text-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" /> Disponible
      </span>
    );
  }

  if (available === false) {
    return (
      <span className="text-sm text-red-600 flex items-center gap-1">
        <XCircle className="h-3 w-3" /> No disponible
      </span>
    );
  }

  return null;
}
