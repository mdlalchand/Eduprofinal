@extends('layouts.app')
@section('title', $brand['company_name'] . ' — ' . ($brand['tagline'] ?? 'Learning Platform'))
@section('content')
@php
    $currency = $brand['currency_symbol'] ?? '$';
    $slides = !empty($heroSlides) ? $heroSlides : [[
        'badge' => $brand['company_name'],
        'title' => $brand['company_name'],
        'subtitle' => $brand['tagline'] ?? 'Online & Campus Learning Management Platform',
        'cta_text' => 'Browse Courses',
        'course_slug' => $courses->first()?->slug ?? '',
    ]];
    $cfg = $homepageConfig ?? [];
@endphp

<section class="py-12 text-white" style="background: linear-gradient(160deg, var(--brand-primary) 0%, #0b3954 100%)">
    <div class="max-w-7xl mx-auto px-4">
        {{-- Hero Slider --}}
        <div id="brand-hero-slider" class="relative rounded-2xl border border-white/15 bg-slate-950/35 text-center shadow-2xl overflow-hidden">
            @foreach($slides as $idx => $slide)
                <div class="hero-slide relative p-8 sm:p-14 {{ $idx === 0 ? 'block' : 'hidden' }}">
                    @if(!empty($slide['image']))
                        <img src="{{ \App\Support\BrandSettings::resolveMediaUrl($slide['image']) }}" alt="{{ $slide['title'] ?? 'Hero Banner' }}" class="absolute inset-0 h-full w-full object-cover">
                        <div class="absolute inset-0 bg-slate-950/70"></div>
                    @endif
                    <div class="relative z-10 max-w-3xl mx-auto">
                        <span class="inline-block rounded-lg bg-amber-400 text-slate-950 font-extrabold text-xs px-3 py-1">
                            {{ $slide['badge'] ?? $brand['company_name'] }}
                        </span>
                        <h1 class="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight">{{ $slide['title'] ?? $brand['company_name'] }}</h1>
                        <p class="mt-3 text-slate-200 text-base sm:text-lg">{{ $slide['subtitle'] ?? $brand['tagline'] }}</p>
                        <div class="mt-7 flex flex-wrap justify-center gap-3">
                            <a href="{{ !empty($slide['course_slug']) ? route('courses.show', $slide['course_slug']) : route('courses.index') }}"
                               class="rounded-xl bg-white text-slate-900 font-bold px-6 py-3 text-sm hover:bg-slate-100 transition">
                                {{ $slide['cta_text'] ?? 'Browse Courses' }}
                            </a>
                            @guest
                                <a href="{{ route('login') }}" class="rounded-xl border border-white/30 bg-white/10 text-white font-bold px-6 py-3 text-sm hover:bg-white/20 transition">
                                    Sign In / Portal
                                </a>
                            @endguest
                        </div>
                    </div>
                </div>
            @endforeach

            @if(count($slides) > 1)
                <div class="pb-5 flex justify-center gap-2 relative z-10">
                    @foreach($slides as $idx => $slide)
                        <button type="button" onclick="showHeroSlide({{ $idx }})" aria-label="Slide {{ $idx + 1 }}" class="h-2.5 w-6 rounded-full bg-white/40 hover:bg-white"></button>
                    @endforeach
                </div>
                <script>
                    function showHeroSlide(target) {
                        document.querySelectorAll('#brand-hero-slider .hero-slide').forEach(function (el, i) {
                            el.classList.toggle('hidden', i !== target);
                        });
                    }
                </script>
            @endif
        </div>

        {{-- Featured Courses + Live Platform Metrics --}}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
            <div class="rounded-2xl border border-white/15 bg-white/10 p-7 flex flex-col justify-between">
                <div>
                    <span class="inline-block rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                        {{ $cfg['featured_badge'] ?? 'Featured Programs' }}
                    </span>
                    <h2 class="mt-3 text-2xl font-extrabold">{{ $cfg['featured_title'] ?? ('Explore ' . $brand['company_name'] . ' Courses') }}</h2>
                    <p class="text-slate-200 text-sm mt-1">{{ $cfg['featured_subtitle'] ?? 'Structured courses, live cohorts, and guided practice.' }}</p>
                    <div class="mt-5 space-y-2.5">
                        @forelse($courses->take(2) as $hc)
                            <a href="{{ route('courses.show', $hc->slug) }}" class="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 transition">
                                <div>
                                    <p class="font-bold">{{ $hc->title }}</p>
                                    <p class="text-xs text-slate-300">{{ $hc->level_tag }} · {{ $hc->price === 0 ? 'Free' : $currency . number_format($hc->price) }}</p>
                                </div>
                                <span class="text-xs font-bold text-emerald-300">Explore →</span>
                            </a>
                        @empty
                            <div class="rounded-xl border border-white/15 bg-white/5 px-4 py-4 text-xs text-slate-200">
                                No courses published yet. Administrators can publish courses from the Unified Portal.
                            </div>
                        @endforelse
                    </div>
                </div>
                <a href="{{ route('courses.index') }}" class="mt-6 block text-center rounded-xl bg-emerald-500 text-slate-950 font-bold py-3 text-sm hover:bg-emerald-400 transition">
                    {{ $cfg['featured_cta'] ?? 'Browse All Courses' }}
                </a>
            </div>

            <div class="rounded-2xl border border-white/15 bg-white/10 p-7 flex flex-col justify-between">
                <div>
                    <span class="inline-block rounded-lg bg-sky-500/20 border border-sky-400/30 px-3 py-1 text-xs font-semibold text-sky-200">
                        {{ $cfg['stats_badge'] ?? 'Platform Overview' }}
                    </span>
                    <h2 class="mt-3 text-2xl font-extrabold">{{ $cfg['stats_title'] ?? 'Live Academy Metrics' }}</h2>
                    <p class="text-slate-200 text-sm mt-1">{{ $cfg['stats_subtitle'] ?? 'Real-time enrollment, course, faculty, and lesson totals.' }}</p>
                    <div class="grid grid-cols-2 gap-3 mt-5">
                        <div class="rounded-xl bg-white/10 p-4"><p class="text-2xl font-extrabold">{{ number_format($stats['students']) }}</p><p class="text-xs text-slate-200">Learners</p></div>
                        <div class="rounded-xl bg-white/10 p-4"><p class="text-2xl font-extrabold">{{ number_format($stats['courses']) }}</p><p class="text-xs text-slate-200">Courses</p></div>
                        <div class="rounded-xl bg-white/10 p-4"><p class="text-2xl font-extrabold">{{ number_format($stats['teachers']) }}</p><p class="text-xs text-slate-200">Instructors</p></div>
                        <div class="rounded-xl bg-white/10 p-4"><p class="text-2xl font-extrabold">{{ number_format($stats['videos']) }}</p><p class="text-xs text-slate-200">Lessons</p></div>
                    </div>
                </div>
                <a href="{{ route('courses.index') }}" class="mt-6 block text-center rounded-xl bg-sky-400 text-slate-950 font-bold py-3 text-sm hover:bg-sky-300 transition">See Course Catalog</a>
            </div>
        </div>
    </div>
