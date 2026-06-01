'use client';

import { useState, useCallback, useRef } from 'react';
import { compressImage, isImageFile } from './compress-image';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface FileUploadProps {
  bucket: string;
  basePath: string;
  label?: string;
  accept?: string;
  onUploaded: (path: string) => void;
}

export function FileUpload({
  bucket,
  basePath,
  label = 'Adjuntar archivo',
  accept = '.pdf,.jpg,.jpeg,.png,.webp',
  onUploaded,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);
    setFileName(file.name);

    try {
      let uploadBlob: Blob = file;
      let uploadName = file.name;

      if (isImageFile(file)) {
        setProgress(5);
        const result = await compressImage(file, (pct) => setProgress(Math.round(pct * 0.6)));
        uploadBlob = result.blob;
        const ext = file.type === 'image/png' ? 'webp' : file.name.split('.').pop() ?? 'jpg';
        uploadName = `${Date.now()}.${ext}`;
      } else {
        setProgress(30);
        uploadName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      }

      setProgress(65);

      const path = `${basePath}/${uploadName}`;
      const supabase = getSupabaseBrowserClient();
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, uploadBlob, { contentType: uploadBlob.type });

      if (uploadErr) {
        setError('Error al subir archivo');
        setUploading(false);
        return;
      }

      setProgress(100);
      onUploaded(path);

      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 800);
    } catch {
      setError('Error al procesar archivo');
      setUploading(false);
    }

    if (inputRef.current) inputRef.current.value = '';
  }, [bucket, basePath, onUploaded]);

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
        id={`upload-${basePath.replace(/\//g, '-')}`}
      />
      <label
        htmlFor={`upload-${basePath.replace(/\//g, '-')}`}
        className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
          uploading
            ? 'border-lime-500/30 bg-lime-500/5 text-lime-400'
            : fileName
              ? 'border-lime-500/20 bg-lime-500/5 text-lime-400'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
        }`}
      >
        {uploading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lime-500/30 border-t-lime-500" />
            <span>Procesando... {progress}%</span>
          </>
        ) : fileName ? (
          <>
            <CheckSvg />
            <span className="truncate">{fileName}</span>
          </>
        ) : (
          <>
            <UploadSvg />
            <span>{label}</span>
          </>
        )}
      </label>
      {uploading && (
        <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-1 rounded-full bg-lime-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function UploadSvg() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function CheckSvg() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

