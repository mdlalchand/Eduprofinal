@extends('layouts.app')
@section('title', 'Results — ' . $brand['company_name'])
@section('content')
<div class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-extrabold text-center text-slate-900">{{ $brand['company_name'] }} Exam Results</h1>
    <p class="text-xs text-center text-slate-500 mt-1">Enter a student roll number (e.g. {{ $brand['roll_prefix'] ?? 'STD' }}-{{ date('Y') }}-1001) to view published results.</p>

    <form method="POST" action="{{ route('results.lookup') }}" class="mt-6 flex gap-3">
        @csrf
        <input type="text" name="roll" value="{{ $roll ?? '' }}" required placeholder="Enter Roll Number" class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase">
        <button type="submit" class="rounded-xl text-white font-bold px-6 py-2.5 text-sm" style="background-color: var(--brand-primary)">Search</button>
    </form>

    @if(!empty($roll) && !$record)
        <div class="mt-6 rounded-2xl bg-amber-50 border border-amber-200 p-6 text-sm text-amber-900">
            No published result record found for roll <strong>{{ $roll }}</strong>.
        </div>
    @endif

    @if($record)
        <div class="mt-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-6">
            <h2 class="text-xl font-extrabold text-slate-900">{{ $record->student_name }}</h2>
            <p class="text-xs text-slate-600 mt-1">{{ $record->roll_number }} · {{ $record->batch_name }} · {{ $record->branch_name }}</p>
            <p class="text-sm font-bold text-emerald-900 mt-3">{{ $record->exam_name }} · Score: {{ $record->total_score }} · {{ $record->grade }} (Merit #{{ $record->merit_position }})</p>
        </div>
    @endif
</div>
@endsection
