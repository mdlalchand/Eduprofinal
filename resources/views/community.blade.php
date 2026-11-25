@extends('layouts.app')
@section('title', 'Community — ' . $brand['company_name'])
@section('content')
<div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
    <div>
        <h1 class="text-3xl font-extrabold text-slate-900">{{ $brand['company_name'] }} Community &amp; Announcements</h1>
        <p class="text-sm text-slate-600 mt-1">Study tips, announcements, and articles from our faculty.</p>
    </div>

    @forelse($posts as $post)
        <article class="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <div class="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span class="font-bold text-indigo-700">{{ $post->category }}</span>
                <span>{{ $post->created_at?->format('M d, Y') }} · {{ $post->author?->name ?? 'Admin' }}</span>
            </div>
            <h2 class="text-xl font-extrabold text-slate-900">{{ $post->title }}</h2>
            <p class="text-sm text-slate-700 whitespace-pre-line">{{ $post->content }}</p>
            <form method="POST" action="{{ route('community.like', $post) }}">
                @csrf
                <button type="submit" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    Helpful ({{ $post->likes }})
                </button>
            </form>
        </article>
    @empty
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            No community articles published yet.
        </div>
    @endforelse
</div>
@endsection
