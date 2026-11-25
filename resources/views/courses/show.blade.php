@extends('layouts.app')
@section('title', $course->title . ' — ' . $brand['company_name'])
@section('content')
@php $currency = $brand['currency_symbol'] ?? '$'; @endphp
<div class="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
    <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div>
            <p class="text-xs font-bold uppercase text-indigo-600">{{ $course->category }} · {{ $course->level_tag }}</p>
            <h1 class="text-2xl font-extrabold text-slate-900 mt-1">{{ $course->title }}</h1>
            <p class="text-sm text-slate-600 mt-2">{{ $course->description }}</p>
        </div>

        @if($course->batches->count())
            <div>
                <h2 class="text-base font-extrabold text-slate-900">Active Batches &amp; Schedules ({{ $course->batches->count() }})</h2>
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    @foreach($course->batches as $bat)
                        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-indigo-700">{{ $bat->code }}</span>
                                <span class="uppercase font-bold text-emerald-700">{{ $bat->status }}</span>
                            </div>
                            <p class="font-extrabold text-sm text-slate-900 mt-1">{{ $bat->name }}</p>
                            <p class="text-slate-600 mt-1">{{ $bat->schedule }} · {{ $bat->mode }}</p>
                            <p class="text-slate-500 mt-0.5">{{ max(0, $bat->seat_limit - $bat->enrolled_seats) }} seats available</p>
                        </div>
                    @endforeach
                </div>
            </div>
        @endif

        <div>
            <h2 class="text-base font-extrabold text-slate-900">Curriculum ({{ $course->lessons->count() }} Lessons)</h2>
            <div class="mt-3 space-y-2">
                @forelse($course->lessons as $l)
                    <div class="border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between gap-2">
                        <div>
                            <span class="inline-block rounded px-2 py-0.5 text-[10px] font-extrabold uppercase bg-sky-50 text-sky-700 mr-1.5">{{ str_replace('_', ' ', $l->lesson_type) }}</span>
                            <span class="font-semibold">{{ $l->title }}</span>
                            <span class="text-xs text-slate-500 ml-1">({{ $l->duration }})</span>
                        </div>
                        @if($l->is_free_preview)
                            <span class="text-xs font-bold text-emerald-700">Free Preview</span>
                        @endif
                    </div>
                @empty
                    <p class="text-xs text-slate-500">Lessons will appear here once added by an instructor.</p>
                @endforelse
            </div>
        </div>
    </div>

    <div class="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 h-fit">
        <p class="text-3xl font-extrabold text-indigo-600">{{ $course->price === 0 ? 'Free' : $currency . number_format($course->price) }}</p>
        @if($course->original_price > $course->price)
            <p class="text-xs text-slate-400 line-through mt-0.5">{{ $currency . number_format($course->original_price) }}</p>
        @endif
        @auth
            <form method="POST" action="{{ route('courses.enroll', $course) }}" class="mt-4 space-y-3">
                @csrf
                <div>
                    <label for="enroll_branch" class="block text-xs font-semibold text-slate-700 mb-1">Campus / Delivery</label>
                    <select id="enroll_branch" name="branch_id" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                        @if($branches->isEmpty())
                            <option value="">Online Enrollment</option>
                        @else
                            @foreach($branches as $b)
                                <option value="{{ $b->id }}">{{ $b->name }}</option>
                            @endforeach
                        @endif
                    </select>
                </div>
                <div>
                    <label for="enroll_gw" class="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select id="enroll_gw" name="payment_method" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                        @forelse($activeGateways ?? [] as $gw)
                            <option value="{{ $gw['name'] }}">{{ $gw['name'] }} ({{ strtoupper($gw['provider_type'] ?? 'online') }})</option>
                        @empty
                            <option value="" disabled>No Active Payment Gateways Configured</option>
                        @endforelse
                    </select>
                </div>
                <div>
                    <label for="enroll_coupon" class="block text-xs font-semibold text-slate-700 mb-1">Promo Code (optional)</label>
                    <input id="enroll_coupon" type="text" name="coupon_code" placeholder="Enter coupon code" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                </div>
                <button type="submit" class="w-full rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-accent)">Enroll Now</button>
            </form>
        @else
            <a href="{{ route('login') }}" class="mt-5 block w-full text-center rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-primary)">
                Sign In to Enroll
            </a>
        @endauth
    </div>
</div>
@endsection
