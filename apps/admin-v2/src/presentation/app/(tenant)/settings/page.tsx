'use client';

import { Suspense } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Settings, Clock, Image, List, Shield, Palette, Receipt } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { GeneralTab } from '@/presentation/components/features/settings/general-tab';
import { ScheduleTab } from '@/presentation/components/features/settings/schedule-tab';
import { GalleryTab } from '@/presentation/components/features/settings/gallery-tab';
import { CustomFieldsTab } from '@/presentation/components/features/settings/custom-fields-tab';
import { PermissionsTab } from '@/presentation/components/features/settings/permissions-tab';
import { BrandTab } from '@/presentation/components/features/settings/brand-tab';
import { BillingTab } from '@/presentation/components/features/settings/billing-tab';

const TABS = [
  { value: 'general', label: 'General', icon: Settings },
  { value: 'schedule', label: 'Horario', icon: Clock },
  { value: 'gallery', label: 'Galeria', icon: Image },
  { value: 'fields', label: 'Campos', icon: List },
  { value: 'permissions', label: 'Permisos', icon: Shield },
  { value: 'brand', label: 'Marca', icon: Palette },
  { value: 'billing', label: 'Facturación', icon: Receipt },
] as const;

function SettingsContent() {
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('general'));

  return (
    <div className="space-y-4">

      <Tabs value={tab} onValueChange={setTab}>
        {/* Desktop: vertical side tabs */}
        <div className="flex flex-col gap-6 lg:flex-row">
          <TabsList className="hidden h-auto flex-col items-stretch gap-1 bg-transparent p-0 lg:flex lg:w-48 lg:sticky lg:top-4 lg:self-start">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium data-[state=active]:bg-[var(--color-primary-muted)] data-[state=active]:text-[var(--color-primary-hover)] data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile: horizontal chips */}
          <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0 lg:hidden">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-1.5 rounded-full px-3 py-1.5 text-xs data-[state=active]:bg-[var(--color-primary-muted)] data-[state=active]:text-[var(--color-primary-hover)] data-[state=active]:shadow-none"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content */}
          <div className="flex-1">
            <TabsContent value="general"><GeneralTab /></TabsContent>
            <TabsContent value="schedule"><ScheduleTab /></TabsContent>
            <TabsContent value="gallery"><GalleryTab /></TabsContent>
            <TabsContent value="fields"><CustomFieldsTab /></TabsContent>
            <TabsContent value="permissions"><PermissionsTab /></TabsContent>
            <TabsContent value="brand"><BrandTab /></TabsContent>
            <TabsContent value="billing"><BillingTab /></TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-6">
            <Skeleton className="hidden h-64 w-48 lg:block" />
            <Skeleton className="h-96 flex-1" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
