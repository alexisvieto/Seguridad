'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShiftState {
  shiftId: string;
  stationId: string;
  stationName: string;
  clockIn: string;
}

interface IncidentEntry {
  id: string;
  rawText: string;
  refinedText: string | null;
  time: string;
}

interface ApiError {
  error: { code: string; message: string };
}

type LoadingState = 'idle' | 'gps' | 'scanning' | 'sending' | 'refining';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function getGpsPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu dispositivo no soporta geolocalización'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PuestoPage() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  // State
  const [shift, setShift] = useState<ShiftState | null>(null);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isOnDuty = shift !== null;

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // -------------------------------------------------------------------
  // QR Scan + Clock-in
  // -------------------------------------------------------------------

  const handleClockIn = useCallback(async () => {
    try {
      setLoading('gps');

      const position = await getGpsPosition();

      setLoading('scanning');

      // TODO: Replace with real QR scanner output
      const simulatedQrPayload = {
        work_station_id: 'PLACEHOLDER_STATION_ID',
        qr_code_token: 'PLACEHOLDER_QR_TOKEN',
      };

      const res = await fetch('/api/shift/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_station_id: simulatedQrPayload.work_station_id,
          qr_code_token: simulatedQrPayload.qr_code_token,
          gps: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error.message);
      }

      const { data } = (await res.json()) as {
        data: { shift_id: string; clock_in: string; work_station_id: string };
      };

      setShift({
        shiftId: data.shift_id,
        stationId: data.work_station_id,
        stationName: 'Puesto asignado',
        clockIn: data.clock_in,
      });

      setToast({ type: 'success', message: 'Entrada registrada correctamente' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrar entrada';
      setToast({ type: 'error', message });
    } finally {
      setLoading('idle');
    }
  }, []);

  // -------------------------------------------------------------------
  // Incident report
  // -------------------------------------------------------------------

  const handleSendReport = useCallback(async () => {
    if (!shift || !reportText.trim()) return;

    try {
      setLoading('refining');

      const res = await fetch('/api/incidents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_station_id: shift.stationId,
          raw_text: reportText.trim(),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error.message);
      }

      const { data } = (await res.json()) as {
        data: {
          incident_id: string;
          raw_text: string;
          ai_refined_text: string | null;
          created_at: string;
        };
      };

      setIncidents((prev) => [
        {
          id: data.incident_id,
          rawText: data.raw_text,
          refinedText: data.ai_refined_text,
          time: data.created_at,
        },
        ...prev,
      ]);

      setReportText('');
      setToast({ type: 'success', message: 'Novedad registrada y procesada por IA' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar reporte';
      setToast({ type: 'error', message });
    } finally {
      setLoading('idle');
    }
  }, [shift, reportText]);

  // -------------------------------------------------------------------
  // Voice dictation (Web Speech API)
  // -------------------------------------------------------------------

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setToast({ type: 'error', message: 'Tu navegador no soporta dictado por voz' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-419';
    recognition.continuous = true;
    recognition.interimResults = true;

    const baseTextRef = { value: reportText };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.[0]) {
          if (result.isFinal) {
            final += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }
      }
      if (final) {
        baseTextRef.value = baseTextRef.value + final;
        setReportText(baseTextRef.value);
      } else {
        setReportText(baseTextRef.value + interim);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setToast({ type: 'error', message: 'Error en el reconocimiento de voz' });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, reportText]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-900 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {tenantSlug}
            </p>
            {isOnDuty && (
              <p className="text-xs text-emerald-400">
                En turno desde {formatTime(shift.clockIn)}
              </p>
            )}
          </div>
          <div
            className={`h-3 w-3 shrink-0 rounded-full ${
              isOnDuty ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
            }`}
            title={isOnDuty ? 'En turno' : 'Fuera de turno'}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col gap-4 p-4 pb-8">

        {/* ============================================================ */}
        {/* OFF DUTY — Clock-in panel                                     */}
        {/* ============================================================ */}
        {!isOnDuty && (
          <section className="flex flex-1 flex-col items-center justify-center gap-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-100">
              <svg
                className="h-12 w-12 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.5h16.5M3.75 4.5v15a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-15M3.75 4.5l1.072-2.143A1.5 1.5 0 016.165 1.5h11.67a1.5 1.5 0 011.343.857L20.25 4.5M9 9h.008M15 9h.008M9 13.5h6"
                />
              </svg>
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold text-zinc-900">
                Iniciar turno
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Escanea el código QR del puesto y activa tu GPS
              </p>
            </div>

            <button
              onClick={handleClockIn}
              disabled={loading !== 'idle'}
              className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-md transition-colors active:bg-emerald-700 disabled:opacity-60"
            >
              {loading === 'idle' && (
                <>
                  <QrIcon />
                  Escanear QR de Entrada
                </>
              )}
              {loading === 'gps' && (
                <>
                  <Spinner />
                  Obteniendo ubicación...
                </>
              )}
              {loading === 'scanning' && (
                <>
                  <Spinner />
                  Registrando entrada...
                </>
              )}
            </button>
          </section>
        )}

        {/* ============================================================ */}
        {/* ON DUTY — Report + incident log                               */}
        {/* ============================================================ */}
        {isOnDuty && (
          <>
            {/* Report form */}
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Reportar novedad
              </h2>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describa la novedad o dicte por voz..."
                  rows={4}
                  maxLength={5000}
                  disabled={loading === 'refining'}
                  className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                />

                {/* Mic button */}
                <button
                  onClick={toggleVoice}
                  type="button"
                  className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-zinc-100 text-zinc-500 active:bg-zinc-200'
                  }`}
                  title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                >
                  <MicIcon />
                </button>
              </div>

              {isListening && (
                <p className="mt-2 text-xs text-red-500 animate-pulse">
                  Escuchando... toca el micrófono para detener
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-400">
                  {reportText.length}/5000
                </span>

                <button
                  onClick={handleSendReport}
                  disabled={loading === 'refining' || !reportText.trim()}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors active:bg-zinc-800 disabled:opacity-40"
                >
                  {loading === 'refining' ? (
                    <>
                      <Spinner />
                      <span className="text-xs">La IA está puliendo su informe...</span>
                    </>
                  ) : (
                    <>
                      <SendIcon />
                      Enviar Reporte con IA
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Incident log */}
            <section className="flex-1 rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Bitácora del turno
                {incidents.length > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                    {incidents.length}
                  </span>
                )}
              </h2>

              {incidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                    <ClipboardIcon />
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    Sin novedades registradas
                  </p>
                  <p className="text-xs text-zinc-300">
                    Las novedades enviadas aparecerán aquí
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {incidents.map((incident) => (
                    <li
                      key={incident.id}
                      className="rounded-xl border border-zinc-100 bg-zinc-50 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-400">
                          {formatTime(incident.time)}
                        </span>
                        {incident.refinedText && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            IA
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-zinc-800">
                        {incident.refinedText ?? incident.rawText}
                      </p>
                      {incident.refinedText && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600">
                            Ver texto original
                          </summary>
                          <p className="mt-1 text-xs leading-relaxed text-zinc-400 italic">
                            {incident.rawText}
                          </p>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm animate-[slideUp_0.3s_ease-out] rounded-xl px-4 py-3 text-center text-sm font-medium shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (keeps the page self-contained, no external deps)
// ---------------------------------------------------------------------------

function QrIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 13.5h3v3h3v3h-3v-3h-3v-3z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-7 w-7 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
