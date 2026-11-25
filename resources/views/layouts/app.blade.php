<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', $brand['company_name'] ?? 'Academy LMS')</title>
    <meta name="description" content="{{ $brand['tagline'] ?? '' }}">
    <link rel="icon" href="{{ $brand['favicon_url'] ?? asset('images/default-logo.svg') }}">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {
            --brand-primary: {{ $brand['primary_color'] ?? '#062436' }};
            --brand-accent: {{ $brand['accent_color'] ?? '#4f46e5' }};
        }
    </style>
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
    <header class="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div class="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
            <a href="{{ route('home') }}" class="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <span class="h-9 w-9 sm:h-10 sm:w-10 rounded-xl p-1 flex items-center justify-center shrink-0" style="background-color: var(--brand-primary)">
                    <img src="{{ $brand['logo_url'] ?? asset('images/default-logo.svg') }}" alt="{{ $brand['company_name'] }}" class="h-full w-full object-contain rounded-lg">
                </span>
                <span class="font-extrabold text-base sm:text-lg tracking-tight truncate" style="color: var(--brand-primary)">{{ $brand['company_name'] }}</span>
            </a>

            @php
                $rawMenu = \Illuminate\Support\Facades\DB::table('settings')->where('key', 'header_menu')->value('value');
                $headerMenu = $rawMenu ? (json_decode($rawMenu, true) ?: []) : [];
                if (empty($headerMenu)) {
                    $headerMenu = [
                        ['label' => 'Home', 'path' => route('home'), 'visible' => true],
                        ['label' => 'Courses', 'path' => route('courses.index'), 'visible' => true],
                        ['label' => 'Learn', 'path' => route('learn'), 'visible' => true],
                        ['label' => 'Instructors', 'path' => route('instructors'), 'visible' => true],
                        ['label' => 'Exams', 'path' => route('exams.index'), 'visible' => true],
                        ['label' => 'Store', 'path' => route('products'), 'visible' => true],
                        ['label' => 'E-Books', 'path' => route('ebooks'), 'visible' => true],
                        ['label' => 'Results', 'path' => route('results'), 'visible' => true],
                        ['label' => 'Certificates', 'path' => route('certificates.verify'), 'visible' => true],
                        ['label' => 'Community', 'path' => route('community'), 'visible' => true],
                    ];
                }
            @endphp

            <nav aria-label="Primary Navigation" class="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600 shrink-0">
                @foreach($headerMenu as $m)
                    @if(($m['visible'] ?? true) !== false)
                        <a href="{{ $m['path'] ?? '/' }}" class="inline-flex items-center gap-1 hover:text-indigo-600 transition">
                            <span>{{ $m['label'] ?? 'Link' }}</span>
                            @if(!empty($m['badge']))
                                <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">{{ $m['badge'] }}</span>
                            @endif
                        </a>
                    @endif
                @endforeach
            </nav>

            <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                @auth
                    <a href="{{ route('portal.index') }}" class="px-2.5 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-semibold whitespace-nowrap" style="background-color: var(--brand-primary)">Portal</a>
                    <a href="{{ route('profile') }}" class="px-2.5 sm:px-3 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-semibold whitespace-nowrap">Profile</a>
                @else
                    <a href="{{ route('login') }}" class="px-3 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-semibold whitespace-nowrap" style="background-color: var(--brand-accent)">Sign In</a>
                @endauth
                <button type="button" onclick="document.getElementById('mobile-nav').classList.toggle('hidden')" aria-label="Toggle Menu" class="lg:hidden rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">
                    Menu
                </button>
            </div>
        </div>

        <nav id="mobile-nav" aria-label="Mobile Navigation" class="hidden lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
            @foreach($headerMenu as $m)
                @if(($m['visible'] ?? true) !== false)
                    <a href="{{ $m['path'] ?? '/' }}" class="block py-1.5 text-sm font-medium text-slate-700 hover:text-indigo-600">
                        {{ $m['label'] ?? 'Link' }}
                    </a>
                @endif
            @endforeach
        </nav>
    </header>

    <main class="flex-1">
        @if(session('status'))
            <div class="max-w-7xl mx-auto px-4 mt-4">
                <div role="status" class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-800">{{ session('status') }}</div>
            </div>
        @endif
        @if($errors->any())
            <div class="max-w-7xl mx-auto px-4 mt-4">
                <div role="alert" class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-800 space-y-1">
                    @foreach($errors->all() as $err)
                        <p>{{ $err }}</p>
                    @endforeach
                </div>
            </div>
        @endif
        @yield('content')
    </main>

    <footer class="text-slate-300 py-12 mt-16" style="background-color: var(--brand-primary)">
        <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between gap-6 text-sm">
            <div>
                <p class="font-extrabold text-white text-base">{{ $brand['company_name'] }}</p>
                <p class="text-slate-300/80 mt-1">{{ $brand['tagline'] }}</p>
                @if(!empty($brand['office_address']) || !empty($brand['support_email']) || !empty($brand['support_phone']))
                    <p class="text-slate-300/70 text-xs mt-2">
                        {{ $brand['office_address'] }}
                        @if(!empty($brand['support_email'])) · {{ $brand['support_email'] }} @endif
                        @if(!empty($brand['support_phone'])) · {{ $brand['support_phone'] }} @endif
                    </p>
                @endif
            </div>
            <div class="text-slate-300/80 sm:text-right">
                <p>{{ $brand['footer_text'] ?: ('© ' . date('Y') . ' ' . $brand['company_name'] . '. All Rights Reserved.') }}</p>
                <p class="text-xs text-slate-400 mt-1">Platform v{{ $brand['system_version'] ?? config('version.version', '1.0.0') }}</p>
            </div>
        </div>
    </footer>
</body>
</html>
