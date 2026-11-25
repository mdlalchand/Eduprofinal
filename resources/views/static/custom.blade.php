@extends('layouts.app')
@section('title', $page['title'] ?? 'Information')
@section('content')
<section class="max-w-4xl mx-auto px-4 py-14">
    <h1 class="text-3xl font-extrabold text-slate-900">{{ $page['title'] ?? 'Information' }}</h1>
    @if(!empty($page['subtitle']))<p class="mt-2 text-base text-slate-600">{{ $page['subtitle'] }}</p>@endif
    <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{{ $page['body'] ?? '' }}</div>
</section>
@endsection
