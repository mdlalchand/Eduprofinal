@extends('layouts.app')
@section('title', 'Role Portal Access, Register & Recover — ' . $brand['company_name'])
@section('content')
@php
    $activeMode = $mode ?? 'login';
    $activeRole = $selectedRole ?? 'student';
    $roleMeta = [
        'student' => ['label' => 'Student', 'desc' => 'Courses, live classes, exams & certificates'],
        'guardian' => ['label' => 'Guardian', 'desc' => 'Linked student progress, attendance & results'],
        'teacher' => ['label' => 'Teacher', 'desc' => 'Batches, lessons, attendance & question bank'],
        'branch' => ['label' => 'Branch', 'desc' => 'Campus batches, admissions & fee approvals'],
        'admin' => ['label' => 'Main Admin', 'desc' => 'Full platform, approvals & system updates'],
    ];
@endphp
<div class="max-w-5xl mx-auto px-4 py-10 space-y-6">
    @if(request()->boolean('installed') && !session('status'))
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">
            {{ $brand['company_name'] }} installed cleanly with zero demo data! Sign in below with your Main Admin account.
        </div>
    @endif

    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
                <h1 class="text-2xl font-extrabold text-slate-900">{{ $roleMeta[$activeRole]['label'] }} Portal</h1>
                <p class="text-xs text-slate-500 mt-0.5">{{ $roleMeta[$activeRole]['desc'] }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="{{ route('login', ['role' => $activeRole]) }}" class="px-3.5 py-2 rounded-xl text-xs font-bold {{ $activeMode === 'login' ? 'text-white' : 'bg-slate-100 text-slate-700' }}" style="{{ $activeMode === 'login' ? 'background-color: var(--brand-primary)' : '' }}">Sign In</a>
                @if($activeRole !== 'admin')
                    <a href="{{ route('register', ['role' => $activeRole]) }}" class="px-3.5 py-2 rounded-xl text-xs font-bold {{ $activeMode === 'register' ? 'text-white' : 'bg-slate-100 text-slate-700' }}" style="{{ $activeMode === 'register' ? 'background-color: var(--brand-accent)' : '' }}">Register</a>
                @endif
                <a href="{{ route('recover', ['role' => $activeRole]) }}" class="px-3.5 py-2 rounded-xl text-xs font-bold {{ $activeMode === 'recover' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700' }}">Recover Account</a>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
            @foreach($roleMeta as $rKey => $rInfo)
                @php
                    $targetRoute = ($activeMode === 'register' && $rKey !== 'admin')
                        ? route('register', ['role' => $rKey])
                        : ($activeMode === 'recover' ? route('recover', ['role' => $rKey]) : route('login', ['role' => $rKey]));
                @endphp
                <a href="{{ $targetRoute }}" class="rounded-xl border px-3 py-2.5 text-center transition {{ $activeRole === $rKey ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold' : 'border-slate-200 bg-slate-50 text-slate-700 font-semibold hover:bg-slate-100' }}">
                    <span class="block text-xs">{{ $rInfo['label'] }}</span>
                </a>
            @endforeach
        </div>

        @if($activeMode === 'login')
            <form method="POST" action="{{ route('login.post') }}" class="max-w-md space-y-4 pt-2">
                @csrf
                <input type="hidden" name="expected_role" value="{{ $activeRole }}">
                <div>
                    <label for="login_email" class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input id="login_email" type="email" name="email" value="{{ old('email') }}" required placeholder="you@example.com" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm">
                </div>
                <div>
                    <label for="login_password" class="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <input id="login_password" type="password" name="password" required placeholder="Password" class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm">
                </div>
                <div class="flex items-center justify-between text-xs">
                    <label class="flex items-center gap-2 text-slate-600">
                        <input type="checkbox" name="remember" value="1">
                        <span>Keep me signed in</span>
                    </label>
                    <a href="{{ route('recover', ['role' => $activeRole]) }}" class="font-bold text-indigo-700 hover:underline">Forgot password?</a>
                </div>
                <button type="submit" class="w-full rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-primary)">Sign In as {{ $roleMeta[$activeRole]['label'] }}</button>
            </form>
        @elseif($activeMode === 'register')
            <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-semibold text-amber-900">
                New Student, Guardian, Teacher, and Branch registrations require Main Admin approval before portal sign-in is enabled.
            </div>
            <form method="POST" action="{{ route('register.post') }}" class="space-y-4 pt-1">
                @csrf
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label for="reg_name" class="block text-xs font-semibold text-slate-700 mb-1">Full Name / Contact Lead</label>
                        <input id="reg_name" type="text" name="name" value="{{ old('name') }}" required placeholder="Your Full Name" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                    </div>
                    <div>
                        <label for="reg_role" class="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
                        <select id="reg_role" name="role" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                            <option value="student" @selected(old('role', $activeRole) === 'student')>Student / Learner</option>
                            <option value="guardian" @selected(old('role', $activeRole) === 'guardian')>Guardian / Parent</option>
                            <option value="teacher" @selected(old('role', $activeRole) === 'teacher')>Teacher / Instructor</option>
                            <option value="branch" @selected(old('role', $activeRole) === 'branch')>Branch Campus</option>
                        </select>
                    </div>
                    <div>
                        <label for="reg_email" class="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                        <input id="reg_email" type="email" name="email" value="{{ old('email') }}" required placeholder="account@example.com" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                    </div>
                    <div>
                        <label for="reg_phone" class="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                        <input id="reg_phone" type="text" name="phone" value="{{ old('phone') }}" required placeholder="Phone number" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                    </div>
                </div>

                @if($activeRole !== 'branch')
                    <div>
                        <label for="reg_branch" class="block text-xs font-semibold text-slate-700 mb-1">Campus / Branch</label>
                        <select id="reg_branch" name="branch_id" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                            @if($branches->isEmpty())
                                <option value="">Online / General</option>
                            @else
                                @foreach($branches as $b)
                                    <option value="{{ $b->id }}">{{ $b->name }} ({{ $b->city }})</option>
                                @endforeach
                            @endif
                        </select>
                    </div>
                @endif

                @if($activeRole === 'guardian')
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="reg_roll_link" class="block text-xs font-semibold text-slate-700 mb-1">Student Roll ID</label>
                            <input id="reg_roll_link" type="text" name="student_roll_link" value="{{ old('student_roll_link') }}" placeholder="{{ $brand['roll_prefix'] ?? 'STD' }}-{{ date('Y') }}-1001" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                        <div>
                            <label for="reg_student_verify" class="block text-xs font-semibold text-slate-700 mb-1">Student Phone or Link Code</label>
                            <input id="reg_student_verify" type="text" name="student_verification" value="{{ old('student_verification') }}" placeholder="Registered phone or STD-XXXXXX" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                    </div>
                @elseif($activeRole === 'teacher')
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="reg_specialty" class="block text-xs font-semibold text-slate-700 mb-1">Subject Specialty</label>
                            <input id="reg_specialty" type="text" name="subject_specialty" value="{{ old('subject_specialty') }}" placeholder="e.g. IELTS & Spoken" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                        <div>
                            <label for="reg_education" class="block text-xs font-semibold text-slate-700 mb-1">Education &amp; Credentials</label>
                            <input id="reg_education" type="text" name="education" value="{{ old('education') }}" placeholder="M.A., CELTA / Degrees" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                    </div>
                @elseif($activeRole === 'branch')
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label for="reg_branch_name" class="block text-xs font-semibold text-slate-700 mb-1">Branch Campus Name</label>
                            <input id="reg_branch_name" type="text" name="branch_name" value="{{ old('branch_name') }}" required placeholder="e.g. Banani Campus" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                        <div>
                            <label for="reg_branch_code" class="block text-xs font-semibold text-slate-700 mb-1">Campus Code</label>
                            <input id="reg_branch_code" type="text" name="branch_code" value="{{ old('branch_code') }}" placeholder="e.g. BNN01" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase">
                        </div>
                        <div>
                            <label for="reg_branch_city" class="block text-xs font-semibold text-slate-700 mb-1">City</label>
                            <input id="reg_branch_city" type="text" name="branch_city" value="{{ old('branch_city') }}" placeholder="City" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                        <div>
                            <label for="reg_branch_address" class="block text-xs font-semibold text-slate-700 mb-1">Full Address</label>
                            <input id="reg_branch_address" type="text" name="branch_address" value="{{ old('branch_address') }}" placeholder="Campus street address" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                        </div>
                    </div>
                @endif

                <div>
                    <label for="reg_password" class="block text-xs font-semibold text-slate-700 mb-1">Password (6+ chars)</label>
                    <input id="reg_password" type="password" name="password" required minlength="6" placeholder="Create password" class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm">
                </div>
                <button type="submit" class="w-full rounded-xl text-white font-bold py-3 text-sm" style="background-color: var(--brand-accent)">Submit {{ $roleMeta[$activeRole]['label'] }} Registration for Approval</button>
            </form>
        @else
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <form method="POST" action="{{ route('recover.request') }}" class="rounded-xl border border-slate-200 p-4 space-y-3">
                    @csrf
                    <input type="hidden" name="expected_role" value="{{ $activeRole }}">
                    <h2 class="text-sm font-extrabold text-slate-900">1. Request Recovery Token ({{ $roleMeta[$activeRole]['label'] }})</h2>
                    <p class="text-xs text-slate-500">Generates a 1-hour recovery token. Contact your Main Admin to retrieve your issued recovery token if SMTP mail is not enabled.</p>
                    <input type="email" name="email" required value="{{ old('email') }}" placeholder="Registered email" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <button type="submit" class="w-full rounded-xl text-white font-bold py-2.5 text-xs" style="background-color: var(--brand-primary)">Request Recovery Token</button>
                </form>

                <form method="POST" action="{{ route('recover.confirm') }}" class="rounded-xl border border-slate-200 p-4 space-y-3">
                    @csrf
                    <input type="hidden" name="expected_role" value="{{ $activeRole }}">
                    <h2 class="text-sm font-extrabold text-slate-900">2. Confirm Token &amp; Set New Password</h2>
                    <input type="email" name="email" required value="{{ old('email') }}" placeholder="Registered email" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <input type="text" name="token" required value="{{ old('token') }}" placeholder="Recovery Token" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase font-mono">
                    <input type="password" name="password" required minlength="6" placeholder="New Password (6+ chars)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <button type="submit" class="w-full rounded-xl text-white font-bold py-2.5 text-xs" style="background-color: var(--brand-accent)">Reset Password</button>
                </form>
            </div>
        @endif
    </div>
</div>
@endsection
