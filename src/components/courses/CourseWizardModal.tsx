import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Globe,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resolveCourseCategories } from '../../lib/batchEnterprise';
import { calculateCoursePricingServerSide, generateCourseSlug } from '../../lib/courseEnterprise';
import type {
  Branch,
  Course,
  CourseBatch,
  CourseDeliveryType,
  CourseLevel,
  CourseStatus,
  CourseVisibility,
  EnrollmentAvailability,
  Instructor,
} from '../../types';
import { ImageUploadField } from '../ImageUploadField';

interface CourseWizardModalProps {
  open: boolean;
  course: Course | null;
  templateDefaults?: Partial<Course> | null;
  sampleModules?: string[];
  allCourses: Course[];
  branches: Branch[];
  instructors: Instructor[];
  batches: CourseBatch[];
  onClose: () => void;
  onSaved: (message: string, savedCourse?: Course) => Promise<void> | void;
}

interface DraftBatchRow {
  name: string;
  code: string;
  branchId: string;
  instructorId: string;
  schedule: string;
  classDurationMinutes: number;
  classroomOrMeeting: string;
  startDate: string;
  endDate: string;
  seatLimit: number;
  mode: 'Online Live' | 'Offline Branch' | 'Hybrid';
}

const THUMBNAIL_PRESETS = [
  { label: 'HSC English', url: '/src/assets/images/hero_hsc_english_1795411661478.jpg' },
  { label: 'IELTS & Batch', url: '/src/assets/images/hero_ielts_batch_1795411661577.jpg' },
  { label: 'Spoken & Grammar', url: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg' },
  { label: 'Course Books', url: '/src/assets/images/course_english_books_1795411661325.jpg' },
];

const STEPS = [
  { id: 1, title: 'Basic Info', icon: BookOpen },
  { id: 2, title: 'Configuration', icon: CalendarClock },
  { id: 3, title: 'Pricing', icon: CreditCard },
  { id: 4, title: 'Instructors & Batches', icon: Users },
  { id: 5, title: 'Publish & SEO', icon: Globe },
] as const;

export function CourseWizardModal({
  open,
  course,
  templateDefaults,
  sampleModules,
  allCourses,
  branches,
  instructors,
  batches,
  onClose,
  onSaved,
}: CourseWizardModalProps) {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const isEditing = Boolean(course);
  const dynamicCategories = resolveCourseCategories(bootstrap?.categories ?? [], allCourses);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatBusy, setQuickCatBusy] = useState(false);
  const lastInitKeyRef = useRef<string | null>(null);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [category, setCategory] = useState<Course['category']>('HSC English');
  const [levelTag, setLevelTag] = useState('HSC 27');
  const [level, setLevel] = useState<CourseLevel>('Intermediate');
  const [language, setLanguage] = useState('Bangla & English');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState(THUMBNAIL_PRESETS[0].url);
  const [bannerImage, setBannerImage] = useState('');
  const [demoVideoTitle, setDemoVideoTitle] = useState('');
  const [demoYoutubeUrl, setDemoYoutubeUrl] = useState('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  const [tagsText, setTagsText] = useState('');
  const [isCombo, setIsCombo] = useState(false);
  const [includedCoursesText, setIncludedCoursesText] = useState('');

  // Step 2: Configuration
  const [courseType, setCourseType] = useState<CourseDeliveryType>('Hybrid');
  const [durationLabel, setDurationLabel] = useState('4 Months');
  const [totalClasses, setTotalClasses] = useState('40');
  const [estimatedHours, setEstimatedHours] = useState('60');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [minEnrollment, setMinEnrollment] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enrollmentStartDate, setEnrollmentStartDate] = useState('');
  const [enrollmentDeadline, setEnrollmentDeadline] = useState('');
  const [prerequisitesText, setPrerequisitesText] = useState('');
  const [outcomesText, setOutcomesText] = useState('');
  const [audienceText, setAudienceText] = useState('');
  const [highlightsText, setHighlightsText] = useState('');

  // Step 3: Pricing
  const [isFree, setIsFree] = useState(false);
  const [originalPrice, setOriginalPrice] = useState('3500');
  const [price, setPrice] = useState('1990');
  const [admissionFee, setAdmissionFee] = useState('0');
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [paymentPolicy, setPaymentPolicy] = useState(
    'Full refund eligible within 7 days before batch commencement.'
  );
  const [couponEligible, setCouponEligible] = useState(true);
  const [examSystemIncluded, setExamSystemIncluded] = useState(true);

  // Step 4: Instructors & Batches
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [newBatches, setNewBatches] = useState<DraftBatchRow[]>([]);

  // Step 5: Publish, Certificate & SEO
  const [status, setStatus] = useState<CourseStatus>('published');
  const [featured, setFeatured] = useState(false);
  const [visibility, setVisibility] = useState<CourseVisibility>('public');
  const [enrollmentAvailability, setEnrollmentAvailability] =
    useState<EnrollmentAvailability>('open');
  const [sequentialAccess, setSequentialAccess] = useState(false);
  const [certEnabled, setCertEnabled] = useState(true);
  const [certMinProgress, setCertMinProgress] = useState('80');
  const [certRequireExam, setCertRequireExam] = useState(false);
  const [certMinExam, setCertMinExam] = useState('50');
  const [certRequireAssignment, setCertRequireAssignment] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [noIndex, setNoIndex] = useState(false);

  useEffect(() => {
    if (!open) {
      lastInitKeyRef.current = null;
      return;
    }
    const initKey = `${course?.id ?? 'new'}::${templateDefaults?.title ?? ''}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    setStep(1);
    setError(null);
    setQuickCatOpen(false);
    setQuickCatName('');
    setNewBatches([]);

    const src = course ?? templateDefaults ?? null;
    if (src) {
      setTitle(src.title ?? '');
      setSlug(src.slug ?? '');
      setSlugManuallyEdited(Boolean(course?.slug));
      setCategory((src.category as Course['category']) ?? 'HSC English');
      setLevelTag(src.levelTag ?? 'HSC 27');
      setLevel(src.level ?? 'Intermediate');
      setLanguage(src.language ?? 'Bangla & English');
      setSubtitle(src.subtitle ?? '');
      setDescription(src.description ?? '');
      setThumbnail(src.thumbnail ?? THUMBNAIL_PRESETS[0].url);
      setBannerImage(src.bannerImage ?? '');
      setDemoVideoTitle(src.demoVideoTitle ?? '');
      setDemoYoutubeUrl(src.demoYoutubeUrl ?? 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setTagsText((src.tags ?? []).join(', '));
      setIsCombo(Boolean(src.isCombo));
      setIncludedCoursesText((src.includedCourses ?? []).join('\n'));

      setCourseType(src.courseType ?? 'Hybrid');
      setDurationLabel(src.durationLabel ?? '4 Months');
      setTotalClasses(String(src.totalClasses ?? 40));
      setEstimatedHours(String(src.estimatedHours ?? 60));
      setMaxCapacity(src.maxCapacity ? String(src.maxCapacity) : '');
      setMinEnrollment(src.minEnrollment !== undefined ? String(src.minEnrollment) : '5');
      setStartDate(src.startDate ?? '');
      setEndDate(src.endDate ?? '');
      setEnrollmentStartDate(src.enrollmentStartDate ?? '');
      setEnrollmentDeadline(src.enrollmentDeadline ?? '');
      setPrerequisitesText((src.prerequisites ?? []).join('\n'));
      setOutcomesText((src.learningOutcomes ?? []).join('\n'));
      setAudienceText((src.targetAudience ?? []).join('\n'));
      setHighlightsText(
        (
          src.highlights ?? [
            'Structured Bilingual Lectures',
            'Printable PDF Lecture Sheets',
            'Automated Weekly MCQ Evaluation',
          ]
        ).join('\n')
      );

      setIsFree(Boolean(src.isFree));
      setOriginalPrice(String(src.originalPrice ?? 3500));
      setPrice(String(src.price ?? 1990));
      setAdmissionFee(String(src.admissionFee ?? 0));
      setInstallmentEnabled(Boolean(src.installmentEnabled));
      setInstallmentCount(String(src.installmentCount ?? 2));
      setPaymentPolicy(
        src.paymentPolicy ?? 'Full refund eligible within 7 days before batch commencement.'
      );
      setCouponEligible(src.couponEligible !== false);
      setExamSystemIncluded(src.examSystemIncluded !== false);

      setBranchIds(src.branchIds?.length ? src.branchIds : branches.map((b) => b.id));
      setInstructorIds(
        src.instructorIds?.length ? src.instructorIds : instructors.slice(0, 1).map((i) => i.id)
      );

      setStatus(src.status ?? 'published');
      setFeatured(Boolean(src.featured));
      setVisibility(src.visibility ?? 'public');
      setEnrollmentAvailability(src.enrollmentAvailability ?? 'open');
      setSequentialAccess(Boolean(src.sequentialAccess));

      const crit = src.certificateCriteria;
      setCertEnabled(crit ? crit.enabled !== false : true);
      setCertMinProgress(String(crit?.minProgressPercent ?? 80));
      setCertRequireExam(Boolean(crit?.requireExamPass));
      setCertMinExam(String(crit?.minExamPercent ?? 50));
      setCertRequireAssignment(Boolean(crit?.requireAssignmentCompletion));

      const seo = src.seo;
      setMetaTitle(seo?.metaTitle ?? '');
      setMetaDescription(seo?.metaDescription ?? '');
      setMetaKeywords(seo?.metaKeywords ?? seo?.focusKeyword ?? '');
      setCanonicalUrl(seo?.canonicalUrl ?? '');
      setOgImage(seo?.ogImage ?? '');
      setNoIndex(Boolean(seo?.noIndex));
    } else {
      setTitle('');
      setSlug('');
      setSlugManuallyEdited(false);
      setCategory('HSC English');
      setLevelTag('HSC 27');
      setLevel('Intermediate');
      setLanguage('Bangla & English');
      setSubtitle('');
      setDescription('');
      setThumbnail(THUMBNAIL_PRESETS[0].url);
      setBannerImage('');
      setDemoVideoTitle('');
      setDemoYoutubeUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setTagsText('English, Board Exam, Grammar');
      setIsCombo(false);
      setIncludedCoursesText('');

      setCourseType('Hybrid');
      setDurationLabel('4 Months');
      setTotalClasses('40');
      setEstimatedHours('60');
      setMaxCapacity('');
      setMinEnrollment('5');
      setStartDate('');
      setEndDate('');
      setEnrollmentStartDate('');
      setEnrollmentDeadline('');
      setPrerequisitesText('Basic reading & writing comprehension');
      setOutcomesText('Master core grammar rules and exam writing formats\nScore higher in weekly MCQ & CQ mocks');
      setAudienceText('SSC / HSC & Academic English students');
      setHighlightsText(
        'Structured Bilingual Live & Recorded Lectures\nPrintable PDF Practice Sheets\nAutomated Weekly MCQ Evaluation'
      );

      setIsFree(false);
      setOriginalPrice('3500');
      setPrice('1990');
      setAdmissionFee('0');
      setInstallmentEnabled(false);
      setInstallmentCount('2');
      setPaymentPolicy('Full refund eligible within 7 days before batch commencement.');
      setCouponEligible(true);
      setExamSystemIncluded(true);

      setBranchIds(branches.filter((b) => b.status === 'active').map((b) => b.id));
      setInstructorIds(instructors.slice(0, 1).map((i) => i.id));

      setStatus('published');
      setFeatured(false);
      setVisibility('public');
      setEnrollmentAvailability('open');
      setSequentialAccess(false);
      setCertEnabled(true);
      setCertMinProgress('80');
      setCertRequireExam(false);
      setCertMinExam('50');
      setCertRequireAssignment(false);
      setMetaTitle('');
      setMetaDescription('');
      setMetaKeywords('');
      setCanonicalUrl('');
      setOgImage('');
      setNoIndex(false);
    }
  }, [open, course, templateDefaults, branches, instructors]);

  if (!open) return null;

  const existingCourseBatches = course ? batches.filter((b) => b.courseId === course.id) : [];

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slugManuallyEdited) {
      setSlug(generateCourseSlug(val, allCourses, course?.id));
    }
  };

  const pricingPreview = calculateCoursePricingServerSide({
    isFree,
    price: Number(price) || 0,
    originalPrice: Number(originalPrice) || 0,
    admissionFee: Number(admissionFee) || 0,
    couponEligible,
  });

  const addDraftBatchRow = () => {
    const defBranch = branchIds[0] || branches[0]?.id || 'br-mirpur';
    const defInst = instructorIds[0] || instructors[0]?.id || 'inst-1';
    setNewBatches((prev) => [
      ...prev,
      {
        name: `${title.trim() || 'New Course'} — Batch ${existingCourseBatches.length + prev.length + 1}`,
        code: `AEC-${Date.now().toString().slice(-4)}`,
        branchId: defBranch,
        instructorId: defInst,
        schedule: 'Sun · Tue · Thu (5:00 PM)',
        classDurationMinutes: 60,
        classroomOrMeeting: 'Room 302 / Live Zoom',
        startDate: startDate || new Date().toISOString().slice(0, 10),
        endDate: endDate || '',
        seatLimit: 40,
        mode: courseType === 'Offline' ? 'Offline Branch' : courseType === 'Online' ? 'Online Live' : 'Hybrid',
      },
    ]);
  };

  const splitLines = (raw: string) =>
    raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) {
      setStep(1);
      setError('Course Title is required in Step 1.');
      return;
    }
    if (!subtitle.trim()) {
      setStep(1);
      setError('Short Description / Subtitle is required in Step 1.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || generateCourseSlug(title, allCourses, course?.id),
        subtitle: subtitle.trim(),
        category,
        levelTag: levelTag.trim() || '2026 Batch',
        level,
        language: language.trim() || 'Bangla & English',
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isCombo,
        includedCourses: isCombo ? splitLines(includedCoursesText) : undefined,
        description: description.trim() || subtitle.trim(),
        thumbnail: thumbnail.trim() || THUMBNAIL_PRESETS[0].url,
        bannerImage: bannerImage.trim() || undefined,
        demoVideoTitle: demoVideoTitle.trim() || `${title.trim()} — Orientation`,
        demoYoutubeUrl: demoYoutubeUrl.trim(),
        courseType,
        durationLabel: durationLabel.trim(),
        totalClasses: Number(totalClasses) || 1,
        estimatedHours: Number(estimatedHours) || 1,
        maxCapacity: maxCapacity ? Number(maxCapacity) : undefined,
        minEnrollment: minEnrollment !== '' ? Number(minEnrollment) : 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        enrollmentStartDate: enrollmentStartDate || undefined,
        enrollmentDeadline: enrollmentDeadline || undefined,
        prerequisites: splitLines(prerequisitesText),
        learningOutcomes: splitLines(outcomesText),
        targetAudience: splitLines(audienceText),
        highlights: splitLines(highlightsText),
        isFree,
        price: isFree ? 0 : Math.max(0, Number(price) || 0),
        originalPrice: isFree ? 0 : Math.max(Number(price) || 0, Number(originalPrice) || 0),
        admissionFee: isFree ? 0 : Math.max(0, Number(admissionFee) || 0),
        installmentEnabled,
        installmentCount: Number(installmentCount) || 2,
        paymentPolicy: paymentPolicy.trim() || undefined,
        couponEligible,
        examSystemIncluded,
        branchIds,
        instructorIds,
        status,
        featured,
        visibility,
        enrollmentAvailability,
        sequentialAccess,
        certificateCriteria: {
          enabled: certEnabled,
          minProgressPercent: Math.min(100, Math.max(0, Number(certMinProgress) || 80)),
          requireExamPass: certRequireExam,
          minExamPercent: Math.min(100, Math.max(0, Number(certMinExam) || 50)),
          requireAssignmentCompletion: certRequireAssignment,
        },
        seo: {
          metaTitle: metaTitle.trim() || undefined,
          metaDescription: metaDescription.trim() || undefined,
          metaKeywords: metaKeywords.trim() || undefined,
          canonicalUrl: canonicalUrl.trim() || undefined,
          ogImage: ogImage.trim() || undefined,
          noIndex,
        },
      };

      const res = await apiFetch<{ course: Course }>(
        isEditing ? `/api/portal/courses/${course!.id}` : '/api/portal/courses',
        {
          method: isEditing ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        }
      );

      const savedCourse = res.course;

      // Provision any newly added batches in Step 4
      for (const b of newBatches) {
        if (!b.name.trim() || !b.code.trim()) continue;
        await apiFetch('/api/portal/batches', {
          method: 'POST',
          body: JSON.stringify({
            courseId: savedCourse.id,
            name: b.name.trim(),
            code: b.code.trim(),
            branchId: b.branchId,
            instructorId: b.instructorId,
            schedule: b.schedule.trim(),
            classDurationMinutes: Number(b.classDurationMinutes) || 60,
            classroomOrMeeting: b.classroomOrMeeting.trim() || undefined,
            startDate: b.startDate || new Date().toISOString().slice(0, 10),
            endDate: b.endDate || undefined,
            seatLimit: Math.max(1, Number(b.seatLimit) || 30),
            mode: b.mode,
            status: 'open',
          }),
        });
      }

      // If initialized from template with sampleModules, seed starter modules on new course
      if (!isEditing && sampleModules && sampleModules.length > 0) {
        for (const modTitle of sampleModules) {
          await apiFetch(`/api/portal/courses/${savedCourse.id}/modules`, {
            method: 'POST',
            body: JSON.stringify({ title: modTitle, status: 'published' }),
          });
        }
      }

      await onSaved(
        isEditing
          ? `Course "${savedCourse.title}" updated successfully.`
          : `Course "${savedCourse.title}" created successfully.`,
        savedCourse
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit Course Wizard' : '5-Step Course Creation Wizard'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
        {/* Header & Stepper */}
        <div className="border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <div>
                <h2 className="text-base font-extrabold">
                  {isEditing ? `Edit Course: ${course?.title}` : 'Enterprise Course Creation Wizard'}
                </h2>
                <p className="text-[11px] text-sky-200">
                  Step {step} of 5 · Configure curriculum metadata, pricing, batches, and SEO
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close course wizard"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              const completed = step > s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-bold transition-colors ${
                    active
                      ? 'bg-amber-400 text-slate-950'
                      : completed
                        ? 'bg-emerald-600/80 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden truncate sm:inline">
                    {s.id}. {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {/* STEP 1: BASIC INFO */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-title" className="mb-1 block text-xs font-bold text-slate-700">
                    Course Title *
                  </label>
                  <input
                    id="cw-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. HSC 27 English A+ Complete Mastery"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label htmlFor="cw-slug" className="mb-1 block text-xs font-bold text-slate-700">
                    URL Slug (Auto / Editable)
                  </label>
                  <input
                    id="cw-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugManuallyEdited(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="hsc-27-english-complete"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label htmlFor="cw-cat" className="block text-xs font-bold text-slate-700">
                      Category
                    </label>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => setQuickCatOpen((v) => !v)}
                        className="text-[11px] font-bold text-indigo-600 hover:underline"
                      >
                        {quickCatOpen ? 'Close' : '+ New Category'}
                      </button>
                    )}
                  </div>
                  <select
                    id="cw-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {dynamicCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {quickCatOpen && user?.role === 'admin' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={quickCatName}
                        onChange={(e) => setQuickCatName(e.target.value)}
                        placeholder="New category name..."
                        aria-label="New course category name"
                        className="min-w-0 flex-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        disabled={quickCatBusy || !quickCatName.trim()}
                        onClick={async () => {
                          if (!quickCatName.trim()) return;
                          setQuickCatBusy(true);
                          try {
                            const res = await apiFetch<{ category: { name: string } }>(
                              '/api/portal/categories',
                              {
                                method: 'POST',
                                body: JSON.stringify({
                                  name: quickCatName.trim(),
                                  type: 'course',
                                  active: true,
                                }),
                              }
                            );
                            await refreshBootstrap();
                            setCategory(res.category.name);
                            setQuickCatName('');
                            setQuickCatOpen(false);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to create category.');
                          } finally {
                            setQuickCatBusy(false);
                          }
                        }}
                        className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {quickCatBusy ? '...' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="cw-level" className="mb-1 block text-xs font-bold text-slate-700">
                    Level
                  </label>
                  <select
                    id="cw-level"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as CourseLevel)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cw-ltag" className="mb-1 block text-xs font-bold text-slate-700">
                    Badge Tag
                  </label>
                  <input
                    id="cw-ltag"
                    type="text"
                    value={levelTag}
                    onChange={(e) => setLevelTag(e.target.value)}
                    placeholder="HSC 27 / IELTS 8.0"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label htmlFor="cw-lang" className="mb-1 block text-xs font-bold text-slate-700">
                    Language
                  </label>
                  <input
                    id="cw-lang"
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="Bangla & English"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cw-sub" className="mb-1 block text-xs font-bold text-slate-700">
                  Short Description / Subtitle *
                </label>
                <input
                  id="cw-sub"
                  type="text"
                  required
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Concise 1-sentence value proposition shown on catalog cards"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium"
                />
              </div>

              <div>
                <label htmlFor="cw-desc" className="mb-1 block text-xs font-bold text-slate-700">
                  Full Course Description
                </label>
                <textarea
                  id="cw-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed curriculum overview, teaching methodology, and exam preparation plan..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <ImageUploadField
                    label="Course Thumbnail"
                    value={thumbnail}
                    onChange={setThumbnail}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {THUMBNAIL_PRESETS.map((p) => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => setThumbnail(p.url)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:border-indigo-400"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ImageUploadField
                  label="Course Banner Image (Optional)"
                  value={bannerImage}
                  onChange={setBannerImage}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-dtitle" className="mb-1 block text-xs font-bold text-slate-700">
                    Intro Video Title
                  </label>
                  <input
                    id="cw-dtitle"
                    type="text"
                    value={demoVideoTitle}
                    onChange={(e) => setDemoVideoTitle(e.target.value)}
                    placeholder="Course Orientation & Study Plan"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-durl" className="mb-1 block text-xs font-bold text-slate-700">
                    Intro Video URL
                  </label>
                  <input
                    id="cw-durl"
                    type="url"
                    value={demoYoutubeUrl}
                    onChange={(e) => setDemoYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-tags" className="mb-1 block text-xs font-bold text-slate-700">
                    Tags (comma separated)
                  </label>
                  <input
                    id="cw-tags"
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="HSC, Grammar, Board Exam"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={isCombo}
                      onChange={(e) => setIsCombo(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>Bundle / Combo Course Pack</span>
                  </label>
                </div>
              </div>

              {isCombo && (
                <div>
                  <label htmlFor="cw-inc" className="mb-1 block text-xs font-bold text-slate-700">
                    Included Sub-Courses (1 per line)
                  </label>
                  <textarea
                    id="cw-inc"
                    rows={3}
                    value={includedCoursesText}
                    onChange={(e) => setIncludedCoursesText(e.target.value)}
                    placeholder="HSC 1st Paper&#10;HSC 2nd Paper&#10;Board Mock Exams"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 2: COURSE CONFIGURATION */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="cw-type" className="mb-1 block text-xs font-bold text-slate-700">
                    Delivery Type
                  </label>
                  <select
                    id="cw-type"
                    value={courseType}
                    onChange={(e) => setCourseType(e.target.value as CourseDeliveryType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Hybrid">Hybrid (Campus + Online)</option>
                    <option value="Online">Online Live &amp; Recorded</option>
                    <option value="Offline">Offline Campus Only</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cw-dur" className="mb-1 block text-xs font-bold text-slate-700">
                    Course Duration
                  </label>
                  <input
                    id="cw-dur"
                    type="text"
                    value={durationLabel}
                    onChange={(e) => setDurationLabel(e.target.value)}
                    placeholder="4 Months"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-classes" className="mb-1 block text-xs font-bold text-slate-700">
                    Total Classes
                  </label>
                  <input
                    id="cw-classes"
                    type="number"
                    min={1}
                    value={totalClasses}
                    onChange={(e) => setTotalClasses(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-hours" className="mb-1 block text-xs font-bold text-slate-700">
                    Est. Learning Hours
                  </label>
                  <input
                    id="cw-hours"
                    type="number"
                    min={1}
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="cw-maxcap" className="mb-1 block text-xs font-bold text-slate-700">
                    Max Student Capacity
                  </label>
                  <input
                    id="cw-maxcap"
                    type="number"
                    min={1}
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    placeholder="Unlimited"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-minenr" className="mb-1 block text-xs font-bold text-slate-700">
                    Min Enrollment
                  </label>
                  <input
                    id="cw-minenr"
                    type="number"
                    min={0}
                    value={minEnrollment}
                    onChange={(e) => setMinEnrollment(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-sdate" className="mb-1 block text-xs font-bold text-slate-700">
                    Course Start Date
                  </label>
                  <input
                    id="cw-sdate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-edate" className="mb-1 block text-xs font-bold text-slate-700">
                    Course End Date
                  </label>
                  <input
                    id="cw-edate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-esdate" className="mb-1 block text-xs font-bold text-slate-700">
                    Enrollment Start Date
                  </label>
                  <input
                    id="cw-esdate"
                    type="date"
                    value={enrollmentStartDate}
                    onChange={(e) => setEnrollmentStartDate(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-edead" className="mb-1 block text-xs font-bold text-slate-700">
                    Enrollment Deadline
                  </label>
                  <input
                    id="cw-edead"
                    type="date"
                    value={enrollmentDeadline}
                    onChange={(e) => setEnrollmentDeadline(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-prereq" className="mb-1 block text-xs font-bold text-slate-700">
                    Prerequisites (1 per line)
                  </label>
                  <textarea
                    id="cw-prereq"
                    rows={3}
                    value={prerequisitesText}
                    onChange={(e) => setPrerequisitesText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-out" className="mb-1 block text-xs font-bold text-slate-700">
                    Learning Outcomes (1 per line)
                  </label>
                  <textarea
                    id="cw-out"
                    rows={3}
                    value={outcomesText}
                    onChange={(e) => setOutcomesText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cw-aud" className="mb-1 block text-xs font-bold text-slate-700">
                    Target Audience (1 per line)
                  </label>
                  <textarea
                    id="cw-aud"
                    rows={3}
                    value={audienceText}
                    onChange={(e) => setAudienceText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="cw-hl" className="mb-1 block text-xs font-bold text-slate-700">
                    Course Key Highlights (1 per line)
                  </label>
                  <textarea
                    id="cw-hl"
                    rows={3}
                    value={highlightsText}
                    onChange={(e) => setHighlightsText(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRICING */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span>Free / Scholarship Course (৳0 Tuition)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={couponEligible}
                    onChange={(e) => setCouponEligible(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>Eligible for Promo Coupons (e.g. AEC20)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={examSystemIncluded}
                    onChange={(e) => setExamSystemIncluded(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>Exam Center &amp; Certificates Included</span>
                </label>
              </div>

              {!isFree && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="cw-orig" className="mb-1 block text-xs font-bold text-slate-700">
                      Regular Course Fee (৳)
                    </label>
                    <input
                      id="cw-orig"
                      type="number"
                      min={0}
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="cw-price" className="mb-1 block text-xs font-bold text-slate-700">
                      Discounted Selling Fee (৳)
                    </label>
                    <input
                      id="cw-price"
                      type="number"
                      min={0}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-indigo-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="cw-adm" className="mb-1 block text-xs font-bold text-slate-700">
                      Admission / Kit Fee (৳)
                    </label>
                    <input
                      id="cw-adm"
                      type="number"
                      min={0}
                      value={admissionFee}
                      onChange={(e) => setAdmissionFee(e.target.value)}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={installmentEnabled}
                      onChange={(e) => setInstallmentEnabled(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>Enable Installment Option</span>
                  </label>
                  {installmentEnabled && (
                    <div>
                      <label htmlFor="cw-instcnt" className="mb-1 block text-xs font-semibold text-slate-600">
                        Number of Installments
                      </label>
                      <input
                        id="cw-instcnt"
                        type="number"
                        min={2}
                        max={12}
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                        className="font-mono-tabular w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold"
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs">
                  <p className="font-extrabold text-indigo-950">Server-Validated Checkout Preview</p>
                  <div className="mt-2 space-y-1 text-indigo-900">
                    <div className="flex justify-between">
                      <span>Tuition Fee:</span>
                      <span className="font-mono-tabular font-bold">
                        {pricingPreview.isFree ? 'Free' : `৳${pricingPreview.discountedFee}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Admission Fee:</span>
                      <span className="font-mono-tabular font-bold">৳{pricingPreview.admissionFee}</span>
                    </div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1 text-sm font-extrabold">
                      <span>Total Payable at Checkout:</span>
                      <span className="font-mono-tabular text-indigo-700">
                        {pricingPreview.isFree ? '৳0 (Free)' : `৳${pricingPreview.totalPayable}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="cw-policy" className="mb-1 block text-xs font-bold text-slate-700">
                  Payment &amp; Refund Policy
                </label>
                <textarea
                  id="cw-policy"
                  rows={2}
                  value={paymentPolicy}
                  onChange={(e) => setPaymentPolicy(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          {/* STEP 4: INSTRUCTORS & MULTI-BATCH */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Assigned Instructors
                  </h3>
                  <div className="mt-2.5 space-y-1.5">
                    {instructors.map((inst) => {
                      const checked = instructorIds.includes(inst.id);
                      return (
                        <label
                          key={inst.id}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setInstructorIds((prev) =>
                                checked ? prev.filter((id) => id !== inst.id) : [...prev, inst.id]
                              )
                            }
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>{inst.name}</span>
                          <span className="ml-auto text-[11px] text-slate-500">{inst.subject}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Available Campus Branches
                  </h3>
                  <div className="mt-2.5 space-y-1.5">
                    {branches.map((br) => {
                      const checked = branchIds.includes(br.id);
                      return (
                        <label
                          key={br.id}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setBranchIds((prev) =>
                                checked ? prev.filter((id) => id !== br.id) : [...prev, br.id]
                              )
                            }
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>{br.name}</span>
                          <span className="ml-auto text-[11px] text-slate-500">{br.city}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {existingCourseBatches.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    <span>Existing Linked Batches ({existingCourseBatches.length})</span>
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {existingCourseBatches.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <p className="font-bold text-slate-900">
                          {b.name} ({b.code})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {b.schedule} · Seats {b.enrolledSeats}/{b.seatLimit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900">
                      Add New Batch(es) with This Course
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Automatically created and linked when you save this wizard.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addDraftBatchRow}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Batch</span>
                  </button>
                </div>

                {newBatches.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {newBatches.map((nb, idx) => (
                      <div
                        key={idx}
                        className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-700">New Batch #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setNewBatches((prev) => prev.filter((_, i) => i !== idx))
                            }
                            aria-label={`Remove new batch ${idx + 1}`}
                            className="rounded-lg p-1 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input
                            type="text"
                            value={nb.name}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                              )
                            }
                            placeholder="Batch Name"
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold"
                          />
                          <input
                            type="text"
                            value={nb.code}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, code: e.target.value } : r))
                              )
                            }
                            placeholder="Batch Code"
                            className="font-mono-tabular rounded-lg border border-slate-300 px-2.5 py-1.5 uppercase"
                          />
                          <input
                            type="text"
                            value={nb.schedule}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, schedule: e.target.value } : r
                                )
                              )
                            }
                            placeholder="Class Schedule"
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <select
                            value={nb.branchId}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, branchId: e.target.value } : r
                                )
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                          >
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={nb.instructorId}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, instructorId: e.target.value } : r
                                )
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                          >
                            {instructors.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={nb.seatLimit}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, seatLimit: Number(e.target.value) } : r
                                )
                              )
                            }
                            placeholder="Seat Limit"
                            className="font-mono-tabular rounded-lg border border-slate-300 px-2.5 py-1.5"
                          />
                          <input
                            type="text"
                            value={nb.classroomOrMeeting}
                            onChange={(e) =>
                              setNewBatches((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, classroomOrMeeting: e.target.value }
                                    : r
                                )
                              )
                            }
                            placeholder="Room / Zoom"
                            className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: PUBLISH, CERTIFICATE & SEO */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="cw-status" className="mb-1 block text-xs font-bold text-slate-700">
                    Publish Status
                  </label>
                  <select
                    id="cw-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CourseStatus)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="active">Active (Live)</option>
                    <option value="draft">Draft</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cw-vis" className="mb-1 block text-xs font-bold text-slate-700">
                    Course Visibility
                  </label>
                  <select
                    id="cw-vis"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as CourseVisibility)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="public">Public (Listed in Catalog)</option>
                    <option value="unlisted">Unlisted (Direct Link Only)</option>
                    <option value="private">Private (Admin Invite Only)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="cw-avail" className="mb-1 block text-xs font-bold text-slate-700">
                    Enrollment Availability
                  </label>
                  <select
                    id="cw-avail"
                    value={enrollmentAvailability}
                    onChange={(e) =>
                      setEnrollmentAvailability(e.target.value as EnrollmentAvailability)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="open">Open for Enrollment</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <span>Featured Course</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={sequentialAccess}
                    onChange={(e) => setSequentialAccess(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>Enforce Sequential Lesson Progression</span>
                </label>
              </div>

              {/* Certificate Criteria */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-950">
                    <Award className="h-4 w-4 text-emerald-600" />
                    <span>Certificate Issuance Criteria</span>
                  </h3>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={certEnabled}
                      onChange={(e) => setCertEnabled(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-600"
                    />
                    <span>Enable Certificate</span>
                  </label>
                </div>
                {certEnabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <label htmlFor="cw-cprog" className="mb-1 block font-bold text-slate-700">
                        Min Lesson Progress (%)
                      </label>
                      <input
                        id="cw-cprog"
                        type="number"
                        min={0}
                        max={100}
                        value={certMinProgress}
                        onChange={(e) => setCertMinProgress(e.target.value)}
                        className="font-mono-tabular w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={certRequireExam}
                          onChange={(e) => setCertRequireExam(e.target.checked)}
                          className="h-4 w-4 rounded accent-indigo-600"
                        />
                        <span>Require Exam Pass</span>
                      </label>
                      {certRequireExam && (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={certMinExam}
                          onChange={(e) => setCertMinExam(e.target.value)}
                          placeholder="Min Exam %"
                          aria-label="Minimum exam percentage"
                          className="font-mono-tabular w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5"
                        />
                      )}
                    </div>
                    <div className="flex items-center">
                      <label className="flex cursor-pointer items-center gap-1.5 font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={certRequireAssignment}
                          onChange={(e) => setCertRequireAssignment(e.target.checked)}
                          className="h-4 w-4 rounded accent-indigo-600"
                        />
                        <span>Require All Assignments</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* SEO Metadata & Live SERP Preview */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Search Engine Optimization (SEO) &amp; OpenGraph
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label htmlFor="cw-mtitle" className="mb-1 block font-bold text-slate-700">
                      SEO Meta Title
                    </label>
                    <input
                      id="cw-mtitle"
                      type="text"
                      value={metaTitle}
                      onChange={(e) => setMetaTitle(e.target.value)}
                      placeholder={title || 'Course SEO Title'}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="cw-mkw" className="mb-1 block font-bold text-slate-700">
                      Focus Keywords
                    </label>
                    <input
                      id="cw-mkw"
                      type="text"
                      value={metaKeywords}
                      onChange={(e) => setMetaKeywords(e.target.value)}
                      placeholder="HSC English, Online Course, Dhaka"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
                <div className="text-xs">
                  <label htmlFor="cw-mdesc" className="mb-1 block font-bold text-slate-700">
                    SEO Meta Description
                  </label>
                  <textarea
                    id="cw-mdesc"
                    rows={2}
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder={subtitle || '150-character search snippet description'}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <label htmlFor="cw-canon" className="mb-1 block font-bold text-slate-700">
                      Canonical URL (Optional)
                    </label>
                    <input
                      id="cw-canon"
                      type="text"
                      value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)}
                      placeholder={`https://alomsenglishcenter.com/course/${slug || 'slug'}`}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={noIndex}
                        onChange={(e) => setNoIndex(e.target.checked)}
                        className="h-4 w-4 rounded accent-rose-600"
                      />
                      <span>Exclude from Search Indexing (noindex)</span>
                    </label>
                  </div>
                </div>

                <ImageUploadField
                  label="SEO / OpenGraph Social Share Image (Optional)"
                  value={ogImage}
                  onChange={setOgImage}
                  category="course"
                />

                {/* Live SERP Preview */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Google Search Preview
                  </p>
                  <p className="mt-1 truncate text-xs text-emerald-700">
                    {canonicalUrl || `https://alomsenglishcenter.com/course/${slug || 'course-slug'}`}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-bold text-indigo-700">
                    {metaTitle || title || 'Course Title'} — Alom&apos;s English Center
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                    {metaDescription || subtitle || description || 'Structured LMS course description.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5) : s))}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            ← Previous Step
          </button>

          <div className="flex items-center gap-2">
            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s < 5 ? ((s + 1) as 1 | 2 | 3 | 4 | 5) : s))}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                Next Step →
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-5 py-2 text-xs font-extrabold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Saving...' : isEditing ? 'Save Course Changes' : 'Create Course'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
