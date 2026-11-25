import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ClipboardList,
  ExternalLink,
  Eye,
  FileText,
  FolderPlus,
  GripVertical,
  Headphones,
  Layers,
  Lock,
  Pencil,
  Play,
  Plus,
  Radio,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { computeCurriculumHierarchy } from '../../lib/courseEnterprise';
import { reorderListItem, sanitizeSafeUrl, toSafeVideoEmbedUrl } from '../../lib/domain';
import type {
  Course,
  CourseBatch,
  CourseChapter,
  CourseLesson,
  CourseModule,
  CourseResource,
  LessonType,
  LiveClassStatus,
} from '../../types';

interface CurriculumBuilderModalProps {
  open: boolean;
  course: Course | null;
  batches: CourseBatch[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const LESSON_TYPES: { id: LessonType; label: string }[] = [
  { id: 'recorded', label: 'Recorded Video' },
  { id: 'video', label: 'HD Video Lesson' },
  { id: 'live', label: 'Live Class' },
  { id: 'text', label: 'Text Reading Lesson' },
  { id: 'audio', label: 'Audio / Listening Lesson' },
  { id: 'pdf_notes', label: 'PDF Notes' },
  { id: 'lecture_sheet', label: 'Lecture Sheet' },
  { id: 'document', label: 'Downloadable Document' },
  { id: 'external', label: 'External Learning Resource' },
  { id: 'quiz', label: 'Interactive Quiz' },
  { id: 'assignment', label: 'Assignment Task' },
  { id: 'practice_test', label: 'Practice Test' },
];

export function CurriculumBuilderModal({
  open,
  course,
  batches,
  onClose,
  onChanged,
  onNotify,
}: CurriculumBuilderModalProps) {
  const { apiFetch } = useAuth();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [chapters, setChapters] = useState<CourseChapter[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Module / Chapter quick creators
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [editingModTitle, setEditingModTitle] = useState('');
  const [addingChapterForModId, setAddingChapterForModId] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // Drag-and-drop state
  const [dragLessonId, setDragLessonId] = useState<string | null>(null);
  const [dragModuleId, setDragModuleId] = useState<string | null>(null);

  // Preview Lesson Modal
  const [previewLesson, setPreviewLesson] = useState<CourseLesson | null>(null);

  // Add / Edit Lesson Editor Modal inside Builder
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [lesTitle, setLesTitle] = useState('');
  const [lesType, setLesType] = useState<LessonType>('recorded');
  const [lesModuleId, setLesModuleId] = useState('');
  const [lesChapterId, setLesChapterId] = useState('');
  const [lesBatchId, setLesBatchId] = useState('');
  const [lesDuration, setLesDuration] = useState('30:00');
  const [lesVideoUrl, setLesVideoUrl] = useState('');
  const [lesAudioUrl, setLesAudioUrl] = useState('');
  const [lesTextContent, setLesTextContent] = useState('');
  const [lesSheetUrl, setLesSheetUrl] = useState('');
  const [lesExternalUrl, setLesExternalUrl] = useState('');
  const [lesLiveJoinUrl, setLesLiveJoinUrl] = useState('');
  const [lesLiveStatus, setLesLiveStatus] = useState<LiveClassStatus>('scheduled');
  const [lesScheduledAt, setLesScheduledAt] = useState('');
  const [lesSummary, setLesSummary] = useState('');
  const [lesFreePreview, setLesFreePreview] = useState(false);
  const [lesCompletionRequired, setLesCompletionRequired] = useState(true);
  const [lesSeqLock, setLesSeqLock] = useState(false);
  const [lesStatus, setLesStatus] = useState<'draft' | 'published'>('published');
  const [lesResources, setLesResources] = useState<CourseResource[]>([]);
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resKind, setResKind] = useState<CourseResource['kind']>('pdf');
  const [savingLesson, setSavingLesson] = useState(false);

  const loadCurriculum = useCallback(async () => {
    if (!open || !course) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        modules: CourseModule[];
        chapters: CourseChapter[];
        lessons: CourseLesson[];
      }>(`/api/portal/courses/${course.id}/curriculum`);
      setModules(res.modules ?? []);
      setChapters(res.chapters ?? []);
      setLessons(res.lessons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  }, [open, course, apiFetch]);

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  if (!open || !course) return null;

  const courseBatches = batches.filter((b) => b.courseId === course.id);
  const hierarchy = computeCurriculumHierarchy(course.id, modules, chapters, lessons, true);

  const persistReorder = async (
    nextModuleIds: string[],
    nextLessons: { id: string; moduleId?: string; chapterId?: string }[]
  ) => {
    await apiFetch(`/api/portal/courses/${course.id}/curriculum/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({
        moduleIds: nextModuleIds,
        lessonItems: nextLessons,
      }),
    });
    await loadCurriculum();
    await onChanged();
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    await apiFetch(`/api/portal/courses/${course.id}/modules`, {
      method: 'POST',
      body: JSON.stringify({ title: newModuleTitle.trim(), status: 'published' }),
    });
    setNewModuleTitle('');
    await loadCurriculum();
    await onChanged();
    onNotify('Module added.');
  };

  const handleRenameModule = async (modId: string) => {
    if (!editingModTitle.trim()) return;
    await apiFetch(`/api/portal/modules/${modId}`, {
      method: 'PUT',
      body: JSON.stringify({ title: editingModTitle.trim() }),
    });
    setEditingModId(null);
    await loadCurriculum();
    await onChanged();
    onNotify('Module renamed.');
  };

  const handleDeleteModule = async (modId: string) => {
    await apiFetch(`/api/portal/modules/${modId}`, { method: 'DELETE' });
    await loadCurriculum();
    await onChanged();
    onNotify('Module removed.');
  };

  const handleAddChapter = async (moduleId: string) => {
    if (!newChapterTitle.trim()) return;
    await apiFetch(`/api/portal/courses/${course.id}/chapters`, {
      method: 'POST',
      body: JSON.stringify({ moduleId, title: newChapterTitle.trim() }),
    });
    setAddingChapterForModId(null);
    setNewChapterTitle('');
    await loadCurriculum();
    await onChanged();
    onNotify('Chapter added.');
  };

  const handleDeleteChapter = async (chapId: string) => {
    await apiFetch(`/api/portal/chapters/${chapId}`, { method: 'DELETE' });
    await loadCurriculum();
    await onChanged();
    onNotify('Chapter removed.');
  };

  const handleDropLesson = async (
    targetLessonId: string | null,
    targetModuleId?: string,
    targetChapterId?: string
  ) => {
    if (!dragLessonId || dragLessonId === targetLessonId) {
      setDragLessonId(null);
      return;
    }
    const ordered = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
    const fromIdx = ordered.findIndex((l) => l.id === dragLessonId);
    if (fromIdx === -1) {
      setDragLessonId(null);
      return;
    }
    const [moved] = ordered.splice(fromIdx, 1);
    const updatedMoved = {
      ...moved,
      moduleId: targetModuleId ?? moved.moduleId,
      chapterId: targetChapterId !== undefined ? targetChapterId : moved.chapterId,
    };

    if (targetLessonId) {
      const toIdx = ordered.findIndex((l) => l.id === targetLessonId);
      ordered.splice(toIdx >= 0 ? toIdx : ordered.length, 0, updatedMoved);
    } else {
      ordered.push(updatedMoved);
    }

    setDragLessonId(null);
    await persistReorder(
      modules.map((m) => m.id),
      ordered.map((l) => ({
        id: l.id,
        moduleId: l.moduleId && !l.moduleId.startsWith('mod-virt-') ? l.moduleId : undefined,
        chapterId: l.chapterId,
      }))
    );
    onNotify('Curriculum lesson order saved.');
  };

  const handleDropModule = async (targetModuleId: string) => {
    if (!dragModuleId || dragModuleId === targetModuleId) {
      setDragModuleId(null);
      return;
    }
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const fromIdx = sorted.findIndex((m) => m.id === dragModuleId);
    const toIdx = sorted.findIndex((m) => m.id === targetModuleId);
    if (fromIdx === -1 || toIdx === -1) {
      setDragModuleId(null);
      return;
    }
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    setDragModuleId(null);
    await persistReorder(
      sorted.map((m) => m.id),
      lessons.map((l) => ({ id: l.id, moduleId: l.moduleId, chapterId: l.chapterId }))
    );
    onNotify('Module order updated.');
  };

  const handleMoveModuleStep = async (modId: string, dir: 'up' | 'down') => {
    const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = sorted.findIndex((m) => m.id === modId);
    const reordered = reorderListItem(sorted, idx, dir);
    await persistReorder(
      reordered.map((m) => m.id),
      lessons.map((l) => ({ id: l.id, moduleId: l.moduleId, chapterId: l.chapterId }))
    );
  };

  const handleMoveLessonStep = async (lessonId: string, dir: 'up' | 'down') => {
    const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = sorted.findIndex((l) => l.id === lessonId);
    const reordered = reorderListItem(sorted, idx, dir);
    await persistReorder(
      modules.map((m) => m.id),
      reordered.map((l) => ({ id: l.id, moduleId: l.moduleId, chapterId: l.chapterId }))
    );
  };

  const openLessonEditor = (
    les: CourseLesson | null,
    defaultModId = '',
    defaultChapId = ''
  ) => {
    setEditingLesson(les);
    if (les) {
      setLesTitle(les.title);
      setLesType(les.lessonType ?? 'recorded');
      setLesModuleId(les.moduleId ?? '');
      setLesChapterId(les.chapterId ?? '');
      setLesBatchId(les.batchId ?? '');
      setLesDuration(les.duration || '30:00');
      setLesVideoUrl(les.videoUrl || '');
      setLesAudioUrl(les.audioUrl || '');
      setLesTextContent(les.textContent || '');
      setLesSheetUrl(les.lectureSheetUrl || '');
      setLesExternalUrl(les.externalUrl || '');
      setLesLiveJoinUrl(les.liveJoinUrl || '');
      setLesLiveStatus(les.liveStatus ?? 'scheduled');
      setLesScheduledAt(les.scheduledAt || '');
      setLesSummary(les.sheetSummary || '');
      setLesFreePreview(Boolean(les.isFreePreview));
      setLesCompletionRequired(les.completionRequired !== false);
      setLesSeqLock(Boolean(les.sequentialLock));
      setLesStatus(les.status === 'draft' ? 'draft' : 'published');
      setLesResources(les.resources ?? []);
    } else {
      setLesTitle('');
      setLesType('recorded');
      setLesModuleId(defaultModId || modules[0]?.id || '');
      setLesChapterId(defaultChapId);
      setLesBatchId('');
      setLesDuration('30:00');
      setLesVideoUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setLesAudioUrl('');
      setLesTextContent('');
      setLesSheetUrl('');
      setLesExternalUrl('');
      setLesLiveJoinUrl('');
      setLesLiveStatus('scheduled');
      setLesScheduledAt('');
      setLesSummary('');
      setLesFreePreview(false);
      setLesCompletionRequired(true);
      setLesSeqLock(false);
      setLesStatus('published');
      setLesResources([]);
    }
    setLessonEditorOpen(true);
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lesTitle.trim()) return;
    setSavingLesson(true);
    try {
      const modObj = modules.find((m) => m.id === lesModuleId);
      const chapObj = chapters.find((ch) => ch.id === lesChapterId);
      const payload = {
        courseId: course.id,
        moduleId: modObj ? modObj.id : undefined,
        chapterId: chapObj ? chapObj.id : undefined,
        moduleName: modObj?.title || 'Module 1: Core Curriculum',
        chapterName: chapObj?.title || undefined,
        batchId: lesBatchId || null,
        lessonType: lesType,
        title: lesTitle.trim(),
        duration: lesDuration.trim() || '30:00',
        videoPreviewTitle: lesTitle.trim(),
        videoUrl: lesVideoUrl.trim(),
        audioUrl: lesAudioUrl.trim() || undefined,
        textContent: lesTextContent.trim() || undefined,
        lectureSheetUrl: lesSheetUrl.trim() || undefined,
        externalUrl: lesExternalUrl.trim() || undefined,
        resources: lesResources,
        liveJoinUrl: lesLiveJoinUrl.trim() || undefined,
        liveStatus: lesType === 'live' ? lesLiveStatus : undefined,
        scheduledAt: lesScheduledAt.trim() || undefined,
        sheetSummary: lesSummary.trim() || `${lesTitle.trim()} learning notes.`,
        isFreePreview: lesFreePreview,
        completionRequired: lesCompletionRequired,
        sequentialLock: lesSeqLock,
        status: lesStatus,
      };
      if (editingLesson) {
        await apiFetch(`/api/portal/lessons/${editingLesson.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify(`Lesson "${lesTitle.trim()}" updated.`);
      } else {
        await apiFetch('/api/portal/lessons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(`Lesson "${lesTitle.trim()}" added.`);
      }
      setLessonEditorOpen(false);
      await loadCurriculum();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson.');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    await apiFetch(`/api/portal/lessons/${id}`, { method: 'DELETE' });
    await loadCurriculum();
    await onChanged();
    onNotify('Lesson removed.');
  };

  const renderLessonRow = (les: CourseLesson) => {
    const lType = les.lessonType ?? 'recorded';
    return (
      <div
        key={les.id}
        draggable
        onDragStart={() => setDragLessonId(les.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.stopPropagation();
          void handleDropLesson(
            les.id,
            les.moduleId && !les.moduleId.startsWith('mod-virt-') ? les.moduleId : undefined,
            les.chapterId
          );
        }}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-xs transition-colors ${
          dragLessonId === les.id ? 'border-indigo-500 opacity-50' : 'border-slate-200 hover:border-indigo-300'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            {lType === 'live' ? (
              <Radio className="h-3.5 w-3.5 text-rose-600" />
            ) : lType === 'audio' ? (
              <Headphones className="h-3.5 w-3.5 text-purple-600" />
            ) : lType === 'text' ? (
              <BookOpen className="h-3.5 w-3.5 text-sky-600" />
            ) : lType === 'quiz' || lType === 'assignment' || lType === 'practice_test' ? (
              <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
            ) : lType === 'lecture_sheet' || lType === 'pdf_notes' || lType === 'document' ? (
              <FileText className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <Video className="h-3.5 w-3.5 text-sky-600" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-bold text-slate-900">{les.title}</p>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                {lType.replace('_', ' ')}
              </span>
              {les.isFreePreview && (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  Preview
                </span>
              )}
              {les.status === 'draft' && (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  Draft
                </span>
              )}
              {les.sequentialLock && (
                <Lock className="h-3 w-3 text-slate-400" aria-label="Sequential lock" />
              )}
            </div>
            <p className="font-mono-tabular text-[11px] text-slate-500">
              #{les.orderIndex} · {les.duration}
              {(les.resources?.length ?? 0) > 0 ? ` · ${les.resources!.length} attachment(s)` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleMoveLessonStep(les.id, 'up')}
            aria-label={`Move ${les.title} up`}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-indigo-700"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => handleMoveLessonStep(les.id, 'down')}
            aria-label={`Move ${les.title} down`}
            className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:text-indigo-700"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setPreviewLesson(les)}
            aria-label={`Preview ${les.title}`}
            className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openLessonEditor(les)}
            aria-label={`Edit ${les.title}`}
            className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-indigo-700 hover:bg-indigo-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteLesson(les.id)}
            aria-label={`Delete ${les.title}`}
            className="rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Course Curriculum Builder"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-extrabold">Drag-and-Drop Curriculum Builder</h2>
              <p className="text-[11px] text-sky-200">
                {course.title} · {modules.length} module(s) · {lessons.length} lesson(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openLessonEditor(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Lesson / Resource</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close curriculum builder"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Add Module Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
          <form onSubmit={handleAddModule} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="New Module Title (e.g. Module 2: Modifiers & Clauses)"
              aria-label="New module title"
              className="min-w-[240px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Add Module</span>
            </button>
          </form>
          {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
        </div>

        {/* Hierarchy Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {loading ? (
            <p className="py-12 text-center text-xs text-slate-500">Loading curriculum...</p>
          ) : hierarchy.modulesTree.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="text-sm font-bold text-slate-700">No modules or lessons yet.</p>
              <p className="mt-1 text-xs text-slate-500">
                Create your first Module above, add Chapters, and drag-and-drop Lessons into order.
              </p>
            </div>
          ) : (
            hierarchy.modulesTree.map((node) => {
              const mod = node.module;
              const isVirtual = mod.id.startsWith('mod-virt-');
              return (
                <div
                  key={mod.id}
                  draggable={!isVirtual}
                  onDragStart={() => !isVirtual && setDragModuleId(mod.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragModuleId && !isVirtual) {
                      void handleDropModule(mod.id);
                    } else if (dragLessonId) {
                      void handleDropLesson(null, isVirtual ? undefined : mod.id, undefined);
                    }
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!isVirtual && <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />}
                      {editingModId === mod.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingModTitle}
                            onChange={(e) => setEditingModTitle(e.target.value)}
                            className="rounded-lg border border-indigo-400 bg-white px-2.5 py-1 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameModule(mod.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {mod.title}{' '}
                          <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                            ({node.totalLessons} lessons)
                          </span>
                        </h3>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {!isVirtual && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMoveModuleStep(mod.id, 'up')}
                            aria-label={`Move module ${mod.title} up`}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:text-indigo-700"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveModuleStep(mod.id, 'down')}
                            aria-label={`Move module ${mod.title} down`}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:text-indigo-700"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingChapterForModId(mod.id);
                              setNewChapterTitle('');
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100"
                          >
                            + Chapter
                          </button>
                          <button
                            type="button"
                            onClick={() => openLessonEditor(null, mod.id, '')}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700"
                          >
                            + Lesson
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingModId(mod.id);
                              setEditingModTitle(mod.title);
                            }}
                            aria-label={`Rename module ${mod.title}`}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:text-indigo-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(mod.id)}
                            aria-label={`Delete module ${mod.title}`}
                            className="rounded-lg border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {addingChapterForModId === mod.id && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        placeholder="Chapter title..."
                        className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddChapter(mod.id)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Save Chapter
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingChapterForModId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Chapters inside Module */}
                  <div className="mt-3 space-y-2.5">
                    {node.chapters.map((chNode) => (
                      <div
                        key={chNode.chapter.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.stopPropagation();
                          if (dragLessonId) {
                            void handleDropLesson(null, mod.id, chNode.chapter.id);
                          }
                        }}
                        className="rounded-xl border border-slate-200 bg-white/80 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-indigo-800">
                            Chapter: {chNode.chapter.title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openLessonEditor(null, mod.id, chNode.chapter.id)}
                              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700"
                            >
                              + Lesson
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChapter(chNode.chapter.id)}
                              aria-label={`Delete chapter ${chNode.chapter.title}`}
                              className="rounded p-1 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {chNode.lessons.length === 0 ? (
                            <p className="py-2 text-center text-[11px] text-slate-400">
                              Drop a lesson here or click + Lesson
                            </p>
                          ) : (
                            chNode.lessons.map(renderLessonRow)
                          )}
                        </div>
                      </div>
                    ))}

                    {node.directLessons.length > 0 && (
                      <div className="space-y-1.5">{node.directLessons.map(renderLessonRow)}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Lesson Inner Modal */}
      {lessonEditorOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingLesson ? `Edit Lesson: ${editingLesson.title}` : 'Add Curriculum Lesson'}
              </h3>
              <button
                type="button"
                onClick={() => setLessonEditorOpen(false)}
                aria-label="Close lesson editor"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="flex-1 space-y-3.5 overflow-y-auto p-6 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Lesson Title *</label>
                  <input
                    type="text"
                    required
                    value={lesTitle}
                    onChange={(e) => setLesTitle(e.target.value)}
                    placeholder="e.g. Right Form of Verbs — Rules 1-10"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-semibold"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Lesson Type</label>
                  <select
                    value={lesType}
                    onChange={(e) => setLesType(e.target.value as LessonType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    {LESSON_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Module</label>
                  <select
                    value={lesModuleId}
                    onChange={(e) => {
                      setLesModuleId(e.target.value);
                      setLesChapterId('');
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    <option value="">Default Module</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Chapter</label>
                  <select
                    value={lesChapterId}
                    onChange={(e) => setLesChapterId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    <option value="">None (Direct in Module)</option>
                    {chapters
                      .filter((c) => !lesModuleId || c.moduleId === lesModuleId)
                      .map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Duration</label>
                  <input
                    type="text"
                    value={lesDuration}
                    onChange={(e) => setLesDuration(e.target.value)}
                    placeholder="35:00"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Video URL (Private)</label>
                  <input
                    type="text"
                    value={lesVideoUrl}
                    onChange={(e) => setLesVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">PDF / Lecture Sheet URL</label>
                  <input
                    type="text"
                    value={lesSheetUrl}
                    onChange={(e) => setLesSheetUrl(e.target.value)}
                    placeholder="https://.../sheet.pdf"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              {lesType === 'audio' && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Audio Stream URL</label>
                  <input
                    type="text"
                    value={lesAudioUrl}
                    onChange={(e) => setLesAudioUrl(e.target.value)}
                    placeholder="https://.../listening-track.mp3"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {(lesType === 'text' || lesType === 'assignment' || lesType === 'practice_test') && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700">
                    Lesson Reading / Prompt Content
                  </label>
                  <textarea
                    rows={4}
                    value={lesTextContent}
                    onChange={(e) => setLesTextContent(e.target.value)}
                    placeholder="Full lesson article, grammar rules, or practice prompt..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {lesType === 'external' && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700">External Resource URL</label>
                  <input
                    type="url"
                    value={lesExternalUrl}
                    onChange={(e) => setLesExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              )}

              {lesType === 'live' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Live Join URL</label>
                    <input
                      type="text"
                      value={lesLiveJoinUrl}
                      onChange={(e) => setLesLiveJoinUrl(e.target.value)}
                      placeholder="https://zoom.us/j/..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Live Status</label>
                    <select
                      value={lesLiveStatus}
                      onChange={(e) => setLesLiveStatus(e.target.value as LiveClassStatus)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="live_now">LIVE NOW</option>
                      <option value="ended">Ended</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Scheduled Time</label>
                    <input
                      type="text"
                      value={lesScheduledAt}
                      onChange={(e) => setLesScheduledAt(e.target.value)}
                      placeholder="Fri 8:00 PM"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block font-bold text-slate-700">Lesson Summary &amp; Notes</label>
                <textarea
                  rows={2}
                  value={lesSummary}
                  onChange={(e) => setLesSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              {/* Additional Downloadable Resources */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="font-bold text-slate-800">Attached Learning Resources</p>
                {lesResources.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  >
                    <span className="truncate font-semibold">
                      [{r.kind.toUpperCase()}] {r.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setLesResources((prev) => prev.filter((item) => item.id !== r.id))
                      }
                      className="text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">
                  <input
                    type="text"
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="Resource Title"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                  <input
                    type="text"
                    value={resUrl}
                    onChange={(e) => setResUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                  <select
                    value={resKind}
                    onChange={(e) => setResKind(e.target.value as CourseResource['kind'])}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                  >
                    <option value="pdf">PDF</option>
                    <option value="document">Doc</option>
                    <option value="slides">Slides</option>
                    <option value="external">Link</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!resTitle.trim() || !resUrl.trim()) return;
                      setLesResources((prev) => [
                        ...prev,
                        {
                          id: `res-${Date.now()}`,
                          title: resTitle.trim(),
                          url: resUrl.trim(),
                          kind: resKind,
                        },
                      ]);
                      setResTitle('');
                      setResUrl('');
                    }}
                    className="rounded-lg bg-slate-900 px-3 py-1 font-bold text-white"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Batch Scope (Optional)</label>
                  <select
                    value={lesBatchId}
                    onChange={(e) => setLesBatchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">All Batches of Course</option>
                    {courseBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Lesson Status</label>
                  <select
                    value={lesStatus}
                    onChange={(e) => setLesStatus(e.target.value as 'draft' | 'published')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft (Hidden from students)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={lesFreePreview}
                    onChange={(e) => setLesFreePreview(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span>Free Preview</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={lesCompletionRequired}
                    onChange={(e) => setLesCompletionRequired(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>Completion Required</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={lesSeqLock}
                    onChange={(e) => setLesSeqLock(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                  <span>Sequential Lock</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setLessonEditorOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingLesson ? 'Saving...' : 'Save Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Preview Modal */}
      {previewLesson && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">
                  Lesson Preview: {previewLesson.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLesson(null)}
                aria-label="Close lesson preview"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6 text-xs">
              {previewLesson.videoUrl && toSafeVideoEmbedUrl(previewLesson.videoUrl) && (
                <div className="aspect-video overflow-hidden rounded-xl bg-black">
                  <iframe
                    src={toSafeVideoEmbedUrl(previewLesson.videoUrl)}
                    title={previewLesson.title}
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              )}
              {previewLesson.audioUrl && (
                <audio controls src={sanitizeSafeUrl(previewLesson.audioUrl, '')} className="w-full" />
              )}
              {previewLesson.textContent && (
                <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 leading-relaxed text-slate-800">
                  {previewLesson.textContent}
                </div>
              )}
              <p className="text-slate-600">{previewLesson.sheetSummary}</p>
              {previewLesson.externalUrl && (
                <a
                  href={sanitizeSafeUrl(previewLesson.externalUrl, '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open External Resource</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
