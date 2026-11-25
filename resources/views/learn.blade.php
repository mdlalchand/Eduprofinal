@extends('layouts.app')
@section('title', 'Classroom — ' . $brand['company_name'])
@section('content')
<div class="max-w-6xl mx-auto px-4 py-10 space-y-6">
    <div>
        <h1 class="text-3xl font-extrabold text-slate-900">{{ $brand['company_name'] }} Classroom</h1>
        <p class="text-sm text-slate-600 mt-1">Join live interactive classes, watch recorded lessons, track completion, and download lecture materials.</p>
    </div>

    @forelse($enrollments as $enr)
        @php
            $completedIds = $enr->completed_lesson_ids ?? [];
            $totalLessons = max(1, $enr->course->lessons->count());
            $progressPct = $enr->course->lessons->count() > 0 ? (int) round((count($completedIds) / $totalLessons) * 100) : 0;
        @endphp
        <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 class="text-lg font-extrabold text-slate-900">{{ $enr->course->title }}</h2>
                    <p class="text-xs text-slate-500">Completion: {{ count($completedIds) }}/{{ $enr->course->lessons->count() }} lessons ({{ $progressPct }}%)</p>
                </div>
                <span class="text-xs font-bold uppercase text-emerald-700">{{ $enr->course->lessons->count() }} Classes</span>
            </div>

            @if($enr->course->batches->count())
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    @foreach($enr->course->batches as $bat)
                        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
                            <p class="font-extrabold text-slate-900">{{ $bat->name }} ({{ $bat->code }})</p>
                            <p class="text-slate-600 mt-0.5">{{ $bat->schedule }} · {{ $bat->mode }}</p>
                        </div>
                    @endforeach
                </div>
            @endif

            <div class="space-y-2.5">
                @forelse($enr->course->lessons as $l)
                    @php $done = in_array((int) $l->id, $completedIds, true); @endphp
                    <div class="border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <span class="inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase {{ $l->lesson_type === 'live' ? 'bg-rose-50 text-rose-700' : ($l->lesson_type === 'lecture_sheet' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-700') }}">
                                {{ str_replace('_', ' ', $l->lesson_type) }}
                            </span>
                            @if($l->batch)
                                <span class="inline-block rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ml-1">{{ $l->batch->name }}</span>
                            @endif
                            <p class="text-sm font-bold text-slate-900 mt-1">{{ $l->title }}</p>
                            <p class="text-xs text-slate-500">{{ $l->module_name }} · {{ $l->duration }}</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            @if($l->video_url)
                                <a href="{{ $l->video_url }}" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-bold">Watch Lesson</a>
                            @endif
                            @if($l->lesson_type === 'live' && $l->live_join_url && $l->live_status !== 'ended')
                                <a href="{{ $l->live_join_url }}" target="_blank" rel="noopener noreferrer" class="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs font-bold">Join Live</a>
                            @endif
                            @if($l->lecture_sheet_url)
                                <a href="{{ $l->lecture_sheet_url }}" target="_blank" rel="noopener noreferrer" class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">Material / PDF</a>
                            @endif
                            <form method="POST" action="{{ route('learn.progress') }}">
                                @csrf
                                <input type="hidden" name="course_id" value="{{ $enr->course_id }}">
                                <input type="hidden" name="lesson_id" value="{{ $l->id }}">
                                <button type="submit" class="rounded-lg px-3 py-1.5 text-xs font-bold {{ $done ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-600 text-white' }}">
                                    {{ $done ? 'Completed' : 'Mark Complete' }}
                                </button>
                            </form>
                        </div>
                    </div>
                @empty
                    <p class="text-xs text-slate-500">No lessons published in this course yet.</p>
                @endforelse
            </div>
        </div>
    @empty
        <div class="rounded-2xl bg-white border border-slate-200 p-8 text-center text-slate-600">
            <p class="font-bold text-slate-800">No active enrollments yet.</p>
            <p class="text-xs mt-1">Browse the course catalog and enroll to unlock classroom lessons.</p>
            <a href="{{ route('courses.index') }}" class="mt-4 inline-block rounded-xl text-white font-bold px-5 py-2.5 text-xs" style="background-color: var(--brand-primary)">Browse Courses</a>
        </div>
    @endforelse
</div>
@endsection
