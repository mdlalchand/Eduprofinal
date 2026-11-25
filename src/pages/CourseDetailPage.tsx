import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Globe,
  Layers,
  Lock,
  Play,
  Radio,
  Star,
  Tag,
  Target,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FourStepPaymentModal } from '../components/FourStepPaymentModal';
import { useAuth } from '../context/AuthContext';
import {
  buildCourseJsonLd,
  calculateCoursePricingServerSide,
  computeCurriculumHierarchy,
  isCourseEnrollable,
} from '../lib/courseEnterprise';
import {
  calculateDiscountedPrice,
  computeBatchSeatUsage,
  filterActiveBranches,
  resolveDefaultActiveBranchId,
  toSafeVideoEmbedUrl,
} from '../lib/domain';
import type {
  Branch,
  Coupon,
  Course,
  CourseBatch,
  CourseChapter,
  CourseLesson,
  CourseModule,
  Instructor,
  Review,
} from '../types';

interface CourseDetailPageProps {
  slug: string;
  navigate: (path: string) => void;
}

interface CourseDetailPayload {
  course: Course;
  instructors: Instructor[];
  batches?: CourseBatch[];
  modules?: CourseModule[];
  chapters?: CourseChapter[];
  lessons: CourseLesson[];
  branches: Branch[];
  reviews?: Review[];
  averageRating?: number;
  reviewCount?: number;
  seoJsonLd?: Record<string, unknown>;
}

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}='${key}']`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function CourseDetailPage({ slug, navigate }: CourseDetailPageProps) {
  const { user, apiFetch, refreshBootstrap } = useAuth();
  const [data, setData] = useState<CourseDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'demo'>('overview');
  const [expandedDesc, setExpandedDesc] = useState(false);

  // Coupon & Enrollment state
  const [showCouponBox, setShowCouponBox] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [enrollStatus, setEnrollStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(
    null
  );

  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/public/courses/${encodeURIComponent(slug)}`);
      const payload = r.ok ? ((await r.json()) as CourseDetailPayload) : null;
      if (payload) {
        const activeList = filterActiveBranches(payload.branches ?? []);
        setData({ ...payload, branches: activeList });
        setSelectedBranchId((prev) => prev || resolveDefaultActiveBranchId(activeList));
        const openBatch = (payload.batches ?? []).find(
          (b) => b.status !== 'closed' && !computeBatchSeatUsage(b).isFull
        );
        setSelectedBatchId((prev) => prev || openBatch?.id || '');
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Dynamic SEO meta tags & Schema.org JSON-LD injection
  useEffect(() => {
    if (!data?.course) return;
    const { course, instructors, reviews = [], seoJsonLd } = data;
    const seoTitle = course.seo?.metaTitle || `${course.title} | Alom's English Center LMS`;
    const seoDesc =
      course.seo?.metaDescription ||
      course.subtitle ||
      course.description.slice(0, 160);
    const ogImage = course.seo?.ogImage || course.bannerImage || course.thumbnail;
    const canonical =
      course.seo?.canonicalUrl || `${window.location.origin}/course/${course.slug}`;
    const noIndex =
      Boolean(course.seo?.noIndex) ||
      course.seo?.robotsIndex === false ||
      course.visibility === 'unlisted' ||
      course.visibility === 'private';

    document.title = seoTitle;
    upsertMetaTag('name', 'description', seoDesc);
    upsertMetaTag('property', 'og:title', course.seo?.ogTitle || seoTitle);
    upsertMetaTag('property', 'og:description', course.seo?.ogDescription || seoDesc);
    upsertMetaTag('property', 'og:image', ogImage);
    upsertMetaTag('name', 'robots', noIndex ? 'noindex,nofollow' : 'index,follow');

    let link = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;

    const jsonLd = seoJsonLd || buildCourseJsonLd(course, instructors, reviews, window.location.origin);
    let script = document.getElementById('course-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'course-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.getElementById('course-jsonld')?.remove();
    };
  }, [data]);

  const hierarchy = useMemo(() => {
    if (!data?.course) return { modulesTree: [], unassignedLessons: [], orderedLessons: [] };
    return computeCurriculumHierarchy(
      data.course.id,
      data.modules ?? [],
      data.chapters ?? [],
      data.lessons ?? [],
      false
    );
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-500">
        Loading course details...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Course Not Found</h1>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  const {
    course,
    instructors,
    batches = [],
    lessons,
    branches,
    reviews = [],
    averageRating,
    reviewCount,
  } = data;

  const pricing = calculateDiscountedPrice(course.price, course.originalPrice, appliedCoupon);
  const fullPricing = calculateCoursePricingServerSide(course, appliedCoupon);
  const enrollCheck = isCourseEnrollable(course);
  const demoEmbedUrl = toSafeVideoEmbedUrl(course.demoYoutubeUrl);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    try {
      const res = await fetch('/api/public/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput, courseId: course.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCouponError(json.error || 'Invalid coupon code');
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon(json.coupon);
    } catch {
      setCouponError('Failed to validate coupon');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg(null);
    setReviewBusy(true);
    try {
      await apiFetch(`/api/courses/${course.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: reviewRating, text: reviewText }),
      });
      setReviewText('');
      setReviewMsg({ type: 'ok', text: 'Thank you! Your verified review has been published.' });
      await loadDetail();
    } catch (err) {
      setReviewMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit review.',
      });
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-slate-50 to-white pb-16 pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Courses</span>
        </button>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-indigo-700">
            <span className="rounded-lg bg-indigo-100 px-2.5 py-1">{course.category}</span>
            <span>{course.courseType || 'Hybrid'}</span>
            <span aria-hidden="true">·</span>
            <span>{course.level || 'Intermediate'}</span>
            {course.language && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  {course.language}
                </span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {course.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{course.subtitle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="font-mono-tabular font-semibold">
                {course.enrolledCount.toLocaleString()}
              </span>
              <span>students enrolled</span>
            </span>
            {course.durationLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>{course.durationLabel}</span>
              </span>
            )}
            {(course.totalClasses || course.estimatedHours) && (
              <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                {course.totalClasses ? `${course.totalClasses} Classes` : ''}
                {course.totalClasses && course.estimatedHours ? ' · ' : ''}
                {course.estimatedHours ? `${course.estimatedHours} Hours` : ''}
              </span>
            )}
            {typeof averageRating === 'number' && (reviewCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                <span className="font-mono-tabular">{averageRating}</span>
                <span className="text-xs font-medium text-slate-500">({reviewCount} reviews)</span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Content Card */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              {/* Tabs */}
              <div className="grid grid-cols-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-sky-600 text-sky-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Overview &amp; Curriculum</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('demo')}
                  className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-colors ${
                    activeTab === 'demo'
                      ? 'border-b-2 border-sky-600 text-sky-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Play className="h-4 w-4" />
                  <span>Demo Class</span>
                </button>
              </div>

              {activeTab === 'overview' ? (
                <div className="space-y-8 p-6 sm:p-8">
                  {/* Course Instructors */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Course Instructors
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-5">
                      {instructors.map((inst) => (
                        <div key={inst.id} className="flex w-28 flex-col items-center text-center">
                          <img
                            src={inst.avatar}
                            alt={inst.name}
                            className="h-16 w-16 rounded-full border-2 border-sky-100 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <h4 className="mt-2 text-xs font-bold text-slate-900">{inst.name}</h4>
                          <p className="text-[11px] text-slate-500">{inst.subject}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Course Description & Outcomes */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Course Description
                    </h3>
                    <p
                      className={`mt-3 text-sm leading-relaxed text-slate-700 ${
                        expandedDesc ? '' : 'line-clamp-3'
                      }`}
                    >
                      {course.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedDesc((v) => !v)}
                      className="mt-2 text-xs font-bold text-sky-600 hover:underline"
                    >
                      {expandedDesc ? 'Show less' : 'See more'}
                    </button>

                    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {course.highlights.map((h) => (
                        <div
                          key={h}
                          className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-700"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>

                    {((course.learningOutcomes && course.learningOutcomes.length > 0) ||
                      (course.prerequisites && course.prerequisites.length > 0)) && (
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {course.learningOutcomes && course.learningOutcomes.length > 0 && (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                            <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-emerald-800">
                              <Target className="h-3.5 w-3.5" />
                              <span>What You Will Learn</span>
                            </h4>
                            <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                              {course.learningOutcomes.map((item) => (
                                <li key={item} className="flex items-start gap-1.5">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {course.prerequisites && course.prerequisites.length > 0 && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="text-xs font-extrabold uppercase text-slate-700">
                              Prerequisites &amp; Audience
                            </h4>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                              {course.prerequisites.map((p) => (
                                <li key={p}>{p}</li>
                              ))}
                              {(course.targetAudience ?? []).map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Batches & Routine (Selectable) */}
                  {batches.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        <span>Active Batches &amp; Schedules ({batches.length})</span>
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {batches.map((bat) => {
                          const seatInfo = computeBatchSeatUsage(bat);
                          const isSelected = selectedBatchId === bat.id;
                          const disabled = bat.status === 'closed' || seatInfo.isFull;
                          return (
                            <button
                              key={bat.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => setSelectedBatchId(bat.id)}
                              className={`rounded-xl border p-4 text-left transition-all ${
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                                  : 'border-slate-200 bg-slate-50/70 hover:border-indigo-300'
                              } disabled:opacity-60`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono-tabular rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                  {bat.code}
                                </span>
                                <span
                                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase ${
                                    bat.status === 'open'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : bat.status === 'running'
                                        ? 'bg-sky-50 text-sky-700'
                                        : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {seatInfo.isFull
                                    ? 'Seat Full'
                                    : bat.status === 'open'
                                      ? 'Admission Open'
                                      : bat.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm font-extrabold text-slate-900">
                                {bat.name}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                                <span>{bat.schedule}</span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Mode: <strong>{bat.mode}</strong> · {seatInfo.remainingSeats} seats
                                available
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hierarchical Syllabus Preview */}
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Course Curriculum ({lessons.length} Lectures &amp; Materials)
                    </h3>
                    <div className="mt-4 space-y-4">
                      {hierarchy.modulesTree.map((modNode, mIdx) => (
                        <div
                          key={modNode.module.id}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                            <p className="text-sm font-extrabold text-slate-900">
                              <span className="font-mono-tabular mr-2 text-indigo-600">
                                0{mIdx + 1}.
                              </span>
                              {modNode.module.title}
                            </p>
                            <span className="font-mono-tabular text-xs font-bold text-slate-500">
                              {modNode.totalLessons} items
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {modNode.chapters.map((chNode) => (
                              <div key={chNode.chapter.id} className="bg-white/60 p-3">
                                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                                  Chapter: {chNode.chapter.title}
                                </p>
                                <div className="space-y-2">
                                  {chNode.lessons.map((les) => (
                                    <LessonCurriculumRow
                                      key={les.id}
                                      lesson={les}
                                      onPreview={() => setActiveTab('demo')}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                            {modNode.directLessons.length > 0 && (
                              <div className="space-y-2 bg-white p-3">
                                {modNode.directLessons.map((les) => (
                                  <LessonCurriculumRow
                                    key={les.id}
                                    lesson={les}
                                    onPreview={() => setActiveTab('demo')}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {hierarchy.unassignedLessons.length > 0 && (
                        <div className="space-y-2">
                          {hierarchy.unassignedLessons.map((les) => (
                            <LessonCurriculumRow
                              key={les.id}
                              lesson={les}
                              onPreview={() => setActiveTab('demo')}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Verified Course Reviews */}
                  <div className="border-t border-slate-200 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        <span>Student Reviews &amp; Ratings ({reviews.length})</span>
                      </h3>
                      {typeof averageRating === 'number' && reviews.length > 0 && (
                        <span className="font-mono-tabular rounded-lg bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-800">
                          {averageRating} / 5.0 Average
                        </span>
                      )}
                    </div>

                    {reviews.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        No reviews published for this course yet. Enrolled students can share feedback below.
                      </p>
                    ) : (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-extrabold text-slate-900">{rev.name}</p>
                              <span className="font-mono-tabular inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                {rev.rating || 5}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-semibold text-indigo-700">
                              {rev.roleLabel}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-700">{rev.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {user && (
                      <form
                        onSubmit={handleReviewSubmit}
                        className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"
                      >
                        <p className="text-xs font-extrabold text-slate-900">
                          Write a Verified Course Review
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label htmlFor="rev-rating" className="text-xs font-bold text-slate-700">
                            Rating:
                          </label>
                          <select
                            id="rev-rating"
                            value={reviewRating}
                            onChange={(e) => setReviewRating(Number(e.target.value))}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold"
                          >
                            <option value={5}>5 Stars — Excellent</option>
                            <option value={4}>4 Stars — Very Good</option>
                            <option value={3}>3 Stars — Good</option>
                            <option value={2}>2 Stars — Fair</option>
                            <option value={1}>1 Star — Needs Work</option>
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          required
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="Share your learning experience with this course (enrolled students only)..."
                          className="mt-2.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        />
                        {reviewMsg && (
                          <p
                            className={`mt-2 text-xs font-bold ${
                              reviewMsg.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {reviewMsg.text}
                          </p>
                        )}
                        <button
                          type="submit"
                          disabled={reviewBusy}
                          className="mt-2.5 rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
                        >
                          {reviewBusy ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-6 sm:p-8">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {course.demoVideoTitle}
                  </h3>
                  {demoEmbedUrl ? (
                    <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-black">
                      <iframe
                        src={demoEmbedUrl}
                        title={course.demoVideoTitle}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-6 text-center text-white">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-lg">
                        <Play className="h-7 w-7 fill-slate-950" />
                      </span>
                      <p className="mt-4 text-base font-bold">{course.demoVideoTitle}</p>
                      <p className="mt-1 max-w-md text-xs text-slate-300">
                        Preview lesson unlocked for prospective learners. Enroll to unlock all{' '}
                        {lessons.length} live &amp; recorded modules, PDF sheets, and MCQ exams.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sticky Checkout Card */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="overflow-hidden rounded-xl">
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="aspect-[16/9] w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="mt-5 flex flex-col items-center">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono-tabular text-3xl font-extrabold text-indigo-600">
                    {fullPricing.isFree ? 'Free' : `৳${fullPricing.totalPayable}`}
                  </span>
                  {pricing.originalPrice > pricing.finalPrice && !fullPricing.isFree && (
                    <span className="font-mono-tabular text-base text-slate-400 line-through">
                      ৳{pricing.originalPrice}
                    </span>
                  )}
                </div>

                {fullPricing.admissionFee > 0 && (
                  <p className="font-mono-tabular mt-1 text-[11px] font-semibold text-slate-500">
                    Includes ৳{fullPricing.admissionFee} admission fee
                  </p>
                )}

                {pricing.baseDiscountPercent > 0 && !fullPricing.isFree && (
                  <span className="mt-2 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {pricing.baseDiscountPercent}% OFF
                    {pricing.appliedCouponCode
                      ? ` + ${pricing.appliedCouponCode} (-৳${pricing.couponDiscountAmount})`
                      : ''}
                  </span>
                )}

                {course.installmentEnabled && (
                  <p className="mt-2 text-[11px] font-semibold text-indigo-700">
                    Installment Plan: {course.installmentCount || 2} installments available
                  </p>
                )}
              </div>

              {/* Coupon Toggle */}
              {!fullPricing.isFree && course.couponEligible !== false && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setShowCouponBox((v) => !v)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>Have Coupon Code? (Try AEC20)</span>
                  </button>

                  {showCouponBox && (
                    <form onSubmit={handleApplyCoupon} className="mt-2.5 flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Enter code (e.g. AEC20)"
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white"
                      >
                        Apply
                      </button>
                    </form>
                  )}
                  {couponError && (
                    <p className="mt-1.5 text-center text-xs font-medium text-rose-600">
                      {couponError}
                    </p>
                  )}
                </div>
              )}

              {enrollStatus && (
                <div
                  className={`mt-4 rounded-xl p-3 text-xs font-semibold ${
                    enrollStatus.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {enrollStatus.msg}
                </div>
              )}

              {!enrollCheck.ok && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {enrollCheck.reason}
                </p>
              )}

              {/* Primary Enroll CTA */}
              <button
                type="button"
                disabled={!enrollCheck.ok}
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setEnrollOpen(true);
                  }
                }}
                className="mt-3 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                {!enrollCheck.ok
                  ? 'Enrollment Unavailable'
                  : user
                    ? 'Enroll Now (4-Step Checkout)'
                    : 'Login to Enroll'}
              </button>

              <FourStepPaymentModal
                open={enrollOpen}
                onClose={() => setEnrollOpen(false)}
                referenceType="course"
                itemTitle={course.title}
                baseAmount={fullPricing.discountedFee + fullPricing.admissionFee}
                initialCouponCode={appliedCoupon?.code || ''}
                initialDiscount={pricing.couponDiscountAmount}
                courseId={course.id}
                branchId={selectedBranchId}
                branches={branches}
                batches={batches}
                selectedBatchId={selectedBatchId}
                onSuccess={async ({ transaction }) => {
                  await refreshBootstrap();
                  setEnrollStatus({
                    type: 'ok',
                    msg:
                      transaction.status === 'completed'
                        ? `Enrollment approved! Invoice ${transaction.invoiceNo} issued. Open /learn to start classes.`
                        : `Request ${transaction.invoiceNo} submitted for Branch/Manual verification.`,
                  });
                }}
              />

              {/* Meta Footer */}
              <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    Students
                  </span>
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {course.enrolledCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-slate-400" />
                    Exam System
                  </span>
                  <span className="font-bold text-emerald-600">
                    {course.examSystemIncluded ? 'Included' : 'Optional'}
                  </span>
                </div>
                {course.certificateCriteria?.enabled !== false && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-slate-400" />
                      Certificate
                    </span>
                    <span className="font-bold text-indigo-700">Verified PDF</span>
                  </div>
                )}
                {course.paymentPolicy && (
                  <p className="border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                    Policy: {course.paymentPolicy}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LessonCurriculumRow({
  lesson,
  onPreview,
}: {
  lesson: CourseLesson;
  onPreview: () => void;
}) {
  const lType = lesson.lessonType ?? 'recorded';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
              lType === 'live'
                ? 'bg-rose-50 text-rose-700'
                : lType === 'lecture_sheet' || lType === 'pdf_notes' || lType === 'document'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-sky-50 text-sky-700'
            }`}
          >
            {lType === 'live' ? (
              <Radio className="h-3 w-3" />
            ) : lType === 'lecture_sheet' || lType === 'pdf_notes' || lType === 'document' ? (
              <FileText className="h-3 w-3" />
            ) : (
              <Video className="h-3 w-3" />
            )}
            <span>{lType.replace('_', ' ')}</span>
          </span>
          {lesson.batchName && (
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              {lesson.batchName}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-bold text-slate-900">{lesson.title}</p>
        <p className="text-xs text-slate-500">
          {lesson.moduleName} · <span className="font-mono-tabular">{lesson.duration}</span>
        </p>
      </div>
      {lesson.isFreePreview ? (
        <button
          type="button"
          onClick={onPreview}
          className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
        >
          Free Preview
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
          <Lock className="h-3 w-3" />
          <span>Enrolled Only</span>
        </span>
      )}
    </div>
  );
}
