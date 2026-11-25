<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\ContactInquiry;
use App\Support\BrandSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaticPageController extends Controller
{
    public function about()
    {
        $brand = BrandSettings::all();
        $mission = (string) (DB::table('settings')->where('key', 'about_mission')->value('value') ?: $brand['tagline']);
        $branches = Branch::where('status', 'active')->orderBy('name')->get();

        return view('static.about', compact('brand', 'mission', 'branches'));
    }

    public function contact()
    {
        $brand = BrandSettings::all();
        $branches = Branch::where('status', 'active')->orderBy('name')->get();

        return view('static.contact', compact('brand', 'branches'));
    }

    public function submitContact(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:120',
            'email' => 'nullable|email|max:140',
            'phone' => 'required|string|max:40',
            'branch_id' => 'nullable|exists:branches,id',
            'message' => 'required|string|min:5|max:3000',
        ]);

        ContactInquiry::create($data);

        return redirect()->route('contact')->with('status', 'Thank you. Your inquiry has been sent to our team.');
    }

    public function policy(string $type)
    {
        $pages = [
            'terms' => ['title' => 'Terms & Conditions', 'key' => 'terms_content'],
            'privacy' => ['title' => 'Privacy Policy', 'key' => 'privacy_content'],
            'refund' => ['title' => 'Refund Policy', 'key' => 'refund_content'],
        ];

        abort_unless(isset($pages[$type]), 404);
        $page = $pages[$type];
        $content = (string) (DB::table('settings')->where('key', $page['key'])->value('value') ?: 'This policy page has not yet been configured by the academy administrator. Please contact the support team for the current policy.');

        return view('static.policy', ['title' => $page['title'], 'content' => $content]);
    }

    public function customPage(string $slug)
    {
        $raw = DB::table('settings')->where('key', 'custom_pages')->value('value');
        $pages = $raw ? json_decode($raw, true) : [];
        abort_unless(is_array($pages), 404);

        $page = collect($pages)->first(
            fn ($item) => is_array($item)
                && !empty($item['published'])
                && strcasecmp((string) ($item['slug'] ?? ''), $slug) === 0
        );

        abort_unless($page, 404);

        return view('static.custom', ['page' => $page]);
    }
}
