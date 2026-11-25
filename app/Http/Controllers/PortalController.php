<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\BackupSnapshot;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Category;
use App\Models\CenterResult;
use App\Models\Certificate;
use App\Models\CommunityPost;
use App\Models\Coupon;
use App\Models\ContactInquiry;
use App\Models\Course;
use App\Models\Ebook;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\ExamQuestion;
use App\Models\FinancialRecord;
use App\Models\LearnerReward;
use App\Models\Lesson;
use App\Models\Order;
use App\Models\PayrollRecord;
use App\Models\Product;
use App\Models\QuestionBankItem;
use App\Models\RecycleBinItem;
use App\Models\Review;
use App\Models\ScormPackage;
use App\Models\SystemUpdate;
use App\Models\User;
use App\Services\SystemUpdateService;
use App\Support\BrandSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PortalController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $role = $user->role;

        $branches = Branch::all();
        $courses = Course::all();
        $batches = Batch::with(['course', 'branch'])->latest()->get();
        $lessons = Lesson::with(['course', 'batch'])->orderBy('order_index')->get();
        $exams = Exam::with('questions')->get();

        if ($role === 'admin') {
            $users = User::with('branch')->get();
            $enrollments = Enrollment::with(['user', 'course', 'branch'])->latest()->get();
            $orders = Order::with('user')->latest()->get();
            $reviews = Review::latest()->get();
            $contactInquiries = ContactInquiry::with('branch')->latest()->take(50)->get();
            $customPagesRaw = DB::table('settings')->where('key', 'custom_pages')->value('value');
            $customPages = $customPagesRaw ? (json_decode($customPagesRaw, true) ?: []) : [];
            $questionBank = QuestionBankItem::latest()->get();
            $products = Product::latest()->get();
            $ebooks = Ebook::latest()->get();
            $categories = Category::latest()->get();
            $posts = CommunityPost::with('author')->latest()->get();
            $coupons = Coupon::latest()->get();
            $attendance = AttendanceRecord::with('user')->latest()->take(50)->get();
            $payrolls = PayrollRecord::with('employee')->latest()->get();
            $financialRecords = FinancialRecord::latest()->take(50)->get();
            $scormPackages = ScormPackage::latest()->get();
            $backups = BackupSnapshot::latest()->get();
            $recycleBin = RecycleBinItem::latest()->get();
            $centerResults = CenterResult::latest()->get();
            $certificates = Certificate::latest()->get();
            $updater = app(SystemUpdateService::class);
            $systemVersion = $updater->currentVersion();
            $pendingMigrations = $updater->pendingMigrations();
            $systemUpdates = SystemUpdate::latest()->take(20)->get();
            $slidesRaw = DB::table('settings')->where('key', 'homepage_slides')->value('value');
            $configRaw = DB::table('settings')->where('key', 'homepage_config')->value('value');
            $gatewaysRaw = DB::table('settings')->where('key', 'payment_gateways')->value('value');
            $connectorsRaw = DB::table('settings')->where('key', 'api_connectors')->value('value');
            $heroSlides = $slidesRaw ? (json_decode($slidesRaw, true) ?? []) : [];
            $homepageConfig = $configRaw ? (json_decode($configRaw, true) ?? []) : [];
            $paymentGateways = $gatewaysRaw ? (json_decode($gatewaysRaw, true) ?? []) : self::defaultPaymentGateways();
            $apiConnectors = $connectorsRaw ? (json_decode($connectorsRaw, true) ?? []) : self::defaultApiConnectors();
            return view('portal.index', compact(
                'user', 'branches', 'courses', 'batches', 'lessons', 'exams', 'users',
                'enrollments', 'orders', 'reviews', 'heroSlides', 'homepageConfig', 'contactInquiries', 'customPages',
                'paymentGateways', 'apiConnectors',
                'questionBank', 'products', 'ebooks', 'categories', 'posts', 'coupons',
                'attendance', 'payrolls', 'financialRecords', 'scormPackages', 'backups', 'recycleBin',
                'centerResults', 'certificates', 'systemVersion', 'pendingMigrations', 'systemUpdates'
            ));
        }

        if ($role === 'branch') {
            $batches = Batch::where('branch_id', $user->branch_id)->with(['course', 'branch'])->latest()->get();
            $enrollments = Enrollment::where('branch_id', $user->branch_id)->with(['user', 'course'])->latest()->get();
            $users = User::where('branch_id', $user->branch_id)->get();
            $orders = Order::where('branch_pickup_id', $user->branch_id)->latest()->get();
            $attendance = AttendanceRecord::where('branch_id', $user->branch_id)->latest()->take(40)->get();
            return view('portal.index', compact('user', 'branches', 'courses', 'batches', 'users', 'enrollments', 'orders', 'attendance'));
        }

        if ($role === 'teacher') {
            $questionBank = QuestionBankItem::latest()->get();
            return view('portal.index', compact('user', 'branches', 'courses', 'batches', 'lessons', 'exams', 'questionBank'));
        }

        if ($role === 'guardian') {
            $children = $user->linkedStudents()->with(['enrollments.course', 'examAttempts.exam'])->get();
            return view('portal.index', compact('user', 'children'));
        }

        // Student
        $enrollments = Enrollment::where('user_id', $user->id)->with('course')->get();
        $attempts = $user->examAttempts()->with('exam')->latest()->get();
        $orders = Order::where('user_id', $user->id)->latest()->get();
        $certificates = Certificate::where('user_id', $user->id)->where('revoked', false)->latest()->get();
        $reward = LearnerReward::firstOrCreate(['user_id' => $user->id], ['xp' => 0, 'streak_days' => 1, 'badges' => [], 'show_on_leaderboard' => true]);
        return view('portal.index', compact('user', 'enrollments', 'attempts', 'orders', 'certificates', 'reward'));
    }

    public function storeCourse(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:180',
            'subtitle' => 'required|string|max:240',
            'category' => 'required|string|max:80',
            'level_tag' => 'required|string|max:40',
            'price' => 'required|integer|min:0',
            'original_price' => 'required|integer|min:0|gte:price',
            'description' => 'required|string|max:4000',
            'demo_video_title' => 'nullable|string|max:180',
            'thumbnail' => 'nullable|string|max:500',
            'status' => 'nullable|in:active,draft',
            'is_combo' => 'nullable|boolean',
            'exam_system_included' => 'nullable|boolean',
            'included_courses_text' => 'nullable|string|max:1000',
        ]);

        $isCombo = $request->boolean('is_combo') || $data['category'] === 'Combo Packs';
        $includedCourses = $isCombo && !empty($data['included_courses_text'])
            ? array_values(array_filter(array_map('trim', explode("\n", $data['included_courses_text']))))
            : null;

        Course::create([
            'title' => $data['title'],
            'subtitle' => $data['subtitle'],
            'category' => $data['category'],
            'level_tag' => $data['level_tag'],
            'price' => $data['price'],
            'original_price' => $data['original_price'],
            'description' => $data['description'],
            'demo_video_title' => $data['demo_video_title'] ?? ($data['title'] . ' — Orientation'),
            'thumbnail' => $data['thumbnail'] ?? 'images/default-logo.svg',
            'status' => $data['status'] ?? 'active',
            'slug' => Str::slug($data['title']) . '-' . rand(100, 999),
            'is_combo' => $isCombo,
            'included_courses' => $includedCourses,
            'exam_system_included' => $request->boolean('exam_system_included', true),
        ]);

        return back()->with('status', 'Course published successfully.');
    }

    public function updateCourse(Request $request, Course $course)
    {
        $data = $request->validate([
            'title' => 'required|string|max:180',
            'subtitle' => 'required|string|max:240',
            'category' => 'required|string|max:80',
            'level_tag' => 'required|string|max:40',
            'price' => 'required|integer|min:0',
            'original_price' => 'required|integer|min:0|gte:price',
            'description' => 'required|string|max:4000',
            'demo_video_title' => 'nullable|string|max:180',
            'thumbnail' => 'nullable|string|max:500',
            'status' => 'required|in:active,draft',
            'is_combo' => 'nullable|boolean',
            'exam_system_included' => 'nullable|boolean',
            'included_courses_text' => 'nullable|string|max:1000',
        ]);

        $isCombo = $request->boolean('is_combo') || $data['category'] === 'Combo Packs';
        $includedCourses = $isCombo && !empty($data['included_courses_text'])
            ? array_values(array_filter(array_map('trim', explode("\n", $data['included_courses_text']))))
            : ($isCombo ? $course->included_courses : null);

        $course->update([
            'title' => $data['title'],
            'subtitle' => $data['subtitle'],
            'category' => $data['category'],
            'level_tag' => $data['level_tag'],
            'price' => $data['price'],
            'original_price' => $data['original_price'],
            'description' => $data['description'],
            'demo_video_title' => $data['demo_video_title'] ?? $course->demo_video_title,
            'thumbnail' => $data['thumbnail'] ?? $course->thumbnail,
            'status' => $data['status'],
            'is_combo' => $isCombo,
            'included_courses' => $includedCourses,
            'exam_system_included' => $request->boolean('exam_system_included', true),
        ]);

        return back()->with('status', 'Course updated successfully.');
    }

    public function toggleCourseStatus(Request $request, Course $course)
    {
        $nextStatus = $course->status === 'active' ? 'draft' : 'active';
        $course->update(['status' => $nextStatus]);
        return back()->with('status', "Course status changed to {$nextStatus}.");
    }

    public function duplicateCourse(Course $course)
    {
        $copy = $course->replicate();
        $copy->slug = $course->slug . '-copy-' . rand(100, 999);
        $copy->title = $course->title . ' (Copy)';
        $copy->enrolled_count = 0;
        $copy->status = 'draft';
        $copy->save();

        foreach ($course->lessons as $lesson) {
            $lesCopy = $lesson->replicate();
            $lesCopy->course_id = $copy->id;
            $lesCopy->save();
        }

        return back()->with('status', 'Draft duplicate created successfully.');
    }

    public function deleteCourse(Course $course)
    {
        $course->delete();
        return back()->with('status', 'Course deleted.');
    }

    public function storeBatch(Request $request)
    {
        $actor = $request->user();
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'name' => 'required|string|max:140',
            'code' => 'required|string|max:32|unique:batches,code',
            'branch_id' => 'nullable|exists:branches,id',
            'instructor_name' => 'nullable|string|max:120',
            'schedule' => 'required|string|max:140',
            'start_date' => 'nullable|string|max:40',
            'seat_limit' => 'required|integer|min:1|max:5000',
            'mode' => 'required|in:Online Live,Offline Branch,Hybrid',
            'status' => 'required|in:open,running,closed',
        ]);

        if ($actor->role === 'branch' && $actor->branch_id && (int) ($data['branch_id'] ?? 0) !== (int) $actor->branch_id) {
            abort(403, 'Branch accounts can only create batches for their own branch.');
        }

        $data['code'] = strtoupper(trim($data['code']));
        Batch::create($data);
        return back()->with('status', 'Course batch created.');
    }

    public function updateBatch(Request $request, Batch $batch)
    {
        $actor = $request->user();
        if ($actor->role === 'branch' && $actor->branch_id && (int) $batch->branch_id !== (int) $actor->branch_id) {
            abort(403, 'Branch accounts can only update batches in their own branch.');
        }

        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'name' => 'required|string|max:140',
            'code' => 'required|string|max:32|unique:batches,code,' . $batch->id,
            'branch_id' => 'nullable|exists:branches,id',
            'instructor_name' => 'nullable|string|max:120',
            'schedule' => 'required|string|max:140',
            'start_date' => 'nullable|string|max:40',
            'seat_limit' => 'required|integer|min:1|max:5000',
            'mode' => 'required|in:Online Live,Offline Branch,Hybrid',
            'status' => 'required|in:open,running,closed',
        ]);

        $data['code'] = strtoupper(trim($data['code']));
        $batch->update($data);
        return back()->with('status', 'Course batch updated.');
    }

    public function toggleBatchStatus(Request $request, Batch $batch)
    {
        $data = $request->validate(['status' => 'required|in:open,running,closed']);
        $batch->update(['status' => $data['status']]);
        return back()->with('status', 'Batch status updated.');
    }

    public function deleteBatch(Request $request, Batch $batch)
    {
        $actor = $request->user();
        if ($actor->role === 'branch' && $actor->branch_id && (int) $batch->branch_id !== (int) $actor->branch_id) {
            abort(403, 'Branch accounts can only delete batches in their own branch.');
        }
        $batch->delete();
        return back()->with('status', 'Course batch deleted.');
    }

    public function storeLesson(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'batch_id' => 'nullable|exists:batches,id',
            'lesson_type' => 'required|in:recorded,live,lecture_sheet',
            'title' => 'required|string|max:180',
            'module_name' => 'required|string|max:140',
            'duration' => 'required|string|max:40',
            'video_url' => 'nullable|string|max:500',
            'lecture_sheet_url' => 'nullable|string|max:500',
            'live_join_url' => 'nullable|string|max:500',
            'live_status' => 'nullable|in:scheduled,live_now,ended',
            'scheduled_at' => 'nullable|string|max:60',
            'sheet_summary' => 'nullable|string|max:2000',
            'is_free_preview' => 'nullable|boolean',
        ]);

        $orderIndex = Lesson::where('course_id', $data['course_id'])->count() + 1;
        Lesson::create([
            ...$data,
            'is_free_preview' => $request->boolean('is_free_preview'),
            'order_index' => $orderIndex,
        ]);
        return back()->with('status', 'Lecture / Video added.');
    }

    public function updateLesson(Request $request, Lesson $lesson)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'batch_id' => 'nullable|exists:batches,id',
            'lesson_type' => 'required|in:recorded,live,lecture_sheet',
            'title' => 'required|string|max:180',
            'module_name' => 'required|string|max:140',
            'duration' => 'required|string|max:40',
            'video_url' => 'nullable|string|max:500',
            'lecture_sheet_url' => 'nullable|string|max:500',
            'live_join_url' => 'nullable|string|max:500',
            'live_status' => 'nullable|in:scheduled,live_now,ended',
            'scheduled_at' => 'nullable|string|max:60',
            'sheet_summary' => 'nullable|string|max:2000',
            'is_free_preview' => 'nullable|boolean',
        ]);

        $lesson->update([
            ...$data,
            'is_free_preview' => $request->boolean('is_free_preview'),
        ]);
        return back()->with('status', 'Lecture / Video updated.');
    }

    public function updateLessonLiveStatus(Request $request, Lesson $lesson)
    {
        $data = $request->validate(['live_status' => 'required|in:scheduled,live_now,ended']);
        $lesson->update([
            'lesson_type' => 'live',
            'live_status' => $data['live_status'],
        ]);
        return back()->with('status', "Live class marked as {$data['live_status']}.");
    }

    public function duplicateLesson(Lesson $lesson)
    {
        $copy = $lesson->replicate();
        $copy->title = $lesson->title . ' (Copy)';
        $copy->order_index = Lesson::where('course_id', $lesson->course_id)->count() + 1;
        $copy->save();
        return back()->with('status', 'Lecture duplicated.');
    }

    public function deleteLesson(Lesson $lesson)
    {
        $lesson->delete();
        return back()->with('status', 'Lesson deleted.');
    }

    public function storeExam(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'category' => 'required|string',
            'prompt' => 'required|string',
            'options' => 'required|array|size:4',
            'correct_index' => 'required|integer|min:0|max:3',
        ]);

        $exam = Exam::create([
            'title' => $data['title'],
            'category' => $data['category'],
            'teacher_id' => $request->user()->id,
        ]);

        ExamQuestion::create([
            'exam_id' => $exam->id,
            'prompt' => $data['prompt'],
            'options' => $data['options'],
            'correct_index' => $data['correct_index'],
        ]);

        return back()->with('status', 'MCQ Exam created.');
    }

    public function storeBranch(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:140',
            'code' => 'required|string|max:32|unique:branches,code',
            'city' => 'required|string|max:80',
            'address' => 'required|string|max:240',
            'phone' => 'nullable|string|max:32',
            'manager_name' => 'nullable|string|max:120',
            'active_students' => 'nullable|integer|min:0',
            'status' => 'nullable|in:active,inactive',
        ]);
        $data['code'] = strtoupper(trim($data['code']));
        $data['phone'] = (string) ($data['phone'] ?? '');
        $data['active_students'] = $data['active_students'] ?? 0;
        $data['status'] = $data['status'] ?? 'active';
        Branch::create($data);
        return back()->with('status', 'Branch campus added.');
    }

    public function updateBranch(Request $request, Branch $branch)
    {
        $data = $request->validate([
            'name' => 'required|string|max:140',
            'code' => 'required|string|max:32|unique:branches,code,' . $branch->id,
            'city' => 'required|string|max:80',
            'address' => 'required|string|max:240',
            'phone' => 'nullable|string|max:32',
            'manager_name' => 'nullable|string|max:120',
            'active_students' => 'nullable|integer|min:0',
            'status' => 'required|in:active,inactive',
        ]);
        $data['code'] = strtoupper(trim($data['code']));
        $branch->update($data);
        return back()->with('status', "Branch '{$branch->name}' updated.");
    }

    public function toggleBranchStatus(Request $request, Branch $branch)
    {
        $nextStatus = $request->input('status');
        if (!in_array($nextStatus, ['active', 'inactive'], true)) {
            $nextStatus = $branch->status === 'active' ? 'inactive' : 'active';
        }
        $branch->update(['status' => $nextStatus]);
        return back()->with('status', "Branch '{$branch->name}' marked {$nextStatus}.");
    }

    public function deleteBranch(Request $request, Branch $branch)
    {
        RecycleBinItem::create([
            'entity_type' => 'branch',
            'original_id' => (string) $branch->id,
            'label' => $branch->name,
            'deleted_by' => $request->user()->name,
            'snapshot_json' => json_encode($branch->toArray()),
        ]);
        $branch->delete();
        return back()->with('status', "Branch '{$branch->name}' moved to Recycle Bin.");
    }

    public static function defaultPaymentGateways(): array
    {
        return [
            ['id' => 'gw-online', 'name' => 'Online Card / Gateway', 'provider_type' => 'online', 'mode' => 'sandbox', 'merchant_account' => 'Configure Merchant ID', 'instructions' => 'Pay securely online once configured by your administrator.', 'fee_percent' => 0, 'active' => true, 'api_key_masked' => 'Unconfigured'],
            ['id' => 'gw-bank', 'name' => 'Bank Transfer', 'provider_type' => 'manual', 'mode' => 'live', 'merchant_account' => 'Configure Bank Account', 'instructions' => 'Submit transfer reference for admin verification.', 'fee_percent' => 0, 'active' => true, 'api_key_masked' => 'Manual Review'],
            ['id' => 'gw-cash', 'name' => 'Campus Desk Cash', 'provider_type' => 'cash', 'mode' => 'live', 'merchant_account' => 'Campus Accounts Desk', 'instructions' => 'Pay in person at your nearest campus desk for approval.', 'fee_percent' => 0, 'active' => true, 'api_key_masked' => 'Desk Receipt'],
        ];
    }

    public static function defaultApiConnectors(): array
    {
        return [
            ['id' => 'plg-scorm', 'name' => 'SCORM 1.2 LMS Runtime', 'category' => 'Learning & LMS', 'environment' => 'production', 'endpoint_url' => '/learn', 'api_key_masked' => 'Built-in', 'description' => 'Local SCORM package validation and learner tracking.', 'active' => true],
            ['id' => 'plg-sms', 'name' => 'SMS Notification Gateway', 'category' => 'SMS & Messaging', 'environment' => 'sandbox', 'endpoint_url' => '', 'api_key_masked' => 'Not Configured', 'description' => 'Attendance alerts, fee receipts, and exam reminder SMS.', 'active' => false],
            ['id' => 'plg-wa', 'name' => 'WhatsApp Business Cloud API', 'category' => 'SMS & Messaging', 'environment' => 'sandbox', 'endpoint_url' => 'https://graph.facebook.com/v20.0', 'api_key_masked' => 'Not Configured', 'description' => 'Official Meta Cloud API for guardian & student messages.', 'active' => false],
            ['id' => 'plg-zoom', 'name' => 'Live Video Conferencing', 'category' => 'Video & Live', 'environment' => 'sandbox', 'endpoint_url' => '', 'api_key_masked' => 'Not Configured', 'description' => 'Connect Zoom / Google Meet links for live classes.', 'active' => false],
        ];
    }

    private static function maskSecret(?string $raw, string $fallback = 'Not Configured'): string
    {
        $clean = trim((string) $raw);
        if ($clean === '') {
            return $fallback;
        }
        if (strlen($clean) <= 8) {
            return str_repeat('*', strlen($clean));
        }
        return substr($clean, 0, 4) . '****' . substr($clean, -4);
    }

    private function loadSettingJson(string $key, array $default): array
    {
        $raw = DB::table('settings')->where('key', $key)->value('value');
        $decoded = $raw ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : $default;
    }

    private function saveSettingJson(string $key, array $items): void
    {
        DB::table('settings')->updateOrInsert(['key' => $key], ['value' => json_encode(array_values($items))]);
    }

    public function storePaymentGateway(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'provider_type' => 'required|in:mfs,online,manual,cash',
            'mode' => 'required|in:sandbox,live',
            'merchant_account' => 'required|string|max:140',
            'instructions' => 'nullable|string|max:400',
            'fee_percent' => 'nullable|numeric|min:0|max:25',
            'api_key' => 'nullable|string|max:240',
        ]);
        $gateways = $this->loadSettingJson('payment_gateways', self::defaultPaymentGateways());
        $gateways[] = [
            'id' => 'gw-' . bin2hex(random_bytes(3)),
            'name' => trim($data['name']),
            'provider_type' => $data['provider_type'],
            'mode' => $data['mode'],
            'merchant_account' => trim($data['merchant_account']),
            'instructions' => trim((string) ($data['instructions'] ?? '')),
            'fee_percent' => (float) ($data['fee_percent'] ?? 0),
            'active' => $request->boolean('active'),
            'api_key_masked' => self::maskSecret($data['api_key'] ?? null, 'Unconfigured'),
        ];
        $this->saveSettingJson('payment_gateways', $gateways);
        return back()->with('status', "Payment gateway '{$data['name']}' added.");
    }

    public function updatePaymentGateway(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'provider_type' => 'required|in:mfs,online,manual,cash',
            'mode' => 'required|in:sandbox,live',
            'merchant_account' => 'required|string|max:140',
            'instructions' => 'nullable|string|max:400',
            'fee_percent' => 'nullable|numeric|min:0|max:25',
            'api_key' => 'nullable|string|max:240',
        ]);
        $gateways = $this->loadSettingJson('payment_gateways', self::defaultPaymentGateways());
        foreach ($gateways as &$gw) {
            if (($gw['id'] ?? '') === $id) {
                $gw['name'] = trim($data['name']);
                $gw['provider_type'] = $data['provider_type'];
                $gw['mode'] = $data['mode'];
                $gw['merchant_account'] = trim($data['merchant_account']);
                $gw['instructions'] = trim((string) ($data['instructions'] ?? ''));
                $gw['fee_percent'] = (float) ($data['fee_percent'] ?? 0);
                if (!empty($data['api_key'])) {
                    $gw['api_key_masked'] = self::maskSecret($data['api_key']);
                }
                break;
            }
        }
        unset($gw);
        $this->saveSettingJson('payment_gateways', $gateways);
        return back()->with('status', "Payment gateway '{$data['name']}' updated.");
    }

    public function togglePaymentGateway(string $id)
    {
        $gateways = $this->loadSettingJson('payment_gateways', self::defaultPaymentGateways());
        foreach ($gateways as &$gw) {
            if (($gw['id'] ?? '') === $id) {
                $gw['active'] = empty($gw['active']);
                break;
            }
        }
        unset($gw);
        $this->saveSettingJson('payment_gateways', $gateways);
        return back()->with('status', 'Payment gateway status toggled.');
    }

    public function deletePaymentGateway(Request $request, string $id)
    {
        $gateways = $this->loadSettingJson('payment_gateways', self::defaultPaymentGateways());
        $kept = [];
        foreach ($gateways as $gw) {
            if (($gw['id'] ?? '') === $id) {
                RecycleBinItem::create([
                    'entity_type' => 'payment_gateway',
                    'original_id' => $id,
                    'label' => $gw['name'] ?? $id,
                    'deleted_by' => $request->user()->name,
                    'snapshot_json' => json_encode($gw),
                ]);
            } else {
                $kept[] = $gw;
            }
        }
        $this->saveSettingJson('payment_gateways', $kept);
        return back()->with('status', 'Payment gateway moved to Recycle Bin.');
    }

    public function storeConnector(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'category' => 'required|string|max:80',
            'environment' => 'required|in:sandbox,production',
            'endpoint_url' => 'nullable|string|max:300',
            'api_key' => 'nullable|string|max:240',
            'description' => 'nullable|string|max:300',
        ]);
        $connectors = $this->loadSettingJson('api_connectors', self::defaultApiConnectors());
        $connectors[] = [
            'id' => 'plg-' . bin2hex(random_bytes(3)),
            'name' => trim($data['name']),
            'category' => trim($data['category']),
            'environment' => $data['environment'],
            'endpoint_url' => trim((string) ($data['endpoint_url'] ?? '')),
            'api_key_masked' => self::maskSecret($data['api_key'] ?? null),
            'description' => trim((string) ($data['description'] ?? '')),
            'active' => $request->boolean('active'),
        ];
        $this->saveSettingJson('api_connectors', $connectors);
        return back()->with('status', "API Connector '{$data['name']}' created.");
    }

    public function updateConnector(Request $request, string $id)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'category' => 'required|string|max:80',
            'environment' => 'required|in:sandbox,production',
            'endpoint_url' => 'nullable|string|max:300',
            'api_key' => 'nullable|string|max:240',
            'description' => 'nullable|string|max:300',
        ]);
        $connectors = $this->loadSettingJson('api_connectors', self::defaultApiConnectors());
        foreach ($connectors as &$conn) {
            if (($conn['id'] ?? '') === $id) {
                $conn['name'] = trim($data['name']);
                $conn['category'] = trim($data['category']);
                $conn['environment'] = $data['environment'];
                $conn['endpoint_url'] = trim((string) ($data['endpoint_url'] ?? ''));
                $conn['description'] = trim((string) ($data['description'] ?? ''));
                if (!empty($data['api_key'])) {
                    $conn['api_key_masked'] = self::maskSecret($data['api_key']);
                }
                break;
            }
        }
        unset($conn);
        $this->saveSettingJson('api_connectors', $connectors);
        return back()->with('status', "API Connector '{$data['name']}' updated.");
    }

    public function toggleConnector(string $id)
    {
        $connectors = $this->loadSettingJson('api_connectors', self::defaultApiConnectors());
        foreach ($connectors as &$conn) {
            if (($conn['id'] ?? '') === $id) {
                $conn['active'] = empty($conn['active']);
                break;
            }
        }
        unset($conn);
        $this->saveSettingJson('api_connectors', $connectors);
        return back()->with('status', 'API Connector status updated.');
    }

    public function deleteConnector(Request $request, string $id)
    {
        $connectors = $this->loadSettingJson('api_connectors', self::defaultApiConnectors());
        $kept = [];
        foreach ($connectors as $conn) {
            if (($conn['id'] ?? '') === $id) {
                RecycleBinItem::create([
                    'entity_type' => 'plugin',
                    'original_id' => $id,
                    'label' => $conn['name'] ?? $id,
                    'deleted_by' => $request->user()->name,
                    'snapshot_json' => json_encode($conn),
                ]);
            } else {
                $kept[] = $conn;
            }
        }
        $this->saveSettingJson('api_connectors', $kept);
        return back()->with('status', 'API Connector moved to Recycle Bin.');
    }

    public function storeUser(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30',
            'role' => 'required|in:branch,teacher,student,guardian',
            'status' => 'nullable|in:pending,active,suspended,rejected',
            'branch_id' => 'nullable|exists:branches,id',
            'education' => 'nullable|string|max:180',
            'subject_specialty' => 'nullable|string|max:120',
            'password' => 'required|string|min:6',
        ]);

        User::create([
            ...$data,
            'email' => strtolower(trim($data['email'])),
            'status' => $data['status'] ?? 'active',
            'approved_at' => ($data['status'] ?? 'active') === 'active' ? now() : null,
            'approved_by' => ($data['status'] ?? 'active') === 'active' ? $request->user()->name : null,
            'password' => Hash::make($data['password']),
        ]);

        return back()->with('status', 'User created.');
    }

    public function updateUser(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:30',
            'role' => 'required|in:admin,branch,teacher,student,guardian',
            'status' => 'required|in:pending,active,suspended,rejected',
            'branch_id' => 'nullable|exists:branches,id',
            'education' => 'nullable|string|max:180',
            'subject_specialty' => 'nullable|string|max:120',
            'bio' => 'nullable|string|max:1000',
            'approval_note' => 'nullable|string|max:500',
            'password' => 'nullable|string|min:6',
        ]);

        if ($user->role === 'admin' && ($data['role'] !== 'admin' || $data['status'] !== 'active')) {
            return back()->withErrors(['user' => 'The sole Main Admin account must remain active with admin role.']);
        }
        if ($user->role !== 'admin' && $data['role'] === 'admin') {
            return back()->withErrors(['user' => 'Additional Main Admin accounts cannot be promoted (Single Main Admin policy).']);
        }

        $payload = [
            'name' => trim($data['name']),
            'email' => strtolower(trim($data['email'])),
            'phone' => $data['phone'] ?? $user->phone,
            'role' => $data['role'],
            'status' => $data['status'],
            'branch_id' => $data['branch_id'] ?? null,
            'education' => $data['education'] ?? $user->education,
            'subject_specialty' => $data['subject_specialty'] ?? $user->subject_specialty,
            'bio' => $data['bio'] ?? $user->bio,
            'approval_note' => $data['approval_note'] ?? $user->approval_note,
        ];
        if ($data['status'] === 'active' && !$user->approved_at) {
            $payload['approved_at'] = now();
            $payload['approved_by'] = $request->user()->name;
        }
        if (!empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }

        $user->update($payload);

        if ($user->role === 'branch' && $user->branch_id && $data['status'] === 'active') {
            Branch::whereKey($user->branch_id)->update(['status' => 'active']);
        }

        return back()->with('status', "Account '{$user->name}' updated.");
    }

    public function approveUser(Request $request, User $user)
    {
        $user->update([
            'status' => 'active',
            'approval_note' => $request->input('approval_note') ?: 'Approved by Main Admin',
            'approved_at' => now(),
            'approved_by' => $request->user()->name,
        ]);

        if ($user->role === 'branch' && $user->branch_id) {
            Branch::whereKey($user->branch_id)->update(['status' => 'active']);
        }

        return back()->with('status', "Account '{$user->name}' ({$user->role}) approved.");
    }

    public function rejectUser(Request $request, User $user)
    {
        if ($user->role === 'admin') {
            return back()->withErrors(['user' => 'Cannot reject the Main Admin account.']);
        }

        $user->update([
            'status' => 'rejected',
            'approval_note' => $request->input('approval_note') ?: 'Rejected by Main Admin',
        ]);

        if ($user->role === 'branch' && $user->branch_id) {
            Branch::whereKey($user->branch_id)->update(['status' => 'inactive']);
        }

        return back()->with('status', "Account '{$user->name}' rejected.");
    }

    public function issueResetToken(Request $request, User $user)
    {
        $rawToken = strtoupper(bin2hex(random_bytes(5)));
        $user->update([
            'password_reset_token_hash' => hash('sha256', $rawToken),
            'password_reset_expires_at' => now()->addHour(),
        ]);

        return back()
            ->with('status', "Password recovery token generated for {$user->email} (expires in 1 hour).")
            ->with('issued_reset_token', $rawToken)
            ->with('issued_reset_email', $user->email);
    }

    public function updateUserRole(Request $request, User $user)
    {
        $data = $request->validate(['role' => 'required|in:admin,branch,teacher,student,guardian']);
        if ($user->role === 'admin' && $data['role'] !== 'admin') {
            return back()->withErrors(['user' => 'Main Admin role cannot be downgraded.']);
        }
        if ($user->role !== 'admin' && $data['role'] === 'admin') {
            return back()->withErrors(['user' => 'Single Main Admin invariant prevents promoting another admin.']);
        }
        $user->update(['role' => $data['role']]);
        return back()->with('status', 'Role updated.');
    }

    public function decideEnrollment(Request $request, Enrollment $enrollment)
    {
        $actor = $request->user();
        if ($actor->role === 'branch' && $enrollment->branch_id !== $actor->branch_id) {
            abort(403, 'Branch accounts can only approve enrollments in their own branch.');
        }

        $data = $request->validate(['status' => 'required|in:approved,rejected']);
        $prev = $enrollment->status;
        $enrollment->update(['status' => $data['status']]);
        if ($prev !== 'approved' && $data['status'] === 'approved') {
            $enrollment->course->increment('enrolled_count');
        }
        return back()->with('status', 'Enrollment updated.');
    }

    public function updateOrder(Request $request, Order $order)
    {
        $data = $request->validate(['status' => 'required|in:processing,shipped,delivered,cancelled']);
        $order->update(['status' => $data['status']]);
        return back()->with('status', 'Order status updated.');
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'phone' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:140',
            'address' => 'nullable|string|max:240',
            'about_mission' => 'nullable|string|max:6000',
            'terms_content' => 'nullable|string|max:12000',
            'privacy_content' => 'nullable|string|max:12000',
            'refund_content' => 'nullable|string|max:12000',
        ]);

        foreach ($data as $key => $value) {
            DB::table('settings')->updateOrInsert(['key' => $key], ['value' => trim((string) $value)]);
        }
        return back()->with('status', 'Company contact and public page content saved.');
    }

    public function storeCustomPage(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:140',
            'slug' => 'nullable|string|max:100|alpha_dash',
            'subtitle' => 'nullable|string|max:240',
            'body' => 'required|string|max:12000',
            'published' => 'nullable|boolean',
        ]);
        $slug = Str::slug($data['slug'] ?: $data['title']);
        if ($slug === '') {
            return back()->withErrors(['slug' => 'Enter a valid page title or slug.']);
        }

        $raw = DB::table('settings')->where('key', 'custom_pages')->value('value');
        $pages = $raw ? (json_decode($raw, true) ?: []) : [];
        if (collect($pages)->contains(fn ($page) => is_array($page) && ($page['slug'] ?? '') === $slug)) {
            return back()->withErrors(['slug' => 'A custom page already uses this URL slug.']);
        }

        $pages[] = [
            'id' => (string) Str::uuid(),
            'title' => $data['title'],
            'slug' => $slug,
            'subtitle' => $data['subtitle'] ?? '',
            'body' => $data['body'],
            'published' => $request->boolean('published'),
        ];
        DB::table('settings')->updateOrInsert(['key' => 'custom_pages'], ['value' => json_encode(array_values($pages), JSON_UNESCAPED_UNICODE)]);
        return back()->with('status', 'Custom page saved.');
    }

    public function deleteCustomPage(string $slug)
    {
        $raw = DB::table('settings')->where('key', 'custom_pages')->value('value');
        $pages = $raw ? (json_decode($raw, true) ?: []) : [];
        $pages = array_values(array_filter($pages, fn ($page) => !is_array($page) || ($page['slug'] ?? '') !== $slug));
        DB::table('settings')->updateOrInsert(['key' => 'custom_pages'], ['value' => json_encode($pages, JSON_UNESCAPED_UNICODE)]);
        return back()->with('status', 'Custom page removed.');
    }

    public function updateContactInquiryStatus(Request $request, ContactInquiry $inquiry)
    {
        $data = $request->validate(['status' => 'required|in:pending,contacted']);
        $inquiry->update($data);
        return back()->with('status', 'Contact inquiry status updated.');
    }

    public function deleteContactInquiry(ContactInquiry $inquiry)
    {
        $inquiry->delete();
        return back()->with('status', 'Contact inquiry deleted.');
    }

    public function updateHeaderMenu(Request $request)
    {
        $labels = $request->input('labels', []);
        $paths = $request->input('paths', []);
        $badges = $request->input('badges', []);
        $visibles = $request->input('visibles', []);
        $menu = [];
        foreach ($labels as $idx => $label) {
            $cleanLabel = trim((string) $label);
            $cleanPath = trim((string) ($paths[$idx] ?? ''));
            if ($cleanLabel === '' || $cleanPath === '' || preg_match('/^(javascript|data|vbscript):/i', $cleanPath)) {
                continue;
            }
            $menu[] = [
                'label' => mb_substr($cleanLabel, 0, 40),
                'path' => $cleanPath,
                'badge' => trim((string) ($badges[$idx] ?? '')),
                'visible' => in_array((string) $idx, array_map('strval', $visibles), true),
            ];
        }
        DB::table('settings')->updateOrInsert(['key' => 'header_menu'], ['value' => json_encode($menu)]);
        return back()->with('status', 'Custom navigation menu updated.');
    }

    public function storeHomepageSlide(Request $request)
    {
        $data = $request->validate([
            'badge' => 'required|string|max:40',
            'title' => 'required|string|max:140',
            'subtitle' => 'nullable|string|max:200',
            'cta_text' => 'required|string|max:60',
            'course_slug' => 'required|string|max:120',
            'image_url' => 'nullable|string|max:500',
            'banner_image' => 'nullable|image|mimes:jpeg,jpg,png,webp,gif|max:5120',
        ]);

        $imagePath = $data['image_url'] ?? null;
        if ($request->hasFile('banner_image')) {
            $file = $request->file('banner_image');
            $ext = strtolower($file->extension() ?: 'jpg');
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
                $ext = 'jpg';
            }
            $dir = public_path('uploads/banners');
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            $filename = 'banner-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
            $file->move($dir, $filename);
            $imagePath = 'uploads/banners/' . $filename;
        }

        unset($data['banner_image'], $data['image_url']);
        $data['image'] = $imagePath;

        $raw = DB::table('settings')->where('key', 'homepage_slides')->value('value');
        $slides = $raw ? (json_decode($raw, true) ?? []) : [];
        array_unshift($slides, $data);
        DB::table('settings')->updateOrInsert(['key' => 'homepage_slides'], ['value' => json_encode($slides)]);
        return back()->with('status', 'Homepage Hero Slide added.');
    }

    public function deleteHomepageSlide(int $index)
    {
        $raw = DB::table('settings')->where('key', 'homepage_slides')->value('value');
        $slides = $raw ? (json_decode($raw, true) ?? []) : [];
        if (count($slides) <= 1) {
            return back()->withErrors(['slide' => 'At least one hero slide is required.']);
        }
        $removed = $slides[$index] ?? null;
        if (is_array($removed) && !empty($removed['image']) && str_starts_with($removed['image'], 'uploads/banners/')) {
            $fullPath = public_path($removed['image']);
            if (is_file($fullPath)) {
                @unlink($fullPath);
            }
        }
        array_splice($slides, $index, 1);
        DB::table('settings')->updateOrInsert(['key' => 'homepage_slides'], ['value' => json_encode(array_values($slides))]);
        return back()->with('status', 'Hero slide deleted.');
    }

    public function updateHomepageConfig(Request $request)
    {
        $data = $request->validate([
            'featured_badge' => 'required|string|max:80',
            'featured_title' => 'required|string|max:140',
            'featured_subtitle' => 'nullable|string|max:160',
            'featured_cta' => 'required|string|max:60',
            'stats_mode' => 'required|in:auto,custom',
            'stats_badge' => 'required|string|max:80',
            'stats_title' => 'required|string|max:140',
            'stats_subtitle' => 'nullable|string|max:160',
            'custom_students' => 'required|integer|min:0',
            'custom_courses' => 'required|integer|min:0',
            'custom_teachers' => 'required|integer|min:0',
            'custom_videos' => 'required|integer|min:0',
            'paths_heading' => 'required|string|max:140',
            'paths_subheading' => 'nullable|string|max:300',
        ]);
        DB::table('settings')->updateOrInsert(['key' => 'homepage_config'], ['value' => json_encode($data)]);
        return back()->with('status', 'Homepage Highlights & Statistics updated.');
    }

    public function storeReview(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'role_label' => 'required|string|max:120',
            'text' => 'required|string|max:600',
            'rating' => 'required|integer|min:1|max:5',
            'row' => 'required|in:1,2',
        ]);
        Review::create($data);
        return back()->with('status', 'Testimonial added to Homepage.');
    }

    public function updateReview(Request $request, Review $review)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'role_label' => 'required|string|max:120',
            'text' => 'required|string|max:600',
            'rating' => 'required|integer|min:1|max:5',
            'row' => 'required|in:1,2',
        ]);
        $review->update($data);
        return back()->with('status', 'Testimonial updated.');
    }

    public function deleteReview(Request $request, Review $review)
    {
        RecycleBinItem::create([
            'entity_type' => 'review',
            'original_id' => (string) $review->id,
            'label' => $review->name,
            'deleted_by' => $request->user()->name,
            'snapshot_json' => json_encode($review->toArray()),
        ]);
        $review->delete();
        return back()->with('status', 'Testimonial moved to Recycle Bin.');
    }

    public function updateReviewStatus(Request $request, Review $review)
    {
        $review->update([
            'status' => $request->input('status', $review->status),
            'featured' => $request->has('featured') ? $request->boolean('featured') : $review->featured,
        ]);
        return back()->with('status', 'Testimonial visibility updated.');
    }

    public function bulkImportQuestions(Request $request)
    {
        $data = $request->validate([
            'subject' => 'required|string|max:120',
            'chapter' => 'required|string|max:120',
            'difficulty' => 'required|in:Easy,Medium,Hard',
            'raw_text' => 'required|string',
        ]);

        $lines = array_filter(array_map('trim', explode("\n", $data['raw_text'])));
        $count = 0;
        foreach ($lines as $line) {
            $parts = array_map('trim', explode('|', $line));
            if (count($parts) < 6) {
                continue;
            }
            QuestionBankItem::create([
                'subject' => $data['subject'],
                'chapter' => $data['chapter'],
                'difficulty' => $data['difficulty'],
                'prompt' => $parts[0],
                'options' => [$parts[1], $parts[2], $parts[3], $parts[4]],
                'correct_index' => max(0, min(3, (int) $parts[5])),
                'explanation' => $parts[6] ?? 'Question Bank solution.',
                'marks' => max(1, (int) ($parts[7] ?? 1)),
            ]);
            $count++;
        }
        return back()->with('status', "Imported {$count} MCQs into Question Bank.");
    }

    public function buildExamFromBank(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:180',
            'category' => 'required|string|max:100',
            'subject' => 'nullable|string',
            'count' => 'required|integer|min:1|max:50',
            'duration_minutes' => 'required|integer|min:5|max:180',
        ]);

        $pool = QuestionBankItem::when(!empty($data['subject']), fn ($q) => $q->where('subject', $data['subject']))
            ->inRandomOrder()
            ->take($data['count'])
            ->get();

        if ($pool->isEmpty()) {
            return back()->withErrors(['exam' => 'No matching questions found in Question Bank.']);
        }

        $exam = Exam::create([
            'title' => $data['title'],
            'category' => $data['category'],
            'duration_minutes' => $data['duration_minutes'],
            'teacher_id' => $request->user()->id,
        ]);

        foreach ($pool as $qb) {
            ExamQuestion::create([
                'exam_id' => $exam->id,
                'prompt' => $qb->prompt,
                'options' => $qb->options,
                'correct_index' => $qb->correct_index,
                'explanation' => $qb->explanation,
                'marks' => $qb->marks,
            ]);
        }

        return back()->with('status', "Exam '{$exam->title}' assembled from Question Bank ({$pool->count()} MCQs).");
    }

    public function storeCoupon(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:40',
            'discount_percent' => 'required|integer|min:1|max:90',
            'applies_to' => 'required|in:all,courses,products',
            'description' => 'nullable|string|max:200',
        ]);
        Coupon::updateOrCreate(
            ['code' => strtoupper(trim($data['code']))],
            [
                'discount_percent' => $data['discount_percent'],
                'applies_to' => $data['applies_to'],
                'description' => $data['description'] ?? ($data['discount_percent'] . '% discount'),
                'active' => true,
            ]
        );
        return back()->with('status', 'Promo coupon saved.');
    }

    public function recordAttendance(Request $request)
    {
        $data = $request->validate([
            'target_id' => 'required|exists:users,id',
            'status' => 'required|in:present,absent,late,leave',
            'attendance_date' => 'required|date',
        ]);
        $target = User::findOrFail($data['target_id']);
        AttendanceRecord::updateOrCreate(
            ['target_id' => $target->id, 'attendance_date' => $data['attendance_date']],
            [
                'target_type' => $target->role === 'student' ? 'student' : 'teacher',
                'branch_id' => $target->branch_id,
                'status' => $data['status'],
                'check_in_time' => now()->format('h:i A'),
                'recorded_by' => $request->user()->name,
            ]
        );
        return back()->with('status', "Attendance marked {$data['status']} for {$target->name}.");
    }

    public function generatePayroll(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|exists:users,id',
            'month_key' => 'required|string|max:10',
            'base_salary' => 'required|integer|min:0',
            'allowances' => 'nullable|integer|min:0',
            'bonuses' => 'nullable|integer|min:0',
            'deductions' => 'nullable|integer|min:0',
            'advance' => 'nullable|integer|min:0',
        ]);

        if (PayrollRecord::where('employee_id', $data['employee_id'])->where('month_key', $data['month_key'])->exists()) {
            return back()->withErrors(['payroll' => 'Duplicate payroll guard: Salary already exists for this month.']);
        }

        $net = max(0, ($data['base_salary'] + ($data['allowances'] ?? 0) + ($data['bonuses'] ?? 0)) - (($data['deductions'] ?? 0) + ($data['advance'] ?? 0)));
        PayrollRecord::create([
            'employee_id' => $data['employee_id'],
            'month_key' => $data['month_key'],
            'base_salary' => $data['base_salary'],
            'allowances' => $data['allowances'] ?? 0,
            'bonuses' => $data['bonuses'] ?? 0,
            'deductions' => $data['deductions'] ?? 0,
            'advance' => $data['advance'] ?? 0,
            'net_salary' => $net,
            'status' => 'pending',
        ]);
        $currency = BrandSettings::all()['currency_symbol'] ?? '$';
        return back()->with('status', "Payroll generated (Net {$currency}{$net}).");
    }

    public function markPayrollPaid(PayrollRecord $payroll, Request $request)
    {
        if ($payroll->status !== 'paid') {
            $payroll->update(['status' => 'paid']);
            FinancialRecord::create([
                'type' => 'expense',
                'category' => 'Staff Payroll',
                'title' => "Salary Paid: {$payroll->employee->name} ({$payroll->month_key})",
                'amount' => $payroll->net_salary,
                'branch_id' => $payroll->employee->branch_id,
                'entry_date' => now()->toDateString(),
                'recorded_by' => $request->user()->name,
            ]);
        }
        return back()->with('status', 'Payroll marked paid & recorded in Finance ledger.');
    }

    public function createVerifiedBackup(Request $request)
    {
        $label = trim((string) $request->input('label', 'Manual Verified Snapshot'));
        $result = app(SystemUpdateService::class)->createFullBackup(
            $request->user()->name,
            $label ?: 'Manual Verified Snapshot'
        );
        return back()->with(
            'status',
            "SHA-256 verified full backup snapshot (#{$result['snapshot']->id}) created."
        );
    }

    public function restoreRecycleBin(RecycleBinItem $item)
    {
        $snap = json_decode($item->snapshot_json, true);
        if (is_array($snap)) {
            if ($item->entity_type === 'review') {
                Review::create($snap);
            } elseif ($item->entity_type === 'course') {
                Course::create($snap);
            } elseif ($item->entity_type === 'batch') {
                Batch::create($snap);
            } elseif ($item->entity_type === 'lesson') {
                Lesson::create($snap);
            } elseif ($item->entity_type === 'product') {
                Product::create($snap);
            } elseif ($item->entity_type === 'ebook') {
                Ebook::create($snap);
            } elseif ($item->entity_type === 'coupon') {
                Coupon::create($snap);
            } elseif ($item->entity_type === 'branch') {
                Branch::create($snap);
            } elseif ($item->entity_type === 'payment_gateway') {
                $gateways = $this->loadSettingJson('payment_gateways', self::defaultPaymentGateways());
                array_unshift($gateways, $snap);
                $this->saveSettingJson('payment_gateways', $gateways);
            } elseif ($item->entity_type === 'plugin') {
                $connectors = $this->loadSettingJson('api_connectors', self::defaultApiConnectors());
                array_unshift($connectors, $snap);
                $this->saveSettingJson('api_connectors', $connectors);
            }
        }
        $item->delete();
        return back()->with('status', "Restored '{$item->label}' from Recycle Bin.");
    }

    public function purgeRecycleBin(RecycleBinItem $item)
    {
        $label = $item->label;
        $item->delete();
        return back()->with('status', "Permanently purged '{$label}'.");
    }

    public function toggleLeaderboardPrivacy(Request $request)
    {
        $reward = LearnerReward::firstOrCreate(['user_id' => $request->user()->id]);
        $reward->update(['show_on_leaderboard' => !$reward->show_on_leaderboard]);
        return back()->with('status', 'Leaderboard privacy preference updated.');
    }

    public function updateBranding(Request $request)
    {
        $data = $request->validate([
            'company_name' => 'required|string|max:120',
            'tagline' => 'nullable|string|max:180',
            'support_email' => 'required|email|max:140',
            'support_phone' => 'nullable|string|max:40',
            'office_address' => 'nullable|string|max:240',
            'currency_symbol' => 'required|string|max:8',
            'roll_prefix' => 'required|string|max:12|alpha_num',
            'primary_color' => 'required|regex:/^#[0-9A-Fa-f]{6}$/',
            'accent_color' => 'required|regex:/^#[0-9A-Fa-f]{6}$/',
            'footer_text' => 'nullable|string|max:240',
            'logo_file' => 'nullable|file|mimes:png,jpg,jpeg,webp,svg|max:4096',
            'favicon_file' => 'nullable|file|mimes:png,jpg,jpeg,webp,svg,ico|max:2048',
        ]);

        $previousBrand = BrandSettings::all();
        $oldName = trim((string) ($previousBrand['company_name'] ?? ''));
        $newName = trim($data['company_name']);

        $footerInput = trim((string) ($data['footer_text'] ?? ''));
        if ($footerInput === '' || ($oldName !== '' && $oldName !== $newName && str_contains($footerInput, $oldName))) {
            $footerInput = '© ' . date('Y') . ' ' . $newName . '. All Rights Reserved.';
        }

        $payload = [
            'company_name' => $newName,
            'tagline' => $data['tagline'] ?? '',
            'support_email' => $data['support_email'],
            'support_phone' => $data['support_phone'] ?? '',
            'office_address' => $data['office_address'] ?? '',
            'currency_symbol' => $data['currency_symbol'],
            'roll_prefix' => strtoupper($data['roll_prefix']),
            'primary_color' => $data['primary_color'],
            'accent_color' => $data['accent_color'],
            'footer_text' => $footerInput,
        ];

        if ($request->hasFile('logo_file')) {
            $payload['logo_path'] = BrandSettings::storeUploadedImage($request->file('logo_file'), 'company-logo');
        }
        if ($request->hasFile('favicon_file')) {
            $payload['favicon_path'] = BrandSettings::storeUploadedImage($request->file('favicon_file'), 'company-favicon');
        }

        BrandSettings::save($payload);

        if ($oldName !== '' && $oldName !== $newName) {
            $hcRaw = DB::table('settings')->where('key', 'homepage_config')->value('value');
            $hc = $hcRaw ? json_decode($hcRaw, true) : null;
            if (is_array($hc)) {
                foreach (['featured_title', 'paths_subheading'] as $hcKey) {
                    if (!empty($hc[$hcKey]) && is_string($hc[$hcKey])) {
                        $hc[$hcKey] = str_replace($oldName, $newName, $hc[$hcKey]);
                    }
                }
                DB::table('settings')->updateOrInsert(['key' => 'homepage_config'], ['value' => json_encode($hc, JSON_UNESCAPED_UNICODE)]);
            }
        }

        return back()->with('status', "White-label branding updated for {$data['company_name']}.");
    }

    public function deleteUser(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return back()->withErrors(['user' => 'You cannot delete your own active Super Admin account.']);
        }
        $name = $user->name;
        $user->delete();
        return back()->with('status', "User '{$name}' removed.");
    }

    public function storeProduct(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:160',
            'category' => 'required|string|max:80',
            'price' => 'required|integer|min:0',
            'original_price' => 'required|integer|min:0|gte:price',
            'stock' => 'required|integer|min:0',
            'description' => 'nullable|string|max:2000',
        ]);
        Product::create($data);
        return back()->with('status', "Product '{$data['title']}' added to store.");
    }

    public function deleteProduct(Product $product)
    {
        $product->delete();
        return back()->with('status', 'Product removed.');
    }

    public function storeEbook(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:160',
            'level' => 'required|string|max:60',
            'author' => 'required|string|max:120',
            'pages_count' => 'required|integer|min:1',
            'price' => 'nullable|integer|min:0',
            'summary' => 'required|string|max:2000',
            'is_free' => 'nullable|boolean',
        ]);
        $isFree = $request->boolean('is_free') || ((int) ($data['price'] ?? 0) === 0);
        $price = $isFree ? 0 : (int) $data['price'];
        Ebook::create([
            'title' => $data['title'],
            'level' => $data['level'],
            'author' => $data['author'],
            'pages_count' => $data['pages_count'],
            'is_free' => $isFree,
            'price' => $price,
            'original_price' => $price,
            'summary' => $data['summary'],
        ]);
        return back()->with('status', "E-Book '{$data['title']}' published.");
    }

    public function deleteEbook(Ebook $ebook)
    {
        $ebook->delete();
        return back()->with('status', 'E-Book removed.');
    }

    public function storeCenterResult(Request $request)
    {
        $data = $request->validate([
            'roll_number' => 'required|string|max:60',
            'student_name' => 'required|string|max:120',
            'batch_name' => 'required|string|max:120',
            'branch_name' => 'required|string|max:120',
            'exam_name' => 'required|string|max:160',
            'mcq_score' => 'required|integer|min:0',
            'written_score' => 'required|integer|min:0',
            'grade' => 'required|string|max:30',
            'merit_position' => 'required|integer|min:1',
        ]);
        $data['roll_number'] = strtoupper(trim($data['roll_number']));
        $data['total_score'] = $data['mcq_score'] + $data['written_score'];
        CenterResult::create($data);
        return back()->with('status', "Published result for {$data['student_name']} ({$data['roll_number']}).");
    }

    public function deleteCenterResult(CenterResult $result)
    {
        $result->delete();
        return back()->with('status', 'Result record removed.');
    }

    public function issueCertificate(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'course_id' => 'nullable|exists:courses,id',
            'course_title' => 'nullable|string|max:180',
            'grade' => 'required|string|max:40',
        ]);
        $student = User::findOrFail($data['user_id']);
        $course = !empty($data['course_id']) ? Course::find($data['course_id']) : null;
        $courseTitle = trim((string) ($course?->title ?: ($data['course_title'] ?? 'Course Completion')));
        $prefix = strtoupper(BrandSettings::all()['roll_prefix'] ?? 'CERT');
        $code = $prefix . '-CERT-' . date('Y') . '-' . strtoupper(bin2hex(random_bytes(3)));

        Certificate::create([
            'certificate_code' => $code,
            'user_id' => $student->id,
            'course_id' => $course?->id,
            'student_name' => $student->name,
            'course_title' => $courseTitle,
            'grade' => $data['grade'],
            'issued_by' => BrandSettings::all()['company_name'],
            'issued_at' => now(),
            'revoked' => false,
        ]);

        return back()->with('status', "Certificate {$code} issued to {$student->name}.");
    }

    public function revokeCertificate(Certificate $certificate)
    {
        $certificate->update(['revoked' => !$certificate->revoked]);
        return back()->with('status', $certificate->revoked ? 'Certificate revoked.' : 'Certificate reinstated.');
    }

    public function storeCommunityPost(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:180',
            'category' => 'required|string|max:80',
            'content' => 'required|string|max:5000',
        ]);
        CommunityPost::create([
            'title' => $data['title'],
            'category' => $data['category'],
            'content' => $data['content'],
            'author_id' => $request->user()->id,
            'likes' => 0,
            'status' => 'published',
        ]);
        return back()->with('status', "Published community post '{$data['title']}'.");
    }

    public function deleteCommunityPost(CommunityPost $post)
    {
        $post->delete();
        return back()->with('status', 'Community post deleted.');
    }

    public function storeFinancialRecord(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:income,expense,refund',
            'category' => 'required|string|max:80',
            'title' => 'required|string|max:160',
            'amount' => 'required|integer|min:1',
            'branch_id' => 'nullable|exists:branches,id',
            'entry_date' => 'required|date',
        ]);
        FinancialRecord::create([
            ...$data,
            'recorded_by' => $request->user()->name,
        ]);
        return back()->with('status', 'Financial entry recorded in ledger.');
    }

    public function deleteCoupon(Coupon $coupon)
    {
        $coupon->delete();
        return back()->with('status', 'Coupon deleted.');
    }
}
