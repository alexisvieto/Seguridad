import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NexGuard360 — Seguridad Operativa y Control 360';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060A14',
          position: 'relative',
        }}
      >
        {/* Glow blob */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '55%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(132, 204, 22, 0.12)',
            filter: 'blur(80px)',
          }}
        />

        {/* Shield icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'rgba(132, 204, 22, 0.10)',
            border: '2px solid rgba(132, 204, 22, 0.30)',
            marginBottom: 32,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#84CC16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <circle cx="12" cy="12" r="3" fill="none" stroke="#84CC16" strokeWidth="1.5" />
            <line x1="12" y1="7" x2="12" y2="9" />
            <line x1="12" y1="15" x2="12" y2="17" />
            <line x1="7" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="17" y2="12" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 0,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#F5F7FA',
              letterSpacing: '-2px',
              fontFamily: 'system-ui',
            }}
          >
            NEXGUARD
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#84CC16',
              letterSpacing: '-2px',
              fontFamily: 'system-ui',
            }}
          >
            360
          </span>
        </div>

        {/* Slogan */}
        <p
          style={{
            fontSize: 24,
            color: '#7B8FAB',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            fontFamily: 'system-ui',
            fontWeight: 400,
            marginBottom: 40,
          }}
        >
          Seguridad Operativa y Control 360
        </p>

        {/* Tagline */}
        <p
          style={{
            fontSize: 20,
            color: '#4D5B73',
            fontFamily: 'system-ui',
            fontWeight: 400,
          }}
        >
          Sistema operativo para agencias de seguridad privada
        </p>

        {/* URL */}
        <p
          style={{
            position: 'absolute',
            bottom: 32,
            fontSize: 16,
            color: '#84CC16',
            letterSpacing: '2px',
            fontFamily: 'system-ui',
          }}
        >
          www.nexguard360.com
        </p>
      </div>
    ),
    { ...size },
  );
}
