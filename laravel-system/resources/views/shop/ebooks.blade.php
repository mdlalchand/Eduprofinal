@extends('layouts.app')
@section('title', 'E-Books — ' . $brand['company_name'])
@section('content')
@php $currency = $brand['currency_symbol'] ?? '$'; @endphp
<div class="max-w-6xl mx-auto px-4 py-10 space-y-6">
    <h1 class="text-3xl font-extrabold text-slate-900">{{ $brand['company_name'] }} E-Books Library</h1>

    @if($ebooks->count() > 0)
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            @foreach($ebooks as $e)
                <div class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
                    <div>
                        <span class="text-[11px] font-bold uppercase text-indigo-600">{{ $e->level }} · {{ $e->pages_count }} pages</span>
                        <h2 class="font-extrabold text-slate-900 mt-1">{{ $e->title }}</h2>
                        <p class="text-xs text-slate-500">By {{ $e->author }}</p>
                        <p class="text-sm text-slate-600 mt-2">{{ $e->summary }}</p>
                    </div>
                    <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span class="text-sm font-extrabold text-emerald-700">{{ $e->is_free ? 'Free' : $currency . number_format($e->price) }}</span>
                        @auth
                            <form method="POST" action="{{ route('ebooks.claim', $e) }}">
                                @csrf
                                <button type="submit" class="rounded-lg text-white font-bold px-3.5 py-1.5 text-xs" style="background-color: var(--brand-accent)">Unlock E-Book</button>
                            </form>
                        @endauth
                    </div>
                </div>
            @endforeach
        </div>
    @else
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No e-books published yet.
        </div>
    @endif
</div>
@endsection
