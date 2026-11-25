import {
  Check,
  Copy,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { MediaAsset } from '../types';

export interface StoredMediaFile extends Partial<MediaAsset> {
  name: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

interface MyStorageModalProps {
  open: boolean;
  onClose: () => void;
  onSelect?: (url: string) => void;
  defaultCategory?: string;
  darkMode?: boolean;
  title?: string;
}

export function MyStorageModal({
  open,
  onClose,
  onSelect,
  defaultCategory = 'general',
  darkMode = false,
  title = 'My Storage · Uploaded Pictures',
}: MyStorageModalProps) {
  const { user, apiFetch } = useAuth();
  const uploadId = useId();
  const [files, setFiles] = useState<StoredMediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ files: StoredMediaFile[] }>('/api/portal/uploads');
      setFiles(res.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load My Storage.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (open) {
      void loadFiles();
    }
  }, [open, loadFiles]);

  const uploadFile = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
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
      const res = await apiFetch<{ url: string; asset?: StoredMediaFile }>('/api/portal/upload-image', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl,
          originalName: file.name,
          category: defaultCategory,
        }),
      });
      await loadFiles();
      if (onSelect && res.url) {
        onSelect(res.url);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (confirmDeleteName !== filename) {
      setConfirmDeleteName(filename);
      return;
    }
    setConfirmDeleteName(null);
    setError(null);
    try {
      await apiFetch(`/api/portal/uploads/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      setFiles((prev) => prev.filter((f) => f.name !== filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete image.');
    }
  };

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((f) => {
      const matchesCat =
        categoryFilter === 'all' || (f.category ?? 'general') === categoryFilter;
      const matchesQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.originalName ?? '').toLowerCase().includes(q) ||
        (f.uploadedByName ?? '').toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [files, search, categoryFilter]);

  const totalSizeKb = useMemo(
    () => Math.round(files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0) / 1024),
    [files]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
    >
      <div
        className={`flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border shadow-2xl ${
          darkMode
            ? 'border-[#25365E] bg-[#0F1B3B] text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${
            darkMode ? 'border-[#25365E]' : 'border-slate-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <HardDrive className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold">{title}</h2>
              <p className="tabular-nums text-[11px] opacity-70">
                {files.length} stored {files.length === 1 ? 'picture' : 'pictures'} ·{' '}
                {totalSizeKb >= 1024
                  ? `${(totalSizeKb / 1024).toFixed(1)} MB`
                  : `${totalSizeKb} KB`}{' '}
                used in My Storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close My Storage"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Upload Dropzone & Filter Bar */}
        <div
          className={`space-y-3 border-b px-5 py-4 ${
            darkMode ? 'border-[#25365E] bg-[#132043]/60' : 'border-slate-100 bg-slate-50/70'
          }`}
        >
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
              if (dropped) void uploadFile(dropped);
            }}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed px-4 py-3 transition-colors ${
              dragOver
                ? 'border-sky-500 bg-sky-500/10'
                : darkMode
                  ? 'border-[#2B4073] bg-[#0F1B3B]'
                  : 'border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-xs font-extrabold">
                  {uploading
                    ? 'Saving image to My Storage...'
                    : 'Drag & drop an image from your device, or browse'}
                </p>
                <p className="text-[11px] opacity-65">
                  PNG, JPG, WEBP, GIF up to 5 MB · Saved permanently in My Storage
                </p>
              </div>
            </div>
            <label
              htmlFor={uploadId}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Choose from Device</span>
              <input
                id={uploadId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void uploadFile(file);
                }}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 opacity-50" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search saved images..."
                className={`w-full rounded-xl border py-1.5 pl-8 pr-3 text-xs focus:outline-none ${
                  darkMode
                    ? 'border-[#25365E] bg-[#0F1B3B] text-white placeholder:text-slate-400'
                    : 'border-slate-200 bg-white text-slate-900'
                }`}
              />
            </div>

            <select
              aria-label="Filter by image category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                darkMode
                  ? 'border-[#25365E] bg-[#0F1B3B] text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <option value="all">All Categories</option>
              <option value="avatar">Profile Photos</option>
              <option value="course">Course Media</option>
              <option value="branch">Campus Branches</option>
              <option value="assignment">Assignments</option>
              <option value="community">Community</option>
              <option value="cms">CMS & Banners</option>
              <option value="general">General</option>
            </select>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-xs opacity-70">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading My Storage...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 py-14 text-center">
              <FolderOpen className="h-8 w-8 opacity-40" />
              <p className="mt-2 text-xs font-bold opacity-80">
                No pictures found in My Storage
              </p>
              <p className="mt-1 text-[11px] opacity-60">
                Upload a photo from your device above to save and reuse it anywhere.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filteredFiles.map((file) => {
                const canDelete =
                  user?.role === 'admin' || file.uploadedByUserId === user?.id;
                const confirming = confirmDeleteName === file.name;
                return (
                  <div
                    key={file.name}
                    className={`group flex flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-md ${
                      darkMode
                        ? 'border-[#25365E] bg-[#132043]'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="relative h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <img
                        src={file.url}
                        alt={file.originalName || file.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">
                        {file.category || 'image'}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-2.5 text-[11px]">
                      <div>
                        <p className="truncate font-bold" title={file.originalName || file.name}>
                          {file.originalName || file.name}
                        </p>
                        <p className="tabular-nums mt-0.5 text-[10px] opacity-65">
                          {Math.max(1, Math.round((file.sizeBytes || 0) / 1024))} KB ·{' '}
                          {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="mt-2.5 flex items-center gap-1">
                        {onSelect ? (
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(file.url);
                              onClose();
                            }}
                            className="flex-1 rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-700"
                          >
                            Use Photo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(file.url).catch(() => {});
                              setCopiedUrl(file.url);
                              window.setTimeout(() => setCopiedUrl(null), 1500);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-[#25365E] dark:hover:bg-white/10"
                          >
                            {copiedUrl === file.url ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy URL</span>
                              </>
                            )}
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(file.name)}
                            aria-label={`Delete ${file.originalName || file.name}`}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                              confirming
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {confirming ? 'Sure?' : <Trash2 className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between border-t px-5 py-3 text-[11px] opacity-75 ${
            darkMode ? 'border-[#25365E]' : 'border-slate-100'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Images are stored locally on server storage (/uploads)</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300/70 px-3 py-1 font-bold hover:bg-slate-100 dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
