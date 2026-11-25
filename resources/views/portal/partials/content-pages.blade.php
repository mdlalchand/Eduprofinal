<section id="content-pages" class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
    <div>
        <h2 class="text-lg font-extrabold text-slate-900">Public Content &amp; CMS Pages</h2>
        <p class="text-xs text-slate-500">Manage the About page, policies, custom published pages and public inquiries.</p>
    </div>

    <form method="POST" action="{{ route('portal.settings') }}" class="space-y-3">
        @csrf
        <h3 class="text-sm font-bold text-slate-800">About &amp; Policy Content</h3>
        <textarea name="about_mission" rows="3" maxlength="6000" placeholder="About the academy / mission" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ $contentSettings['about_mission'] ?? '' }}</textarea>
        <textarea name="terms_content" rows="3" maxlength="12000" placeholder="Terms &amp; Conditions" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ $contentSettings['terms_content'] ?? '' }}</textarea>
        <textarea name="privacy_content" rows="3" maxlength="12000" placeholder="Privacy Policy" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ $contentSettings['privacy_content'] ?? '' }}</textarea>
        <textarea name="refund_content" rows="3" maxlength="12000" placeholder="Refund Policy" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">{{ $contentSettings['refund_content'] ?? '' }}</textarea>
        <button class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Save Public Content</button>
    </form>

    <div class="border-t border-slate-200 pt-5">
        <h3 class="text-sm font-bold text-slate-800 mb-3">Create Custom Page</h3>
        <form method="POST" action="{{ route('portal.content_pages.store') }}" class="space-y-3">
            @csrf
            <div class="grid gap-3 sm:grid-cols-2">
                <input name="title" required maxlength="140" placeholder="Page title" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
                <input name="slug" maxlength="100" placeholder="URL slug (e.g. faq)" class="rounded-xl border border-slate-300 px-3 py-2 text-xs">
            </div>
            <input name="subtitle" maxlength="240" placeholder="Short subtitle (optional)" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs">
            <textarea name="body" required maxlength="12000" rows="5" placeholder="Page content" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"></textarea>
            <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" name="published" value="1" checked> Publish page immediately</label>
            <button class="rounded-xl px-4 py-2 text-xs font-bold text-white" style="background-color: var(--brand-accent)">Save Custom Page</button>
        </form>
        <div class="mt-4 space-y-2">
            @foreach($customPages as $page)
                <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs">
                    <div><p class="font-bold text-slate-900">{{ $page['title'] ?? 'Untitled page' }}</p><p class="text-slate-500">/page/{{ $page['slug'] ?? '' }} · {{ !empty($page['published']) ? 'Published' : 'Draft' }}</p></div>
                    <form method="POST" action="{{ route('portal.content_pages.delete', $page['slug']) }}">@csrf @method('DELETE')<button class="font-bold text-rose-600">Delete</button></form>
                </div>
            @endforeach
        </div>
    </div>

    <div class="border-t border-slate-200 pt-5">
        <h3 class="text-sm font-bold text-slate-800 mb-3">Recent Contact Inquiries ({{ $contactInquiries->count() }})</h3>
        <div class="space-y-3">
            @forelse($contactInquiries as $inquiry)
                <article class="rounded-xl border border-slate-200 p-4">
                    <div class="flex flex-wrap justify-between gap-2">
                        <div><p class="text-sm font-bold text-slate-900">{{ $inquiry->name }} · {{ $inquiry->phone }}</p><p class="text-xs text-slate-500">{{ $inquiry->email ?: 'No email' }} · {{ $inquiry->branch?->name ?: 'General inquiry' }} · {{ $inquiry->created_at?->format('Y-m-d H:i') }}</p></div>
                        <span class="text-xs font-bold capitalize {{ $inquiry->status === 'contacted' ? 'text-emerald-700' : 'text-amber-700' }}">{{ $inquiry->status }}</span>
                    </div>
                    <p class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{{ $inquiry->message }}</p>
                    <div class="mt-3 flex gap-2">
                        <form method="POST" action="{{ route('portal.contact_inquiries.status', $inquiry) }}">@csrf @method('PATCH')<input type="hidden" name="status" value="{{ $inquiry->status === 'pending' ? 'contacted' : 'pending' }}"><button class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">{{ $inquiry->status === 'pending' ? 'Mark Contacted' : 'Mark Pending' }}</button></form>
                        <form method="POST" action="{{ route('portal.contact_inquiries.delete', $inquiry) }}">@csrf @method('DELETE')<button class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button></form>
                    </div>
                </article>
            @empty
                <p class="text-xs text-slate-500">No inquiries have been submitted yet.</p>
            @endforelse
        </div>
    </div>
</section>
