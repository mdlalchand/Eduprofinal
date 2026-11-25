import {
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Landmark,
  Languages,
  Layers,
  LayoutTemplate,
  Loader2,
  Menu as MenuIcon,
  MessageSquareQuote,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_HEADER_MENU, normalizeHeaderMenu, reorderListItem, sanitizeSafeUrl } from '../lib/domain';
import type {
  Course,
  CustomPage,
  FeaturedHighlightItem,
  FooterLinkItem,
  HeaderMenuItem,
  HeroSlide,
  HighlightAccentKey,
  HighlightIconKey,
  HomepageConfig,
  LearningPathHighlight,
  Review,
  SiteSettings,
} from '../types';
import { ImageUploadField } from './ImageUploadField';

interface HomepageCmsStudioProps {
  settings: SiteSettings;
  courses: Course[];
  reviews: Review[];
  liveStats?: { students: number; courses: number; teachers: number; videos: number };
  initialTab?: CmsTab;
  onSaved: (message: string) => Promise<void> | void;
  onNavigateHome: () => void;
}

type CmsTab = 'slides' | 'highlights' | 'stats' | 'reviews' | 'branding';

const BANNER_PRESETS = [
  {
    label: 'Academic Classroom',
    url: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
  },
  {
    label: 'IELTS & Spoken Studio',
    url: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
  },
  {
    label: 'Spoken & Grammar Workshop',
    url: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
  },
];

const GRADIENT_PRESETS = [
  { label: 'Royal Violet', value: 'from-fuchsia-800/85 via-purple-900/70 to-slate-950/90' },
  { label: 'Deep Emerald', value: 'from-emerald-900/85 via-teal-900/70 to-slate-950/90' },
  { label: 'Ocean Sky', value: 'from-cyan-900/85 via-sky-950/75 to-slate-950/90' },
  { label: 'Amber Slate', value: 'from-amber-900/85 via-slate-900/75 to-slate-950/95' },
];

const ICON_OPTIONS: { value: HighlightIconKey; label: string }[] = [
  { value: 'book', label: 'Book (Academic)' },
  { value: 'briefcase', label: 'Briefcase (College / Career)' },
  { value: 'graduation', label: 'Graduation Cap' },
  { value: 'languages', label: 'Languages (Spoken)' },
  { value: 'award', label: 'Award (IELTS)' },
  { value: 'layers', label: 'Layers (Grammar)' },
  { value: 'landmark', label: 'Landmark (Campus)' },
];

const ACCENT_OPTIONS: { value: HighlightAccentKey; label: string }[] = [
  { value: 'emerald', label: 'Emerald' },
  { value: 'amber', label: 'Amber' },
  { value: 'sky', label: 'Sky Blue' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'purple', label: 'Purple' },
  { value: 'teal', label: 'Teal' },
];

const DEFAULT_FALLBACK_CONFIG: HomepageConfig = {
  featuredCard: {
    badge: 'Online & Branch Course',
    title: 'Online Batches are ongoing!',
    subtitle: 'Book your seat now!',
    ctaText: 'See All Courses',
    ctaLink: '/courses',
    highlights: [],
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
    items: [],
  },
  reviewsSection: {
    kicker: 'Student Reviews',
    heading: 'What Our Students Say',
    subheading:
      'Feedback from learners and guardians who transformed their English journey with Aloms English Center',
  },
};

