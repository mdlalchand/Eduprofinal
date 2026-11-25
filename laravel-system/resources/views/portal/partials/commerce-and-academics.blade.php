@php $currency = $brand['currency_symbol'] ?? '$'; @endphp

{{-- Users & Roles Management --}}
<div id="users-studio" class="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
    <div>
        <h2 class="text-lg font-extrabold text-slate-900">Users &amp; Role Management ({{ $users->count() }})</h2>
        <p class="text-xs text-slate-500">Create admins, branch managers, instructors, students, or guardians and manage roles.</p>
    </div>

    <form method="POST" action="{{ route('portal.users.store') }}" class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        @csrf
        <input type="text" name="name" required placeholder="Full Name" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        <input type="email" name="email" required placeholder="Email Address" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        <input type="text" name="phone" placeholder="Phone Number" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        <select name="role" required class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
            <option value="teacher">Teacher / Instructor</option>
            <option value="branch_manager">Branch Manager</option>
            <option value="student">Student</option>
            <option value="guardian">Guardian</option>
            <option value="admin">Super Admin</option>
        </select>
        <select name="branch_id" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
            <option value="">Online / All Branches</option>
            @foreach($branches as $b)
                <option value="{{ $b->id }}">{{ $b->name }}</option>
            @endforeach
        </select>
        <input type="password" name="password" required minlength="6" placeholder="Password (6+ chars)" class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        <div class="md:col-span-3">
            <button type="submit" class="rounded-xl text-white px-5 py-2 text-xs font-bold" style="background-color: var(--brand-accent)">+ Create User</button>
        </div>
    </form>

    <div class="space-y-2">
        @foreach($users as $u)
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs">
                <div>
                    <strong class="text-slate-900">{{ $u->name }}</strong>
                    <span class="text-slate-500 ml-1">{{ $u->email }}</span>
                    @if($u->roll_number)
                        <span class="ml-1 font-mono text-indigo-700 font-bold">({{ $u->roll_number }})</span>
                    @endif
                </div>
                <div class="flex items-center gap-2">
                    <form method="POST" action="{{ route('portal.users.role', $u) }}" class="flex items-center gap-1.5">
                        @csrf @method('PATCH')
                        <select name="role" class="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                            @foreach(['admin', 'branch_manager', 'teacher', 'student', 'guardian'] as $r)
                                <option value="{{ $r }}" @selected($u->role === $r)>{{ strtoupper($r) }}</option>
                            @endforeach
                        </select>
                        <button type="submit" class="rounded-lg border border-slate-300 px-2.5 py-1 font-bold text-slate-700">Save Role</button>
                    </form>
                    @if($u->id !== $user->id)
                        <form method="POST" action="{{ route('portal.users.delete', $u) }}">
                            @csrf @method('DELETE')
                            <button type="submit" class="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 font-bold">Delete</button>
                        </form>
                    @endif
                </div>
            </div>
        @endforeach
    </div>
</div>

