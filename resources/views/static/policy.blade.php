@extends('layouts.app')
@section('title', $title)
@section('content')
<section class="max-w-3xl mx-auto px-4 py-14">
    <h1 class="text-3xl font-extrabold text-slate-900">{{ $title }}</h1>
    <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700 whitespace-pre-wrap">{{ $content }}</div>
</section>
@endsection
