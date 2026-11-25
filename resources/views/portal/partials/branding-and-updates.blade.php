{{-- White-Label Branding Studio & Non-Destructive System Update Manager --}}
<div id="white-label-branding" class="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h2 class="text-lg font-extrabold text-slate-900">White-Label Company Branding &amp; Logo</h2>
            <p class="text-xs text-slate-500">Run this entire platform under your own company name, logo, colors, currency, and student ID prefix — no developer required.</p>
        </div>
        <span class="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">Live Brand Profile</span>
    </div>

    <form method="POST" action="{{ route('portal.branding.update') }}" enctype="multipart/form-data" class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        @csrf
        <div>
            <label for="brand_company_name" class="block text-xs font-semibold text-slate-700 mb-1">Company / Academy Name *</label>
            <input id="brand_company_name" type="text" name="company_name" required value="{{ $brand['company_name'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div>
            <label for="brand_tagline" class="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
            <input id="brand_tagline" type="text" name="tagline" value="{{ $brand['tagline'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div>
            <label for="brand_support_email" class="block text-xs font-semibold text-slate-700 mb-1">Support Email *</label>
            <input id="brand_support_email" type="email" name="support_email" required value="{{ $brand['support_email'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div>
            <label for="brand_support_phone" class="block text-xs font-semibold text-slate-700 mb-1">Support Phone</label>
            <input id="brand_support_phone" type="text" name="support_phone" value="{{ $brand['support_phone'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div>
            <label for="brand_office_address" class="block text-xs font-semibold text-slate-700 mb-1">Office Address</label>
            <input id="brand_office_address" type="text" name="office_address" value="{{ $brand['office_address'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label for="brand_currency_symbol" class="block text-xs font-semibold text-slate-700 mb-1">Currency *</label>
                <input id="brand_currency_symbol" type="text" name="currency_symbol" required value="{{ $brand['currency_symbol'] }}" maxlength="8" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
            </div>
            <div>
                <label for="brand_roll_prefix" class="block text-xs font-semibold text-slate-700 mb-1">Roll Prefix *</label>
                <input id="brand_roll_prefix" type="text" name="roll_prefix" required value="{{ $brand['roll_prefix'] }}" maxlength="12" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs uppercase">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
            <div>
                <label for="brand_primary_color" class="block text-xs font-semibold text-slate-700 mb-1">Primary Color</label>
                <input id="brand_primary_color" type="color" name="primary_color" value="{{ $brand['primary_color'] }}" class="w-full h-9 rounded-xl border border-slate-300 bg-white p-1">
            </div>
            <div>
                <label for="brand_accent_color" class="block text-xs font-semibold text-slate-700 mb-1">Accent Color</label>
                <input id="brand_accent_color" type="color" name="accent_color" value="{{ $brand['accent_color'] }}" class="w-full h-9 rounded-xl border border-slate-300 bg-white p-1">
            </div>
        </div>
        <div>
            <label for="brand_logo_file" class="block text-xs font-semibold text-slate-700 mb-1">Upload New Logo (optional)</label>
            <input id="brand_logo_file" type="file" name="logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs">
        </div>
        <div>
            <label for="brand_favicon_file" class="block text-xs font-semibold text-slate-700 mb-1">Upload Favicon (optional)</label>
            <input id="brand_favicon_file" type="file" name="favicon_file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs">
        </div>
        <div class="md:col-span-2">
            <label for="brand_footer_text" class="block text-xs font-semibold text-slate-700 mb-1">Footer Copyright Text</label>
            <input id="brand_footer_text" type="text" name="footer_text" value="{{ $brand['footer_text'] }}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
        </div>
        <div class="flex items-end">
            <button type="submit" class="w-full rounded-xl text-white px-5 py-2.5 text-xs font-bold" style="background-color: var(--brand-primary)">
                Save Company Branding
            </button>
        </div>
    </form>
</div>