{{-- Store Products, E-Books, Exam Results, Certificates & Community --}}
<div id="operations-studio" class="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
    <h2 class="text-lg font-extrabold text-slate-900">Store, E-Books, Results, Certificates &amp; Community</h2>

    {{-- Products --}}
    <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">Store Products ({{ ($products ?? collect())->count() }})</h3>
        <form method="POST" action="{{ route('portal.products.store') }}" class="grid grid-cols-1 md:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            @csrf
            <input type="text" name="title" required placeholder="Product Title" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-2">
            <input type="text" name="category" required value="Books" placeholder="Category" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="price" required min="0" placeholder="Price ({{ $currency }})" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="original_price" required min="0" placeholder="Original Price" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="stock" required min="0" value="50" placeholder="Stock" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="description" placeholder="Short description" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-3">
            <button type="submit" class="rounded-lg text-white font-bold px-3 py-1.5 text-xs" style="background-color: var(--brand-primary)">+ Add Product</button>
        </form>
        @foreach(($products ?? collect()) as $prod)
            <div class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <span><strong>{{ $prod->title }}</strong> · {{ $currency . number_format($prod->price) }} (Stock: {{ $prod->stock }})</span>
                <form method="POST" action="{{ route('portal.products.delete', $prod) }}">
                    @csrf @method('DELETE')
                    <button type="submit" class="text-rose-700 font-bold">Delete</button>
                </form>
            </div>
        @endforeach
    </div>

    {{-- E-Books --}}
    <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">E-Books Library ({{ ($ebooks ?? collect())->count() }})</h3>
        <form method="POST" action="{{ route('portal.ebooks.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            @csrf
            <input type="text" name="title" required placeholder="E-Book Title" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-2">
            <input type="text" name="level" required placeholder="Level / Tag" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="author" required placeholder="Author" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="pages_count" required min="1" value="32" placeholder="Pages" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="price" min="0" value="0" placeholder="Price (0 = Free)" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="summary" required placeholder="Summary" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-2">
            <label class="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" name="is_free" value="1" checked> Free E-Book</label>
            <button type="submit" class="rounded-lg text-white font-bold px-3 py-1.5 text-xs" style="background-color: var(--brand-primary)">+ Publish E-Book</button>
        </form>
        @foreach(($ebooks ?? collect()) as $eb)
            <div class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <span><strong>{{ $eb->title }}</strong> · {{ $eb->is_free ? 'Free' : $currency . number_format($eb->price) }}</span>
                <form method="POST" action="{{ route('portal.ebooks.delete', $eb) }}">
                    @csrf @method('DELETE')
                    <button type="submit" class="text-rose-700 font-bold">Delete</button>
                </form>
            </div>
        @endforeach
    </div>

    {{-- Publish Center Results --}}
    <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">Publish Student Results ({{ ($centerResults ?? collect())->count() }})</h3>
        <form method="POST" action="{{ route('portal.results.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            @csrf
            <input type="text" name="roll_number" required placeholder="Roll ({{ $brand['roll_prefix'] }}-2026-01)" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase">
            <input type="text" name="student_name" required placeholder="Student Name" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="batch_name" required placeholder="Batch Name" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="branch_name" required placeholder="Branch Name" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="exam_name" required placeholder="Exam Title" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="mcq_score" required min="0" placeholder="MCQ Score" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="number" name="written_score" required min="0" placeholder="Written Score" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <div class="grid grid-cols-2 gap-1.5">
                <input type="text" name="grade" required value="A+" placeholder="Grade" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                <input type="number" name="merit_position" required min="1" value="1" placeholder="Merit" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            </div>
            <button type="submit" class="rounded-lg text-white font-bold px-3 py-1.5 text-xs md:col-span-4" style="background-color: var(--brand-accent)">+ Publish Result</button>
        </form>
    </div>

    {{-- Issue Verified Certificates --}}
    <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">Issued Certificates ({{ ($certificates ?? collect())->count() }})</h3>
        <form method="POST" action="{{ route('portal.certificates.store') }}" class="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            @csrf
            <select name="user_id" required class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                @foreach($users as $u)
                    <option value="{{ $u->id }}">{{ $u->name }} ({{ $u->role }})</option>
                @endforeach
            </select>
            <select name="course_id" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
                <option value="">Custom Title</option>
                @foreach($courses as $c)
                    <option value="{{ $c->id }}">{{ $c->title }}</option>
                @endforeach
            </select>
            <input type="text" name="course_title" placeholder="Or Custom Program Title" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <input type="text" name="grade" required value="Distinction" placeholder="Grade" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <button type="submit" class="rounded-lg text-white font-bold px-3 py-1.5 text-xs md:col-span-4" style="background-color: var(--brand-primary)">+ Issue Verified Certificate</button>
        </form>
        @foreach(($certificates ?? collect()) as $cert)
            <div class="flex flex-wrap items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <span><strong class="font-mono text-indigo-700">{{ $cert->certificate_code }}</strong> · {{ $cert->student_name }} — {{ $cert->course_title }} ({{ $cert->grade }})</span>
                <form method="POST" action="{{ route('portal.certificates.revoke', $cert) }}">
                    @csrf @method('PATCH')
                    <button type="submit" class="font-bold {{ $cert->revoked ? 'text-emerald-700' : 'text-rose-700' }}">{{ $cert->revoked ? 'Reinstate' : 'Revoke' }}</button>
                </form>
            </div>
        @endforeach
    </div>

    {{-- Community Posts --}}
    <div class="border-t border-slate-100 pt-4 space-y-3">
        <h3 class="text-sm font-extrabold text-slate-900">Community Articles ({{ ($posts ?? collect())->count() }})</h3>
        <form method="POST" action="{{ route('portal.community.store') }}" class="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            @csrf
            <input type="text" name="title" required placeholder="Article / Announcement Title" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-2">
            <input type="text" name="category" required value="Announcement" placeholder="Category" class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs">
            <textarea name="content" rows="2" required placeholder="Write post content..." class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs md:col-span-3"></textarea>
            <button type="submit" class="rounded-lg text-white font-bold px-3 py-1.5 text-xs md:col-span-3" style="background-color: var(--brand-accent)">+ Publish Post</button>
        </form>
    </div>
</div>
