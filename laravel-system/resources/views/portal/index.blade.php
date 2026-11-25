@extends('layouts.app')
@section('title', 'Unified Portal — ' . $brand['company_name'])
@section('content')
@php $currency = $brand['currency_symbol'] ?? '$'; @endphp
<div class="max-w-7xl mx-auto px-4 py-10 space-y-6">
    <div class="rounded-2xl bg-white border border-slate-200 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
            <p class="text-xs font-bold uppercase text-indigo-600">{{ $brand['company_name'] }} · {{ strtoupper($user->role) }}</p>
            <h1 class="text-2xl font-extrabold text-slate-900">Welcome, {{ $user->name }}</h1>
            @if($user->roll_number)
                <p class="text-xs font-mono text-slate-500 mt-0.5">Student ID: {{ $user->roll_number }}</p>
            @endif
        </div>
        <div class="flex flex-wrap items-center gap-2">
            @if($user->role === 'admin')
                <a href="#white-label-branding" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Branding</a>
                <a href="#system-updates" class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Updates &amp; Backup</a>
                <a href="#courses-studio" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Courses</a>
                <a href="#users-studio" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Users</a>
                <a href="#branches-studio" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Branches</a>
            @endif
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="rounded-xl bg-rose-50 text-rose-700 font-bold px-4 py-2 text-xs">Sign Out</button>
            </form>
        </div>
    </div>

    @if($user->role === 'admin')
        @include('portal.partials.branding-and-updates')

        @php
            $dynamicCourseCats = collect($categories ?? [])->where('type', 'course')->where('active', true)->pluck('name')->all();
            $courseCategoryOptions = array_values(array_unique(array_merge(['General', 'Combo Packs'], $dynamicCourseCats)));
        @endphp

        <div id="categories-studio" class="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 class="text-lg font-extrabold text-slate-900">Course Categories ({{ collect($categories ?? [])->where('type', 'course')->count() }})</h2>
            <p class="text-xs text-slate-500 mb-4">Add categories for your academy. Active categories appear in Course Creation and Public Filters.</p>
            <form method="POST" action="{{ route('portal.categories.store') }}" class="flex flex-wrap items-center gap-3 mb-4">
                @csrf
                <input type="hidden" name="type" value="course">
                <input type="text" name="name" required placeholder="New Category Name" class="flex-1 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Add Course Category</button>
            </form>
            <div class="flex flex-wrap gap-2">
                @foreach(collect($categories ?? [])->where('type', 'course') as $cat)
                    <div class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                        <span class="font-bold text-slate-800">{{ $cat->name }}</span>
                        <form method="POST" action="{{ route('portal.categories.toggle', $cat) }}" class="inline">
                            @csrf @method('PATCH')
                            <button type="submit" class="font-bold {{ $cat->active ? 'text-emerald-700' : 'text-slate-500' }}">{{ $cat->active ? 'Active' : 'Hidden' }}</button>
                        </form>
                        <form method="POST" action="{{ route('portal.categories.delete', $cat) }}" class="inline">
                            @csrf @method('DELETE')
                            <button type="submit" class="text-rose-600 font-bold" aria-label="Delete {{ $cat->name }}">×</button>
                        </form>
                    </div>
                @endforeach
            </div>
        </div>

        <div id="courses-studio" class="rounded-2xl bg-white border border-slate-200 p-6">
            <div class="flex flex-wrap items-center justify-between gap-4 mb-5">
                <div>
                    <h2 class="text-lg font-extrabold text-slate-900">Course &amp; Combo Studio ({{ $courses->count() }})</h2>
                    <p class="text-xs text-slate-500">Create, edit, publish/draft, duplicate, or remove courses and bundles.</p>
                </div>
                <a href="{{ route('courses.index') }}" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">View Live /courses</a>
            </div>

            <form method="POST" action="{{ route('portal.courses.store') }}" class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6 space-y-3">
                @csrf
                <h3 class="text-sm font-extrabold text-slate-900">+ Add New Course / Combo</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" name="title" required placeholder="Course Title" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="text" name="subtitle" required placeholder="Subtitle" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <select name="category" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                        @foreach($courseCategoryOptions as $catOpt)
                            <option value="{{ $catOpt }}">{{ $catOpt }}</option>
                        @endforeach
                    </select>
                    <input type="text" name="level_tag" required value="Standard" placeholder="Level / Cohort Tag" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="number" name="price" required value="99" min="0" placeholder="Sale Price ({{ $currency }})" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="number" name="original_price" required value="149" min="0" placeholder="Original Price ({{ $currency }})" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <select name="status" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                        <option value="active">Active (Published)</option>
                        <option value="draft">Draft (Hidden)</option>
                    </select>
                    <label class="flex items-center gap-2 text-xs font-bold text-slate-700 px-2">
                        <input type="checkbox" name="is_combo" value="1">
                        <span>Bundle as Combo Pack</span>
                    </label>
                    <label class="flex items-center gap-2 text-xs font-bold text-slate-700 px-2">
                        <input type="checkbox" name="exam_system_included" value="1" checked>
                        <span>Include Exam System</span>
                    </label>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <textarea name="description" required rows="2" placeholder="Full Course Description" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"></textarea>
                    <textarea name="included_courses_text" rows="2" placeholder="Included courses for Combo (one per line)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"></textarea>
                </div>
                <button type="submit" class="rounded-xl text-white px-5 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">Publish Course</button>
            </form>

            <div class="space-y-3">
                @foreach($courses as $c)
                    <details class="rounded-xl border border-slate-200 p-4">
                        <summary class="flex flex-wrap items-center justify-between gap-3 cursor-pointer list-none">
                            <div>
                                <p class="font-bold text-sm text-slate-900">{{ $c->title }}</p>
                                <p class="text-xs text-slate-500">{{ $c->category }} · {{ $c->level_tag }} · {{ $currency . $c->price }} (Reg: {{ $currency . $c->original_price }}) · {{ strtoupper($c->status) }}</p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">Modify Details</span>
                                <form method="POST" action="{{ route('portal.courses.status', $c) }}" class="inline">
                                    @csrf @method('PATCH')
                                    <button type="submit" class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                                        {{ $c->status === 'active' ? 'Move to Draft' : 'Publish Active' }}
                                    </button>
                                </form>
                                <form method="POST" action="{{ route('portal.courses.duplicate', $c) }}" class="inline">
                                    @csrf
                                    <button type="submit" class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">Duplicate</button>
                                </form>
                                <form method="POST" action="{{ route('portal.courses.delete', $c) }}" class="inline">
                                    @csrf @method('DELETE')
                                    <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-bold">Delete</button>
                                </form>
                            </div>
                        </summary>

                        <form method="POST" action="{{ route('portal.courses.update', $c) }}" class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                            @csrf @method('PUT')
                            <input type="text" name="title" required value="{{ $c->title }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <input type="text" name="subtitle" required value="{{ $c->subtitle }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <select name="category" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                                @foreach(array_values(array_unique(array_merge($courseCategoryOptions, [$c->category]))) as $catOpt)
                                    <option value="{{ $catOpt }}" @selected($c->category === $catOpt)>{{ $catOpt }}</option>
                                @endforeach
                            </select>
                            <input type="text" name="level_tag" required value="{{ $c->level_tag }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <input type="number" name="price" required value="{{ $c->price }}" min="0" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <input type="number" name="original_price" required value="{{ $c->original_price }}" min="0" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <select name="status" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                                <option value="active" @selected($c->status === 'active')>Active</option>
                                <option value="draft" @selected($c->status === 'draft')>Draft</option>
                            </select>
                            <label class="flex items-center gap-2 text-xs font-bold text-slate-700 px-2">
                                <input type="checkbox" name="is_combo" value="1" @checked($c->is_combo)>
                                <span>Combo Pack</span>
                            </label>
                            <label class="flex items-center gap-2 text-xs font-bold text-slate-700 px-2">
                                <input type="checkbox" name="exam_system_included" value="1" @checked($c->exam_system_included)>
                                <span>Exam System</span>
                            </label>
                            <textarea name="description" required rows="2" class="md:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ $c->description }}</textarea>
                            <textarea name="included_courses_text" rows="2" placeholder="Combo included courses (one per line)" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ implode("\n", $c->included_courses ?? []) }}</textarea>
                            <div class="md:col-span-3">
                                <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-primary)">Save Changes</button>
                            </div>
                        </form>
                    </details>
                @endforeach
            </div>
        </div>
    @endif

    @if(in_array($user->role, ['admin', 'teacher', 'branch_manager']) && isset($batches))
        <div id="batches-studio" class="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 class="text-lg font-extrabold text-slate-900 mb-1">Course Batches &amp; Routine Studio ({{ $batches->count() }})</h2>
            <p class="text-xs text-slate-500 mb-4">Create, edit, or delete course batches.</p>

            <form method="POST" action="{{ route('portal.batches.store') }}" class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                @csrf
                <select name="course_id" required class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    @foreach($courses as $c)
                        <option value="{{ $c->id }}">{{ $c->title }}</option>
                    @endforeach
                </select>
                <input type="text" name="name" required placeholder="Batch Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="code" required placeholder="Batch Code (e.g. COHORT-01)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs uppercase">
                <select name="branch_id" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="">Online / All Branches</option>
                    @foreach($branches as $b)
                        <option value="{{ $b->id }}">{{ $b->name }}</option>
                    @endforeach
                </select>
                <input type="text" name="instructor_name" placeholder="Lead Instructor Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="schedule" required placeholder="Routine (Mon · Wed 4:00 PM)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="start_date" value="{{ date('Y-m-d') }}" placeholder="Start Date" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="number" name="seat_limit" value="60" min="1" placeholder="Seat Limit" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <div class="grid grid-cols-2 gap-2">
                    <select name="mode" class="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs">
                        <option value="Hybrid">Hybrid</option>
                        <option value="Online Live">Online Live</option>
                        <option value="Offline Branch">Offline Branch</option>
                    </select>
                    <select name="status" class="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs">
                        <option value="open">Open</option>
                        <option value="running">Running</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div class="md:col-span-3">
                    <button type="submit" class="rounded-xl text-white px-5 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Create Course Batch</button>
                </div>
            </form>

            <div class="space-y-2.5">
                @foreach($batches as $bat)
                    <details class="rounded-xl border border-slate-200 p-4">
                        <summary class="flex flex-wrap items-center justify-between gap-2 cursor-pointer list-none">
                            <div>
                                <p class="text-sm font-bold text-slate-900">{{ $bat->name }} <span class="text-xs text-indigo-700">({{ $bat->code }})</span></p>
                                <p class="text-xs text-slate-500">{{ $bat->course?->title }} · {{ $bat->schedule }} · {{ $bat->mode }} · {{ strtoupper($bat->status) }}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Edit Batch</span>
                                <form method="POST" action="{{ route('portal.batches.delete', $bat) }}" class="inline">
                                    @csrf @method('DELETE')
                                    <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-bold">Delete</button>
                                </form>
                            </div>
                        </summary>
                        <form method="POST" action="{{ route('portal.batches.update', $bat) }}" class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                            @csrf @method('PUT')
                            <input type="hidden" name="course_id" value="{{ $bat->course_id }}">
                            <input type="text" name="name" required value="{{ $bat->name }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <input type="text" name="code" required value="{{ $bat->code }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase">
                            <input type="text" name="schedule" required value="{{ $bat->schedule }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <input type="number" name="seat_limit" required value="{{ $bat->seat_limit }}" min="1" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                            <select name="mode" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                                @foreach(['Hybrid', 'Online Live', 'Offline Branch'] as $mOpt)
                                    <option value="{{ $mOpt }}" @selected($bat->mode === $mOpt)>{{ $mOpt }}</option>
                                @endforeach
                            </select>
                            <select name="status" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                                @foreach(['open', 'running', 'closed'] as $sOpt)
                                    <option value="{{ $sOpt }}" @selected($bat->status === $sOpt)>{{ strtoupper($sOpt) }}</option>
                                @endforeach
                            </select>
                            <div class="md:col-span-3">
                                <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-primary)">Save Batch Changes</button>
                            </div>
                        </form>
                    </details>
                @endforeach
            </div>
        </div>
    @endif

    @if(in_array($user->role, ['admin', 'teacher']) && isset($lessons))
        <div id="lessons-studio" class="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 class="text-lg font-extrabold text-slate-900 mb-1">Lecture, Live Class &amp; Video Studio ({{ $lessons->count() }})</h2>
            <p class="text-xs text-slate-500 mb-4">Publish recorded videos, live sessions, and lecture sheets.</p>

            <form method="POST" action="{{ route('portal.lessons.store') }}" class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                @csrf
                <select name="course_id" required class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    @foreach($courses as $c)
                        <option value="{{ $c->id }}">{{ $c->title }}</option>
                    @endforeach
                </select>
                <select name="batch_id" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="">All Batches (General)</option>
                    @foreach($batches ?? [] as $bat)
                        <option value="{{ $bat->id }}">{{ $bat->name }} ({{ $bat->code }})</option>
                    @endforeach
                </select>
                <select name="lesson_type" required class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                    <option value="recorded">Recorded Video</option>
                    <option value="live">Live Class</option>
                    <option value="lecture_sheet">Lecture Sheet (PDF)</option>
                </select>
                <input type="text" name="title" required placeholder="Lecture / Live / Video Title" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-2">
                <input type="text" name="duration" required value="30:00" placeholder="Duration" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="module_name" required value="Module 1" placeholder="Module Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="url" name="video_url" placeholder="Video URL" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="url" name="live_join_url" placeholder="Live Join URL" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="lecture_sheet_url" placeholder="Lecture Sheet PDF URL" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="scheduled_at" placeholder="Live Schedule" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <select name="live_status" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="scheduled">Live: Scheduled</option>
                    <option value="live_now">Live: LIVE NOW</option>
                    <option value="ended">Live: Ended</option>
                </select>
                <textarea name="sheet_summary" rows="2" placeholder="Notes & Summary" class="md:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"></textarea>
                <div class="md:col-span-3 flex items-center justify-between">
                    <label class="flex items-center gap-2 text-xs font-bold text-slate-700">
                        <input type="checkbox" name="is_free_preview" value="1">
                        <span>Unlock Free Preview</span>
                    </label>
                    <button type="submit" class="rounded-xl text-white px-5 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Publish Lesson</button>
                </div>
            </form>

            <div class="space-y-2.5">
                @foreach($lessons as $les)
                    <div class="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p class="text-sm font-bold text-slate-900">
                                <span class="uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 mr-1.5">{{ $les->lesson_type }}</span>
                                {{ $les->title }}
                            </p>
                            <p class="text-xs text-slate-500">{{ $les->course?->title }} · {{ $les->module_name }} · {{ $les->duration }}</p>
                        </div>
                        <form method="POST" action="{{ route('portal.lessons.delete', $les) }}">
                            @csrf @method('DELETE')
                            <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 text-xs font-bold">Delete</button>
                        </form>
                    </div>
                @endforeach
            </div>
        </div>
    @endif

    @if(in_array($user->role, ['admin', 'branch_manager']))
        <div class="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 class="text-lg font-extrabold mb-4">Enrollments &amp; Fee Approvals ({{ $enrollments->count() }})</h2>
            <div class="space-y-2">
                @forelse($enrollments as $enr)
                    <div class="flex flex-wrap items-center justify-between border border-slate-200 rounded-xl p-3 text-sm gap-2">
                        <div><strong>{{ $enr->user->name }}</strong> — {{ $enr->course->title }} ({{ $currency . number_format($enr->amount_paid) }})</div>
                        <div class="flex items-center gap-2">
                            <span class="uppercase text-xs font-bold">{{ $enr->status }}</span>
                            @if($enr->status === 'pending')
                                <form method="POST" action="{{ route('portal.enrollments.decide', $enr) }}">
                                    @csrf @method('PATCH')
                                    <input type="hidden" name="status" value="approved">
                                    <button class="rounded-lg bg-emerald-600 text-white px-3 py-1 text-xs font-bold">Approve</button>
                                </form>
                            @endif
                        </div>
                    </div>
                @empty
                    <p class="text-xs text-slate-500">No enrollments recorded yet.</p>
                @endforelse
            </div>
        </div>
    @endif

    @if(in_array($user->role, ['admin', 'teacher']) && isset($questionBank))
        <div class="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <h2 class="text-lg font-extrabold text-slate-900">Exams &amp; Question Bank ({{ $questionBank->count() }} MCQs · {{ $exams->count() }} Exams)</h2>
            <form method="POST" action="{{ route('portal.exams.store') }}" class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                @csrf
                <input type="text" name="title" required placeholder="Exam Title" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-2">
                <input type="text" name="category" required value="General" placeholder="Category" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="prompt" required placeholder="Sample MCQ Question Prompt" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-3">
                <input type="text" name="options[]" required placeholder="Option A" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="options[]" required placeholder="Option B" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="options[]" required placeholder="Option C" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="options[]" required placeholder="Option D" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <select name="correct_index" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="0">Correct: Option A</option>
                    <option value="1">Correct: Option B</option>
                    <option value="2">Correct: Option C</option>
                    <option value="3">Correct: Option D</option>
                </select>
                <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-primary)">+ Create MCQ Exam</button>
            </form>
            <form method="POST" action="{{ route('portal.question_bank.bulk') }}" class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                @csrf
                <input type="text" name="subject" required placeholder="Subject" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="chapter" required placeholder="Chapter" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <select name="difficulty" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="Easy">Easy</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Hard">Hard</option>
                </select>
                <textarea name="raw_text" rows="2" required placeholder="Question | OptA | OptB | OptC | OptD | CorrectIdx(0-3) | Explanation | Marks" class="md:col-span-3 rounded-xl border border-slate-300 bg-white p-3 text-xs font-mono"></textarea>
                <button type="submit" class="rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-bold">Bulk Import MCQs</button>
            </form>
        </div>
    @endif

    @if($user->role === 'admin')
        @include('portal.partials.commerce-and-academics')

        {{-- Homepage Visual CMS Studio --}}
        <div class="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="text-lg font-extrabold text-slate-900">Homepage CMS &amp; Testimonials Studio</h2>
                    <p class="text-xs text-slate-500">Manage Hero Slider banners, Featured Course Highlights, Statistics mode, and Testimonials without coding.</p>
                </div>
                <a href="{{ route('home') }}" target="_blank" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-primary)">Preview Homepage</a>
            </div>

            <div class="border-t border-slate-100 pt-5">
                <h3 class="text-sm font-extrabold text-slate-900 mb-3">Hero Carousel Slides ({{ count($heroSlides ?? []) }})</h3>
                <form method="POST" action="{{ route('portal.homepage.slides.store') }}" enctype="multipart/form-data" class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                    @csrf
                    <input type="text" name="badge" required placeholder="Badge (e.g. Featured)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="text" name="title" required placeholder="Slide Title" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-2">
                    <input type="text" name="subtitle" placeholder="Subtitle" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs md:col-span-2">
                    <input type="text" name="cta_text" required value="Browse Courses" placeholder="CTA Text" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <select name="course_slug" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                        <option value="">Link to All Courses</option>
                        @foreach($courses as $c)
                            <option value="{{ $c->slug }}">{{ $c->title }}</option>
                        @endforeach
                    </select>
                    <input type="file" name="banner_image" accept="image/png,image/jpeg,image/webp,image/gif" class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs">
                    <input type="text" name="image_url" placeholder="Or Image URL (optional)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold md:col-span-3" style="background-color: var(--brand-accent)">+ Add Hero Slide</button>
                </form>
            </div>

            <form method="POST" action="{{ route('portal.homepage.config') }}" class="border-t border-slate-100 pt-5 space-y-4">
                @csrf
                <h3 class="text-sm font-extrabold text-slate-900">Homepage Highlights &amp; Statistics Control</h3>
                @php $hc = $homepageConfig ?? []; @endphp
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="text" name="featured_badge" value="{{ $hc['featured_badge'] ?? 'Featured Programs' }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                    <input type="text" name="featured_title" value="{{ $hc['featured_title'] ?? ('Explore ' . $brand['company_name'] . ' Courses') }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                    <input type="text" name="featured_subtitle" value="{{ $hc['featured_subtitle'] ?? 'Structured courses, live cohorts, and guided practice.' }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                    <input type="text" name="featured_cta" value="{{ $hc['featured_cta'] ?? 'Browse All Courses' }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                    <input type="text" name="paths_heading" value="{{ $hc['paths_heading'] ?? 'Featured Courses' }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                    <input type="text" name="paths_subheading" value="{{ $hc['paths_subheading'] ?? '' }}" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <select name="stats_mode" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                        <option value="auto" {{ ($hc['stats_mode'] ?? 'auto') === 'auto' ? 'selected' : '' }}>Stats Mode: Auto Live DB</option>
                        <option value="custom" {{ ($hc['stats_mode'] ?? 'auto') === 'custom' ? 'selected' : '' }}>Stats Mode: Custom Numbers</option>
                    </select>
                    <input type="text" name="stats_badge" value="{{ $hc['stats_badge'] ?? 'Platform Overview' }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="text" name="stats_title" value="{{ $hc['stats_title'] ?? 'Live Academy Metrics' }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="hidden" name="stats_subtitle" value="{{ $hc['stats_subtitle'] ?? 'Real-time enrollment, course, faculty, and lesson totals.' }}">
                    <input type="number" name="custom_students" value="{{ $hc['custom_students'] ?? 0 }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="number" name="custom_courses" value="{{ $hc['custom_courses'] ?? 0 }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="number" name="custom_teachers" value="{{ $hc['custom_teachers'] ?? 0 }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="number" name="custom_videos" value="{{ $hc['custom_videos'] ?? 0 }}" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold md:col-span-2" style="background-color: var(--brand-primary)">Save Highlights &amp; Statistics</button>
                </div>
            </form>

            <div class="border-t border-slate-100 pt-5">
                <h3 class="text-sm font-extrabold text-slate-900 mb-3">Testimonials ({{ ($reviews ?? collect())->count() }})</h3>
                <form method="POST" action="{{ route('portal.reviews.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                    @csrf
                    <input type="text" name="name" required placeholder="Student / Guardian Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <input type="text" name="role_label" required placeholder="Role / Cohort" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <select name="rating" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                    </select>
                    <select name="row" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                        <option value="1">Row 1</option>
                        <option value="2">Row 2</option>
                    </select>
                    <textarea name="text" rows="2" required placeholder="Student feedback text..." class="md:col-span-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"></textarea>
                    <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Add Testimonial</button>
                </form>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    @foreach($reviews ?? [] as $rev)
                        <div class="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3 text-xs">
                            <div>
                                <p class="font-bold text-slate-900">{{ $rev->name }} <span class="text-slate-500 font-normal">· {{ $rev->role_label }}</span></p>
                                <p class="text-slate-600 mt-1">{{ $rev->text }}</p>
                            </div>
                            <form method="POST" action="{{ route('portal.reviews.delete', $rev) }}">
                                @csrf @method('DELETE')
                                <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 font-bold">Delete</button>
                            </form>
                        </div>
                    @endforeach
                </div>
            </div>
        </div>

        {{-- Branches Studio --}}
        <div id="branches-studio" class="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
            <div>
                <h2 class="text-lg font-extrabold text-slate-900">Branch Campuses ({{ $branches->count() }})</h2>
                <p class="text-xs text-slate-500">Add, edit, activate/deactivate, or soft-delete campuses.</p>
            </div>
            <form method="POST" action="{{ route('portal.branches.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                @csrf
                <input type="text" name="name" required placeholder="Branch Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="code" required placeholder="Code (e.g. MAIN-01)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs uppercase">
                <input type="text" name="city" required placeholder="City" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="phone" placeholder="Phone" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="address" required placeholder="Full Campus Address" class="md:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <input type="text" name="manager_name" placeholder="Branch Manager Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <select name="status" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                <div class="md:col-span-4">
                    <button type="submit" class="rounded-xl text-white px-5 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Add Branch Campus</button>
                </div>
            </form>
            <div class="space-y-2.5">
                @foreach($branches as $br)
                    <div class="rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                            <p class="text-sm font-bold text-slate-900">{{ $br->name }} <span class="font-mono text-indigo-700">({{ $br->code }})</span></p>
                            <p class="text-slate-500">{{ $br->city }} · {{ $br->address }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <form method="POST" action="{{ route('portal.branches.status', $br) }}" class="inline">
                                @csrf @method('PATCH')
                                <button type="submit" class="rounded-lg border border-slate-200 px-2.5 py-1 font-bold">{{ $br->status === 'active' ? 'Deactivate' : 'Activate' }}</button>
                            </form>
                            <form method="POST" action="{{ route('portal.branches.delete', $br) }}" class="inline">
                                @csrf @method('DELETE')
                                <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 font-bold">Delete</button>
                            </form>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>

        {{-- Coupons, Payment Gateways, Connectors & Recycle Bin --}}
        <div class="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
            <h2 class="text-lg font-extrabold text-slate-900">Coupons, Payment Gateways &amp; Recycle Bin</h2>
            <form method="POST" action="{{ route('portal.coupons.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                @csrf
                <input type="text" name="code" required placeholder="CODE (e.g. SAVE20)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs uppercase">
                <input type="number" name="discount_percent" required value="15" min="1" max="90" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                <select name="applies_to" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <option value="all">All</option>
                    <option value="courses">Courses</option>
                    <option value="products">Products</option>
                </select>
                <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">Save Coupon</button>
            </form>

            <div class="space-y-2 border-t border-slate-100 pt-4">
                <h3 class="text-sm font-extrabold text-slate-900">Payment Gateways ({{ count($paymentGateways ?? []) }})</h3>
                @foreach($paymentGateways ?? [] as $gw)
                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                        <span><strong>{{ $gw['name'] }}</strong> ({{ strtoupper($gw['provider_type'] ?? 'online') }} · {{ !empty($gw['active']) ? 'Active' : 'Inactive' }})</span>
                        <form method="POST" action="{{ route('portal.gateways.status', $gw['id']) }}">
                            @csrf @method('PATCH')
                            <button type="submit" class="rounded-lg border border-slate-200 px-2.5 py-1 font-bold">Toggle Status</button>
                        </form>
                    </div>
                @endforeach
            </div>

            <div id="recycle-bin" class="space-y-2 border-t border-slate-100 pt-4">
                <h3 class="text-sm font-extrabold text-slate-900">Recycle Bin ({{ ($recycleBin ?? collect())->count() }})</h3>
                @forelse(($recycleBin ?? collect()) as $binItem)
                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
                        <span><strong class="uppercase text-indigo-700">{{ $binItem->entity_type }}</strong> · {{ $binItem->label }} (by {{ $binItem->deleted_by }})</span>
                        <div class="flex items-center gap-2">
                            <form method="POST" action="{{ route('portal.recycle.restore', $binItem) }}">
                                @csrf
                                <button type="submit" class="rounded-lg bg-emerald-600 text-white px-2.5 py-1 font-bold">Restore</button>
                            </form>
                            <form method="POST" action="{{ route('portal.recycle.purge', $binItem) }}">
                                @csrf @method('DELETE')
                                <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 font-bold">Purge</button>
                            </form>
                        </div>
                    </div>
                @empty
                    <p class="text-xs text-slate-500">Recycle Bin is empty.</p>
                @endforelse
            </div>
        </div>
    @endif

    @if($user->role === 'student')
        <div class="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
            <h2 class="text-lg font-extrabold text-slate-900">My Enrolled Courses ({{ ($enrollments ?? collect())->count() }})</h2>
            @forelse($enrollments ?? [] as $enr)
                <div class="flex items-center justify-between border border-slate-200 rounded-xl p-3 text-sm">
                    <div>
                        <p class="font-bold text-slate-900">{{ $enr->course->title }}</p>
                        <p class="text-xs text-slate-500">Status: {{ strtoupper($enr->status) }} · Paid {{ $currency . number_format($enr->amount_paid) }}</p>
                    </div>
                    <a href="{{ route('learn') }}" class="rounded-lg text-white px-3 py-1.5 text-xs font-bold" style="background-color: var(--brand-primary)">Open Classroom</a>
                </div>
            @empty
                <p class="text-xs text-slate-500">You have not enrolled in any courses yet.</p>
            @endforelse
        </div>

        @if(isset($certificates) && $certificates->count() > 0)
            <div class="rounded-2xl bg-white border border-slate-200 p-6 space-y-3">
                <h2 class="text-lg font-extrabold text-slate-900">My Earned Certificates</h2>
                @foreach($certificates as $cert)
                    <div class="flex items-center justify-between border border-emerald-200 bg-emerald-50 rounded-xl p-3 text-xs">
                        <span><strong>{{ $cert->course_title }}</strong> · Code: <span class="font-mono font-bold">{{ $cert->certificate_code }}</span> ({{ $cert->grade }})</span>
                        <a href="{{ route('certificates.verify', ['code' => $cert->certificate_code]) }}" class="font-bold text-emerald-800 underline">Verify</a>
                    </div>
                @endforeach
            </div>
        @endif

        @if(isset($reward))
            <div class="rounded-2xl bg-amber-50 border border-amber-200 p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p class="text-xs font-bold uppercase text-amber-800">Learning Rewards &amp; Streak</p>
                    <p class="text-lg font-extrabold text-slate-900">{{ $reward->xp }} XP · {{ $reward->streak_days }}d Streak</p>
                </div>
                <form method="POST" action="{{ route('portal.rewards.privacy') }}">
                    @csrf
                    <button type="submit" class="rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-bold">
                        {{ $reward->show_on_leaderboard ? 'Leaderboard: Public (Click to Mask)' : 'Leaderboard: Masked (Click to Show)' }}
                    </button>
                </form>
            </div>
        @endif
    @endif

    @if($user->role === 'guardian')
        <div class="rounded-2xl bg-white border border-slate-200 p-6">
            <h2 class="text-lg font-extrabold mb-4">Linked Student Progress &amp; Exam Results</h2>
            @forelse($children ?? [] as $child)
                <div class="border border-slate-200 rounded-xl p-4 mb-3">
                    <h3 class="font-bold">{{ $child->name }} ({{ $child->roll_number }})</h3>
                    <p class="text-xs text-slate-600 mt-1">Enrolled Courses: {{ $child->enrollments->count() }} | Exams Attempted: {{ $child->examAttempts->count() }}</p>
                </div>
            @empty
                <p class="text-xs text-slate-500">No linked students found yet.</p>
            @endforelse
        </div>
    @endif
</div>
@endsection
