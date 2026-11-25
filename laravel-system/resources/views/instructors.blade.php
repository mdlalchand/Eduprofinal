@extends('layouts.app')
@section('title', 'Instructors — ' . $brand['company_name'])
@section('content')
<div class="max-w-6xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-extrabold text-center text-slate-900">{{ $brand['company_name'] }} Instructors</h1>
    @if($teachers->count() > 0)
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            @foreach($teachers as $t)
                <div class="bg-white rounded-2xl border border-slate-200 p-6 text-center">
                    <h2 class="text-lg font-extrabold text-slate-900">{{ $t->name }}</h2>
                    <p class="text-xs font-semibold text-indigo-600 mt-1">{{ $t->branch->name ?? 'Faculty' }}</p>
                </div>
            @endforeach
        </div>
    @else
        <div class="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No instructors assigned yet.
        </div>
    @endif
</div>
@endsection
