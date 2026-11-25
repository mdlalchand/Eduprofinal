import {
  Award,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Layers,
  Lock,
  Megaphone,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BATCH_LIFECYCLE_LABELS, normalizeBatchLifecycle } from '../../lib/batchEnterprise';
import type {
  AttendanceRecord,
  BatchNotification,
  BatchScheduleSlot,
  CourseAnnouncement,
  CourseBatch,
  Enrollment,
  ExamAttempt,
  Instructor,
} from '../../types';

interface StudentBatchItem {
  batch: CourseBatch;
  enrollment?: Enrollment;
  courseTitle: string;
  courseSlug: string;
  instructor: Instructor | null;
  slots: BatchScheduleSlot[];
  attendanceSummary: {
    total: number;
    present: number;
    rate: number;
    records: AttendanceRecord[];
  };
  examsCount: number;
  attempts: ExamAttempt[];
  announcements: CourseAnnouncement[];
  notifications: BatchNotification[];
}

interface StudentBatchPortalProps {
  onNavigate: (path: string) => void;
}

export function StudentBatchPortal({ onNavigate }: StudentBatchPortalProps) {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<StudentBatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ enrolledBatches: StudentBatchItem[] }>('/api/student/batches');
      setItems(res.enrolledBatches ?? []);
    } catch {
      // keep silent empty fallback
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadMyBatches();
  }, [loadMyBatches]);

  if (loading && items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
        Loading your enrolled batches &amp; class routine...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Layers className="h-5 w-5 text-indigo-600" />
            <span>My Enrolled Batches &amp; Class Routine</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            View your batch schedule, authorized live meeting links, attendance rate, and announcements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/learn')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Classroom</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/exams')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
          >
            <Award className="h-3.5 w-3.5" />
            <span>Exams &amp; Merit</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
          You are not assigned to a specific batch yet. Select a batch when enrolling in a course.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const lc = normalizeBatchLifecycle(item.batch);
            const approved = item.enrollment?.status === 'approved';
            const online = item.batch.onlineSettings;
            const credsProtected = online?.credentialsProtected;
            return (
              <div key={item.batch.id} className="rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono tabular-nums text-xs font-bold text-indigo-700">
                        {item.batch.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <h3 className="text-base font-bold text-slate-900">{item.batch.name}</h3>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {BATCH_LIFECYCLE_LABELS[lc]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Course: <strong>{item.courseTitle}</strong> · Instructor:{' '}
                      <strong>{item.instructor?.name || 'Faculty'}</strong> · {item.batch.mode}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                      <span className="inline-flex items-center gap-1">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Attendance:{' '}
                        <strong className="font-mono tabular-nums">{item.attendanceSummary.rate}%</strong> (
                        {item.attendanceSummary.present}/{item.attendanceSummary.total})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Schedule Slots & Meeting Credentials */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                    <p className="flex items-center gap-1.5 font-bold text-slate-900">
                      <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Weekly Class Routine</span>
                    </p>
                    <p className="font-semibold text-slate-700">{item.batch.schedule}</p>
                    {item.slots.length > 0 && (
                      <div className="space-y-1">
                        {item.slots.slice(0, 4).map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold">
                              {slot.dayOfWeek} · {slot.startTime}–{slot.endTime}
                            </span>
                            <span className="text-slate-500">
                              {slot.roomLabel || item.batch.classroomOrMeeting || item.batch.mode}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                    <p className="flex items-center gap-1.5 font-bold text-slate-900">
                      <Video className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Live Class &amp; Room Access</span>
                    </p>
                    {!approved || credsProtected ? (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>
                          Meeting credentials unlock once your enrollment is approved.
                        </span>
                      </div>
                    ) : online?.meetingLink ? (
                      <div className="space-y-1">
                        <p>
                          Platform: <strong>{online.platform || 'Zoom'}</strong>
                          {online.meetingId ? ` · ID: ${online.meetingId}` : ''}
                          {online.meetingPassword ? ` · Pass: ${online.meetingPassword}` : ''}
                        </p>
                        <a
                          href={online.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Join Live Session</span>
                        </a>
                      </div>
                    ) : (
                      <p className="text-slate-600">
                        Campus Room: <strong>{item.batch.classroomOrMeeting || 'See branch noticeboard'}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Announcements & Batch Notifications */}
                {(item.announcements.length > 0 || item.notifications.length > 0) && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                    {item.announcements.slice(0, 2).map((ann) => (
                      <div key={ann.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                        <p className="flex items-center gap-1 font-bold text-indigo-950">
                          <Megaphone className="h-3.5 w-3.5 text-indigo-600" />
                          <span>{ann.title}</span>
                        </p>
                        <p className="mt-0.5 text-slate-700">{ann.message}</p>
                      </div>
                    ))}
                    {item.notifications.slice(0, 2).map((notif) => (
                      <div key={notif.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="flex items-center gap-1 font-bold text-slate-900">
                          <Bell className="h-3.5 w-3.5 text-amber-600" />
                          <span>{notif.title}</span>
                        </p>
                        <p className="mt-0.5 text-slate-600">{notif.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