<div id="system-updates" class="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h2 class="text-lg font-extrabold text-slate-900">Non-Destructive System Update &amp; Backup Manager</h2>
            <p class="text-xs text-slate-500">
                Upgrade application files &amp; run incremental migrations safely without losing database records, <code>.env</code>, or uploaded media.
            </p>
        </div>
        <div class="flex items-center gap-2 text-xs">
            <span class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-extrabold text-emerald-800">
                Current Version: v{{ $systemVersion ?? config('version.version', '1.0.0') }}
            </span>
            <span class="rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 font-bold text-slate-700">
                Pending Migrations: {{ count($pendingMigrations ?? []) }}
            </span>
        </div>
    </div>

    <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong>Protected Hosting Paths (Never Overwritten During Updates):</strong>
        <code>.env</code>, <code>storage/installed.lock</code>, <code>storage/</code>, <code>public/uploads/</code>, <code>database/*.sqlite</code>, <code>vendor/</code>. Automatic pre-update backup and file/DB rollback protect live records.
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {{-- Upload Update ZIP Package --}}
        <form method="POST" action="{{ route('portal.updates.apply') }}" enctype="multipart/form-data" class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            @csrf
            <h3 class="text-sm font-extrabold text-slate-900">1. Apply Non-Destructive Update Package (.zip)</h3>
            <p class="text-xs text-slate-500">Automatically creates a SHA-256 backup snapshot, skips protected paths, copies updated files, runs incremental <code>migrate --force</code>, and rolls back automatically on error.</p>
            <div>
                <label for="update_package" class="block text-xs font-semibold text-slate-700 mb-1">Update ZIP Package *</label>
                <input id="update_package" type="file" name="update_package" accept=".zip,application/zip" required class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
            </div>
            <button type="submit" class="rounded-xl text-white px-5 py-2.5 text-xs font-bold" style="background-color: var(--brand-accent)">
                Backup &amp; Apply Non-Destructive Update
            </button>
        </form>

        {{-- Full Database & Env Backup + Incremental Migration --}}
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
                <h3 class="text-sm font-extrabold text-slate-900">2. Full Snapshot Backup &amp; Safe Incremental Migrations</h3>
                <p class="text-xs text-slate-500 mt-0.5">Export complete SHA-256 verified JSON backup of all live tables or run pending schema migrations safely.</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <form method="POST" action="{{ route('portal.updates.backup') }}" class="flex-1 flex gap-2">
                    @csrf
                    <input type="text" name="label" placeholder="Backup Label (optional)" class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs">
                    <button type="submit" class="rounded-xl text-white px-4 py-2 text-xs font-bold shrink-0" style="background-color: var(--brand-primary)">
                        Create Full Backup
                    </button>
                </form>
                <form method="POST" action="{{ route('portal.updates.migrate') }}">
                    @csrf
                    <button type="submit" class="rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-800 px-4 py-2 text-xs font-bold">
                        Run Pending Migrations ({{ count($pendingMigrations ?? []) }})
                    </button>
                </form>
            </div>

            @if(($backups ?? collect())->count() > 0)
                <div class="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-slate-200">
                    @foreach($backups as $snap)
                        <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
                            <div>
                                <p class="font-bold text-slate-900">#{{ $snap->id }} · {{ $snap->label }}</p>
                                <p class="text-[11px] text-slate-500 font-mono">SHA-256: {{ substr($snap->checksum_sha256, 0, 14) }}... · {{ $snap->created_at?->format('Y-m-d H:i') }}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <a href="{{ route('portal.updates.backup.download', $snap) }}" class="rounded-lg border border-slate-300 px-2.5 py-1 font-bold text-slate-700">Download</a>
                                <form method="POST" action="{{ route('portal.updates.backup.restore', $snap) }}">
                                    @csrf
                                    <button type="submit" class="rounded-lg bg-emerald-600 text-white px-2.5 py-1 font-bold">Restore</button>
                                </form>
                            </div>
                        </div>
                    @endforeach
                </div>
            @endif
        </div>
    </div>

    {{-- Update History Audit Log --}}
    <div class="border-t border-slate-100 pt-4">
        <h3 class="text-sm font-extrabold text-slate-900 mb-2">System Update Audit History ({{ ($systemUpdates ?? collect())->count() }})</h3>
        @forelse(($systemUpdates ?? collect()) as $upd)
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs mb-2">
                <div>
                    <span class="font-bold text-slate-900">v{{ $upd->from_version }} → v{{ $upd->to_version }}</span>
                    <span class="text-slate-500 ml-2">{{ $upd->package_name }} · {{ $upd->files_updated_count }} files · {{ count($upd->migrations_applied ?? []) }} migrations</span>
                    <p class="text-[11px] text-slate-500 mt-0.5">{{ $upd->notes }}</p>
                </div>
                <span class="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase {{ $upd->status === 'applied' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700' }}">
                    {{ $upd->status }}
                </span>
            </div>
        @empty
            <p class="text-xs text-slate-500">No update packages applied yet.</p>
        @endforelse
    </div>
</div>
