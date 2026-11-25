import {
  BookOpen,
  CheckCircle2,
  FileText,
  Layers,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { resolveCourseCategories } from '../lib/batchEnterprise';
import { calculateDiscountedPrice } from '../lib/domain';
import type { Branch, Course, CourseLesson, CourseStatus, Instructor, LessonType } from '../types';
import { ImageUploadField } from './ImageUploadField';

interface AdminCourseModalProps {
  open: boolean;
  course: Course | null;
  allCourses: Course[];
  branches: Branch[];
  instructors: Instructor[];
  lessons?: CourseLesson[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}

const THUMBNAIL_PRESETS = [
  {
    label: 'HSC English Banner',
    url: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
  },
  {
    label: 'IELTS & Batch Studio',
    url: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
  },
  {
    label: 'Spoken & Grammar Studio',
    url: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
  },
  {
    label: 'English Books & Kit',
    url: '/src/assets/images/course_english_books_1795411661325.jpg',
  },
];

const LEVEL_PRESETS = ['HSC 27', 'HSC 28', 'SSC 26', 'SSC 27', 'IELTS', 'Spoken', 'Admission', 'All Levels'];

export function AdminCourseModal({
  open,
  course,
  allCourses,
  branches,
  instructors,
  lessons = [],
  onClose,
  onSaved,
}: AdminCourseModalProps) {
  const { bootstrap, apiFetch } = useAuth();
  const isEditing = Boolean(course);
  const dynamicCategories = resolveCourseCategories(bootstrap?.categories ?? [], allCourses);

  const [tab, setTab] = useState<'details' | 'pricing' | 'curriculum' | 'lessons'>('details');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core details
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<Course['category']>('HSC English');
  const [levelTag, setLevelTag] = useState('HSC 27');
  const [status, setStatus] = useState<CourseStatus>('active');
  const [isCombo, setIsCombo] = useState(false);
  const [includedCourses, setIncludedCourses] = useState<string[]>([]);
  const [newSubCourse, setNewSubCourse] = useState('');

  // Pricing & Media
  const [price, setPrice] = useState('1990');
  const [originalPrice, setOriginalPrice] = useState('3000');
  const [examSystemIncluded, setExamSystemIncluded] = useState(true);
  const [thumbnail, setThumbnail] = useState(THUMBNAIL_PRESETS[0].url);
  const [demoVideoTitle, setDemoVideoTitle] = useState('');
  const [demoYoutubeUrl, setDemoYoutubeUrl] = useState('https://www.youtube.com/watch?v=M7lc1UVf-VE');

  // Description, Highlights, Branches & Instructors
  const [description, setDescription] = useState('');
  const [highlights, setHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState('');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [instructorIds, setInstructorIds] = useState<string[]>([]);

  // Quick lesson builder when editing
  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>([]);
  const [newLesType, setNewLesType] = useState<LessonType>('recorded');
  const [newLesTitle, setNewLesTitle] = useState('');
  const [newLesModule, setNewLesModule] = useState('Module 1: Core Grammar');
  const [newLesDuration, setNewLesDuration] = useState('35:00');
  const [newLesUrl, setNewLesUrl] = useState('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  const [newLesPreview, setNewLesPreview] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('details');
    setError(null);
    if (course) {
      setTitle(course.title);
      setSubtitle(course.subtitle);
      setCategory(course.category);
      setLevelTag(course.levelTag);
      setStatus(course.status);
      setIsCombo(course.isCombo);
      setIncludedCourses(course.includedCourses ?? []);
      setPrice(String(course.price));
      setOriginalPrice(String(course.originalPrice));
      setExamSystemIncluded(course.examSystemIncluded);
      setThumbnail(course.thumbnail || THUMBNAIL_PRESETS[0].url);
      setDemoVideoTitle(course.demoVideoTitle || '');
      setDemoYoutubeUrl(course.demoYoutubeUrl || 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setDescription(course.description || course.subtitle);
      setHighlights(course.highlights?.length ? course.highlights : []);
      setBranchIds(course.branchIds?.length ? course.branchIds : branches.map((b) => b.id));
      setInstructorIds(
        course.instructorIds?.length ? course.instructorIds : instructors.slice(0, 2).map((i) => i.id)
      );
      setCourseLessons(lessons.filter((l) => l.courseId === course.id));
    } else {
      setTitle('');
      setSubtitle('');
      setCategory('HSC English');
      setLevelTag('HSC 27');
      setStatus('active');
      setIsCombo(false);
      setIncludedCourses([]);
      setPrice('1990');
      setOriginalPrice('3000');
      setExamSystemIncluded(true);
      setThumbnail(THUMBNAIL_PRESETS[0].url);
      setDemoVideoTitle('');
      setDemoYoutubeUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setDescription('');
      setHighlights([
        'Structured Bilingual Live & Recorded Lectures',
        'Printable PDF Practice Sheets & Suggestion',
        'Automated Weekly MCQ & Written Evaluation',
      ]);
      setBranchIds(branches.map((b) => b.id));
      setInstructorIds(instructors.slice(0, 2).map((i) => i.id));
      setCourseLessons([]);
    }
  }, [open, course, branches, instructors, lessons]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const livePricing = calculateDiscountedPrice(
    Number(price) || 0,
    Math.max(Number(price) || 0, Number(originalPrice) || 0)
  );

  const toggleId = (list: string[], id: string, setter: (next: string[]) => void) => {
    if (list.includes(id)) {
      if (list.length === 1) return;
      setter(list.filter((item) => item !== id));
    } else {
      setter([...list, id]);
    }
  };

  const addHighlight = () => {
    const val = newHighlight.trim();
    if (!val) return;
    setHighlights([...highlights, val]);
    setNewHighlight('');
  };

  const addIncludedSubCourse = (name: string) => {
    const clean = name.trim();
    if (!clean || includedCourses.includes(clean)) return;
    setIncludedCourses([...includedCourses, clean]);
    setNewSubCourse('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !subtitle.trim()) {
      setError('Course title and subtitle are required.');
      setTab('details');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        category: isCombo && category === 'Combo Packs' ? 'Combo Packs' : category,
        levelTag: levelTag.trim() || 'HSC 27',
        status,
        isCombo,
        includedCourses: isCombo ? includedCourses : undefined,
        price: Math.max(0, Number(price) || 0),
        originalPrice: Math.max(Number(price) || 0, Number(originalPrice) || 0),
        examSystemIncluded,
        thumbnail: thumbnail.trim() || THUMBNAIL_PRESETS[0].url,
        demoVideoTitle: demoVideoTitle.trim() || `${title.trim()} — Orientation Class`,
        demoYoutubeUrl: demoYoutubeUrl.trim(),
        description: description.trim() || subtitle.trim(),
        highlights,
        branchIds,
        instructorIds,
      };

      if (isEditing && course) {
        await apiFetch(`/api/portal/courses/${course.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await onSaved(`Updated "${payload.title}" successfully.`);
      } else {
        await apiFetch('/api/portal/courses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await onSaved(`Published "${payload.title}" successfully.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuickLesson = async () => {
    if (!course || !newLesTitle.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ lesson: CourseLesson }>('/api/portal/lessons', {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          lessonType: newLesType,
          title: newLesTitle.trim(),
          moduleName: newLesModule.trim() || 'Module 1',
          duration: newLesDuration.trim() || '35:00',
          videoUrl: newLesType === 'recorded' ? newLesUrl.trim() : '',
          liveJoinUrl: newLesType === 'live' ? newLesUrl.trim() : '',
          liveStatus: newLesType === 'live' ? 'scheduled' : undefined,
          lectureSheetUrl: newLesType === 'lecture_sheet' ? newLesUrl.trim() : '',
          isFreePreview: newLesPreview,
        }),
      });
      setCourseLessons([...courseLessons, res.lesson]);
      setNewLesTitle('');
      await onSaved(`Added ${newLesType} lesson "${res.lesson.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add lesson.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuickLesson = async (lessonId: string) => {
    setSaving(true);
    try {
      await apiFetch(`/api/portal/lessons/${lessonId}`, { method: 'DELETE' });
      setCourseLessons(courseLessons.filter((l) => l.id !== lessonId));
      await onSaved('Lesson removed from syllabus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove lesson.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-studio-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-[#062436]">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 id="course-studio-title" className="text-base font-extrabold">
                {isEditing ? 'Modify Course / Batch Studio' : 'Create New Course / Combo Studio'}
              </h2>
              <p className="text-xs text-slate-300">
                Full control over pricing, combos, media, syllabus highlights & faculty
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close course studio"
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-6 py-2.5">
          {[
            { id: 'details', label: '1. Core Details & Combo' },
            { id: 'pricing', label: '2. Pricing & Media' },
            { id: 'curriculum', label: '3. Highlights & Faculty' },
            ...(isEditing ? [{ id: 'lessons', label: `4. Lessons (${courseLessons.length})` }] : []),
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                tab === item.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                {error}
              </div>
            )}

            {tab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="cs-title"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Course / Batch Title *
                    </label>
                    <input
                      id="cs-title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. HSC 27 English 1st & 2nd Paper Final Revision"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="cs-subtitle"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Short Subtitle *
                    </label>
                    <input
                      id="cs-subtitle"
                      type="text"
                      required
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Complete Board Grammar, Freehand Writing & Weekly MCQ Exams"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cs-category"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Course Category
                    </label>
                    <select
                      id="cs-category"
                      value={category}
                      onChange={(e) => {
                        const nextCat = e.target.value as Course['category'];
                        setCategory(nextCat);
                        if (nextCat === 'Combo Packs') setIsCombo(true);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                    >
                      {dynamicCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cs-level"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Batch / Level Tag (Shown on Filter & Card)
                    </label>
                    <input
                      id="cs-level"
                      type="text"
                      list="level-presets"
                      value={levelTag}
                      onChange={(e) => setLevelTag(e.target.value)}
                      placeholder="e.g. HSC 27, SSC 27, IELTS"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                    <datalist id="level-presets">
                      {LEVEL_PRESETS.map((lv) => (
                        <option key={lv} value={lv} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label
                      htmlFor="cs-status"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Publish Visibility
                    </label>
                    <select
                      id="cs-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CourseStatus)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                    >
                      <option value="active">Active (Live on /courses)</option>
                      <option value="draft">Draft (Hidden from students)</option>
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={isCombo}
                        onChange={(e) => setIsCombo(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      <Layers className="h-4 w-4 text-indigo-600" />
                      <span>Bundle as Combo Pack (Combos Section)</span>
                    </label>
                  </div>
                </div>

                {isCombo && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                    <p className="text-xs font-extrabold text-indigo-950">
                      Combo Included Courses ({includedCourses.length})
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Pick from existing courses or add custom course module names displayed inside the Combo card.
                    </p>

                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={newSubCourse}
                        onChange={(e) => setNewSubCourse(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addIncludedSubCourse(newSubCourse);
                          }
                        }}
                        placeholder="Add included course title..."
                        aria-label="Included course title"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => addIncludedSubCourse(newSubCourse)}
                        className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white"
                      >
                        Add
                      </button>
                    </div>

                    {allCourses.filter((c) => !c.isCombo && c.id !== course?.id).length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {allCourses
                          .filter((c) => !c.isCombo && c.id !== course?.id)
                          .slice(0, 6)
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => addIncludedSubCourse(c.title)}
                              className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-600 hover:text-white"
                            >
                              + {c.levelTag}: {c.title.slice(0, 26)}...
                            </button>
                          ))}
                      </div>
                    )}

                    {includedCourses.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {includedCourses.map((sub) => (
                          <div
                            key={sub}
                            className="flex items-center justify-between rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                          >
                            <span>{sub}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setIncludedCourses(includedCourses.filter((x) => x !== sub))
                              }
                              aria-label={`Remove ${sub}`}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'pricing' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="cs-price"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Sale Price (৳) — 0 for Free
                    </label>
                    <input
                      id="cs-price"
                      type="number"
                      min={0}
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cs-orig-price"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Regular Price (৳)
                    </label>
                    <input
                      id="cs-orig-price"
                      type="number"
                      min={0}
                      required
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-center">
                      <p className="text-[11px] font-semibold text-emerald-700">Live Discount Badge</p>
                      <p className="font-mono-tabular text-sm font-extrabold text-emerald-800">
                        {livePricing.basePrice === 0
                          ? 'FREE COURSE'
                          : livePricing.baseDiscountPercent > 0
                            ? `${livePricing.baseDiscountPercent}% OFF`
                            : 'No Discount'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={examSystemIncluded}
                      onChange={(e) => setExamSystemIncluded(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <span>Include Live MCQ & Written Exam System with this Course</span>
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-slate-700">
                    Course Banner Thumbnail Preset
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {THUMBNAIL_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setThumbnail(preset.url)}
                        className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
                          thumbnail === preset.url
                            ? 'border-indigo-600 ring-2 ring-indigo-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="aspect-video w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <p className="truncate px-2 py-1.5 text-[11px] font-bold text-slate-700">
                          {preset.label}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <ImageUploadField
                      label="Upload Custom Course Thumbnail or Enter URL"
                      value={thumbnail}
                      onChange={setThumbnail}
                      placeholder="/uploads/... or https://..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="cs-demo-title"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Demo Class Video Title
                    </label>
                    <input
                      id="cs-demo-title"
                      type="text"
                      value={demoVideoTitle}
                      onChange={(e) => setDemoVideoTitle(e.target.value)}
                      placeholder="Orientation & First Lesson Preview"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="cs-demo-url"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Demo Video URL
                    </label>
                    <input
                      id="cs-demo-url"
                      type="url"
                      value={demoYoutubeUrl}
                      onChange={(e) => setDemoYoutubeUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === 'curriculum' && (
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="cs-desc"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Full Course Description (Bangla / English)
                  </label>
                  <textarea
                    id="cs-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed syllabus overview, batch schedule, and exam support..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-slate-700">
                    Key Course Highlights ({highlights.length})
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newHighlight}
                      onChange={(e) => setNewHighlight(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addHighlight();
                        }
                      }}
                      placeholder="e.g. 60+ Live Classes & Printed Suggestion PDF"
                      aria-label="New course highlight"
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={addHighlight}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {highlights.map((h, i) => (
                      <div
                        key={`${h}-${i}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800"
                      >
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          {h}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHighlights(highlights.filter((_, idx) => idx !== i))}
                          aria-label={`Remove highlight ${h}`}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-700">Available Branches</p>
                    <div className="space-y-1.5 rounded-xl border border-slate-200 p-3">
                      {branches.map((b) => (
                        <label
                          key={b.id}
                          className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={branchIds.includes(b.id)}
                            onChange={() => toggleId(branchIds, b.id, setBranchIds)}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>
                            {b.name} ({b.code})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-700">Assigned Instructors</p>
                    <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
                      {instructors.map((inst) => (
                        <label
                          key={inst.id}
                          className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={instructorIds.includes(inst.id)}
                            onChange={() => toggleId(instructorIds, inst.id, setInstructorIds)}
                            className="h-4 w-4 rounded accent-indigo-600"
                          />
                          <span>
                            {inst.name} — <span className="text-slate-500">{inst.subject}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'lessons' && isEditing && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                    <Video className="h-4 w-4 text-indigo-600" />
                    <span>Quick Add Lecture / Live Class / Recorded Video</span>
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <select
                      value={newLesType}
                      onChange={(e) => setNewLesType(e.target.value as LessonType)}
                      aria-label="Lesson format type"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="recorded">Recorded Video</option>
                      <option value="live">Live Class</option>
                      <option value="lecture_sheet">Lecture Sheet (PDF)</option>
                    </select>
                    <input
                      type="text"
                      value={newLesTitle}
                      onChange={(e) => setNewLesTitle(e.target.value)}
                      placeholder="Lecture / Video Title"
                      aria-label="New lesson title"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:col-span-2"
                    />
                    <input
                      type="text"
                      value={newLesModule}
                      onChange={(e) => setNewLesModule(e.target.value)}
                      placeholder="Module Name"
                      aria-label="Module name"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={newLesDuration}
                      onChange={(e) => setNewLesDuration(e.target.value)}
                      placeholder="Duration (e.g. 38:00)"
                      aria-label="Lesson duration"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      value={newLesUrl}
                      onChange={(e) => setNewLesUrl(e.target.value)}
                      placeholder={
                        newLesType === 'live'
                          ? 'Live Join URL (Zoom / Meet)'
                          : newLesType === 'lecture_sheet'
                            ? 'PDF Sheet URL'
                            : 'Video URL (YouTube)'
                      }
                      aria-label="Lesson resource URL"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={newLesPreview}
                        onChange={(e) => setNewLesPreview(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                      Free Public Preview
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={saving || !newLesTitle.trim()}
                    onClick={handleAddQuickLesson}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    + Add {newLesType === 'live' ? 'Live Class' : newLesType === 'lecture_sheet' ? 'Lecture Sheet' : 'Recorded Video'}
                  </button>
                </div>

                <div className="space-y-2">
                  {courseLessons.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      No lessons attached to this course yet.
                    </p>
                  ) : (
                    courseLessons.map((les) => {
                      const lType = les.lessonType ?? 'recorded';
                      return (
                        <div
                          key={les.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-xs"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  lType === 'live'
                                    ? 'bg-rose-50 text-rose-700'
                                    : lType === 'lecture_sheet'
                                      ? 'bg-amber-50 text-amber-800'
                                      : 'bg-sky-50 text-sky-700'
                                }`}
                              >
                                {lType === 'live' ? (
                                  <Radio className="h-3 w-3" />
                                ) : lType === 'lecture_sheet' ? (
                                  <FileText className="h-3 w-3" />
                                ) : (
                                  <Video className="h-3 w-3" />
                                )}
                                <span>
                                  {lType === 'live'
                                    ? les.liveStatus === 'live_now'
                                      ? 'Live Now'
                                      : 'Live'
                                    : lType === 'lecture_sheet'
                                      ? 'Sheet'
                                      : 'Recorded'}
                                </span>
                              </span>
                              <p className="font-bold text-slate-900">{les.title}</p>
                            </div>
                            <p className="mt-0.5 text-slate-500">
                              {les.moduleName} · <span className="font-mono-tabular">{les.duration}</span>
                              {les.batchName ? ` · Batch: ${les.batchName}` : ''}
                              {les.isFreePreview ? ' · Free Preview' : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuickLesson(les.id)}
                            aria-label={`Delete lesson ${les.title}`}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Changes sync live across Courses, Detail Page & Unified Portal</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : isEditing
                    ? 'Save Course Changes'
                    : 'Publish Course'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
