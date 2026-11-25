<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Category;
use App\Models\CenterResult;
use App\Models\Certificate;
use App\Models\CommunityPost;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicController extends Controller
{
    public function home()
    {
        $courses = Course::where('status', 'active')->latest()->take(6)->get();
        $reviews = Review::where('status', 'approved')->latest()->get();

        $slidesRaw = DB::table('settings')->where('key', 'homepage_slides')->value('value');
        $configRaw = DB::table('settings')->where('key', 'homepage_config')->value('value');
        $heroSlides = $slidesRaw ? (json_decode($slidesRaw, true) ?? []) : [];
        $homepageConfig = $configRaw ? (json_decode($configRaw, true) ?? []) : [];

        $liveStats = [
            'students' => User::where('role', 'student')->count() + Enrollment::where('status', 'approved')->count(),
            'courses' => Course::where('status', 'active')->count(),
            'teachers' => User::where('role', 'teacher')->count(),
            'videos' => Lesson::count(),
        ];

        $stats = ($homepageConfig['stats_mode'] ?? 'auto') === 'custom'
            ? [
                'students' => (int) ($homepageConfig['custom_students'] ?? $liveStats['students']),
                'courses' => (int) ($homepageConfig['custom_courses'] ?? $liveStats['courses']),
                'teachers' => (int) ($homepageConfig['custom_teachers'] ?? $liveStats['teachers']),
                'videos' => (int) ($homepageConfig['custom_videos'] ?? $liveStats['videos']),
            ]
            : $liveStats;

        return view('home', compact('courses', 'stats', 'reviews', 'heroSlides', 'homepageConfig'));
    }

    public function courses(Request $request)
    {
        $category = $request->query('cat', 'All Courses');
        $search = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'featured');
        $showDrafts = $request->user()?->role === 'admin' && $request->boolean('drafts', true);

        $query = Course::query();
        if (!$showDrafts) {
            $query->where('status', 'active');
        }
        if ($category === 'Combos') {
            $query->where('is_combo', true);
        } elseif ($category !== 'All Courses') {
            $query->where(function ($sub) use ($category) {
                $sub->where('category', $category)
                    ->orWhere('level_tag', $category);
            });
        }
        if ($search !== '') {
            $query->where(function ($sub) use ($search) {
                $sub->where('title', 'like', "%{$search}%")
                    ->orWhere('subtitle', 'like', "%{$search}%")
                    ->orWhere('level_tag', 'like', "%{$search}%");
            });
        }

        if ($sort === 'price_asc') {
            $query->orderBy('price', 'asc');
        } elseif ($sort === 'price_desc') {
            $query->orderBy('price', 'desc');
        } elseif ($sort === 'popular') {
            $query->orderBy('enrolled_count', 'desc');
        } else {
            $query->latest();
        }

        $courses = $query->get();
        $combos = $courses->where('is_combo', true)->values();
        $regularCourses = $courses->where('is_combo', false)->values();

        $dbCats = Category::where('type', 'course')->where('active', true)->pluck('name')->all();
        $courseCategories = array_values(array_unique(array_merge(
            ['All Courses', 'Combos'],
            $dbCats
        )));

        return view('courses.index', compact('courses', 'combos', 'regularCourses', 'category', 'search', 'sort', 'courseCategories'));
    }

    public function courseDetail(string $slug)
    {
        $course = Course::where('slug', $slug)
            ->where('status', 'active')
            ->with(['lessons.batch', 'batches.branch'])
            ->firstOrFail();
        $branches = Branch::where('status', 'active')->get();
        $gatewaysRaw = DB::table('settings')->where('key', 'payment_gateways')->value('value');
        $allGateways = $gatewaysRaw ? (json_decode($gatewaysRaw, true) ?? []) : PortalController::defaultPaymentGateways();
        $activeGateways = array_values(array_filter($allGateways, fn ($g) => !empty($g['active'])));
        return view('courses.show', compact('course', 'branches', 'activeGateways'));
    }

    public function enroll(Request $request, Course $course)
    {
        $hasBranches = Branch::where('status', 'active')->exists();

        $data = $request->validate([
            'branch_id' => $hasBranches ? 'required|exists:branches,id' : 'nullable|exists:branches,id',
            'payment_method' => 'required|string|max:80',
            'coupon_code' => 'nullable|string|max:40',
        ]);

        $gatewaysRaw = DB::table('settings')->where('key', 'payment_gateways')->value('value');
        $allGateways = $gatewaysRaw ? (json_decode($gatewaysRaw, true) ?? []) : PortalController::defaultPaymentGateways();
        $activeGateways = array_values(array_filter($allGateways, fn ($g) => !empty($g['active'])));
        $selectedGateway = collect($activeGateways)->first(fn ($g) => strcasecmp($g['name'], $data['payment_method']) === 0);
        if (!$selectedGateway) {
            return back()->withErrors(['payment_method' => 'Selected payment gateway is currently inactive or unavailable.']);
        }

        $finalPrice = $course->price;
        $couponCode = null;
        if (!empty($data['coupon_code'])) {
            $coupon = Coupon::where('code', strtoupper(trim($data['coupon_code'])))->where('active', true)->first();
            if ($coupon) {
                $finalPrice = max(0, (int) round($course->price * (1 - $coupon->discount_percent / 100)));
                $couponCode = $coupon->code;
            }
        }

        $status = in_array($selectedGateway['provider_type'] ?? 'online', ['cash', 'manual'], true) ? 'pending' : 'approved';
        Enrollment::create([
            'user_id' => $request->user()->id,
            'course_id' => $course->id,
            'branch_id' => $data['branch_id'] ?? null,
            'payment_method' => $selectedGateway['name'],
            'amount_paid' => $finalPrice,
            'coupon_used' => $couponCode,
            'status' => $status,
            'completed_lesson_ids' => [],
        ]);

        if ($status === 'approved') {
            $course->increment('enrolled_count');
        }

        return back()->with('status', $status === 'approved' ? 'Enrolled successfully!' : 'Pending Branch Manager verification.');
    }

    public function instructors()
    {
        $teachers = User::where('role', 'teacher')->with('branch')->get();
        return view('instructors', compact('teachers'));
    }

    public function learn(Request $request)
    {
        $user = $request->user();
        $enrollments = Enrollment::where('user_id', $user->id)
            ->where('status', 'approved')
            ->with(['course.lessons.batch', 'course.batches'])
            ->get();
        return view('learn', compact('enrollments'));
    }

    public function markLessonComplete(Request $request)
    {
        $data = $request->validate(['course_id' => 'required|integer', 'lesson_id' => 'required|integer']);
        $enrollment = Enrollment::where('user_id', $request->user()->id)
            ->where('course_id', $data['course_id'])
            ->where('status', 'approved')
            ->firstOrFail();

        $ids = $enrollment->completed_lesson_ids ?? [];
        if (!in_array((int) $data['lesson_id'], $ids, true)) {
            $ids[] = (int) $data['lesson_id'];
            $enrollment->update(['completed_lesson_ids' => $ids]);
        }
        return back()->with('status', 'Lesson marked complete!');
    }

    public function results()
    {
        return view('results', ['record' => null, 'roll' => '']);
    }

    public function lookupResult(Request $request)
    {
        $roll = strtoupper(trim((string) $request->input('roll', '')));
        $record = $roll !== '' ? CenterResult::where('roll_number', $roll)->first() : null;
        return view('results', compact('record', 'roll'));
    }

    public function community()
    {
        $posts = CommunityPost::where('status', 'published')->with('author')->latest()->get();
        return view('community', compact('posts'));
    }

    public function likeCommunityPost(CommunityPost $post)
    {
        $post->increment('likes');
        return back()->with('status', 'Thank you for engaging with the community!');
    }

    public function verifyCertificate(Request $request)
    {
        $code = strtoupper(trim((string) $request->query('code', '')));
        $certificate = $code !== '' ? Certificate::where('certificate_code', $code)->first() : null;
        return view('certificates.verify', compact('certificate', 'code'));
    }

    public function lookupCertificate(Request $request)
    {
        $code = strtoupper(trim((string) $request->input('code', '')));
        $certificate = $code !== '' ? Certificate::where('certificate_code', $code)->first() : null;
        return view('certificates.verify', compact('certificate', 'code'));
    }
}
