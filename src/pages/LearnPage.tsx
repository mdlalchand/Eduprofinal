import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Headphones,
  Layers,
  Lock,
  Megaphone,
  Pencil,
  Play,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLessonModal } from '../components/AdminLessonModal';
import { CertificateModal } from '../components/courses/CertificateModal';
import { CourseWizardModal } from '../components/courses/CourseWizardModal';
import { CurriculumBuilderModal } from '../components/courses/CurriculumBuilderModal';
import { ImageUploadField } from '../components/ImageUploadField';
import { ScormPlayerModal } from '../components/ScormPlayerModal';
import { useAuth } from '../context/AuthContext';
import {
  computeCourseCompletionStatus,
  computeCurriculumHierarchy,
  isLessonUnlockedForStudent,
} from '../lib/courseEnterprise';
import {
  filterLessonsByTypeAndBatch,
  sanitizeSafeUrl,
  toSafeVideoEmbedUrl,
} from '../lib/domain';
import type {
  AssignmentSubmission,
  Course,
  CourseAnnouncement,
  CourseAssignment,
  CourseBatch,
  CourseCertificate,
  CourseChapter,
  CourseLesson,
  CourseModule,
  Enrollment,
  Exam,
  ExamAttempt,
  LearnerRewardProfile,
  LessonProgressRecord,
  LessonType,
  ScormPackage,
} from '../types';

interface LearnPageProps {
  navigate: (path: string) => void;
}

interface LearnData {
  accessibleCourses: Course[];
  allCourses: Course[];
  batches?: CourseBatch[];
  modulesByCourse?: Record<string, CourseModule[]>;
  chaptersByCourse?: Record<string, CourseChapter[]>;
  lessonsByCourse: Record<string, CourseLesson[]>;
  assignmentsByCourse?: Record<string, CourseAssignment[]>;
  submissions?: AssignmentSubmission[];
  announcements?: CourseAnnouncement[];
  certificates?: CourseCertificate[];
  enrollments: Enrollment[];
}