function renderPreviewIcon(key: HighlightIconKey) {
  switch (key) {
    case 'briefcase':
      return <Briefcase className="h-4 w-4" />;
    case 'graduation':
      return <GraduationCap className="h-4 w-4" />;
    case 'languages':
      return <Languages className="h-4 w-4" />;
    case 'award':
      return <Award className="h-4 w-4" />;
    case 'layers':
      return <Layers className="h-4 w-4" />;
    case 'landmark':
      return <Landmark className="h-4 w-4" />;
    case 'book':
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

export function HomepageCmsStudio({
  settings,
  courses,
  reviews,
  liveStats,
  initialTab = 'slides',
  onSaved,
  onNavigateHome,
}: HomepageCmsStudioProps) {
  const { apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<CmsTab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Custom Image Upload & Media Library State
  const [uploadedImages, setUploadedImages] = useState<
    { name: string; url: string; sizeBytes: number }[]
  >([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hero Slides Editor State
  const [slides, setSlides] = useState<HeroSlide[]>(settings.heroSlides ?? []);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [confirmSlideDeleteId, setConfirmSlideDeleteId] = useState<string | null>(null);

  const [slideBadge, setSlideBadge] = useState('AEC 27');
  const [slideTitle, setSlideTitle] = useState('');
  const [slideSubtitle, setSlideSubtitle] = useState('');
  const [slideCtaText, setSlideCtaText] = useState('Explore Batch');
  const [slideCourseSlug, setSlideCourseSlug] = useState(
    courses[0]?.slug ?? 'ssc-english-final-revision'
  );
  const [slideImage, setSlideImage] = useState(BANNER_PRESETS[0].url);
  const [slideGradient, setSlideGradient] = useState(GRADIENT_PRESETS[0].value);
  const [slideActive, setSlideActive] = useState(true);
  const [slideFormOpen, setSlideFormOpen] = useState(false);

  // Homepage Config State (Highlights + Stats + Review Headers)
  const [config, setConfig] = useState<HomepageConfig>(
    settings.homepageConfig ?? DEFAULT_FALLBACK_CONFIG
  );

  // Reviews Advanced CRUD & Moderation State
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [confirmReviewDeleteId, setConfirmReviewDeleteId] = useState<string | null>(null);
  const [revName, setRevName] = useState('');
  const [revRoleLabel, setRevRoleLabel] = useState('Verified Student · SSC Batch');
  const [revRating, setRevRating] = useState(5);
  const [revRow, setRevRow] = useState<1 | 2>(1);
  const [revStatus, setRevStatus] = useState<'approved' | 'pending' | 'hidden'>('approved');
  const [revFeatured, setRevFeatured] = useState(false);
  const [revCourseTag, setRevCourseTag] = useState('');
  const [revAvatar, setRevAvatar] = useState('');
  const [revText, setRevText] = useState('');
  const [revSearch, setRevSearch] = useState('');
  const [revFilterStatus, setRevFilterStatus] = useState<'all' | 'approved' | 'pending' | 'hidden'>('all');

  // Branding, Logo, Footer & Custom Pages State
  const [brandName, setBrandName] = useState(settings.brandName || 'Aloms English Center');
  const [tagline, setTagline] = useState(settings.tagline || '');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '/images/aec-logo.png');
  const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl || '/images/aec-logo.png');
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || '#062436');
  const [whiteLabelDomain, setWhiteLabelDomain] = useState(settings.whiteLabelDomain || 'alomsenglishcenter.com');
  const [language, setLanguage] = useState<'en' | 'bn'>(settings.language === 'bn' ? 'bn' : 'en');
  const [footerCopyright, setFooterCopyright] = useState(
    settings.footerCopyright || '© 2026 Aloms English Center. All Rights Reserved.'
  );
  const [youtubeUrl, setYoutubeUrl] = useState(settings.socialLinks?.youtube || 'https://youtube.com');
  const [facebookUrl, setFacebookUrl] = useState(settings.socialLinks?.facebook || 'https://facebook.com');
  const [footerLinks, setFooterLinks] = useState<FooterLinkItem[]>(
    settings.footerLinks?.length
      ? settings.footerLinks
      : [
          { label: 'Home', path: '/' },
          { label: 'About Us', path: '/about-us' },
          { label: 'Contact Us', path: '/contact-us' },
          { label: 'Community & Blog', path: '/community' },
        ]
  );
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuItem[]>(() =>
    normalizeHeaderMenu(settings.headerMenu, DEFAULT_HEADER_MENU)
  );
  const [newMenuLabel, setNewMenuLabel] = useState('');
  const [newMenuPath, setNewMenuPath] = useState('/courses');
  const [newMenuBadge, setNewMenuBadge] = useState('');
  const [newMenuNewTab, setNewMenuNewTab] = useState(false);

  const [customPages, setCustomPages] = useState<CustomPage[]>(settings.customPages ?? []);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [newPageBody, setNewPageBody] = useState('');

  const loadUploadedImages = useCallback(async () => {
    try {
      const res = await apiFetch<{
        files: { name: string; url: string; sizeBytes: number }[];
      }>('/api/portal/uploads');
      setUploadedImages(res.files ?? []);
    } catch {
      // ignore initial media load failures
    }
  }, [apiFetch]);

  useEffect(() => {
    setSlides(settings.heroSlides ?? []);
    if (settings.homepageConfig) {
      setConfig(settings.homepageConfig);
    }
    setBrandName(settings.brandName || 'Aloms English Center');
    setTagline(settings.tagline || '');
    setLogoUrl(settings.logoUrl || '/images/aec-logo.png');
    setFaviconUrl(settings.faviconUrl || '/images/aec-logo.png');
    if (settings.primaryColor) setPrimaryColor(settings.primaryColor);
    if (settings.whiteLabelDomain) setWhiteLabelDomain(settings.whiteLabelDomain);
    if (settings.language) setLanguage(settings.language);
    if (settings.footerCopyright) setFooterCopyright(settings.footerCopyright);
    if (settings.footerLinks?.length) setFooterLinks(settings.footerLinks);
    if (settings.customPages) setCustomPages(settings.customPages);
  }, [settings]);

  useEffect(() => {
    void loadUploadedImages();
  }, [loadUploadedImages]);

  const handleUploadCustomImage = async (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setErrorMsg('Only PNG, JPG, WEBP, or GIF images are allowed for homepage banners.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Custom picture size must be 5 MB or less.');
      return;
    }

    setErrorMsg(null);
    setUploadNotice(null);
    setUploadingImage(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('Failed to read selected image file.'));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch<{ url: string; name: string; sizeBytes: number }>(
        '/api/portal/upload-image',
        {
          method: 'POST',
          body: JSON.stringify({ dataUrl }),
        }
      );

      setSlideImage(res.url);
      setUploadedImages((prev) => [{ name: res.name, url: res.url, sizeBytes: res.sizeBytes }, ...prev]);
      setUploadNotice(
        `Custom picture uploaded (${Math.max(1, Math.round(res.sizeBytes / 1024))} KB) and applied to preview.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Custom image upload failed.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleUploadCustomImage(file);
    }
  };

  const handleDropZone = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleUploadCustomImage(file);
    }
  };

  const handleDeleteUploadedImage = async (name: string, url: string) => {
    try {
      await apiFetch(`/api/portal/uploads/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      });
      setUploadedImages((prev) => prev.filter((item) => item.name !== name));
      if (slideImage === url) {
        setSlideImage(BANNER_PRESETS[0].url);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete uploaded image.');
    }
  };

  const persistSlides = async (nextSlides: HeroSlide[], message: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch('/api/portal/homepage/slides', {
        method: 'PUT',
        body: JSON.stringify({ heroSlides: nextSlides }),
      });
      setSlides(nextSlides);
      await onSaved(message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save hero slides.');
    } finally {
      setSaving(false);
    }
  };

  const openNewSlideForm = () => {
    setEditingSlideId(null);
    setSlideBadge('NEW BATCH');
    setSlideTitle('');
    setSlideSubtitle('');
    setSlideCtaText('Enroll Now');
    setSlideCourseSlug(courses[0]?.slug ?? 'ssc-english-final-revision');
    setSlideImage(BANNER_PRESETS[0].url);
    setSlideGradient(GRADIENT_PRESETS[0].value);
    setSlideActive(true);
    setSlideFormOpen(true);
  };

  const openEditSlideForm = (slide: HeroSlide) => {
    setEditingSlideId(slide.id);
    setSlideBadge(slide.badge);
    setSlideTitle(slide.title);
    setSlideSubtitle(slide.subtitle);
    setSlideCtaText(slide.ctaText);
    setSlideCourseSlug(slide.courseSlug);
    setSlideImage(slide.image);
    setSlideGradient(slide.gradient);
    setSlideActive(slide.active !== false);
    setSlideFormOpen(true);
  };

  const handleSaveSlideForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!slideTitle.trim()) {
      setErrorMsg('Slide title is required.');
      return;
    }

    const slideObj: HeroSlide = {
      id: editingSlideId ?? `slide-${Date.now()}`,
      badge: slideBadge.trim() || 'AEC 27',
      title: slideTitle.trim(),
      subtitle: slideSubtitle.trim(),
      ctaText: slideCtaText.trim() || 'Explore Course',
      courseSlug: slideCourseSlug.trim() || 'ssc-english-final-revision',
      image: sanitizeSafeUrl(slideImage, BANNER_PRESETS[0].url),
      gradient: slideGradient,
      active: slideActive,
    };

    const nextSlides = editingSlideId
      ? slides.map((s) => (s.id === editingSlideId ? slideObj : s))
      : [slideObj, ...slides];

    await persistSlides(
      nextSlides,
      editingSlideId ? `Updated hero slide "${slideObj.title}".` : `Published new hero slide "${slideObj.title}".`
    );
    setSlideFormOpen(false);
    setEditingSlideId(null);
  };

  const handleDeleteSlide = async (id: string) => {
    if (slides.length <= 1) {
      setErrorMsg('At least one hero slide must remain active on the homepage.');
      return;
    }
    if (confirmSlideDeleteId !== id) {
      setConfirmSlideDeleteId(id);
      return;
    }
    setConfirmSlideDeleteId(null);
    const nextSlides = slides.filter((s) => s.id !== id);
    await persistSlides(nextSlides, 'Hero slide removed from carousel.');
  };

  const handleDuplicateSlide = async (slide: HeroSlide) => {
    const copy: HeroSlide = {
      ...slide,
      id: `slide-${Date.now()}`,
      title: `${slide.title} (Copy)`,
    };
    await persistSlides([...slides, copy], `Duplicated hero slide "${slide.title}".`);
  };

  const handleMoveSlide = async (index: number, dir: 'up' | 'down') => {
    const next = reorderListItem(slides, index, dir);
    await persistSlides(next, 'Hero slider order updated.');
  };

  const handleToggleSlideActive = async (slide: HeroSlide) => {
    const nextSlides = slides.map((s) =>
      s.id === slide.id ? { ...s, active: s.active === false } : s
    );
    if (nextSlides.every((s) => s.active === false)) {
      setErrorMsg('At least one hero slide should remain visible on the homepage.');
      return;
    }
    await persistSlides(
      nextSlides,
      `Hero slide "${slide.title}" is now ${slide.active === false ? 'visible' : 'hidden'}.`
    );
  };

  const persistHomepageConfig = async (nextConfig: HomepageConfig, message: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch('/api/portal/homepage/config', {
        method: 'PUT',
        body: JSON.stringify({ homepageConfig: nextConfig }),
      });
      setConfig(nextConfig);
      await onSaved(message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update homepage configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHighlights = async (e: FormEvent) => {
    e.preventDefault();
    await persistHomepageConfig(config, 'Course Highlights & Learning Paths updated on Homepage.');
  };

  const handleSaveStats = async (e: FormEvent) => {
    e.preventDefault();
    await persistHomepageConfig(config, 'Homepage Statistics section updated.');
  };

  const handleSaveReviewsHeader = async (e: FormEvent) => {
    e.preventDefault();
    await persistHomepageConfig(config, 'Testimonials section heading updated.');
  };

  const handleAddFeaturedHighlight = () => {
    const item: FeaturedHighlightItem = {
      id: `fhl-${Date.now()}`,
      title: 'New Batch Track',
      desc: 'Short batch highlight summary',
      categoryLink: '/courses',
      iconKey: 'book',
      accentColor: 'sky',
    };
    setConfig((prev) => ({
      ...prev,
      featuredCard: {
        ...prev.featuredCard,
        highlights: [...prev.featuredCard.highlights, item],
      },
    }));
  };

  const handleAddLearningPath = () => {
    const item: LearningPathHighlight = {
      id: `lp-${Date.now()}`,
      title: 'New Learning Track',
      desc: 'Structured English curriculum tailored for board and skill excellence.',
      category: 'All Courses',
      iconKey: 'book',
      accentKey: 'sky',
    };
    setConfig((prev) => ({
      ...prev,
      learningPathsSection: {
        ...prev.learningPathsSection,
        items: [...prev.learningPathsSection.items, item],
      },
    }));
  };

  const handleSaveReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!revName.trim() || !revText.trim()) {
      setErrorMsg('Student/Guardian name and review text are required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: revName.trim(),
        roleLabel: revRoleLabel.trim() || 'Verified Student',
        rating: revRating,
        row: revRow,
        status: revStatus,
        featured: revFeatured,
        courseTag: revCourseTag.trim() || undefined,
        avatar: revAvatar.trim() || undefined,
        verified: true,
        text: revText.trim(),
      };
      if (editingReviewId) {
        await apiFetch(`/api/portal/reviews/${editingReviewId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await onSaved(`Updated testimonial from "${payload.name}".`);
      } else {
        await apiFetch('/api/portal/reviews', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await onSaved(`Published testimonial from "${payload.name}".`);
      }
      setEditingReviewId(null);
      setRevName('');
      setRevRoleLabel('Verified Student · SSC Batch');
      setRevRating(5);
      setRevRow(1);
      setRevStatus('approved');
      setRevFeatured(false);
      setRevCourseTag('');
      setRevAvatar('');
      setRevText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditReview = (rev: Review) => {
    setEditingReviewId(rev.id);
    setRevName(rev.name);
    setRevRoleLabel(rev.roleLabel);
    setRevRating(rev.rating);
    setRevRow(rev.row);
    setRevStatus(rev.status ?? 'approved');
    setRevFeatured(Boolean(rev.featured));
    setRevCourseTag(rev.courseTag ?? '');
    setRevAvatar(rev.avatar ?? '');
    setRevText(rev.text);
  };

  const handleQuickModeration = async (rev: Review, patch: { status?: 'approved' | 'pending' | 'hidden'; featured?: boolean }) => {
    setSaving(true);
    try {
      await apiFetch(`/api/portal/reviews/${rev.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await onSaved(`Updated moderation for ${rev.name}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleReorderReview = async (id: string, direction: 'up' | 'down') => {
    setSaving(true);
    try {
      await apiFetch('/api/portal/reviews/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ id, direction }),
      });
      await onSaved('Testimonials display order updated.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (confirmReviewDeleteId !== id) {
      setConfirmReviewDeleteId(id);
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/portal/reviews/${id}`, { method: 'DELETE' });
      setConfirmReviewDeleteId(null);
      await onSaved('Testimonial moved to Recycle Bin.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch('/api/portal/branding', {
        method: 'PUT',
        body: JSON.stringify({
          brandName,
          tagline,
          logoUrl,
          faviconUrl,
          primaryColor,
          whiteLabelDomain,
          language,
          footerCopyright,
          footerLinks,
          headerMenu,
          socialLinks: { youtube: youtubeUrl, facebook: facebookUrl },
          customPages,
        }),
      });
      await onSaved('Custom Menus, Logo, Branding, Language & Footer settings saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHeaderMenuItem = () => {
    if (!newMenuLabel.trim() || !newMenuPath.trim()) return;
    setHeaderMenu((prev) => [
      ...prev,
      {
        id: `menu-${Date.now()}`,
        label: newMenuLabel.trim(),
        path: newMenuPath.trim(),
        badge: newMenuBadge.trim() || undefined,
        visible: true,
        openInNewTab: newMenuNewTab,
      },
    ]);
    setNewMenuLabel('');
    setNewMenuBadge('');
    setNewMenuNewTab(false);
  };

  const handleAddCustomPage = () => {
    if (!newPageTitle.trim()) return;
    const slug = (newPageSlug.trim() || newPageTitle.trim())
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '');
    setCustomPages((prev) => [
      ...prev,
      {
        id: `pg-${Date.now()}`,
        slug,
        title: newPageTitle.trim(),
        subtitle: `${brandName} Official Page`,
        body: newPageBody.trim() || `Information about ${newPageTitle.trim()}.`,
        published: true,
      },
    ]);
    setNewPageTitle('');
    setNewPageSlug('');
    setNewPageBody('');
  };

  const tabs: { id: CmsTab; label: string; icon: typeof LayoutTemplate }[] = [
    { id: 'slides', label: `Hero Slider (${slides.length})`, icon: ImageIcon },
    {
      id: 'highlights',
      label: `Course Highlights (${config.learningPathsSection.items.length})`,
      icon: Layers,
    },
    { id: 'stats', label: 'Statistics & Counters', icon: BarChart3 },
    { id: 'reviews', label: `Testimonials (${reviews.length})`, icon: MessageSquareQuote },
    { id: 'branding', label: `Menus, Logo & Footer (${headerMenu.length})`, icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Homepage Visual CMS Studio
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage Hero Carousel slides, Course Highlights, Live/Custom Statistics, and Student
              Testimonials without writing any code.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview Live Homepage</span>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
            {errorMsg}
          </div>
        )}
      </div>

      {/* TAB 1: HERO SLIDER MANAGER */}
      {activeTab === 'slides' && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Hero Carousel Banners ({slides.filter((s) => s.active !== false).length} Active)
              </h3>
              <p className="text-xs text-slate-500">
                Add new announcement banners, assign target course links, reorder slides, or toggle
                visibility.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewSlideForm}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add Hero Slide</span>
            </button>
          </div>

          {slideFormOpen && (
            <form
              onSubmit={handleSaveSlideForm}
              className="space-y-4 rounded-2xl border border-indigo-200 bg-slate-50 p-5"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900">
                  {editingSlideId ? 'Edit Hero Slide' : 'Create New Hero Slide'}
                </h4>
                <button
                  type="button"
                  onClick={() => setSlideFormOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              {/* Live Slide Mini Preview */}
              <div className="relative h-44 overflow-hidden rounded-xl border border-slate-200 bg-[#062436]">
                <img
                  src={sanitizeSafeUrl(slideImage, BANNER_PRESETS[0].url)}
                  alt={slideTitle || 'Slide preview'}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${slideGradient}`} />
                <div className="absolute right-3 top-3 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-extrabold text-slate-950">
                  {slideBadge || 'BADGE'}
                </div>
                <div className="absolute inset-x-4 bottom-4 text-center text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    {slideSubtitle || 'Banner subtitle appears here'}
                  </p>
                  <p className="mt-1 text-lg font-extrabold">
                    {slideTitle || 'Main Hero Headline'}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-white px-3.5 py-1 text-[11px] font-bold text-[#062436]">
                    {slideCtaText || 'Explore'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="cms-slide-badge" className="mb-1 block text-xs font-bold text-slate-700">
                    Top Badge Text *
                  </label>
                  <input
                    id="cms-slide-badge"
                    type="text"
                    required
                    value={slideBadge}
                    onChange={(e) => setSlideBadge(e.target.value)}
                    placeholder="e.g. HSC 27"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label htmlFor="cms-slide-cta" className="mb-1 block text-xs font-bold text-slate-700">
                    CTA Button Label *
                  </label>
                  <input
                    id="cms-slide-cta"
                    type="text"
                    required
                    value={slideCtaText}
                    onChange={(e) => setSlideCtaText(e.target.value)}
                    placeholder="e.g. Explore Batch"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="cms-slide-title" className="mb-1 block text-xs font-bold text-slate-700">
                    Hero Slide Title *
                  </label>
                  <input
                    id="cms-slide-title"
                    type="text"
                    required
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    placeholder="e.g. SSC-27 GRAMMAR MASTER SPRINT"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="cms-slide-subtitle" className="mb-1 block text-xs font-bold text-slate-700">
                    Subtitle / Key Offering
                  </label>
                  <input
                    id="cms-slide-subtitle"
                    type="text"
                    value={slideSubtitle}
                    onChange={(e) => setSlideSubtitle(e.target.value)}
                    placeholder="e.g. Live Board Solving + Weekly Model Test"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="cms-slide-course" className="mb-1 block text-xs font-bold text-slate-700">
                    Link to Course (Quick Pick)
                  </label>
                  <select
                    id="cms-slide-course"
                    value={slideCourseSlug}
                    onChange={(e) => setSlideCourseSlug(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cms-slide-gradient" className="mb-1 block text-xs font-bold text-slate-700">
                    Overlay Scrim Gradient
                  </label>
                  <select
                    id="cms-slide-gradient"
                    value={slideGradient}
                    onChange={(e) => setSlideGradient(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {GRADIENT_PRESETS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="cms-slide-image" className="block text-xs font-bold text-slate-700">
                      Banner Picture (Upload Custom Photo, Choose Preset, or Paste URL)
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      PNG, JPG, WEBP, GIF up to 5 MB · Recommended 1600×700px
                    </span>
                  </div>

                  {/* Custom Image Upload Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDropZone}
                    className={`flex flex-col items-center justify-between gap-3 rounded-xl border-2 border-dashed p-4 transition-colors sm:flex-row ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Upload className="h-5 w-5" />
                        )}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {uploadingImage
                            ? 'Uploading custom banner picture...'
                            : 'Upload a custom picture from your computer or phone'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Drag & drop an image here, or click Browse to upload directly to the server.
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <input
                        ref={fileInputRef}
                        id="cms-slide-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleFileInputChange}
                        className="sr-only"
                      />
                      <button
                        type="button"
                        disabled={uploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingImage ? 'Uploading...' : 'Upload Custom Picture'}</span>
                      </button>
                    </div>
                  </div>

                  {uploadNotice && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      {uploadNotice}
                    </p>
                  )}

                  {/* Uploaded Custom Pictures Gallery */}
                  {uploadedImages.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Uploaded Custom Pictures ({uploadedImages.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {uploadedImages.map((img) => {
                          const selected = slideImage === img.url;
                          return (
                            <div
                              key={img.name}
                              className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                                selected ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSlideImage(img.url)}
                                title={`Use ${img.name}`}
                                aria-label={`Select uploaded image ${img.name}`}
                                className="block h-14 w-24 overflow-hidden bg-slate-100"
                              >
                                <img
                                  src={img.url}
                                  alt={img.name}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUploadedImage(img.name, img.url)}
                                aria-label={`Remove uploaded image ${img.name}`}
                                className="absolute right-1 top-1 rounded-full bg-slate-900/75 p-0.5 text-white opacity-90 hover:bg-rose-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Built-in Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Quick Presets:</span>
                    {BANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => setSlideImage(preset.url)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                          slideImage === preset.url
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Direct Image URL Fallback */}
                  <input
                    id="cms-slide-image"
                    type="text"
                    value={slideImage}
                    onChange={(e) => setSlideImage(e.target.value)}
                    placeholder="/uploads/cms-...jpg or https://..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={slideActive}
                    onChange={(e) => setSlideActive(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span>Show Slide on Public Homepage</span>
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-5 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : editingSlideId ? 'Save Slide Changes' : 'Publish Slide'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Slides List */}
          <div className="space-y-3">
            {slides.map((slide, idx) => {
              const isHidden = slide.active === false;
              const isConfirming = confirmSlideDeleteId === slide.id;
              return (
                <div
                  key={slide.id}
                  className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                    isHidden ? 'border-slate-200 bg-slate-50 opacity-75' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={sanitizeSafeUrl(slide.image, BANNER_PRESETS[0].url)}
                      alt={slide.title}
                      className="h-16 w-28 shrink-0 rounded-xl border border-slate-200 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="font-mono-tabular text-slate-400">#{idx + 1}</span>
                        <span className="text-amber-700">{slide.badge}</span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className={isHidden ? 'text-slate-500' : 'text-emerald-700'}>
                          {isHidden ? 'Hidden' : 'Active'}
                        </span>
                      </div>
                      <h4 className="mt-0.5 text-sm font-extrabold text-slate-900">
                        {slide.title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {slide.subtitle} · CTA: {slide.ctaText} (/course/{slide.courseSlug})
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSlideActive(slide)}
                      aria-label={`${isHidden ? 'Show' : 'Hide'} slide ${slide.title}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      <span>{isHidden ? 'Show' : 'Hide'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSlide(idx, 'up')}
                      disabled={idx === 0}
                      aria-label={`Move up slide ${slide.title}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSlide(idx, 'down')}
                      disabled={idx === slides.length - 1}
                      aria-label={`Move down slide ${slide.title}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditSlideForm(slide)}
                      aria-label={`Edit slide ${slide.title}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateSlide(slide)}
                      aria-label={`Duplicate slide ${slide.title}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-600"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(slide.id)}
                      aria-label={
                        isConfirming
                          ? `Confirm delete slide ${slide.title}`
                          : `Delete slide ${slide.title}`
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                        isConfirming
                          ? 'bg-rose-600 text-white'
                          : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isConfirming ? 'Confirm' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COURSE HIGHLIGHTS & LEARNING PATHS */}
      {activeTab === 'highlights' && (
        <form onSubmit={handleSaveHighlights} className="space-y-6">
          {/* Online Batches Featured Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Featured Online Batches Card (Hero Left Panel)
                </h3>
                <p className="text-xs text-slate-500">
                  Customize the headline and featured track quick-links shown below the Hero Slider.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFeaturedHighlight}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Quick Track</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="hl-feat-badge" className="mb-1 block text-xs font-bold text-slate-700">
                  Kicker Badge
                </label>
                <input
                  id="hl-feat-badge"
                  type="text"
                  value={config.featuredCard.badge}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      featuredCard: { ...p.featuredCard, badge: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="hl-feat-cta" className="mb-1 block text-xs font-bold text-slate-700">
                  Button Text
                </label>
                <input
                  id="hl-feat-cta"
                  type="text"
                  value={config.featuredCard.ctaText}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      featuredCard: { ...p.featuredCard, ctaText: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="hl-feat-title" className="mb-1 block text-xs font-bold text-slate-700">
                  Main Card Headline
                </label>
                <input
                  id="hl-feat-title"
                  type="text"
                  value={config.featuredCard.title}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      featuredCard: { ...p.featuredCard, title: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="hl-feat-subtitle" className="mb-1 block text-xs font-bold text-slate-700">
                  Subheadline
                </label>
                <input
                  id="hl-feat-subtitle"
                  type="text"
                  value={config.featuredCard.subtitle}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      featuredCard: { ...p.featuredCard, subtitle: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {config.featuredCard.highlights.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-12"
                >
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Track Title
                    </label>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          featuredCard: {
                            ...p.featuredCard,
                            highlights: p.featuredCard.highlights.map((h) =>
                              h.id === item.id ? { ...h, title: e.target.value } : h
                            ),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Description
                    </label>
                    <input
                      type="text"
                      value={item.desc}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          featuredCard: {
                            ...p.featuredCard,
                            highlights: p.featuredCard.highlights.map((h) =>
                              h.id === item.id ? { ...h, desc: e.target.value } : h
                            ),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-bold text-slate-600">
                      Target URL
                    </label>
                    <input
                      type="text"
                      value={item.categoryLink}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          featuredCard: {
                            ...p.featuredCard,
                            highlights: p.featuredCard.highlights.map((h) =>
                              h.id === item.id ? { ...h, categoryLink: e.target.value } : h
                            ),
                          },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex items-end justify-end gap-1 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          featuredCard: {
                            ...p.featuredCard,
                            highlights: reorderListItem(p.featuredCard.highlights, idx, 'up'),
                          },
                        }))
                      }
                      aria-label={`Move up ${item.title}`}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((p) => ({
                          ...p,
                          featuredCard: {
                            ...p.featuredCard,
                            highlights: p.featuredCard.highlights.filter((h) => h.id !== item.id),
                          },
                        }))
                      }
                      aria-label={`Remove ${item.title}`}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Path Grid Editor */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Course Highlights & Learning Paths Grid ({config.learningPathsSection.items.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Edit the &ldquo;Choose Your Learning Path&rdquo; heading and add, reorder, or remove
                  highlight cards.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddLearningPath}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Highlight Card</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="lp-heading" className="mb-1 block text-xs font-bold text-slate-700">
                  Section Heading
                </label>
                <input
                  id="lp-heading"
                  type="text"
                  value={config.learningPathsSection.heading}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      learningPathsSection: {
                        ...p.learningPathsSection,
                        heading: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="lp-subheading" className="mb-1 block text-xs font-bold text-slate-700">
                  Section Subheading
                </label>
                <input
                  id="lp-subheading"
                  type="text"
                  value={config.learningPathsSection.subheading}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      learningPathsSection: {
                        ...p.learningPathsSection,
                        subheading: e.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {config.learningPathsSection.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Card Title
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.map((x) =>
                                x.id === item.id ? { ...x, title: e.target.value } : x
                              ),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Target Category Filter
                      </label>
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.map((x) =>
                                x.id === item.id ? { ...x, category: e.target.value } : x
                              ),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Icon
                      </label>
                      <select
                        value={item.iconKey}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.map((x) =>
                                x.id === item.id
                                  ? { ...x, iconKey: e.target.value as HighlightIconKey }
                                  : x
                              ),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-bold text-slate-600">
                        Accent
                      </label>
                      <select
                        value={item.accentKey}
                        onChange={(e) =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.map((x) =>
                                x.id === item.id
                                  ? { ...x, accentKey: e.target.value as HighlightAccentKey }
                                  : x
                              ),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        {ACCENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end justify-end gap-1 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: reorderListItem(p.learningPathsSection.items, idx, 'up'),
                            },
                          }))
                        }
                        aria-label={`Move up highlight ${item.title}`}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: reorderListItem(p.learningPathsSection.items, idx, 'down'),
                            },
                          }))
                        }
                        aria-label={`Move down highlight ${item.title}`}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.filter((x) => x.id !== item.id),
                            },
                          }))
                        }
                        aria-label={`Delete highlight ${item.title}`}
                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="sm:col-span-12 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 border border-slate-200">
                          {renderPreviewIcon(item.iconKey)}
                        </span>
                        <input
                          type="text"
                          value={item.desc}
                          onChange={(e) =>
                            setConfig((p) => ({
                              ...p,
                              learningPathsSection: {
                                ...p.learningPathsSection,
                                items: p.learningPathsSection.items.map((x) =>
                                  x.id === item.id ? { ...x, desc: e.target.value } : x
                                ),
                              },
                            }))
                          }
                          aria-label={`Description for ${item.title}`}
                          placeholder="Short description shown inside learning path card"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <ImageUploadField
                        label={`Optional Custom Picture for "${item.title}"`}
                        value={item.image ?? ''}
                        onChange={(url) =>
                          setConfig((p) => ({
                            ...p,
                            learningPathsSection: {
                              ...p.learningPathsSection,
                              items: p.learningPathsSection.items.map((x) =>
                                x.id === item.id ? { ...x, image: url } : x
                              ),
                            },
                          }))
                        }
                        placeholder="Leave empty for icon card, or upload custom path image"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save Course Highlights'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: STATISTICS & COUNTERS */}
      {activeTab === 'stats' && (
        <form
          onSubmit={handleSaveStats}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Homepage Statistics & Counter Controls
              </h3>
              <p className="text-xs text-slate-500">
                Choose automatic real-time database counters or set custom milestone figures and
                labels.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, mode: 'auto' },
                  }))
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  config.statsCard.mode === 'auto'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live DB Auto-Sync
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, mode: 'custom' },
                  }))
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  config.statsCard.mode === 'custom'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Custom Showcase Numbers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="st-badge" className="mb-1 block text-xs font-bold text-slate-700">
                Card Kicker Badge
              </label>
              <input
                id="st-badge"
                type="text"
                value={config.statsCard.badge}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, badge: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="st-cta" className="mb-1 block text-xs font-bold text-slate-700">
                Button Text
              </label>
              <input
                id="st-cta"
                type="text"
                value={config.statsCard.ctaText}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, ctaText: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
            </div>

            <div>
              <label htmlFor="st-title" className="mb-1 block text-xs font-bold text-slate-700">
                Statistics Headline
              </label>
              <input
                id="st-title"
                type="text"
                value={config.statsCard.title}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, title: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>

            <div>
              <label htmlFor="st-subtitle" className="mb-1 block text-xs font-bold text-slate-700">
                Subheadline
              </label>
              <input
                id="st-subtitle"
                type="text"
                value={config.statsCard.subtitle}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    statsCard: { ...p.statsCard, subtitle: e.target.value },
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: 'students', hint: `Live DB: ${(liveStats?.students ?? 0).toLocaleString()}` },
                { key: 'courses', hint: `Live DB: ${liveStats?.courses ?? 0}` },
                { key: 'teachers', hint: `Live DB: ${liveStats?.teachers ?? 0}` },
                { key: 'videos', hint: `Live DB: ${(liveStats?.videos ?? 0).toLocaleString()}` },
              ] as const
            ).map(({ key, hint }) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <label
                  htmlFor={`st-label-${key}`}
                  className="mb-1 block text-[11px] font-bold uppercase text-slate-500"
                >
                  Metric Label ({key})
                </label>
                <input
                  id={`st-label-${key}`}
                  type="text"
                  value={config.statsCard.labels[key]}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      statsCard: {
                        ...p.statsCard,
                        labels: { ...p.statsCard.labels, [key]: e.target.value },
                      },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                />

                <label
                  htmlFor={`st-val-${key}`}
                  className="mb-1 mt-2.5 block text-[11px] font-bold text-slate-600"
                >
                  Custom Showcase Number
                </label>
                <input
                  id={`st-val-${key}`}
                  type="number"
                  min={0}
                  disabled={config.statsCard.mode !== 'custom'}
                  value={config.statsCard.customValues[key]}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      statsCard: {
                        ...p.statsCard,
                        customValues: {
                          ...p.statsCard.customValues,
                          [key]: Math.max(0, Number(e.target.value) || 0),
                        },
                      },
                    }))
                  }
                  className="font-mono-tabular w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-extrabold disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Statistics Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: ADVANCED TESTIMONIALS / REVIEWS STUDIO */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveReviewsHeader}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 className="text-base font-extrabold text-slate-900">
              Testimonials Marquee Header
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label htmlFor="rev-kicker" className="mb-1 block text-xs font-bold text-slate-700">
                  Kicker Label
                </label>
                <input
                  id="rev-kicker"
                  type="text"
                  value={config.reviewsSection.kicker}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      reviewsSection: { ...p.reviewsSection, kicker: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="rev-heading" className="mb-1 block text-xs font-bold text-slate-700">
                  Main Heading
                </label>
                <input
                  id="rev-heading"
                  type="text"
                  value={config.reviewsSection.heading}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      reviewsSection: { ...p.reviewsSection, heading: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="rev-sub" className="mb-1 block text-xs font-bold text-slate-700">
                  Subheading Copy
                </label>
                <input
                  id="rev-sub"
                  type="text"
                  value={config.reviewsSection.subheading}
                  onChange={(e) =>
                    setConfig((p) => ({
                      ...p,
                      reviewsSection: { ...p.reviewsSection, subheading: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Section Heading</span>
              </button>
            </div>
          </form>

          {/* Add / Edit Testimonial Form with Avatar Upload, Status, Featured & Course Tag */}
          <form
            onSubmit={handleSaveReview}
            className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingReviewId ? 'Edit Student Testimonial' : 'Add New Testimonial (With Photo & Moderation)'}
              </h3>
              {editingReviewId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingReviewId(null);
                    setRevName('');
                    setRevAvatar('');
                    setRevCourseTag('');
                    setRevText('');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="cms-rev-name" className="mb-1 block text-xs font-bold text-slate-700">
                  Student / Guardian Name *
                </label>
                <input
                  id="cms-rev-name"
                  type="text"
                  required
                  value={revName}
                  onChange={(e) => setRevName(e.target.value)}
                  placeholder="e.g. Nafisa Chowdhury"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label htmlFor="cms-rev-role" className="mb-1 block text-xs font-bold text-slate-700">
                  Batch / Role Label
                </label>
                <input
                  id="cms-rev-role"
                  type="text"
                  value={revRoleLabel}
                  onChange={(e) => setRevRoleLabel(e.target.value)}
                  placeholder="Verified Student · HSC 27"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="cms-rev-course" className="mb-1 block text-xs font-bold text-slate-700">
                  Course Tag
                </label>
                <input
                  id="cms-rev-course"
                  type="text"
                  value={revCourseTag}
                  onChange={(e) => setRevCourseTag(e.target.value)}
                  placeholder="HSC English A+"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="cms-rev-rating" className="mb-1 block text-xs font-bold text-slate-700">
                  Stars
                </label>
                <select
                  id="cms-rev-rating"
                  value={revRating}
                  onChange={(e) => setRevRating(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                >
                  <option value={5}>5 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={3}>3 Stars</option>
                </select>
              </div>

              <div>
                <label htmlFor="cms-rev-row" className="mb-1 block text-xs font-bold text-slate-700">
                  Marquee Row
                </label>
                <select
                  id="cms-rev-row"
                  value={revRow}
                  onChange={(e) => setRevRow(Number(e.target.value) === 2 ? 2 : 1)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                >
                  <option value={1}>Row 1 (Left)</option>
                  <option value={2}>Row 2 (Right)</option>
                </select>
              </div>

              <div>
                <label htmlFor="cms-rev-status" className="mb-1 block text-xs font-bold text-slate-700">
                  Visibility Status
                </label>
                <select
                  id="cms-rev-status"
                  value={revStatus}
                  onChange={(e) => setRevStatus(e.target.value as 'approved' | 'pending' | 'hidden')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                >
                  <option value="approved">Approved (Live)</option>
                  <option value="pending">Pending Review</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                  <input
                    type="checkbox"
                    checked={revFeatured}
                    onChange={(e) => setRevFeatured(e.target.checked)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span>Featured Story</span>
                </label>
              </div>

              <div className="sm:col-span-4">
                <ImageUploadField
                  label="Reviewer Avatar Photo (Optional)"
                  value={revAvatar}
                  onChange={setRevAvatar}
                  placeholder="/uploads/... or leave empty for initials"
                />
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="cms-rev-text" className="mb-1 block text-xs font-bold text-slate-700">
                  Review / Feedback Message *
                </label>
                <textarea
                  id="cms-rev-text"
                  rows={2}
                  required
                  value={revText}
                  onChange={(e) => setRevText(e.target.value)}
                  placeholder="Write authentic feedback from student or guardian..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{editingReviewId ? 'Save Testimonial Changes' : 'Publish Testimonial'}</span>
              </button>
            </div>
          </form>

          {/* Search, Moderation Filters & Published Testimonials List */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Testimonials Moderation & Order ({reviews.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={revSearch}
                    onChange={(e) => setRevSearch(e.target.value)}
                    placeholder="Search reviewer..."
                    className="rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs"
                  />
                </div>
                <select
                  aria-label="Filter reviews by moderation status"
                  value={revFilterStatus}
                  onChange={(e) => setRevFilterStatus(e.target.value as 'all' | 'approved' | 'pending' | 'hidden')}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                >
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {reviews
                .filter((r) => {
                  const status = r.status ?? 'approved';
                  if (revFilterStatus !== 'all' && status !== revFilterStatus) return false;
                  if (
                    revSearch.trim() &&
                    !`${r.name} ${r.roleLabel} ${r.text}`.toLowerCase().includes(revSearch.toLowerCase())
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((rev, idx) => {
                  const isConfirming = confirmReviewDeleteId === rev.id;
                  const status = rev.status ?? 'approved';
                  return (
                    <div
                      key={rev.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-amber-500">
                            {Array.from({ length: rev.rating }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                            ))}
                            {rev.featured && (
                              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                                Featured
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span
                              className={`rounded px-2 py-0.5 uppercase ${
                                status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {status}
                            </span>
                            <span className="font-mono-tabular text-slate-500">Row {rev.row}</span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-700">{rev.text}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {rev.avatar && (
                            <img
                              src={rev.avatar}
                              alt={rev.name}
                              className="h-7 w-7 rounded-full object-cover border border-slate-200"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-extrabold text-slate-900">{rev.name}</p>
                            <p className="truncate text-[11px] text-slate-500">{rev.roleLabel}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleReorderReview(rev.id, 'up')}
                            disabled={idx === 0}
                            aria-label={`Move up review ${rev.name}`}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-40"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReorderReview(rev.id, 'down')}
                            aria-label={`Move down review ${rev.name}`}
                            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleQuickModeration(rev, {
                                status: status === 'approved' ? 'hidden' : 'approved',
                              })
                            }
                            aria-label={`${status === 'approved' ? 'Hide' : 'Approve'} review ${rev.name}`}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                          >
                            {status === 'approved' ? 'Hide' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleQuickModeration(rev, { featured: !rev.featured })
                            }
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800"
                          >
                            {rev.featured ? 'Unfeature' : 'Feature'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditReview(rev)}
                            aria-label={`Edit review ${rev.name}`}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-indigo-400"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReview(rev.id)}
                            aria-label={
                              isConfirming
                                ? `Confirm delete review ${rev.name}`
                                : `Delete review ${rev.name}`
                            }
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold ${
                              isConfirming
                                ? 'bg-rose-600 text-white'
                                : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            {isConfirming ? 'Confirm' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOM HEADER MENUS, WHITE-LABEL BRANDING, LANGUAGE, FOOTER & PAGE BUILDER */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBranding} className="space-y-6">
          {/* Custom Header Navigation Menu Builder */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <MenuIcon className="h-4 w-4 text-indigo-600" />
                  <span>Custom Header Navigation Menu Builder ({headerMenu.length} Links)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Add custom navbar links, link to Page Builder pages (/page/slug), toggle visibility, reorder, or add badges like &quot;New&quot; / &quot;Live&quot;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHeaderMenu(DEFAULT_HEADER_MENU.map((m) => ({ ...m })))}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Default Menu</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 sm:grid-cols-12">
              <input
                type="text"
                placeholder="Menu Label (e.g. Scholarship FAQ)"
                value={newMenuLabel}
                onChange={(e) => setNewMenuLabel(e.target.value)}
                className="sm:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Path or URL (e.g. /page/faq)"
                value={newMenuPath}
                onChange={(e) => setNewMenuPath(e.target.value)}
                className="sm:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <select
                aria-label="Quick pick route for custom menu"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [lbl, pth] = e.target.value.split('|');
                  setNewMenuLabel((prev) => prev || lbl);
                  setNewMenuPath(pth);
                }}
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
              >
                <option value="">Quick Route...</option>
                <option value="About Us|/about-us">/about-us</option>
                <option value="Contact|/contact-us">/contact-us</option>
                {customPages.map((pg) => (
                  <option key={pg.id} value={`${pg.title}|/page/${pg.slug}`}>
                    /page/{pg.slug}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Badge (e.g. New)"
                value={newMenuBadge}
                onChange={(e) => setNewMenuBadge(e.target.value)}
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleAddHeaderMenuItem}
                className="sm:col-span-2 inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Menu</span>
              </button>
              <label className="sm:col-span-12 flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={newMenuNewTab}
                  onChange={(e) => setNewMenuNewTab(e.target.checked)}
                />
                <span>Open link in new browser tab</span>
              </label>
            </div>

            <div className="space-y-2">
              {headerMenu.map((item, idx) => (
                <div
                  key={item.id}
                  className={`grid grid-cols-1 gap-2 rounded-xl border p-2.5 sm:grid-cols-12 sm:items-center ${
                    item.visible ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100/70 opacity-75'
                  }`}
                >
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setHeaderMenu((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, label: e.target.value } : m))
                      )
                    }
                    aria-label={`Menu label ${item.label}`}
                    className="sm:col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="text"
                    value={item.path}
                    onChange={(e) =>
                      setHeaderMenu((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, path: e.target.value } : m))
                      )
                    }
                    aria-label={`Menu path ${item.label}`}
                    className="sm:col-span-3 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Badge"
                    value={item.badge ?? ''}
                    onChange={(e) =>
                      setHeaderMenu((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, badge: e.target.value || undefined } : m))
                      )
                    }
                    className="sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <div className="sm:col-span-4 flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => setHeaderMenu((prev) => reorderListItem(prev, idx, 'up'))}
                      aria-label={`Move ${item.label} up`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === headerMenu.length - 1}
                      onClick={() => setHeaderMenu((prev) => reorderListItem(prev, idx, 'down'))}
                      aria-label={`Move ${item.label} down`}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setHeaderMenu((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, visible: !m.visible } : m))
                        )
                      }
                      aria-label={`${item.visible ? 'Hide' : 'Show'} ${item.label}`}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold ${
                        item.visible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      <span>{item.visible ? 'Shown' : 'Hidden'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeaderMenu((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove menu ${item.label}`}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <h3 className="text-base font-extrabold text-slate-900">
              Logo, White-Label Branding & Language Settings
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="br-name" className="mb-1 block text-xs font-bold text-slate-700">
                  Institution / Platform Name
                </label>
                <input
                  id="br-name"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label htmlFor="br-domain" className="mb-1 block text-xs font-bold text-slate-700">
                  White-Label Domain
                </label>
                <input
                  id="br-domain"
                  type="text"
                  value={whiteLabelDomain}
                  onChange={(e) => setWhiteLabelDomain(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="br-tag" className="mb-1 block text-xs font-bold text-slate-700">
                  SEO Tagline
                </label>
                <input
                  id="br-tag"
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <ImageUploadField label="Main Brand Logo" value={logoUrl} onChange={setLogoUrl} />
              <ImageUploadField label="Browser Favicon Icon" value={faviconUrl} onChange={setFaviconUrl} />
              <div>
                <label htmlFor="br-lang" className="mb-1 block text-xs font-bold text-slate-700">
                  Website Default Language Mode
                </label>
                <select
                  id="br-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value === 'bn' ? 'bn' : 'en')}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="en">English (EN Primary)</option>
                  <option value="bn">বাংলা / Bilingual (BN Badge)</option>
                </select>
              </div>
              <div>
                <label htmlFor="br-color" className="mb-1 block text-xs font-bold text-slate-700">
                  Primary Brand Accent Hex
                </label>
                <input
                  id="br-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-24 rounded-xl border border-slate-300 p-1"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Custom Footer & Socials</h3>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label htmlFor="ft-copy" className="mb-1 block text-xs font-bold text-slate-700">
                  Footer Copyright Line
                </label>
                <input
                  id="ft-copy"
                  type="text"
                  value={footerCopyright}
                  onChange={(e) => setFooterCopyright(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label htmlFor="ft-yt" className="mb-1 block text-xs font-bold text-slate-700">
                  YouTube URL
                </label>
                <input
                  id="ft-yt"
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label htmlFor="ft-fb" className="mb-1 block text-xs font-bold text-slate-700">
                  Facebook URL
                </label>
                <input
                  id="ft-fb"
                  type="text"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Footer Navigation Links</span>
                <button
                  type="button"
                  onClick={() =>
                    setFooterLinks((prev) => [...prev, { label: 'New Link', path: '/courses' }])
                  }
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                >
                  + Add Footer Link
                </button>
              </div>
              {footerLinks.map((fl, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={fl.label}
                    onChange={(e) =>
                      setFooterLinks((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x))
                      )
                    }
                    className="col-span-5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={fl.path}
                    onChange={(e) =>
                      setFooterLinks((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, path: e.target.value } : x))
                      )
                    }
                    className="col-span-5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setFooterLinks((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Page Builder for Dynamic Custom Pages */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Page Builder (/page/:slug) ({customPages.length} Pages)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                placeholder="Page Title (e.g. Scholarship FAQ)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value)}
                placeholder="URL Slug (e.g. scholarship-faq)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCustomPage}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white"
              >
                + Add Custom Page
              </button>
              <textarea
                rows={2}
                value={newPageBody}
                onChange={(e) => setNewPageBody(e.target.value)}
                placeholder="Page content..."
                className="sm:col-span-3 rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            {customPages.map((pg) => (
              <div key={pg.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs">
                <div>
                  <p className="font-extrabold text-slate-900">{pg.title}</p>
                  <p className="text-[11px] text-sky-700">/page/{pg.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomPages((prev) => prev.filter((p) => p.id !== pg.id))}
                  className="text-xs font-bold text-rose-600"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#062436] px-6 py-3 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Menus, Logo, Footer & Pages'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
