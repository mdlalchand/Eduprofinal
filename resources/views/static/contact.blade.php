@extends('layouts.app')
@section('title', 'Contact ' . $brand['company_name'])
@section('content')
<section class="max-w-5xl mx-auto px-4 py-14">
    <div class="grid gap-8 md:grid-cols-2">
        <div>
            <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Get in touch</p>
            <h1 class="mt-2 text-3xl font-extrabold text-slate-900">Contact Us</h1>
            <p class="mt-3 text-sm leading-6 text-slate-600">Have a question about a course, batch, admission or campus? Send our team an inquiry.</p>
            <div class="mt-7 space-y-3 text-sm text-slate-700">
                @if($brand['support_phone'])<p><strong>Phone:</strong> {{ $brand['support_phone'] }}</p>@endif
                @if($brand['support_email'])<p><strong>Email:</strong> {{ $brand['support_email'] }}</p>@endif
                @if($brand['office_address'])<p><strong>Address:</strong> {{ $brand['office_address'] }}</p>@endif
            </div>
        </div>
        <form method="POST" action="{{ route('contact.submit') }}" class="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            @csrf
            <h2 class="text-lg font-extrabold text-slate-900">Send an Inquiry</h2>
            <input name="name" required maxlength="120" value="{{ old('name') }}" placeholder="Your name" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <input name="phone" required maxlength="40" value="{{ old('phone') }}" placeholder="Phone number" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <input name="email" type="email" maxlength="140" value="{{ old('email') }}" placeholder="Email (optional)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <select name="branch_id" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">General inquiry / no specific campus</option>
                @foreach($branches as $branch)<option value="{{ $branch->id }}" @selected(old('branch_id') == $branch->id)>{{ $branch->name }}</option>@endforeach
            </select>
            <textarea name="message" required minlength="5" maxlength="3000" rows="5" placeholder="Your message or course question..." class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{{ old('message') }}</textarea>
            <button class="w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style="background-color: var(--brand-primary)">Submit Inquiry</button>
        </form>
    </div>
</section>
@endsection
