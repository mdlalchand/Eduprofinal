import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  ChevronRight,
  Download,
  GraduationCap,
  Landmark,
  Languages,
  Layers,
  Play,
  Server,
  Star,
  Users,
  Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { computeAverageRating, sanitizeSafeUrl } from '../lib/domain';
import type { HighlightAccentKey, HighlightIconKey, HomepageConfig } from '../types';

interface HomePageProps {
  navigate: (path: string) => void;
}

const DEFAULT_CONFIG: HomepageConfig = {
  featuredCard: {
    badge: 'Online & Branch Course',
    title: 'Online Batches are ongoing!',
    subtitle: 'Book your seat now!',
    ctaText: 'See All Courses',
    ctaLink: '/courses',
    highlights: [
      {
        id: 'fhl-1',
        title: 'Class 9, 10',
        desc: 'SSC English 1st & 2nd Paper Preparation',
        categoryLink: '/courses?cat=SSC%20English',
        iconKey: 'book',
        accentColor: 'emerald',
      },
      {
        id: 'fhl-2',
        title: 'College & IELTS',
        desc: 'HSC English, Spoken & IELTS Band 8 Prep',
        categoryLink: '/courses?cat=HSC%20English',
        iconKey: 'briefcase',
        accentColor: 'amber',
      },
    ],
  },
  statsCard: {
    mode: 'auto',
    badge: 'Trusted Platform',
    title: 'See the stats!',
    subtitle: 'The trust we are building!',
    ctaText: 'See All Courses',
    ctaLink: '/courses',
    customValues: { students: 340241, courses: 70, teachers: 30, videos: 6476 },
    labels: { students: 'Students', courses: 'Courses', teachers: 'Teachers', videos: 'Videos' },
  },
  learningPathsSection: {
    heading: 'Choose Your Learning Path',
    subheading:
      'Discover structured English programs across academic boards, university admission, spoken fluency, and IELTS mastery.',
    items: [
      {
        id: 'lp-1',
        title: 'Academic English',
        desc: 'Comprehensive SSC & HSC 1st & 2nd Paper board preparation',
        category: 'SSC English',
        iconKey: 'book',
        accentKey: 'sky',
      },
      {
        id: 'lp-2',
        title: 'Admission Courses',
        desc: 'Specialized English prep for DU, IBA, Medical & GST admissions',
        category: 'Admission',
        iconKey: 'graduation',
        accentKey: 'indigo',
      },
      {
        id: 'lp-3',
        title: 'Spoken & Fluency',
        desc: 'Practical speaking drills, phonetics & presentation mastery',
        category: 'IELTS & Spoken',
        iconKey: 'languages',
        accentKey: 'emerald',
      },
      {
        id: 'lp-4',
        title: 'IELTS Mastery',
        desc: 'Band 8.0 Academic & GT Writing, Reading, Listening & Speaking',
        category: 'IELTS & Spoken',
        iconKey: 'award',
        accentKey: 'amber',
      },
      {
        id: 'lp-5',
        title: 'Grammar Basic to Pro',
        desc: 'Deep conceptual clarity in Tense, Clause, Modifiers & Syntax',
        category: 'Grammar Pro',
        iconKey: 'layers',
        accentKey: 'purple',
      },
      {
        id: 'lp-6',
        title: 'Branch & Community',
        desc: 'Hybrid study across Mirpur, Uttara & Chattogram AEC campuses',
        category: 'All Courses',
        iconKey: 'landmark',
        accentKey: 'teal',
      },
    ],
  },
  reviewsSection: {
    kicker: 'Student Reviews',
    heading: 'What Our Students Say',
    subheading:
      'Feedback from learners and guardians who transformed their English journey with Aloms English Center',
  },
};

function getHighlightIcon(key: HighlightIconKey) {
  switch (key) {
    case 'briefcase':
      return Briefcase;
    case 'graduation':
      return GraduationCap;
    case 'languages':
      return Languages;
    case 'award':
      return Award;
    case 'layers':
      return Layers;
    case 'landmark':
      return Landmark;
    case 'book':
    default:
      return BookOpen;
  }
}

const FEATURED_ACCENT_MAP: Record<HighlightAccentKey, string> = {
  emerald: 'bg-emerald-500 text-slate-950',
  amber: 'bg-amber-500 text-slate-950',
  sky: 'bg-sky-500 text-white',
  indigo: 'bg-indigo-500 text-white',
  purple: 'bg-purple-500 text-white',
  teal: 'bg-teal-500 text-slate-950',
};

