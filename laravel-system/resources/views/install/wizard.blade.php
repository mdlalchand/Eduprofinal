<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup Wizard — White-Label Laravel 13 LMS</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 min-h-screen flex items-center justify-center p-4 sm:p-8 text-slate-900">
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8">
        <div class="flex items-center gap-4 border-b border-slate-200 pb-5">
            <img src="{{ asset('images/default-logo.svg') }}" alt="Platform Logo" class="h-12 w-12 rounded-xl bg-slate-900 p-1.5 object-contain shrink-0">
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Laravel 13 · v{{ config('version.version', '1.0.0') }}</p>
                <h1 class="text-2xl font-extrabold text-slate-900">Platform Installation &amp; Company Setup</h1>
                <p class="text-xs text-slate-500 mt-0.5">Configure your company brand, database, and Super Admin account. Zero demo data will be created.</p>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 my-5 text-xs">
            @foreach($requirements as $label => $ok)
                <div class="rounded-lg p-2.5 text-center border {{ $ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800' }}">
                    <p class="font-bold">{{ strtoupper(str_replace('_', ' ', $label)) }}</p>
                    <p class="mt-0.5 font-semibold">{{ $ok ? 'READY' : 'MISSING' }}</p>
                </div>
            @endforeach
        </div>

        @if($errors->any())
            <div class="mb-5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700 space-y-1">
                @foreach($errors->all() as $err)
                    <p>{{ $err }}</p>
                @endforeach
            </div>
        @endif

        <form method="POST" action="{{ route('install.run') }}" enctype="multipart/form-data" class="space-y-6">
            @csrf

            <div>
                <h2 class="text-sm font-extrabold text-slate-900 mb-3">1. Your Company / Academy Branding (White-Label)</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label for="company_name" class="block text-xs font-semibold text-slate-700 mb-1">Company / Academy Name *</label>
                        <input id="company_name" type="text" name="company_name" value="{{ old('company_name', '') }}" required placeholder="e.g. Horizon Learning Academy" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="tagline" class="block text-xs font-semibold text-slate-700 mb-1">Tagline</label>
                        <input id="tagline" type="text" name="tagline" value="{{ old('tagline', 'Online & Campus Learning Management Platform') }}" placeholder="Short company tagline" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="app_url" class="block text-xs font-semibold text-slate-700 mb-1">Site URL *</label>
                        <input id="app_url" type="url" name="app_url" value="{{ old('app_url', url('/')) }}" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="support_email" class="block text-xs font-semibold text-slate-700 mb-1">Support Email *</label>
                        <input id="support_email" type="email" name="support_email" value="{{ old('support_email', '') }}" required placeholder="support@yourcompany.com" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="support_phone" class="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                        <input id="support_phone" type="text" name="support_phone" value="{{ old('support_phone', '') }}" placeholder="+1 555 0100" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="office_address" class="block text-xs font-semibold text-slate-700 mb-1">Office / Campus Address</label>
                        <input id="office_address" type="text" name="office_address" value="{{ old('office_address', '') }}" placeholder="Street, City, Country" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="currency_symbol" class="block text-xs font-semibold text-slate-700 mb-1">Currency *</label>
                            <input id="currency_symbol" type="text" name="currency_symbol" value="{{ old('currency_symbol', '$') }}" required maxlength="8" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                        </div>
                        <div>
                            <label for="roll_prefix" class="block text-xs font-semibold text-slate-700 mb-1">Student ID Prefix *</label>
                            <input id="roll_prefix" type="text" name="roll_prefix" value="{{ old('roll_prefix', 'STD') }}" required maxlength="12" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="primary_color" class="block text-xs font-semibold text-slate-700 mb-1">Primary Color</label>
                            <input id="primary_color" type="color" name="primary_color" value="{{ old('primary_color', '#062436') }}" class="w-full h-10 rounded-xl border border-slate-300 px-1 py-1">
                        </div>
                        <div>
                            <label for="accent_color" class="block text-xs font-semibold text-slate-700 mb-1">Accent Color</label>
                            <input id="accent_color" type="color" name="accent_color" value="{{ old('accent_color', '#4f46e5') }}" class="w-full h-10 rounded-xl border border-slate-300 px-1 py-1">
                        </div>
                    </div>
                    <div class="sm:col-span-2">
                        <label for="logo_file" class="block text-xs font-semibold text-slate-700 mb-1">Company Logo (optional PNG, JPG, WEBP, SVG)</label>
                        <input id="logo_file" type="file" name="logo_file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs">
                    </div>
                </div>
            </div>

            <div class="border-t border-slate-200 pt-5">
                <h2 class="text-sm font-extrabold text-slate-900 mb-3">2. Database Connection</h2>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label for="db_connection" class="block text-xs font-semibold text-slate-700 mb-1">Database Engine *</label>
                        <select id="db_connection" name="db_connection" onchange="toggleDbFields(this.value)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                            <option value="sqlite" @selected(old('db_connection', 'sqlite') === 'sqlite')>SQLite (Zero-Config File)</option>
                            <option value="mysql" @selected(old('db_connection') === 'mysql')>MySQL / MariaDB</option>
                            <option value="pgsql" @selected(old('db_connection') === 'pgsql')>PostgreSQL</option>
                        </select>
                    </div>
                    <div>
                        <label for="db_database" class="block text-xs font-semibold text-slate-700 mb-1">Database Name / SQLite File *</label>
                        <input id="db_database" type="text" name="db_database" value="{{ old('db_database', 'database.sqlite') }}" required class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div id="db-host-wrap" class="hidden">
                        <label for="db_host" class="block text-xs font-semibold text-slate-700 mb-1">DB Host</label>
                        <input id="db_host" type="text" name="db_host" value="{{ old('db_host', '127.0.0.1') }}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div id="db-port-wrap" class="hidden">
                        <label for="db_port" class="block text-xs font-semibold text-slate-700 mb-1">DB Port</label>
                        <input id="db_port" type="number" name="db_port" value="{{ old('db_port', '3306') }}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div id="db-user-wrap" class="hidden">
                        <label for="db_username" class="block text-xs font-semibold text-slate-700 mb-1">DB Username</label>
                        <input id="db_username" type="text" name="db_username" value="{{ old('db_username', 'root') }}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div id="db-pass-wrap" class="hidden">
                        <label for="db_password" class="block text-xs font-semibold text-slate-700 mb-1">DB Password</label>
                        <input id="db_password" type="password" name="db_password" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div id="db-ssl-wrap" class="hidden">
                        <label for="db_sslmode" class="block text-xs font-semibold text-slate-700 mb-1">Database SSL Mode</label>
                        <select id="db_sslmode" name="db_sslmode" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
                            <option value="prefer" @selected(old('db_sslmode', 'prefer') === 'prefer')>Prefer TLS</option>
                            <option value="require" @selected(old('db_sslmode') === 'require')>Require TLS</option>
                            <option value="verify-full" @selected(old('db_sslmode') === 'verify-full')>Verify Full (Strict CA)</option>
                            <option value="disable" @selected(old('db_sslmode') === 'disable')>Disable (Local Dev Only)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="border-t border-slate-200 pt-5">
                <h2 class="text-sm font-extrabold text-slate-900 mb-3">3. Super Admin Account</h2>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label for="admin_name" class="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                        <input id="admin_name" type="text" name="admin_name" value="{{ old('admin_name', '') }}" required placeholder="Admin Full Name" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="admin_email" class="block text-xs font-semibold text-slate-700 mb-1">Admin Email *</label>
                        <input id="admin_email" type="email" name="admin_email" value="{{ old('admin_email', '') }}" required placeholder="admin@yourcompany.com" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label for="admin_password" class="block text-xs font-semibold text-slate-700 mb-1">Password (8+ chars) *</label>
                        <input id="admin_password" type="password" name="admin_password" required minlength="8" placeholder="Minimum 8 characters" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    </div>
                </div>
            </div>

            <button type="submit" class="w-full rounded-xl bg-slate-900 text-white font-bold py-3.5 text-sm hover:bg-indigo-600 transition">
                Complete Clean Installation &amp; Launch Platform
            </button>
        </form>
    </div>

    <script>
        function toggleDbFields(driver) {
            const isSqlServer = driver === 'mysql' || driver === 'pgsql';
            ['db-host-wrap', 'db-port-wrap', 'db-user-wrap', 'db-pass-wrap', 'db-ssl-wrap'].forEach((id) => {
                document.getElementById(id).classList.toggle('hidden', !isSqlServer);
            });
            const dbInput = document.getElementById('db_database');
            const portInput = document.getElementById('db_port');
            if (driver === 'sqlite' && !dbInput.value.endsWith('.sqlite')) {
                dbInput.value = 'database.sqlite';
            } else if (isSqlServer && dbInput.value === 'database.sqlite') {
                dbInput.value = 'academy_lms';
                portInput.value = driver === 'pgsql' ? '5432' : '3306';
            }
        }
        toggleDbFields(document.getElementById('db_connection').value);
    </script>
</body>
</html>
