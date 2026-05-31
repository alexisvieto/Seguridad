'use client';

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentDetail {
  id: string;
  stationName: string;
  propertyName: string;
  agentName: string;
  incidentType: string;
  refinedText: string;
  status: string;
  createdAt: string;
  hasImage: boolean;
  imageUrl?: string;
}

interface IncidentDetailModalProps {
  incident: IncidentDetail | null;
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-PA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' — ' + d.toLocaleTimeString('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const statusConfig: Record<string, { label: string; critical: boolean }> = {
  open: { label: 'ABIERTO — ATENCIÓN INMEDIATA', critical: true },
  in_progress: { label: 'EN CURSO', critical: false },
  resolved: { label: 'RESUELTO', critical: false },
  closed: { label: 'CERRADO', critical: false },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncidentDetailModal({
  incident,
  isOpen,
  onClose,
  tenantSlug,
}: IncidentDetailModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [incident?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !incident) return null;

  const config = statusConfig[incident.status] ?? statusConfig['open']!;

  const handleGoToHistory = () => {
    onClose();
    window.location.href = `/${tenantSlug}/dashboard/live-monitor`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-[780px] mx-4 rounded-2xl border border-[#1E2A4A]/80 bg-[#0C1528] shadow-2xl animate-[modalFadeIn_0.2s_ease-out]">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between border-b border-[#1E2A4A]/60 px-7 py-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Detalle de Novedad
              </h2>
              {config.critical && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold tracking-wide text-emerald-400 ring-1 ring-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REQUIERE ATENCIÓN
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 font-mono">
              {formatDateTime(incident.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300 cursor-pointer"
            aria-label="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ─── Body: Two columns ─── */}
        <div className="grid grid-cols-1 gap-6 px-7 py-6 md:grid-cols-[1fr_280px]">

          {/* Left Column: Report Data */}
          <div className="space-y-4">
            <DataRow label="Cliente / Propiedad" value={incident.propertyName || '—'} />
            <DataRow label="Puesto Comercial" value={incident.stationName || '—'} />
            <DataRow label="Agente que Reporta" value={incident.agentName || '—'} />
            <DataRow label="Tipo de Incidencia" value={incident.incidentType || 'Novedad de Campo'} />

            <div className="pt-2">
              <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase mb-2">
                Descripción
              </p>
              <div className="rounded-xl border border-[#1E2A4A]/60 bg-[#0A1020] px-5 py-4">
                <p className="text-sm leading-relaxed text-zinc-200">
                  {incident.refinedText}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Evidence */}
          <div className="flex flex-col">
            <p className="text-[11px] font-medium tracking-widest text-zinc-500 uppercase mb-3">
              Evidencia Fotográfica
            </p>
            <div className="flex-1 rounded-xl border border-[#1E2A4A]/60 bg-[#0A1020] overflow-hidden min-h-[200px] flex items-center justify-center">
              {incident.hasImage && incident.imageUrl ? (
                <div className="relative w-full h-full">
                  {!imageLoaded && <ImageSkeleton />}
                  <img
                    src={incident.imageUrl}
                    alt="Evidencia del incidente"
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 px-4 text-center">
                  <NoImageIcon />
                  <p className="text-xs text-zinc-600">
                    Sin evidencia fotográfica adjunta
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer: Actions ─── */}
        <div className="flex items-center justify-end gap-3 border-t border-[#1E2A4A]/60 px-7 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#1E2A4A] bg-[#111B2E] px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-[#1A2744] hover:text-white cursor-pointer"
          >
            Cerrar / Archivar
          </button>
          <button
            onClick={handleGoToHistory}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/30 cursor-pointer"
          >
            Ir al Historial
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <p className="w-[140px] shrink-0 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function ImageSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0A1020]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-zinc-800" />
        <div className="h-2 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="h-2 w-16 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function NoImageIcon() {
  return (
    <svg className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  );
}