export function LearnPage({ navigate }: LearnPageProps) {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const canManageLessons = user?.role === 'admin' || user?.role === 'teacher';
  const [data, setData] = useState<LearnData | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | LessonType>('all');
  const [scormPackages, setScormPackages] = useState<ScormPackage[]>([]);
  const [activeScormPkg, setActiveScormPkg] = useState<ScormPackage | null>(null);
  const [rewards, setRewards] = useState<LearnerRewardProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin / Teacher Inline Classroom Studio states
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [courseWizardOpen, setCourseWizardOpen] = useState(false);
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<string | null>(null);
  const [adminActionBusyId, setAdminActionBusyId] = useState<string | null>(null);

  // Assignments & Certificate states
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [submittingAsgId, setSubmittingAsgId] = useState<string | null>(null);
  const [asgMsg, setAsgMsg] = useState<string | null>(null);
  const [claimingCert, setClaimingCert] = useState(false);
  const [certMsg, setCertMsg] = useState<string | null>(null);
  const [activeCert, setActiveCert] = useState<CourseCertificate | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgressRecord>>({});

  const loadLearnWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [res, scormRes, rewRes, examRes] = await Promise.all([
        apiFetch<LearnData>('/api/learn/courses'),
        apiFetch<{ packages: ScormPackage[] }>('/api/scorm/packages'),
        apiFetch<{ rewards: LearnerRewardProfile }>('/api/rewards/me'),
        apiFetch<{ exams: Exam[]; myAttempts: ExamAttempt[] }>('/api/exams').catch(() => ({
          exams: [],
          myAttempts: [],
        })),
      ]);
      setData(res);
      setScormPackages(scormRes.packages ?? []);
      setRewards(rewRes.rewards ?? null);
      setExams(examRes.exams ?? []);
      setExamAttempts(examRes.myAttempts ?? []);
      const firstCourse = res.accessibleCourses[0] || res.allCourses[0];
      if (firstCourse) {
        setSelectedCourseId((prev) => prev || firstCourse.id);
        const firstLes = res.lessonsByCourse[firstCourse.id]?.[0];
        if (firstLes) setSelectedLessonId((prev) => prev || firstLes.id);
      }
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    void loadLearnWorkspace();
  }, [loadLearnWorkspace]);

  const courses = data
    ? data.accessibleCourses.length
      ? data.accessibleCourses
      : data.allCourses
    : [];
  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  useEffect(() => {
    if (!user || !activeCourse) return;
    apiFetch<{ progress: LessonProgressRecord[] }>(
      `/api/portal/lessons/progress?courseId=${encodeURIComponent(activeCourse.id)}`
    )
      .then((res) => {
        const map: Record<string, LessonProgressRecord> = {};
        for (const item of res.progress ?? []) {
          map[item.lessonId] = item;
        }
        setLessonProgressMap(map);
      })
      .catch(() => {});
  }, [user, activeCourse, apiFetch]);
  const allLessons = useMemo(
    () => (activeCourse && data ? data.lessonsByCourse[activeCourse.id] ?? [] : []),
    [activeCourse, data]
  );
  const courseModules = useMemo(
    () => (activeCourse && data?.modulesByCourse ? data.modulesByCourse[activeCourse.id] ?? [] : []),
    [activeCourse, data]
  );
  const courseChapters = useMemo(
    () => (activeCourse && data?.chaptersByCourse ? data.chaptersByCourse[activeCourse.id] ?? [] : []),
    [activeCourse, data]
  );

  const hierarchy = useMemo(() => {
    if (!activeCourse) return { modulesTree: [], unassignedLessons: [], orderedLessons: [] };
    return computeCurriculumHierarchy(
      activeCourse.id,
      courseModules,
      courseChapters,
      allLessons,
      false
    );
  }, [activeCourse, courseModules, courseChapters, allLessons]);

  const activeEnrollment = activeCourse && data
    ? data.enrollments.find((e) => e.courseId === activeCourse.id && e.status === 'approved')
    : undefined;

  const courseAssignments = useMemo(
    () => (activeCourse && data?.assignmentsByCourse ? data.assignmentsByCourse[activeCourse.id] ?? [] : []),
    [activeCourse, data]
  );
  const mySubmissions = useMemo(() => data?.submissions ?? [], [data]);
  const courseAnnouncements = useMemo(
    () => (data?.announcements ?? []).filter((a) => a.courseId === activeCourse?.id),
    [data, activeCourse]
  );

  const completionEval = useMemo(() => {
    if (!activeCourse) return null;
    return computeCourseCompletionStatus({
      course: activeCourse,
      lessons: allLessons,
      enrollment: activeEnrollment,
      exams,
      examAttempts,
      assignments: courseAssignments,
      submissions: mySubmissions,
    });
  }, [activeCourse, allLessons, activeEnrollment, exams, examAttempts, courseAssignments, mySubmissions]);

  if (!user) {
    return (
      <div className="rm-pastel-bg min-h-screen px-4 py-20 text-center">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200/80 bg-white p-10 shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-[#0284c7]">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-[#0284c7]">Classroom Access Required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in to join live classes, watch HD lectures, download lecture sheets, and track
            your course progress.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-6 rounded-xl bg-[#0284c7] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0369a1]"
          >
            Sign In to Classroom
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="rm-pastel-bg min-h-screen px-4 py-16 text-center text-sm font-semibold text-slate-500">
        Loading your classroom...
      </div>
    );
  }

  const orderedLessons = hierarchy.orderedLessons.length > 0 ? hierarchy.orderedLessons : allLessons;
  const filteredLessons = filterLessonsByTypeAndBatch(orderedLessons, typeFilter, 'all', '');
  const activeLesson =
    filteredLessons.find((l) => l.id === selectedLessonId) ||
    filteredLessons[0] ||
    orderedLessons.find((l) => l.id === selectedLessonId) ||
    orderedLessons[0];
  const courseBatches = (data.batches ?? []).filter((b) => b.courseId === activeCourse?.id);

  const completedIds = activeEnrollment?.completedLessonIds ?? [];
  const activeLessonLock =
    activeCourse && activeLesson && user.role === 'student'
      ? isLessonUnlockedForStudent(activeCourse, orderedLessons, completedIds, activeLesson.id)
      : { unlocked: true };

  const progressPct = completionEval?.progressPercent ?? 0;
  const existingCert = (data.certificates ?? []).find(
    (c) => c.courseId === activeCourse?.id && !c.revoked
  );

  const safeEmbedUrl = activeLesson ? toSafeVideoEmbedUrl(activeLesson.videoUrl) : '';
  const safeAudioUrl = activeLesson?.audioUrl ? sanitizeSafeUrl(activeLesson.audioUrl, '') : '';
  const safeLiveJoinUrl = activeLesson?.liveJoinUrl
    ? sanitizeSafeUrl(activeLesson.liveJoinUrl, '')
    : '';
  const safeSheetUrl = activeLesson?.lectureSheetUrl
    ? sanitizeSafeUrl(activeLesson.lectureSheetUrl, '')
    : '';
  const safeExternalUrl = activeLesson?.externalUrl
    ? sanitizeSafeUrl(activeLesson.externalUrl, '')
    : '';

  const handleSelectLesson = (les: CourseLesson) => {
    setLockedNotice(null);
    if (activeCourse && user.role === 'student') {
      const check = isLessonUnlockedForStudent(activeCourse, orderedLessons, completedIds, les.id);
      if (!check.unlocked) {
        setLockedNotice(
          `Sequential access: Complete "${check.blockingLessonTitle || 'the previous lesson'}" first to unlock "${les.title}".`
        );
        return;
      }
    }
    setSelectedLessonId(les.id);
  };

  const saveLessonWatchProgress = async (lessonId: string, watchedSeconds: number, durationSeconds: number, completed = false) => {
    try {
      const res = await apiFetch<{ progress: LessonProgressRecord }>(
        `/api/portal/lessons/${encodeURIComponent(lessonId)}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ watchedSeconds, durationSeconds, completed }),
        }
      );
      setLessonProgressMap((prev) => ({ ...prev, [lessonId]: res.progress }));
    } catch {
      // Non-fatal background sync
    }
  };

  const handleMarkComplete = async () => {
    if (!activeCourse || !activeLesson || !activeEnrollment) return;
    const res = await apiFetch<{ enrollment: Enrollment }>('/api/learn/progress', {
      method: 'POST',
      body: JSON.stringify({ courseId: activeCourse.id, lessonId: activeLesson.id }),
    });
    await saveLessonWatchProgress(activeLesson.id, 600, 600, true);
    setData((prev) =>
      prev
        ? {
            ...prev,
            enrollments: prev.enrollments.map((e) =>
              e.id === res.enrollment.id ? res.enrollment : e
            ),
          }
        : prev
    );
  };

  const handleSubmitAssignment = async (e: React.FormEvent, asg: CourseAssignment) => {
    e.preventDefault();
    setSubmittingAsgId(asg.id);
    setAsgMsg(null);
    try {
      const res = await apiFetch<{ submission: AssignmentSubmission }>(
        `/api/learn/assignments/${asg.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({
            answerText: draftAnswers[asg.id] ?? '',
            attachmentUrl: draftUrls[asg.id] ?? '',
          }),
        }
      );
      setData((prev) => {
        if (!prev) return prev;
        const others = (prev.submissions ?? []).filter((s) => s.id !== res.submission.id);
        return { ...prev, submissions: [res.submission, ...others] };
      });
      setAsgMsg(`Submitted "${asg.title}" successfully!`);
    } catch (err) {
      setAsgMsg(err instanceof Error ? err.message : 'Failed to submit assignment.');
    } finally {
      setSubmittingAsgId(null);
    }
  };

  const handleClaimCertificate = async () => {
    if (!activeCourse) return;
    setClaimingCert(true);
    setCertMsg(null);
    try {
      const res = await apiFetch<{ certificate: CourseCertificate }>(
        `/api/learn/courses/${activeCourse.id}/claim-certificate`,
        { method: 'POST' }
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              certificates: [
                res.certificate,
                ...(prev.certificates ?? []).filter((c) => c.id !== res.certificate.id),
              ],
            }
          : prev
      );
      setActiveCert(res.certificate);
    } catch (err) {
      setCertMsg(err instanceof Error ? err.message : 'Certificate criteria not met yet.');
    } finally {
      setClaimingCert(false);
    }
  };

  const activeType = activeLesson?.lessonType ?? 'recorded';

  const handleReorderLesson = async (lessonId: string, direction: 'up' | 'down') => {
    setAdminActionBusyId(lessonId);
    try {
      await apiFetch(`/api/portal/lessons/${encodeURIComponent(lessonId)}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ direction }),
      });
      await loadLearnWorkspace();
      await refreshBootstrap();
      setAdminToast(`Lesson moved ${direction}.`);
    } catch (err) {
      setAdminToast(err instanceof Error ? err.message : 'Could not reorder lesson.');
    } finally {
      setAdminActionBusyId(null);
    }
  };

  const handleDuplicateLesson = async (les: CourseLesson) => {
    setAdminActionBusyId(les.id);
    try {
      await apiFetch(`/api/portal/lessons/${encodeURIComponent(les.id)}/duplicate`, {
        method: 'POST',
      });
      await loadLearnWorkspace();
      await refreshBootstrap();
      setAdminToast(`Duplicated "${les.title}".`);
    } catch (err) {
      setAdminToast(err instanceof Error ? err.message : 'Could not duplicate lesson.');
    } finally {
      setAdminActionBusyId(null);
    }
  };

  const handleCycleLiveStatus = async (les: CourseLesson) => {
    const nextStatus =
      les.liveStatus === 'scheduled'
        ? 'live_now'
        : les.liveStatus === 'live_now'
          ? 'ended'
          : 'scheduled';
    setAdminActionBusyId(les.id);
    try {
      await apiFetch(`/api/portal/lessons/${encodeURIComponent(les.id)}/live-status`, {
        method: 'POST',
        body: JSON.stringify({ liveStatus: nextStatus }),
      });
      await loadLearnWorkspace();
      setAdminToast(`Live status updated to ${nextStatus.replace('_', ' ').toUpperCase()}.`);
    } catch (err) {
      setAdminToast(err instanceof Error ? err.message : 'Could not update live status.');
    } finally {
      setAdminActionBusyId(null);
    }
  };

  const handleDeleteLesson = async (les: CourseLesson) => {
    if (confirmDeleteLessonId !== les.id) {
      setConfirmDeleteLessonId(les.id);
      return;
    }
    setAdminActionBusyId(les.id);
    try {
      await apiFetch(`/api/portal/lessons/${encodeURIComponent(les.id)}`, {
        method: 'DELETE',
      });
      setConfirmDeleteLessonId(null);
      if (selectedLessonId === les.id) setSelectedLessonId('');
      await loadLearnWorkspace();
      await refreshBootstrap();
      setAdminToast(`Deleted "${les.title}".`);
    } catch (err) {
      setAdminToast(err instanceof Error ? err.message : 'Could not delete lesson.');
    } finally {
      setAdminActionBusyId(null);
    }
  };

  const renderLessonRow = (les: CourseLesson) => {
    const isSelected = activeLesson?.id === les.id;
    const done = completedIds.includes(les.id);
    const lockCheck =
      activeCourse && user.role === 'student'
        ? isLessonUnlockedForStudent(activeCourse, orderedLessons, completedIds, les.id)
        : { unlocked: true };
    const lType = les.lessonType ?? 'recorded';
    return (
      <div
        key={les.id}
        className={`rounded-xl border p-3 transition-colors ${
          !lockCheck.unlocked
            ? 'border-slate-200 bg-slate-50 opacity-70'
            : isSelected
              ? 'border-sky-500 bg-sky-50/90'
              : 'border-slate-200 bg-white hover:bg-slate-50'
        }`}
      >
        <button
          type="button"
          onClick={() => handleSelectLesson(les)}
          className="flex w-full items-start gap-3 text-left"
        >
          <span
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
              !lockCheck.unlocked
                ? 'bg-slate-200 text-slate-600'
                : done
                  ? 'bg-emerald-500 text-white'
                  : lType === 'live'
                    ? 'bg-rose-600 text-white'
                    : lType === 'lecture_sheet' || lType === 'pdf_notes' || lType === 'document'
                      ? 'bg-amber-500 text-white'
                      : lType === 'audio'
                        ? 'bg-purple-600 text-white'
                        : isSelected
                          ? 'bg-[#0284c7] text-white'
                          : 'bg-slate-100 text-slate-600'
            }`}
          >
            {!lockCheck.unlocked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : done ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : lType === 'live' ? (
              <Radio className="h-4 w-4" />
            ) : lType === 'lecture_sheet' || lType === 'pdf_notes' || lType === 'document' ? (
              <FileText className="h-4 w-4" />
            ) : lType === 'audio' ? (
              <Headphones className="h-4 w-4" />
            ) : (
              <Video className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-500">
                {lType === 'live'
                  ? les.liveStatus === 'live_now'
                    ? 'LIVE NOW'
                    : 'Live Class'
                  : lType.replace('_', ' ')}
              </span>
              {les.batchName && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-[#0284c7]">
                  {les.batchName}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-bold text-slate-900">{les.title}</p>
            <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500">
              {les.duration}
              {lessonProgressMap[les.id]
                ? ` · ${lessonProgressMap[les.id].percentWatched}% watched`
                : ''}
            </p>
          </div>
        </button>

        {canManageLessons && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingLesson(les);
                setLessonModalOpen(true);
              }}
              aria-label={`Edit lesson ${les.title}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              disabled={adminActionBusyId === les.id}
              onClick={() => void handleReorderLesson(les.id, 'up')}
              aria-label={`Move ${les.title} up`}
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={adminActionBusyId === les.id}
              onClick={() => void handleReorderLesson(les.id, 'down')}
              aria-label={`Move ${les.title} down`}
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={adminActionBusyId === les.id}
              onClick={() => void handleDuplicateLesson(les)}
              aria-label={`Duplicate lesson ${les.title}`}
              className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
            </button>
            {lType === 'live' && (
              <button
                type="button"
                disabled={adminActionBusyId === les.id}
                onClick={() => void handleCycleLiveStatus(les)}
                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Status: {(les.liveStatus || 'scheduled').replace('_', ' ')}
              </button>
            )}
            <button
              type="button"
              disabled={adminActionBusyId === les.id}
              onClick={() => void handleDeleteLesson(les)}
              aria-label={`Delete lesson ${les.title}`}
              className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                confirmDeleteLessonId === les.id
                  ? 'bg-rose-600 text-white'
                  : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
              }`}
            >
              <Trash2 className="h-3 w-3" />
              <span>{confirmDeleteLessonId === les.id ? 'Confirm' : 'Delete'}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rm-pastel-bg min-h-screen pb-16 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0284c7] sm:text-3xl">
              Classroom &amp; Live Lectures
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Join Live Classes, watch HD Lectures, complete Assignments &amp; claim Verified Certificates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageLessons && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLesson(null);
                    setLessonModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0284c7] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#0369a1]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Lesson</span>
                </button>
                {activeCourse && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurriculumOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3.5 py-2.5 text-xs font-bold text-[#0284c7] shadow-xs hover:bg-sky-50"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>Curriculum Builder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCourseWizardOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit Course</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/portal')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Portal</span>
                </button>
              </>
            )}
            {activeCourse && (
              <select
                aria-label="Select course"
                value={activeCourse.id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedCourseId(nextId);
                  setTypeFilter('all');
                  setLockedNotice(null);
                  setConfirmDeleteLessonId(null);
                  const first = data.lessonsByCourse[nextId]?.[0];
                  setSelectedLessonId(first?.id || '');
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {adminToast && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-xs">
            <span>{adminToast}</span>
            <button
              type="button"
              onClick={() => setAdminToast(null)}
              className="rounded px-2 py-0.5 text-[11px] hover:bg-emerald-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Learner XP, Streak & Badges Strip */}
        {rewards && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-amber-950">
                <Award className="h-4 w-4 text-amber-600" />
                {rewards.xp} XP
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-800">
                <Flame className="h-4 w-4 text-orange-500" />
                {rewards.streakDays} Day Streak
              </span>
              <div className="flex flex-wrap gap-1.5">
                {rewards.badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-lg border border-amber-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/community')}
              className="text-xs font-extrabold text-indigo-700 hover:underline"
            >
              View XP Leaderboard →
            </button>
          </div>
        )}

        {/* Course Announcements Strip */}
        {courseAnnouncements.length > 0 && (
          <div className="mt-4 space-y-2">
            {courseAnnouncements.slice(0, 3).map((ann) => (
              <div
                key={ann.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <div>
                    <p className="font-extrabold text-slate-900">
                      {ann.pinned ? '📌 ' : ''}
                      {ann.title}
                    </p>
                    <p className="mt-0.5 text-slate-700">{ann.message}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Posted by {ann.postedByName || ann.authorName || 'Instructor'} ·{' '}
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active Course Batches Routine Strip */}
        {courseBatches.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courseBatches.map((bat) => (
              <div
                key={bat.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                    <p className="truncate text-xs font-extrabold text-slate-900">{bat.name}</p>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <CalendarClock className="h-3 w-3 text-slate-400" />
                    <span className="truncate">{bat.schedule}</span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    bat.status === 'open'
                      ? 'bg-emerald-50 text-emerald-700'
                      : bat.status === 'running'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {bat.mode}
                </span>
              </div>
            ))}
          </div>
        )}

        {lockedNotice && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
            <Lock className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{lockedNotice}</span>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Player / Lesson Viewer + Assignments */}
          <div className="space-y-6 lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              {!activeLessonLock.unlocked ? (
                <div className="flex aspect-video flex-col items-center justify-center bg-slate-900 p-8 text-center text-white">
                  <Lock className="h-10 w-10 text-amber-400" />
                  <h2 className="mt-3 text-xl font-extrabold">Sequential Lesson Locked</h2>
                  <p className="mt-1 max-w-md text-xs text-slate-300">
                    Complete &ldquo;{activeLessonLock.blockingLessonTitle || 'the previous lesson'}&rdquo; first to unlock this lesson.
                  </p>
                </div>
              ) : activeLesson && activeType === 'live' ? (
                <div className="bg-gradient-to-br from-[#042133] via-[#092f47] to-[#1e1b4b] p-8 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-extrabold uppercase ${
                        activeLesson.liveStatus === 'live_now'
                          ? 'bg-rose-600 text-white'
                          : activeLesson.liveStatus === 'ended'
                            ? 'bg-slate-700 text-slate-200'
                            : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      <Radio className="h-3.5 w-3.5" />
                      <span>
                        {activeLesson.liveStatus === 'live_now'
                          ? 'LIVE CLASS IN PROGRESS'
                          : activeLesson.liveStatus === 'ended'
                            ? 'LIVE CLASS ENDED'
                            : 'UPCOMING LIVE CLASS'}
                      </span>
                    </span>
                    {activeLesson.scheduledAt && (
                      <span className="font-mono-tabular text-xs font-semibold text-sky-200">
                        Schedule: {activeLesson.scheduledAt}
                      </span>
                    )}
                  </div>

                  <h2 className="mt-4 text-2xl font-extrabold">{activeLesson.title}</h2>
                  <p className="mt-1 text-xs text-sky-200">
                    {activeLesson.moduleName}
                    {activeLesson.batchName ? ` · Batch: ${activeLesson.batchName}` : ''} ·{' '}
                    {activeLesson.duration}
                  </p>

                  {safeLiveJoinUrl && activeLesson.liveStatus !== 'ended' && (
                    <div className="mt-6">
                      <a
                        href={safeLiveJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-lg hover:bg-amber-300"
                      >
                        <Radio className="h-4 w-4" />
                        <span>Join Live Class Stream</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}

                  {safeEmbedUrl && (
                    <div className="mt-6 aspect-video overflow-hidden rounded-xl border border-white/15 bg-black">
                      <iframe
                        src={safeEmbedUrl}
                        title={activeLesson.title}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  )}
                </div>
              ) : activeLesson && activeType === 'audio' ? (
                <div className="bg-gradient-to-br from-purple-950 to-slate-900 p-8 text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/30 px-3 py-1 text-xs font-bold text-purple-200">
                    <Headphones className="h-4 w-4" /> Audio / Listening Practice
                  </span>
                  <h2 className="mt-3 text-xl font-extrabold">{activeLesson.title}</h2>
                  {safeAudioUrl ? (
                    <audio controls className="mt-5 w-full" src={safeAudioUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  ) : (
                    <p className="mt-3 text-xs text-purple-200">
                      Audio track configured in resources below.
                    </p>
                  )}
                </div>
              ) : activeLesson && activeType === 'text' ? (
                <div className="bg-white p-8">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                    <BookOpen className="h-4 w-4" /> Reading Lesson
                  </span>
                  <h2 className="mt-3 text-2xl font-extrabold text-slate-900">
                    {activeLesson.title}
                  </h2>
                  <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm leading-relaxed text-slate-800">
                    {activeLesson.textContent || activeLesson.sheetSummary}
                  </div>
                </div>
              ) : activeLesson &&
                (activeType === 'lecture_sheet' ||
                  activeType === 'pdf_notes' ||
                  activeType === 'document') ? (
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-indigo-50 p-10 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
                    <FileText className="h-8 w-8" />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-slate-900">
                    {activeLesson.title}
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    {activeLesson.moduleName}
                    {activeLesson.batchName ? ` · ${activeLesson.batchName}` : ''} ·{' '}
                    {activeLesson.duration}
                  </p>
                  {safeSheetUrl && (
                    <a
                      href={safeSheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600"
                    >
                      <FileText className="h-4 w-4 text-amber-400" />
                      <span>Open / Download PDF Material</span>
                    </a>
                  )}
                </div>
              ) : activeLesson && activeType === 'external' ? (
                <div className="flex flex-col items-center justify-center bg-slate-900 p-10 text-center text-white">
                  <ExternalLink className="h-10 w-10 text-sky-400" />
                  <h2 className="mt-3 text-xl font-extrabold">{activeLesson.title}</h2>
                  {safeExternalUrl && (
                    <a
                      href={safeExternalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-sky-400"
                    >
                      <span>Open External Resource</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ) : activeLesson && (activeType === 'quiz' || activeType === 'practice_test') ? (
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900 p-10 text-center text-white">
                  <ClipboardList className="h-10 w-10 text-amber-400" />
                  <h2 className="mt-3 text-xl font-extrabold">{activeLesson.title}</h2>
                  <p className="mt-1 text-xs text-slate-300">{activeLesson.sheetSummary}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/exams')}
                    className="mt-5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
                  >
                    Launch Exam / Practice Test →
                  </button>
                </div>
              ) : safeEmbedUrl ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={safeEmbedUrl}
                    title={activeLesson?.title || 'Recorded Lecture Video'}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center bg-gradient-to-br from-[#042133] to-[#0a3c4d] p-8 text-center text-white">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-lg">
                    <Play className="h-7 w-7 fill-slate-950" />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold">
                    {activeLesson?.title || 'Select a lecture from the playlist'}
                  </h2>
                  {activeLesson && (
                    <p className="mt-1 text-xs font-medium text-sky-200">
                      {activeLesson.moduleName} · Duration {activeLesson.duration}
                    </p>
                  )}
                </div>
              )}

              {activeLesson && activeLessonLock.unlocked && (
                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                        Lecture Sheet &amp; Notes
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {activeLesson.videoPreviewTitle || activeLesson.title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManageLessons && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLesson(activeLesson);
                            setLessonModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-bold text-[#0284c7] hover:bg-sky-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit Lesson</span>
                        </button>
                      )}
                      {safeSheetUrl &&
                        activeType !== 'lecture_sheet' &&
                        activeType !== 'pdf_notes' &&
                        activeType !== 'document' && (
                          <a
                            href={safeSheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                          >
                            <FileText className="h-4 w-4 text-amber-600" />
                            <span>Lecture Sheet PDF</span>
                          </a>
                        )}
                      {activeEnrollment && (
                        <button
                          type="button"
                          onClick={handleMarkComplete}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                            completedIds.includes(activeLesson.id)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-[#062436] text-white hover:bg-[#0c3954]'
                          }`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>
                            {completedIds.includes(activeLesson.id)
                              ? 'Completed'
                              : 'Mark as Completed'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {activeLesson.sheetSummary}
                  </p>
                  {activeEnrollment && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        Watch Progress:{' '}
                        <strong className="font-mono-tabular text-indigo-700">
                          {lessonProgressMap[activeLesson.id]?.percentWatched ??
                            (completedIds.includes(activeLesson.id) ? 100 : 0)}
                          %
                        </strong>
                        {lessonProgressMap[activeLesson.id]?.lastPositionAt && (
                          <span className="ml-2 text-slate-500">
                            (Last synced{' '}
                            {new Date(lessonProgressMap[activeLesson.id].lastPositionAt).toLocaleTimeString()}
                            )
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => void saveLessonWatchProgress(activeLesson.id, 300, 600, false)}
                        className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
                      >
                        Save Bookmark (50%)
                      </button>
                    </div>
                  )}

                  {activeLesson.resources && activeLesson.resources.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-xs font-extrabold uppercase text-slate-500">
                        Attached Learning Resources ({activeLesson.resources.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeLesson.resources.map((res) => {
                          const safeUrl = sanitizeSafeUrl(res.url, '#');
                          return (
                            <a
                              key={res.id}
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
                            >
                              <FileText className="h-3.5 w-3.5 text-indigo-600" />
                              <span>{res.title}</span>
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Course Assignments & Submissions Panel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                <ClipboardList className="h-4 w-4 text-indigo-600" />
                <span>Course Assignments &amp; Submissions ({courseAssignments.length})</span>
              </h3>
              {asgMsg && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  {asgMsg}
                </p>
              )}
              {courseAssignments.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No assignments assigned for this course yet.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {courseAssignments.map((asg) => {
                    const existingSub = mySubmissions.find((s) => s.assignmentId === asg.id);
                    return (
                      <div
                        key={asg.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900">{asg.title}</h4>
                          <span className="font-mono-tabular rounded-lg bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                            Max {asg.maxMarks} Marks
                            {asg.dueDate ? ` · Due ${asg.dueDate}` : ''}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-700">{asg.instructions}</p>

                        {existingSub && (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold uppercase text-emerald-700">
                                Status: {existingSub.status}
                              </span>
                              {typeof existingSub.marks === 'number' && (
                                <span className="font-mono-tabular rounded bg-emerald-100 px-2 py-0.5 font-extrabold text-emerald-800">
                                  Score: {existingSub.marks}/{asg.maxMarks}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-slate-700">
                              Your response: {existingSub.answerText || existingSub.submissionText}
                            </p>
                            {existingSub.attachmentUrl && (
                              <div className="mt-2">
                                {/\.(png|jpg|jpeg|webp|gif)$/i.test(existingSub.attachmentUrl) ||
                                existingSub.attachmentUrl.startsWith('/uploads/') ? (
                                  <a
                                    href={existingSub.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                  >
                                    <img
                                      src={existingSub.attachmentUrl}
                                      alt="Submitted assignment attachment"
                                      referrerPolicy="no-referrer"
                                      className="h-24 w-36 object-cover"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={existingSub.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>View Attached File</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {existingSub.feedback && (
                              <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-950">
                                Teacher Feedback: {existingSub.feedback}
                              </p>
                            )}
                          </div>
                        )}

                        {activeEnrollment && (
                          <form
                            onSubmit={(e) => handleSubmitAssignment(e, asg)}
                            className="mt-3 space-y-2.5"
                          >
                            <textarea
                              rows={2}
                              value={
                                draftAnswers[asg.id] ??
                                existingSub?.answerText ??
                                existingSub?.submissionText ??
                                ''
                              }
                              onChange={(e) =>
                                setDraftAnswers((prev) => ({ ...prev, [asg.id]: e.target.value }))
                              }
                              placeholder="Write your assignment answer or essay response..."
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                            />
                            <ImageUploadField
                              label="Attach Answer Sheet Photo / Image (Device Upload or My Storage)"
                              value={draftUrls[asg.id] ?? existingSub?.attachmentUrl ?? ''}
                              onChange={(url) =>
                                setDraftUrls((prev) => ({ ...prev, [asg.id]: url }))
                              }
                              category="assignment"
                              placeholder="/uploads/... or optional Drive/PDF link (https://...)"
                            />
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                disabled={submittingAsgId === asg.id}
                                className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
                              >
                                {submittingAsgId === asg.id
                                  ? 'Submitting...'
                                  : existingSub
                                    ? 'Update Submission'
                                    : 'Submit Assignment'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Hierarchical Syllabus + Completion & Certificate + SCORM */}
          <div className="space-y-5 lg:col-span-4">
            {/* Completion & Certificate Card */}
            {activeCourse && completionEval && (
              <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                    <Award className="h-4 w-4 text-amber-500" />
                    <span>Completion &amp; Certificate</span>
                  </h3>
                  <span className="font-mono-tabular text-xs font-extrabold text-emerald-700">
                    {progressPct}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-mono-tabular font-bold">
                    {completionEval.completedLessonsCount}/{completionEval.totalPublishedLessons}
                  </span>{' '}
                  lessons completed ·{' '}
                  <span className="font-mono-tabular font-bold">
                    {Math.max(
                      0,
                      completionEval.totalPublishedLessons - completionEval.completedLessonsCount
                    )}
                  </span>{' '}
                  remaining
                </p>

                {existingCert ? (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setActiveCert(existingCert)}
                      className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white hover:bg-emerald-700"
                    >
                      View / Print Official Certificate
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/verify-certificate?cert=${encodeURIComponent(existingCert.certificateNumber)}`
                        )
                      }
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      Verify Online ({existingCert.certificateNumber})
                    </button>
                  </div>
                ) : completionEval.eligibleForCertificate ? (
                  <button
                    type="button"
                    disabled={claimingCert}
                    onClick={handleClaimCertificate}
                    className="mt-3 w-full rounded-xl bg-amber-400 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
                  >
                    {claimingCert ? 'Issuing Certificate...' : 'Claim Official PDF Certificate'}
                  </button>
                ) : (
                  <ul className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
                    {completionEval.unmetRequirements.map((req) => (
                      <li key={req}>• {req}</li>
                    ))}
                  </ul>
                )}
                {certMsg && (
                  <p className="mt-2 text-xs font-semibold text-rose-700">{certMsg}</p>
                )}
              </div>
            )}

            {/* Hierarchical Syllabus */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Course Syllabus ({allLessons.length})
                </h3>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { id: 'all' as const, label: 'All' },
                  { id: 'recorded' as const, label: 'Recorded' },
                  { id: 'live' as const, label: 'Live' },
                  { id: 'lecture_sheet' as const, label: 'Sheets' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      typeFilter === f.id
                        ? 'bg-[#062436] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {filteredLessons.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    {allLessons.length === 0
                      ? 'Enroll in this course to unlock full lectures and live classes.'
                      : 'No classes match this filter.'}
                  </p>
                ) : typeFilter === 'all' && hierarchy.modulesTree.length > 0 ? (
                  <>
                    {hierarchy.modulesTree.map((modNode) => (
                      <div key={modNode.module.id} className="space-y-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
                          {modNode.module.title}
                        </p>
                        {modNode.chapters.map((chNode) => (
                          <div key={chNode.chapter.id} className="space-y-1.5 pl-1">
                            <p className="text-[11px] font-bold text-slate-500">
                              ↳ {chNode.chapter.title}
                            </p>
                            {chNode.lessons.map(renderLessonRow)}
                          </div>
                        ))}
                        {modNode.directLessons.map(renderLessonRow)}
                      </div>
                    ))}
                    {hierarchy.unassignedLessons.map(renderLessonRow)}
                  </>
                ) : (
                  filteredLessons.map(renderLessonRow)
                )}
              </div>
            </div>

            {/* SCORM 1.2 Interactive Labs */}
            {scormPackages.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-xs">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>SCORM 1.2 Interactive Labs ({scormPackages.length})</span>
                </h3>
                <div className="mt-3 space-y-2.5">
                  {scormPackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-900">{pkg.title}</p>
                        <p className="text-[11px] font-semibold text-emerald-700">
                          +{pkg.xpReward} XP · {pkg.identifier}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveScormPkg(pkg)}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        Launch Lab
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ScormPlayerModal
        pkg={activeScormPkg}
        onClose={() => setActiveScormPkg(null)}
        onCompleted={(nextRewards) => setRewards(nextRewards)}
      />

      <CertificateModal
        certificate={activeCert}
        onClose={() => setActiveCert(null)}
        onOpenVerifyPage={(certNo) =>
          navigate(`/verify-certificate?cert=${encodeURIComponent(certNo)}`)
        }
      />

      {canManageLessons && (
        <>
          <AdminLessonModal
            open={lessonModalOpen}
            lesson={editingLesson}
            courses={courses}
            batches={data.batches ?? []}
            defaultCourseId={activeCourse?.id}
            onClose={() => {
              setLessonModalOpen(false);
              setEditingLesson(null);
            }}
            onSaved={async (msg) => {
              setAdminToast(msg);
              await loadLearnWorkspace();
              await refreshBootstrap();
            }}
          />

          <CurriculumBuilderModal
            open={curriculumOpen}
            course={activeCourse ?? null}
            batches={data.batches ?? []}
            onClose={() => setCurriculumOpen(false)}
            onChanged={async () => {
              await loadLearnWorkspace();
              await refreshBootstrap();
            }}
            onNotify={(msg) => setAdminToast(msg)}
          />

          <CourseWizardModal
            open={courseWizardOpen}
            course={activeCourse ?? null}
            allCourses={data.allCourses}
            branches={bootstrap?.branches ?? []}
            instructors={bootstrap?.instructors ?? []}
            batches={data.batches ?? []}
            onClose={() => setCourseWizardOpen(false)}
            onSaved={async (msg) => {
              setAdminToast(msg);
              await loadLearnWorkspace();
              await refreshBootstrap();
            }}
          />
        </>
      )}
    </div>
  );
}
