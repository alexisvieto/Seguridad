'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertLevel = 'green' | 'yellow' | 'red';

interface CourseRow {
  id: string;
  name: string;
  validityMonths: number;
}

interface AgentCert {
  courseId: string;
  courseName: string;
  expiryDate: string;
  level: AlertLevel;
  daysRemaining: number;
}

interface AgentRow {
  userId: string;
  name: string;
  certs: AgentCert[];
}

interface GapRow {
  stationName: string;
  propertyName: string;
  agentName: string;
  missingCourse: string;
}

interface Toast {
  type: 'success' | 'error';
  msg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function level(dateStr: string): AlertLevel {
  const d = daysUntil(dateStr);
  if (d <= 0) return 'red';
  if (d <= 30) return 'yellow';
  return 'green';
}

const levelDot: Record<AlertLevel, string> = {
  green: 'bg-lime-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

const levelBadge: Record<AlertLevel, string> = {
  green: 'bg-lime-500/15 text-lime-400',
  yellow: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
};

const levelLabel: Record<AlertLevel, string> = {
  green: 'Vigente',
  yellow: 'Por vencer',
  red: 'Vencido',
};

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CapacitacionesPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalAgent, setModalAgent] = useState('');
  const [modalCourse, setModalCourse] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [modalGrade, setModalGrade] = useState('');
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Create course
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseValidity, setNewCourseValidity] = useState('12');
  const [courseLoading, setCourseLoading] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------
  // Load data
  // -------------------------------------------------------------------

  const loadData = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    const { data: tenant } = await supabase
      .from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) return;
    setTenantId(tenant.id);

    const [coursesRes, logsRes, membRes, reqRes] = await Promise.all([
      supabase.from('training_courses').select('id, course_name, validity_months').eq('tenant_id', tenant.id).order('course_name'),
      supabase.from('agent_training_logs').select('user_id, course_id, expiry_date, training_courses(course_name)').eq('tenant_id', tenant.id),
      supabase.from('memberships').select('user_id').eq('tenant_id', tenant.id),
      supabase.from('station_required_trainings').select('work_station_id, course_id, training_courses(course_name), work_stations(name, properties_ph(name))').eq('tenant_id', tenant.id),
    ]);

    setCourses((coursesRes.data ?? []).map((c) => ({ id: c.id, name: c.course_name, validityMonths: c.validity_months })));

    // Build profile name map
    const memberIds = (membRes.data ?? []).map((m) => m.user_id);
    const { data: profiles } = memberIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', memberIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    // Build agent cert matrix
    const logsByUser = new Map<string, AgentCert[]>();
    for (const log of logsRes.data ?? []) {
      const arr = logsByUser.get(log.user_id) ?? [];
      arr.push({
        courseId: log.course_id,
        courseName: log.training_courses?.course_name ?? '',
        expiryDate: log.expiry_date,
        level: level(log.expiry_date),
        daysRemaining: daysUntil(log.expiry_date),
      });
      logsByUser.set(log.user_id, arr);
    }

    const agentRows: AgentRow[] = memberIds.map((uid) => ({
      userId: uid,
      name: nameMap.get(uid) ?? 'Agente',
      certs: logsByUser.get(uid) ?? [],
    }));
    setAgents(agentRows);

    // Build gaps: stations where assigned agents lack required certs
    const today = new Date().toISOString().split('T')[0]!;
    const gapRows: GapRow[] = [];

    // Get active shifts to know who is assigned where
    const { data: activeShifts } = await supabase
      .from('agent_shifts')
      .select('user_id, work_station_id')
      .eq('tenant_id', tenant.id)
      .is('clock_out', null);

    for (const req of reqRes.data ?? []) {
      const stationAgents = (activeShifts ?? []).filter((s) => s.work_station_id === req.work_station_id);
      for (const shift of stationAgents) {
        const agentCerts = logsByUser.get(shift.user_id) ?? [];
        const hasValid = agentCerts.some((c) => c.courseId === req.course_id && c.expiryDate >= today);
        if (!hasValid) {
          gapRows.push({
            stationName: req.work_stations?.name ?? '',
            propertyName: req.work_stations?.properties_ph?.name ?? '',
            agentName: nameMap.get(shift.user_id) ?? 'Agente',
            missingCourse: req.training_courses?.course_name ?? '',
          });
        }
      }
    }
    setGaps(gapRows);

    setIsLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  // -------------------------------------------------------------------
  // Submit training
  // -------------------------------------------------------------------

  const submitTraining = useCallback(async () => {
    if (!tenantId || !modalAgent || !modalCourse || !modalDate) return;
    setModalLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();

      // Upload certificate if provided
      let certUrl: string | null = null;
      if (modalFile) {
        const ext = modalFile.name.split('.').pop() ?? 'pdf';
        const path = `${tenantId}/${modalAgent}/certificados/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('hr-documents')
          .upload(path, modalFile, { contentType: modalFile.type });

        if (uploadErr) {
          setToast({ type: 'error', msg: 'Error al subir el certificado' });
          setModalLoading(false);
          return;
        }

        certUrl = path;
      }

      const { error } = await supabase.from('agent_training_logs').insert({
        tenant_id: tenantId,
        user_id: modalAgent,
        course_id: modalCourse,
        completion_date: new Date().toISOString().split('T')[0]!,
        expiry_date: modalDate,
        grade: modalGrade || null,
        certificate_pdf_url: certUrl,
      });

      if (error) throw error;

      setToast({ type: 'success', msg: 'Capacitación registrada correctamente' });
      setShowModal(false);
      setModalAgent('');
      setModalCourse('');
      setModalDate('');
      setModalGrade('');
      setModalFile(null);
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al registrar la capacitación' });
    } finally {
      setModalLoading(false);
    }
  }, [tenantId, modalAgent, modalCourse, modalDate, modalGrade, modalFile, courses, loadData]);

  const handleCreateCourse = useCallback(async () => {
    if (!tenantId || !newCourseName.trim()) return;
    setCourseLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from('training_courses').insert({
        tenant_id: tenantId,
        course_name: newCourseName.trim(),
        description: newCourseDesc.trim() || null,
        validity_months: parseInt(newCourseValidity) || 12,
      });
      if (error) throw error;
      setToast({ type: 'success', msg: 'Curso agregado' });
      setShowCourseForm(false);
      setNewCourseName('');
      setNewCourseDesc('');
      setNewCourseValidity('12');
      loadData();
    } catch {
      setToast({ type: 'error', msg: 'Error al crear curso' });
    } finally {
      setCourseLoading(false);
    }
  }, [tenantId, newCourseName, newCourseDesc, newCourseValidity, loadData]);

  // -------------------------------------------------------------------
  // KPIs
  // -------------------------------------------------------------------

  const certifiedAgents = agents.filter((a) => a.certs.some((c) => c.level === 'green')).length;
  const expiringCerts = agents.reduce((sum, a) => sum + a.certs.filter((c) => c.level === 'yellow').length, 0);

  // -------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-lime-500" />
          <p className="text-sm tracking-widest text-zinc-500 uppercase">Cargando capacitaciones...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex h-dvh flex-col bg-[#0A0E1A] text-zinc-100 overflow-hidden">

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-3">
        <div className="flex items-center gap-3">
          <CertIcon />
          <h1 className="text-lg font-semibold tracking-wide">Matriz de Competencias</h1>
          <span className="text-sm text-zinc-500">{tenantSlug}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCourseForm(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer">
            <PlusIcon /> Agregar Curso
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lime-500 cursor-pointer">
            <PlusIcon /> Registrar Capacitación
          </button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 border-b border-zinc-800/60 px-6 py-4">
        <div className="rounded-xl border border-lime-500/20 bg-lime-500/8 px-5 py-4">
          <p className="text-xs font-medium tracking-widest text-lime-500/70 uppercase">Agentes Certificados</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-lime-400">{certifiedAgents}</p>
          <p className="mt-1 text-xs text-zinc-500">de {agents.length} agentes</p>
        </div>

        <div className={`rounded-xl border px-5 py-4 ${expiringCerts > 0 ? 'border-amber-500/20 bg-amber-500/8' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
          <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Alertas de Vencimiento</p>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${expiringCerts > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>{expiringCerts}</p>
          <p className="mt-1 text-xs text-zinc-500">{expiringCerts > 0 ? 'cursos por vencer en 30 días' : 'sin alertas'}</p>
        </div>

        <div className={`rounded-xl border px-5 py-4 ${gaps.length > 0 ? 'border-red-500/20 bg-red-500/8' : 'border-zinc-700/30 bg-zinc-800/40'}`}>
          <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">Brechas de Seguridad</p>
          <p className={`mt-1 text-4xl font-bold tabular-nums ${gaps.length > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-600'}`}>{gaps.length}</p>
          <p className="mt-1 text-xs text-zinc-500">{gaps.length > 0 ? 'agentes sin cert obligatoria en puesto' : 'todos cumplen'}</p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden">

        {/* AGENT MATRIX */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="mb-4 text-xs font-semibold tracking-widest text-zinc-400 uppercase">
            Matriz de Idoneidad por Agente
          </h2>

          {agents.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-600">No hay agentes registrados</p>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.userId}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800/40 bg-zinc-800/20 px-5 py-4 hover:bg-zinc-800/30 transition-colors"
                >
                  {/* Name */}
                  <div className="w-48 shrink-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{agent.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {agent.certs.length} curso{agent.certs.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Cert badges */}
                  <div className="flex flex-1 flex-wrap gap-2">
                    {agent.certs.length === 0 ? (
                      <span className="text-xs text-zinc-600 italic">Sin capacitaciones registradas</span>
                    ) : (
                      agent.certs.map((cert) => (
                        <div
                          key={`${agent.userId}-${cert.courseId}-${cert.expiryDate}`}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${levelBadge[cert.level]}`}
                          title={`${cert.courseName} — Vence: ${formatDate(cert.expiryDate)} (${cert.daysRemaining > 0 ? cert.daysRemaining + 'd' : 'VENCIDO'})`}
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${levelDot[cert.level]}`} />
                          <span className="truncate max-w-[140px]">{cert.courseName}</span>
                          <span className="text-[10px] opacity-70">{levelLabel[cert.level]}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GAPS TABLE */}
          {gaps.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-xs font-semibold tracking-widest text-red-400 uppercase">
                Brechas de Seguridad Activas
              </h2>
              <div className="overflow-x-auto rounded-xl border border-red-500/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-500/10 bg-red-500/5">
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-red-400/70 uppercase">Puesto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-red-400/70 uppercase">Propiedad</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-red-400/70 uppercase">Agente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-red-400/70 uppercase">Curso Faltante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((gap, i) => (
                      <tr key={i} className="border-b border-red-500/10 hover:bg-red-500/5 transition-colors">
                        <td className="px-4 py-3 text-zinc-200">{gap.stationName}</td>
                        <td className="px-4 py-3 text-zinc-400">{gap.propertyName}</td>
                        <td className="px-4 py-3 text-zinc-200">{gap.agentName}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400">
                            {gap.missingCourse}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* REGISTER TRAINING MODAL                                       */}
      {/* ============================================================ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100">Registrar Capacitación</h3>

            <div className="mt-5 space-y-4">
              {/* Agent */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Agente</span>
                <select value={modalAgent} onChange={(e) => setModalAgent(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                  <option value="">Seleccionar agente...</option>
                  {agents.map((a) => (<option key={a.userId} value={a.userId}>{a.name}</option>))}
                </select>
              </label>

              {/* Course + add inline */}
              <div>
                <span className="text-xs font-medium text-zinc-400">Curso</span>
                <div className="flex gap-2 mt-1">
                  <select value={modalCourse} onChange={(e) => setModalCourse(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none cursor-pointer">
                    <option value="">Seleccionar curso...</option>
                    {courses.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.validityMonths} meses)</option>))}
                  </select>
                  <button type="button" onClick={() => setShowCourseForm(true)}
                    className="rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-xs font-medium text-lime-400 hover:border-lime-500/30 cursor-pointer whitespace-nowrap">+ Nuevo</button>
                </div>
              </div>

              {/* Expiry date */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Fecha de Vencimiento</span>
                <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
                <p className="mt-1 text-[10px] text-amber-400/70">El sistema enviará una alerta 60 días antes de la fecha de vencimiento.</p>
              </label>

              {/* Grade */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Calificación (opcional)</span>
                <input type="text" value={modalGrade} onChange={(e) => setModalGrade(e.target.value)}
                  placeholder="Ej: Aprobado, 95/100" maxLength={50}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              </label>

              {/* Certificate */}
              <label className="block">
                <span className="text-xs font-medium text-zinc-400">Adjuntar Certificado (PDF o imagen)</span>
                <input type="file" accept=".pdf,image/jpeg,image/png"
                  onChange={(e) => setModalFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-400 min-h-[48px] file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:text-zinc-300 file:cursor-pointer cursor-pointer" />
              </label>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 cursor-pointer min-h-[48px]"
              >
                Cancelar
              </button>
              <button
                onClick={submitTraining}
                disabled={!modalAgent || !modalCourse || !modalDate || modalLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]"
              >
                {modalLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  'Registrar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE COURSE MODAL */}
      {showCourseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCourseForm(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-700/50 bg-[#12162A] p-6 shadow-2xl space-y-5">
            <h3 className="text-lg font-semibold text-zinc-100">Agregar Curso</h3>
            <p className="text-xs text-zinc-500">Los cursos se crean una vez y quedan disponibles para asignar a cualquier agente.</p>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Nombre del Curso</span>
              <input type="text" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Ej: Manejo de Armas de Fuego"
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Descripción (opcional)</span>
              <input type="text" value={newCourseDesc} onChange={(e) => setNewCourseDesc(e.target.value)}
                placeholder="Ej: Certificación DIASP para porte y uso"
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Vigencia (meses)</span>
              <input type="number" value={newCourseValidity} onChange={(e) => setNewCourseValidity(e.target.value)} min="1" max="120"
                className="mt-1 block w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 min-h-[48px] focus:border-lime-500 focus:outline-none" />
              <p className="mt-1 text-[10px] text-zinc-600">Después de este período, la certificación se marca como vencida.</p>
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowCourseForm(false)}
                className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-700 cursor-pointer min-h-[48px]">Cancelar</button>
              <button onClick={handleCreateCourse} disabled={courseLoading || !newCourseName.trim()}
                className="flex-1 rounded-xl bg-lime-600 px-4 py-3 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-40 cursor-pointer min-h-[48px]">
                {courseLoading ? '...' : 'Crear Curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-[slideUp_0.3s_ease-out] ${
          toast.type === 'success' ? 'bg-lime-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CertIcon() {
  return (
    <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
