@extends('layouts.app')
@section('title', 'Sign In & Register — ' . $brand['company_name'])
@section('content')
<div class="max-w-4xl mx-auto px-4 py-12 space-y-5">
    @if(request()->boolean('installed') && !session('status'))
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {{ $brand['company_name'] }} installed cleanly with zero demo data! Sign in below with your Super Admin account.
        </div>
    @endif
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="bg-white rounded-2xl border border-slate-200 p-7 shadow-xs">
        <h1 class="text-2xl font-extrabold text-slate-900">Sign In</h1>
        <p class="text-xs text-slate-500 mt-1">Access {{ $brand['company_name'] }} portal, courses, and exams.</p>

        <form method="POST" action="{{ route('login.post') }}" class="mt-5 space-y-4">
            @csrf
            <div>
                <label for="login_email" class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input id="login_email" type="email" name="email" value="{{ old('email') }}" required placeholder="you@example.com" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm">
            </div>
            <div>
                <label for="login_password" class="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input id="login_password" type="password" name="password" required placeholder="Password" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm">
            </div>
            <label class="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="remember" value="1">
                <span>Keep me signed in</span>
            </label>
            <button type="submit" class="w-full rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-primary)">Sign In to Portal</button>
        </form>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 p-7 shadow-xs">
        <h2 class="text-2xl font-extrabold text-slate-900">Create Account</h2>
        <p class="text-xs text-slate-500 mt-1">Register as a Learner or Guardian under {{ $brand['company_name'] }}.</p>

        <form method="POST" action="{{ route('register.post') }}" class="mt-5 space-y-3">
            @csrf
            <div>
                <label for="reg_name" class="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input id="reg_name" type="text" name="name" value="{{ old('name') }}" required placeholder="Your Full Name" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="reg_email" class="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input id="reg_email" type="email" name="email" value="{{ old('email') }}" required placeholder="student@example.com" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                </div>
                <div>
                    <label for="reg_phone" class="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                    <input id="reg_phone" type="text" name="phone" value="{{ old('phone') }}" required placeholder="Phone number" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="reg_role" class="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                    <select id="reg_role" name="role" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                        <option value="student">Student / Learner</option>
                        <option value="guardian">Guardian / Parent</option>
                    </select>
                </div>
                <div>
                    <label for="reg_branch" class="block text-xs font-semibold text-slate-700 mb-1">Campus / Branch</label>
                    <select id="reg_branch" name="branch_id" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                        @if($branches->isEmpty())
                            <option value="">Online / General</option>
                        @else
                            @foreach($branches as $b)
                                <option value="{{ $b->id }}">{{ $b->name }}</option>
                            @endforeach
                        @endif
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label for="reg_roll_link" class="block text-xs font-semibold text-slate-700 mb-1">Student Roll ID (Guardians only)</label>
                    <input id="reg_roll_link" type="text" name="student_roll_link" value="{{ old('student_roll_link') }}" placeholder="{{ $brand['roll_prefix'] ?? 'STD' }}-{{ date('Y') }}-1001" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                </div>
                <div>
                    <label for="reg_student_verify" class="block text-xs font-semibold text-slate-700 mb-1">Student Phone or Link Code</label>
                    <input id="reg_student_verify" type="text" name="student_verification" value="{{ old('student_verification') }}" placeholder="Registered phone or STD-XXXXXX" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                </div>
            </div>
            <div>
                <label for="reg_password" class="block text-xs font-semibold text-slate-700 mb-1">Password (6+ chars)</label>
                <input id="reg_password" type="password" name="password" required minlength="6" placeholder="Create password" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
            </div>
            <button type="submit" class="w-full rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-accent)">Register Account</button>
        </form>
    </div>
</div>
</div>
@endsection