const LEARNING_ACCENT_MAP: Record<HighlightAccentKey, string> = {
  sky: 'bg-sky-50 text-sky-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  teal: 'bg-teal-50 text-teal-600',
};

export function HomePage({ navigate }: HomePageProps) {
  const { bootstrap } = useAuth();
  const [slideIdx, setSlideIdx] = useState(0);

  const slides = bootstrap?.settings.heroSlides ?? [];
  const cfg = bootstrap?.settings.homepageConfig ?? DEFAULT_CONFIG;
  const stats = bootstrap?.stats ?? { students: 340241, courses: 70, teachers: 30, videos: 6476 };
  const reviews = bootstrap?.reviews ?? [];

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const safeIdx = slides.length ? slideIdx % slides.length : 0;
  const activeSlide = slides[safeIdx];
  const prevSlide = slides.length ? slides[(safeIdx - 1 + slides.length) % slides.length] : null;
  const nextSlide = slides.length ? slides[(safeIdx + 1) % slides.length] : null;

  const row1Reviews = reviews.filter((r) => r.row === 1);
  const row2Reviews = reviews.filter((r) => r.row === 2);
  const avgRating = computeAverageRating(reviews);

  const handleSlideCta = (courseSlug: string) => {
    if (courseSlug.startsWith('/')) {
      navigate(sanitizeSafeUrl(courseSlug, '/courses'));
      return;
    }
    navigate(`/course/${courseSlug}`);
  };

  return (
    <div className="bg-slate-50">
      {/* HERO & FEATURED CARDS SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#042133] via-[#062d40] to-[#083c49] pb-16 pt-8 sm:pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* 3D Side-Peeking Carousel */}
          {activeSlide && (
            <div className="relative flex items-center justify-center gap-5">
              {/* Left Peek Banner (desktop) */}
              {prevSlide && slides.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setSlideIdx((prev) => (prev - 1 + slides.length) % slides.length)
                  }
                  aria-label="Show previous banner"
                  className="hidden h-[340px] w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 opacity-35 transition-opacity hover:opacity-55 lg:block"
                >
                  <img
                    src={prevSlide.image}
                    alt={prevSlide.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              )}

              {/* Active Center Slide */}
              <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#062436] shadow-2xl">
                <div className="relative aspect-[16/9] min-h-[290px] w-full sm:min-h-[380px]">
                  <img
                    src={activeSlide.image}
                    alt={activeSlide.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t ${activeSlide.gradient}`} />

                  {/* Top Brand Tag & Batch Code */}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
                    <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-3 py-1.5 backdrop-blur-sm">
                      <img
                        src={bootstrap?.settings.logoUrl || '/images/aec-logo.png'}
                        alt={bootstrap?.settings.brandName || 'AEC'}
                        className="h-6 w-6 rounded-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold tracking-wide text-white">
                        {(bootstrap?.settings.brandName || 'Aloms English Center').toUpperCase()}
                      </span>
                    </div>
                    <span className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-extrabold tracking-wide text-slate-950">
                      {activeSlide.badge}
                    </span>
                  </div>

                  {/* Center-Bottom Editorial Copy + CTA */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-12 text-center sm:pb-14">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-300 sm:text-sm">
                      {activeSlide.subtitle}
                    </p>
                    <h1
                      style={{ textWrap: 'balance' }}
                      className="mt-1.5 max-w-2xl text-2xl font-extrabold tracking-tight text-white sm:text-4xl"
                    >
                      {activeSlide.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => handleSlideCta(activeSlide.courseSlug)}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-bold text-[#062436] shadow-lg transition-transform hover:scale-105 sm:text-sm"
                    >
                      <span>{activeSlide.ctaText}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Left / Right Slide Arrows */}
                  {slides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setSlideIdx((prev) => (prev - 1 + slides.length) % slides.length)
                        }
                        aria-label="Previous slide"
                        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/50 text-white backdrop-blur-xs transition-colors hover:bg-slate-900"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideIdx((prev) => (prev + 1) % slides.length)}
                        aria-label="Next slide"
                        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-slate-950/50 text-white backdrop-blur-xs transition-colors hover:bg-slate-900"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {/* Slide Pagination Dots */}
                  {slides.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
                      {slides.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSlideIdx(idx)}
                          aria-label={`Go to slide ${idx + 1}`}
                          className={`h-2 rounded-full transition-all ${
                            idx === safeIdx ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Peek Banner (desktop) */}
              {nextSlide && slides.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSlideIdx((prev) => (prev + 1) % slides.length)}
                  aria-label="Show next banner"
                  className="hidden h-[340px] w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 opacity-35 transition-opacity hover:opacity-55 lg:block"
                >
                  <img
                    src={nextSlide.image}
                    alt={nextSlide.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              )}
            </div>
          )}

          {/* TWO-COLUMN FEATURED CARDS: Online Batches + Stats */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left Card: Online Batches */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-[#063f43] to-[#04282d] p-6 sm:p-8">
              <div>
                <span className="inline-block rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-1 text-xs font-semibold text-emerald-300">
                  {cfg.featuredCard.badge}
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {cfg.featuredCard.title}
                </h2>
                <h3 className="mt-1 text-base font-medium text-emerald-300">
                  {cfg.featuredCard.subtitle}
                </h3>

                <div className="mt-6 space-y-3">
                  {cfg.featuredCard.highlights.map((hl) => {
                    const Icon = getHighlightIcon(hl.iconKey);
                    const iconCls = FEATURED_ACCENT_MAP[hl.accentColor] ?? FEATURED_ACCENT_MAP.emerald;
                    return (
                      <button
                        key={hl.id}
                        type="button"
                        onClick={() => navigate(sanitizeSafeUrl(hl.categoryLink, '/courses'))}
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-left transition-colors hover:bg-white/10"
                      >
                        <div className="flex items-center gap-3.5">
                          <span
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconCls}`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-white">{hl.title}</h4>
                            <p className="text-xs text-slate-300">{hl.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(sanitizeSafeUrl(cfg.featuredCard.ctaLink, '/courses'))}
                className="mt-6 w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
              >
                {cfg.featuredCard.ctaText}
              </button>
            </div>

            {/* Right Card: Stats */}
            <div className="flex flex-col justify-between rounded-2xl border border-sky-400/20 bg-gradient-to-br from-[#0a2f50] to-[#062038] p-6 sm:p-8">
              <div>
                <span className="inline-block rounded-full border border-sky-400/30 bg-sky-500/15 px-3.5 py-1 text-xs font-semibold text-sky-300">
                  {cfg.statsCard.badge}
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {cfg.statsCard.title}
                </h2>
                <h3 className="mt-1 text-base font-medium text-sky-300">
                  {cfg.statsCard.subtitle}
                </h3>

                <div className="mt-6 grid grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => navigate('/courses')}
                    className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white">
                      <Users className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="font-mono-tabular text-xl font-extrabold text-white">
                        {stats.students.toLocaleString()}
                      </h4>
                      <p className="text-xs text-slate-300">{cfg.statsCard.labels.students}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/courses')}
                    className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-slate-950">
                      <Play className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="font-mono-tabular text-xl font-extrabold text-white">
                        {stats.courses.toLocaleString()}
                      </h4>
                      <p className="text-xs text-slate-300">{cfg.statsCard.labels.courses}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/instructors')}
                    className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="font-mono-tabular text-xl font-extrabold text-white">
                        {stats.teachers.toLocaleString()}
                      </h4>
                      <p className="text-xs text-slate-300">{cfg.statsCard.labels.teachers}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/learn')}
                    className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white">
                      <Video className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="font-mono-tabular text-xl font-extrabold text-white">
                        {stats.videos.toLocaleString()}
                      </h4>
                      <p className="text-xs text-slate-300">{cfg.statsCard.labels.videos}</p>
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(sanitizeSafeUrl(cfg.statsCard.ctaLink, '/courses'))}
                className="mt-6 w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-sky-400"
              >
                {cfg.statsCard.ctaText}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CHOOSE YOUR LEARNING PATH (COURSE HIGHLIGHTS GRID) */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              style={{ textWrap: 'balance' }}
              className="text-3xl font-extrabold tracking-tight text-[#062436] sm:text-4xl"
            >
              {cfg.learningPathsSection.heading}
            </h2>
            <p className="mt-3 text-base text-slate-600">
              {cfg.learningPathsSection.subheading}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cfg.learningPathsSection.items.map((path) => {
              const Icon = getHighlightIcon(path.iconKey);
              const accentCls = LEARNING_ACCENT_MAP[path.accentKey] ?? LEARNING_ACCENT_MAP.sky;
              return (
                <a
                  key={path.id}
                  href={`/courses?cat=${encodeURIComponent(path.category)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/courses?cat=${encodeURIComponent(path.category)}`);
                  }}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
                >
                  <div>
                    {path.image ? (
                      <img
                        src={path.image}
                        alt={path.title}
                        className="mb-4 h-36 w-full rounded-xl object-cover border border-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${accentCls}`}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                    )}
                    <h3 className="mt-4 text-lg font-bold text-slate-900">{path.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{path.desc}</p>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 group-hover:text-sky-700">
                    <span>Explore</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* STUDENT REVIEWS MARQUEE */}
      <section className="overflow-hidden bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-600">
            {cfg.reviewsSection.kicker}
          </h3>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-[#062436] sm:text-4xl">
            {cfg.reviewsSection.heading}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
            {cfg.reviewsSection.subheading}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5">
            <div className="flex items-center text-amber-500">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-4 w-4 fill-amber-400" />
              ))}
            </div>
            <span className="font-mono-tabular text-sm font-extrabold text-slate-900">
              {avgRating}
            </span>
            <span className="text-xs font-medium text-slate-600">
              average rating ({reviews.length} verified reviews)
            </span>
          </div>
        </div>

        <div className="marquee-pause mt-10 space-y-5">
          {/* Row 1 */}
          {row1Reviews.length > 0 && (
            <div className="flex w-max animate-marquee-left gap-5">
              {[...row1Reviews, ...row1Reviews].map((rev, idx) => (
                <div
                  key={`${rev.id}-r1-${idx}`}
                  className="w-80 shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:w-96"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: rev.rating || 5 }).map((_, s) => (
                        <Star key={s} className="h-3.5 w-3.5 fill-amber-400" />
                      ))}
                    </div>
                    {rev.featured && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Featured Story
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-slate-700">{rev.text}</p>
                  <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                    {rev.avatar ? (
                      <img
                        src={rev.avatar}
                        alt={rev.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#062436] text-xs font-bold text-amber-400">
                        {rev.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-900">{rev.name}</h4>
                      <p className="truncate text-xs text-slate-500">
                        {rev.roleLabel}
                        {rev.courseTag ? ` · ${rev.courseTag}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Row 2 */}
          {row2Reviews.length > 0 && (
            <div className="flex w-max animate-marquee-right gap-5">
              {[...row2Reviews, ...row2Reviews].map((rev, idx) => (
                <div
                  key={`${rev.id}-r2-${idx}`}
                  className="w-80 shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:w-96"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: rev.rating || 5 }).map((_, s) => (
                        <Star key={s} className="h-3.5 w-3.5 fill-amber-400" />
                      ))}
                    </div>
                    {rev.featured && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Featured Story
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-slate-700">{rev.text}</p>
                  <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                    {rev.avatar ? (
                      <img
                        src={rev.avatar}
                        alt={rev.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                        {rev.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-slate-900">{rev.name}</h4>
                      <p className="truncate text-xs text-slate-500">
                        {rev.roleLabel}
                        {rev.courseTag ? ` · ${rev.courseTag}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PRODUCTION LARAVEL INSTALLER DOWNLOAD SECTION */}
      <section className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#062436] to-[#0a3852] p-6 text-white shadow-lg sm:p-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Server className="h-3.5 w-3.5" />
                <span>Primary Production Backend · Laravel 13</span>
              </div>
              <h2
                style={{ textWrap: 'balance' }}
                className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Ready-to-Install Production Package
              </h2>
              <p className="text-sm leading-relaxed text-slate-200">
                Deploy the complete Laravel 13 LMS platform on any PHP 8.3+ server with the
                white-label <code className="rounded bg-white/15 px-1.5 py-0.5 text-xs">/install</code>{' '}
                wizard, encrypted sessions, MySQL/PostgreSQL SSL support, signed payment webhooks,
                and SHA-256 verified backup &amp; non-destructive updater.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <a
                href="/downloads/academy-lms-laravel13.zip"
                download="academy-lms-laravel13.zip"
                data-testid="download-laravel-zip"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-md transition-colors hover:bg-amber-300"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span>Download Installer (.zip)</span>
              </a>
              <span className="text-center text-xs text-slate-300">
                Clean white-label archive · Zero demo data
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
