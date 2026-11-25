@extends('layouts.app')
@section('title', 'Verify Certificate — ' . $brand['company_name'])
@section('content')
<div class="max-w-3xl mx-auto px-4 py-12 space-y-6">
    <div class="text-center">
        <h1 class="text-3xl font-extrabold text-slate-900">Certificate Verification</h1>
        <p class="text-xs text-slate-500 mt-1">Verify authenticity of certificates issued by {{ $brand['company_name'] }}.</p>
    </div>

    <form method="POST" action="{{ route('certificates.lookup') }}" class="flex gap-3">
        @csrf
        <input type="text" name="code" value="{{ $code ?? '' }}" required placeholder="Enter Certificate Code (e.g. {{ $brand['roll_prefix'] ?? 'STD' }}-CERT-...)" class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm uppercase">
        <button type="submit" class="rounded-xl text-white font-bold px-6 py-2.5 text-sm" style="background-color: var(--brand-primary)">Verify</button>
    </form>

    @if(!empty($code) && !$certificate)
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            No certificate record matched code <strong>{{ $code }}</strong>.
        </div>
    @endif

    @if($certificate)
        <div class="rounded-2xl border p-6 {{ $certificate->revoked ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50' }}">
            <p class="text-xs font-extrabold uppercase {{ $certificate->revoked ? 'text-rose-700' : 'text-emerald-700' }}">
                {{ $certificate->revoked ? 'REVOKED CERTIFICATE' : 'VERIFIED AUTHENTIC CERTIFICATE' }}
            </p>
            <h2 class="text-2xl font-extrabold text-slate-900 mt-1">{{ $certificate->student_name }}</h2>
            <p class="text-sm text-slate-700 mt-1">Course: <strong>{{ $certificate->course_title }}</strong></p>
            <p class="text-xs text-slate-600 mt-2">
                Code: <span class="font-mono font-bold">{{ $certificate->certificate_code }}</span> · Grade: <strong>{{ $certificate->grade }}</strong> · Issued by {{ $certificate->issued_by }} on {{ $certificate->issued_at?->format('M d, Y') }}
            </p>
        </div>
    @endif
</div>
@endsection
