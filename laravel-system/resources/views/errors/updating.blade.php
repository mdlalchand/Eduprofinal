<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Updating — {{ $brand['company_name'] ?? 'Academy LMS' }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
    <div class="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl">
        <div class="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-sky-400 border-t-transparent animate-spin"></div>
        <h1 class="text-xl font-extrabold">{{ $brand['company_name'] ?? 'Academy LMS' }} is Updating</h1>
        <p class="mt-2 text-sm text-slate-300">
            Applying a non-destructive system upgrade. Your database records, accounts, and uploaded files remain protected. Please refresh in a few seconds.
        </p>
    </div>
</body>
</html>
