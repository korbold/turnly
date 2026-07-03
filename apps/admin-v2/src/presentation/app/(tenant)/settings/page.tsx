'use client';

import { Suspense } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { Settings, Clock, Image, List, Shield, Palette, Receipt, Layers } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { GeneralTab } from '@/presentation/components/features/settings/general-tab';
import { ScheduleTab } from '@/presentation/components/features/settings/schedule-tab';
import { GalleryTab } from '@/presentation/components/features/settings/gallery-tab';
import { CustomFieldsTab } from '@/presentation/components/features/settings/custom-fields-tab';
import { PermissionsTab } from '@/presentation/components/features/settings/permissions-tab';
import { BrandTab } from '@/presentation/components/features/settings/brand-tab';
import { BillingTab } from '@/presentation/components/features/settings/billing-tab';
import { ResourcesTab } from '@/presentation/components/features/settings/resources-tab';

const TABS = [
  { value: 'general', label: 'General', icon: Settings },
  { value: 'schedule', label: 'Horario', icon: Clock },
  { value: 'gallery', label: 'Galería', icon: Image },
  { value: 'fields', label: 'Campos', icon: List },
  { value: 'permissions', label: 'Permisos', icon: Shield },
  { value: 'brand', label: 'Marca', icon: Palette },
  { value: 'billing', label: 'Facturación', icon: Receipt },
  { value: 'resources', label: 'Recursos', icon: Layers },
] as const;

function SettingsContent() {
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('general'));

  return (
    <div>
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Desktop: vertical side tabs */}
          <TabsList className="hidden h-auto flex-col items-stretch gap-0.5 bg-transparent p-0 lg:flex lg:w-52 lg:sticky lg:top-6 lg:self-start">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="group justify-start gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--fg-default,#4B5462)] transition-[background-color,color] [transition-duration:160ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--niebla-media,#EEF0F3)] data-[state=active]:bg-[var(--brand-50)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-colors duration-150 group-data-[state=active]:text-[var(--brand-500)]" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile: horizontal scroll-snap chips */}
          <TabsList
            className="-mx-4 flex h-auto items-center gap-1.5 overflow-x-auto scroll-smooth bg-transparent px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory lg:hidden"
            aria-label="Secciones de configuración"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="snap-start shrink-0 gap-1.5 rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--fg-default,#4B5462)] transition-[background-color,color,border-color,transform] [transition-duration:160ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] data-[state=active]:border-transparent data-[state=active]:bg-[var(--brand-50)] data-[state=active]:text-[var(--brand-700)] data-[state=active]:shadow-none"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <TabsContent value="general" className="mt-0"><GeneralTab /></TabsContent>
            <TabsContent value="schedule" className="mt-0"><ScheduleTab /></TabsContent>
            <TabsContent value="gallery" className="mt-0"><GalleryTab /></TabsContent>
            <TabsContent value="fields" className="mt-0"><CustomFieldsTab /></TabsContent>
            <TabsContent value="permissions" className="mt-0"><PermissionsTab /></TabsContent>
            <TabsContent value="brand" className="mt-0"><BrandTab /></TabsContent>
            <TabsContent value="billing" className="mt-0"><BillingTab /></TabsContent>
            <TabsContent value="resources" className="mt-0"><ResourcesTab /></TabsContent>
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
        <div className="space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex flex-col gap-6 lg:flex-row">
            <Skeleton className="hidden h-64 w-52 lg:block" />
            <Skeleton className="h-96 flex-1" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