</section>

{{-- Course Highlights --}}
<section class="bg-white py-14">
    <div class="max-w-7xl mx-auto px-4">
        <div class="text-center max-w-2xl mx-auto">
            <h2 class="text-3xl font-extrabold text-slate-900">{{ $cfg['paths_heading'] ?? 'Featured Courses' }}</h2>
            <p class="mt-2 text-sm text-slate-600">{{ $cfg['paths_subheading'] ?? ('Structured programs offered by ' . $brand['company_name'] . '.') }}</p>
        </div>
        @if($courses->count() > 0)
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
                @foreach($courses as $c)
                    <a href="{{ route('courses.show', $c->slug) }}" class="rounded-2xl border border-slate-200 p-5 hover:border-indigo-400 transition block">
                        <p class="text-xs font-bold text-indigo-600">{{ $c->category }} · {{ $c->level_tag }}</p>
                        <h3 class="mt-1 text-base font-extrabold text-slate-900">{{ $c->title }}</h3>
                        <p class="mt-1 text-xs text-slate-600">{{ $c->subtitle }}</p>
                        <p class="mt-3 text-sm font-extrabold text-slate-900">{{ $c->price === 0 ? 'Free' : $currency . number_format($c->price) }}</p>
                    </a>
                @endforeach
            </div>
        @else
            <div class="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p class="text-sm font-bold text-slate-700">No courses have been published yet.</p>
                <p class="text-xs text-slate-500 mt-1">Sign in as administrator to publish your first course, batch, or exam.</p>
            </div>
        @endif
    </div>
</section>

{{-- Student Testimonials --}}
@if(($reviews ?? collect())->count() > 0)
    <section class="bg-slate-50 py-14">
        <div class="max-w-7xl mx-auto px-4">
            <div class="text-center">
                <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Testimonials</p>
                <h2 class="mt-1 text-3xl font-extrabold text-slate-900">What Our Learners Say</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
                @foreach($reviews as $rev)
                    <div class="rounded-2xl border border-slate-200 bg-white p-5">
                        <p class="text-xs font-bold text-amber-500">{{ str_repeat('★', $rev->rating) }}</p>
                        <p class="mt-2 text-xs text-slate-700 leading-relaxed">{{ $rev->text }}</p>
                        <p class="mt-3 text-xs font-extrabold text-slate-900">{{ $rev->name }}</p>
                        <p class="text-[11px] text-slate-500">{{ $rev->role_label }}</p>
                    </div>
                @endforeach
            </div>
        </div>
    </section>
@endif
@endsection
