@extends('layouts.app')
@section('title', 'Online Exams — ' . $brand['company_name'])
@section('content')
<div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
    <h1 class="text-3xl font-extrabold text-slate-900">Online MCQ Exams</h1>

    @forelse($exams as $ex)
        <form method="POST" action="{{ route('exams.submit', $ex) }}" class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            @csrf
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-lg font-extrabold text-slate-900">{{ $ex->title }}</h2>
                <span class="text-xs font-bold text-indigo-700">{{ $ex->category }} · {{ $ex->duration_minutes }} min</span>
            </div>
            @foreach($ex->questions as $q)
                <div class="border border-slate-200 rounded-xl p-4">
                    <p class="font-bold text-sm text-slate-900">{{ $q->prompt }}</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        @foreach($q->options as $idx => $opt)
                            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input type="radio" name="answers[{{ $q->id }}]" value="{{ $idx }}">
                                <span>{{ $opt }}</span>
                            </label>
                        @endforeach
                    </div>
                </div>
            @endforeach
            <button type="submit" class="rounded-xl text-white font-bold px-5 py-2.5 text-sm" style="background-color: var(--brand-primary)">Submit Exam</button>
        </form>
    @empty
        <div class="rounded-2xl bg-white border border-slate-200 p-8 text-center text-slate-600 text-sm">
            No exams published yet.
        </div>
    @endforelse

    @if($attempts->count() > 0)
        <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 class="text-lg font-extrabold text-slate-900">Your Recent Exam Attempts</h2>
            @foreach($attempts as $att)
                <div class="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3 text-sm">
                    <span class="font-bold text-slate-900">{{ $att->exam?->title ?? 'Exam' }}</span>
                    <span class="font-extrabold {{ $att->passed ? 'text-emerald-700' : 'text-rose-700' }}">
                        {{ $att->score }}/{{ $att->total_marks }} ({{ $att->percentage }}% · {{ $att->grade }})
                    </span>
                </div>
            @endforeach
        </div>
    @endif
</div>
@endsection
