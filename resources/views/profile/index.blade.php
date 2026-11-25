@extends('layouts.app')

@section('title', 'My Profile')

@section('content')
<section class="max-w-4xl mx-auto px-4 py-10">
    <div class="mb-7">
        <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Account Settings</p>
        <h1 class="mt-1 text-3xl font-extrabold text-slate-900">My Profile</h1>
        <p class="mt-2 text-sm text-slate-600">Update your contact and learning details. Account role, approval status and branch assignment are managed by the Main Admin.</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
        <form method="POST" action="{{ route('profile.update') }}" class="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            @csrf
            @method('PUT')
            <h2 class="text-lg font-extrabold text-slate-900">Personal Information</h2>
            <div>
                <label for="name" class="block text-xs font-semibold text-slate-700 mb-1">Full name</label>
                <input id="name" name="name" required maxlength="120" value="{{ old('name', $user->name) }}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            </div>
            <div>
                <label for="email" class="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
                <input id="email" type="email" name="email" required value="{{ old('email', $user->email) }}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            </div>
            <div>
                <label for="phone" class="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input id="phone" name="phone" value="{{ old('phone', $user->phone) }}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            </div>
            <div>
                <label for="education" class="block text-xs font-semibold text-slate-700 mb-1">Education</label>
                <input id="education" name="education" value="{{ old('education', $user->education) }}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            </div>
            <div>
                <label for="subject_specialty" class="block text-xs font-semibold text-slate-700 mb-1">Subject / Specialty</label>
                <input id="subject_specialty" name="subject_specialty" value="{{ old('subject_specialty', $user->subject_specialty) }}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            </div>
            <div>
                <label for="bio" class="block text-xs font-semibold text-slate-700 mb-1">About me</label>
                <textarea id="bio" name="bio" rows="4" maxlength="1000" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{{ old('bio', $user->bio) }}</textarea>
            </div>
            <button class="rounded-xl px-5 py-2.5 text-sm font-bold text-white" style="background-color: var(--brand-primary)">Save Profile</button>
        </form>

        <div class="lg:col-span-2 space-y-6">
            <div class="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 class="text-lg font-extrabold text-slate-900">Account Access</h2>
                <dl class="mt-4 space-y-3 text-sm">
                    <div><dt class="text-xs text-slate-500">Portal role</dt><dd class="font-semibold capitalize">{{ $user->role }}</dd></div>
                    <div><dt class="text-xs text-slate-500">Approval status</dt><dd class="font-semibold capitalize">{{ $user->status ?? 'active' }}</dd></div>
                    <div><dt class="text-xs text-slate-500">Student / account ID</dt><dd class="font-semibold">{{ $user->roll_number ?: '—' }}</dd></div>
                </dl>
            </div>
            <form method="POST" action="{{ route('profile.password.update') }}" class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
                @csrf
                @method('PUT')
                <h2 class="text-lg font-extrabold text-slate-900">Change Password</h2>
                <div>
                    <label for="current_password" class="block text-xs font-semibold text-slate-700 mb-1">Current password</label>
                    <input id="current_password" type="password" name="current_password" required autocomplete="current-password" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                </div>
                <div>
                    <label for="password" class="block text-xs font-semibold text-slate-700 mb-1">New password</label>
                    <input id="password" type="password" name="password" required minlength="8" autocomplete="new-password" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                </div>
                <div>
                    <label for="password_confirmation" class="block text-xs font-semibold text-slate-700 mb-1">Confirm new password</label>
                    <input id="password_confirmation" type="password" name="password_confirmation" required minlength="8" autocomplete="new-password" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
                </div>
                <button class="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-800">Change Password</button>
            </form>
        </div>
    </div>
</section>
@endsection
