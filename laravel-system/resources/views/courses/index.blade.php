@extends('layouts.app')
@section('title', 'Courses — ' . $brand['company_name'])
@section('content')
@php $currency = $brand['currency_symbol'] ?? '$'; @endphp
<div class="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white pb-16 pt-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
            <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900">{{ $brand['company_name'] }} Courses</h1>
            <form method="GET" action="{{ route('courses.index') }}" class="mt-6 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
                <input type="hidden" name="cat" value="{{ $category }}">
                <input type="search" name="q" value="{{ $search }}" placeholder="Search courses, levels, or topics..." class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-xs">
                <select name="sort" onchange="this.form.submit()" class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">
                    <option value="featured" @selected($sort === 'featured')>Sort: Featured</option>
                    <option value="popular" @selected($sort === 'popular')>Most Enrolled</option>
                    <option value="price_asc" @selected($sort === 'price_asc')>Price: Low to High</option>
                    <option value="price_desc" @selected($sort === 'price_desc')>Price: High to Low</option>
                </select>
                <button type="submit" class="rounded-xl text-white px-5 py-2.5 text-xs font-bold" style="background-color: var(--brand-accent)">Search</button>
            </form>

            <div class="mt-6 flex flex-wrap justify-center gap-2">
                @foreach(($courseCategories ?? ['All Courses', 'Combos']) as $tab)
                    <a href="{{ route('courses.index', ['cat' => $tab, 'q' => $search, 'sort' => $sort]) }}"
                       class="rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition {{ $category === $tab ? 'text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300' }}"
                       @if($category === $tab) style="background-color: var(--brand-primary)" @endif>
                        {{ $tab }}
                    </a>
                @endforeach
            </div>
        </div>

        @auth
            @if(auth()->user()->role === 'admin')
                <div class="mt-8 rounded-2xl border border-indigo-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p class="text-sm font-extrabold text-slate-900">Administrator Course Management</p>
                        <p class="text-xs text-slate-600">Create, edit, toggle active/draft, duplicate, or delete courses.</p>
                    </div>
                    <a href="{{ route('portal.index') }}#courses-studio" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Manage Courses in Portal</a>
                </div>
            @endif
        @endauth

        @if($combos->count() > 0)
            <section class="mt-10">
                <h2 class="text-xl font-extrabold text-slate-900 mb-5">Course Bundles &amp; Combos</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @foreach($combos as $c)
                        <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs">
                            <div class="p-5">
                                <div class="flex items-center justify-between text-xs font-bold text-indigo-700">
                                    <span>Combo · {{ count($c->included_courses ?? []) }} courses</span>
                                    <span>{{ $c->level_tag }}</span>
                                </div>
                                <h3 class="text-lg font-extrabold text-slate-900 mt-2">{{ $c->title }}</h3>
                                @if(!empty($c->included_courses))
                                    <div class="mt-4 rounded-xl bg-slate-50 p-3 space-y-1.5">
                                        @foreach($c->included_courses as $sub)
                                            <div class="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-semibold text-slate-700">{{ $sub }}</div>
                                        @endforeach
                                    </div>
                                @endif
                            </div>
                            <div class="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                                <div class="flex items-baseline gap-2">
                                    <span class="font-extrabold text-indigo-700 text-xl">{{ $c->price === 0 ? 'Free' : $currency . number_format($c->price) }}</span>
                                    @if($c->original_price > $c->price)
                                        <span class="text-sm text-slate-400 line-through">{{ $currency . number_format($c->original_price) }}</span>
                                    @endif
                                </div>
                                <a href="{{ route('courses.show', $c->slug) }}" class="rounded-xl text-white text-xs font-bold px-4 py-2" style="background-color: var(--brand-primary)">View Details</a>
                            </div>
                        </article>
                    @endforeach
                </div>
            </section>
        @endif

        <section class="mt-10">
            <h2 class="text-xl font-extrabold text-slate-900 mb-5">All Courses</h2>
            @if($regularCourses->count() > 0)
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    @foreach($regularCourses as $c)
                        <article class="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs">
                            <div class="p-5">
                                <div class="flex items-center justify-between text-xs font-semibold text-slate-500">
                                    <span>{{ $c->category }}</span>
                                    <span class="text-indigo-700 font-bold">{{ $c->level_tag }}</span>
                                </div>
                                <h3 class="text-lg font-extrabold text-slate-900 mt-2">{{ $c->title }}</h3>
                                <p class="text-sm text-slate-600 mt-1">{{ $c->subtitle }}</p>
                            </div>
                            <div class="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                                <div class="flex items-baseline gap-2">
                                    <span class="font-extrabold text-indigo-700 text-xl">{{ $c->price === 0 ? 'Free' : $currency . number_format($c->price) }}</span>
                                    @if($c->original_price > $c->price)
                                        <span class="text-sm text-slate-400 line-through">{{ $currency . number_format($c->original_price) }}</span>
                                    @endif
                                </div>
                                <a href="{{ route('courses.show', $c->slug) }}" class="rounded-xl text-white text-xs font-bold px-4 py-2" style="background-color: var(--brand-primary)">View Details</a>
                            </div>
                        </article>
                    @endforeach
                </div>
            @elseif($combos->count() === 0)
                <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 text-sm">
                    No courses matched your filter yet.
                </div>
            @endif
        </section>
    </div>
</div>
@endsection
