@extends('layouts.app')
@section('title', 'About ' . $brand['company_name'])
@section('content')
<section class="max-w-5xl mx-auto px-4 py-14">
    <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Our Academy</p>
    <h1 class="mt-2 text-3xl font-extrabold text-slate-900">About {{ $brand['company_name'] }}</h1>
    <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{{ $mission }}</div>
    <h2 class="mt-10 text-xl font-extrabold text-slate-900">Our Campuses</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @forelse($branches as $branch)
            <article class="rounded-2xl border border-slate-200 bg-white p-5">
                <p class="font-mono text-xs font-bold text-indigo-600">{{ $branch->code }}</p>
                <h3 class="mt-1 font-extrabold text-slate-900">{{ $branch->name }}</h3>
                <p class="mt-2 text-xs text-slate-600">{{ $branch->address }}</p>
                <p class="mt-2 text-xs font-semibold text-slate-800">{{ $branch->phone }}</p>
            </article>
        @empty
            <p class="text-sm text-slate-500">Campus information will be published here.</p>
        @endforelse
    </div>
</section>
@endsection
