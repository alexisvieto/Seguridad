'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { IncidentDetailModal, type IncidentDetail } from './dashboard/live-monitor/incident-detail-modal';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RealtimeAlertsProps {
  tenantId: string;
  tenantSlug: string;
}

// ---------------------------------------------------------------------------
// Component: Global Realtime Subscription + Banner + Modal
// Lives in the tenant layout — persists across all dashboard pages.
// ---------------------------------------------------------------------------

export function RealtimeAlerts({ tenantId, tenantSlug }: RealtimeAlertsProps) {
  const [activeNotification, setActiveNotification] = useState<IncidentDetail | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null);

  // -----------------------------------------------------------------
  // Realtime subscription — persists for the entire session
  // -----------------------------------------------------------------

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`global-incidents-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents_log',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const rec = payload.new as Record<string, unknown>;

          setActiveNotification({
            id: String(rec['id'] ?? ''),
            stationName: '',
            propertyName: '',
            agentName: '',
            incidentType: 'Novedad de Campo',
            refinedText: String(rec['ai_refined_text'] ?? rec['raw_text'] ?? ''),
            status: String(rec['status'] ?? 'open'),
            createdAt: String(rec['created_at'] ?? new Date().toISOString()),
            hasImage: false,
          });
          setIsBannerVisible(true);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tenantId]);

  // -----------------------------------------------------------------
  // Handlers — banner click opens modal, dismiss hides banner
  // Channel stays open regardless of UI state.
  // -----------------------------------------------------------------

  const handleBannerClick = useCallback(() => {
    setIsModalOpen(true);
    setIsBannerVisible(false);
  }, []);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBannerVisible(false);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      {/* ─── Global Banner ─── */}
      {isBannerVisible && activeNotification && (
        <div
          onClick={handleBannerClick}
          className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 w-[calc(100%-5rem)] max-w-[700px] cursor-pointer animate-[bannerSlideIn_0.3s_ease-out]"
        >
          <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-[#1A0A0A]/95 shadow-2xl shadow-red-900/20 backdrop-blur-md">
            <div className="absolute left-0 top-0 h-full w-1 bg-red-500 animate-pulse" />

            <div className="flex items-center gap-4 px-5 py-3.5 pl-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
                <svg className="h-4.5 w-4.5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-bold tracking-widest text-red-400 uppercase">
                    Nueva Novedad
                  </p>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(activeNotification.createdAt).toLocaleTimeString('es-PA', {
                      hour: '2-digit', minute: '2-digit', hour12: false,
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-zinc-200 truncate">
                  {activeNotification.propertyName && `${activeNotification.propertyName} — `}
                  {activeNotification.refinedText}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:block text-[10px] text-zinc-500 tracking-wide">
                  Click para detalles
                </span>
                <button
                  onClick={handleDismiss}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400 transition-colors cursor-pointer"
                  aria-label="Descartar"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Global Modal ─── */}
      <IncidentDetailModal
        incident={activeNotification}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        tenantSlug={tenantSlug}
      />
    </>
  );
}
