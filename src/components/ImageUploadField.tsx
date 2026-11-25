import { HardDrive, Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MyStorageModal } from './MyStorageModal';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  category?: 'avatar' | 'branch' | 'course' | 'assignment' | 'community' | 'cms' | 'general';
  darkMode?: boolean;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder = '/uploads/... or upload from device',
  category = 'general',
  darkMode = false,
}: ImageUploadFieldProps) {
  const { user, apiFetch } = useAuth();
  const inputId = useId();
  const fileId = useId();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const uploadSelectedFile = async (file: File) => {
    setErr(null);
    if (file.size > 5 * 1024 * 1024) {
      setErr('Image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read selected file.'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ url: string }>('/api/portal/upload-image', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          originalName: file.name,
          category,
        }),
      });
      onChange(res.url);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadSelectedFile(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className={`block text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}
        >
          {label}
        </label>
        <span className="text-[10px] font-medium text-slate-400">
          Drop image or pick from My Storage
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) void uploadSelectedFile(dropped);
        }}
        className={`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 transition-colors ${
          dragOver
            ? 'border-sky-500 bg-sky-50/70'
            : darkMode
              ? 'border-[#25365E] bg-[#132043]'
              : 'border-slate-200 bg-slate-50/70'
        }`}
      >
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-400">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}

        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`min-w-[140px] flex-1 rounded-lg border px-2.5 py-2 text-xs ${
            darkMode
              ? 'border-[#25365E] bg-[#0F1B3B] text-white placeholder:text-slate-400'
              : 'border-slate-300 bg-white text-slate-900'
          }`}
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Clear ${label}`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <label
          htmlFor={fileId}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          <span>{uploading ? 'Saving...' : 'Device Upload'}</span>
          <input
            id={fileId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>

        {user && (
          <button
            type="button"
            onClick={() => setStorageOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>My Storage</span>
          </button>
        )}
      </div>

      {err && <p className="text-[11px] font-medium text-rose-600">{err}</p>}

      {user && (
        <MyStorageModal
          open={storageOpen}
          onClose={() => setStorageOpen(false)}
          onSelect={(url) => onChange(url)}
          defaultCategory={category}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
