<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Category;
use App\Models\CenterResult;
use App\Models\Certificate;
use App\Models\CommunityPost;
use App\Models\Course;
use App\Models\Ebook;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\Lesson;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Support\BrandSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FullLmsWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private string $lockPath;
    private ?string $originalLock = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->lockPath = storage_path('installed.lock');
        if (is_file($this->lockPath)) {
            $this->originalLock = file_get_contents($this->lockPath) ?: '';
        }
        file_put_contents($this->lockPath, json_encode(['installed' => true]));
    }

    protected function tearDown(): void
    {
        if ($this->originalLock !== null) {
            file_put_contents($this->lockPath, $this->originalLock);
        } else {
            @unlink($this->lockPath);
        }
        parent::tearDown();
    }

    public function test_end_to_end_admin_and_student_lms_commerce_exam_and_certificate_lifecycle(): void
    {
        $admin = User::create([
            'name' => 'Platform Owner',
            'email' => 'owner@northstar.example',
            'role' => 'admin',
            'password' => Hash::make('AdminPass123!'),
        ]);

        // 1. Admin configures white-label branding without touching code
        $this->actingAs($admin)->post(route('portal.branding.update'), [
            'company_name' => 'Northstar Learning Co',
            'tagline' => 'Modern Digital Mastery',
            'support_email' => 'care@northstar.example',
            'support_phone' => '+1-800-555-1212',
            'office_address' => '742 Evergreen Plaza',
            'currency_symbol' => '$',
            'roll_prefix' => 'NST',
            'primary_color' => '#062436',
            'accent_color' => '#4f46e5',
        ])->assertRedirect();

        $brand = BrandSettings::all();
        $this->assertSame('Northstar Learning Co', $brand['company_name']);
        $this->assertSame('NST', $brand['roll_prefix']);

        // 2. Admin creates Branch, Category, Course, Batch, Lesson, Exam, Product, E-Book, Community Post
        $this->actingAs($admin)->post(route('portal.branches.store'), [
            'name' => 'Downtown Campus',
            'code' => 'DTN',
            'city' => 'Austin',
            'address' => '200 Congress Ave',
            'phone' => '+1-555-1000',
            'manager_name' => 'Jordan Lee',
            'status' => 'active',
        ])->assertRedirect();
        $branch = Branch::firstOrFail();

        $this->actingAs($admin)->post(route('portal.categories.store'), [
            'name' => 'Cloud Engineering',
            'type' => 'course',
        ])->assertRedirect();
        $this->assertDatabaseHas('categories', ['name' => 'Cloud Engineering']);

        $this->actingAs($admin)->post(route('portal.courses.store'), [
            'title' => 'Cloud Architecture Bootcamp',
            'subtitle' => 'Design resilient systems',
            'category' => 'Cloud Engineering',
            'level_tag' => 'Intermediate',
            'price' => 199,
            'original_price' => 299,
            'description' => 'Hands-on labs and live architecture reviews.',
            'status' => 'active',
        ])->assertRedirect();
        $course = Course::firstOrFail();

        $this->actingAs($admin)->post(route('portal.batches.store'), [
            'course_id' => $course->id,
            'name' => 'Cohort Spring',
            'code' => 'CLD-SPR-01',
            'branch_id' => $branch->id,
            'instructor_name' => 'Dr. Maya Lin',
            'schedule' => 'Mon & Wed 7 PM',
            'seat_limit' => 40,
            'mode' => 'Online Live',
            'status' => 'open',
        ])->assertRedirect();

        $this->actingAs($admin)->post(route('portal.lessons.store'), [
            'course_id' => $course->id,
            'lesson_type' => 'recorded',
            'title' => 'Lesson 1: Load Balancing Basics',
            'module_name' => 'Module 1',
            'duration' => '24:00',
            'video_url' => 'https://example.com/video-1.mp4',
            'is_free_preview' => true,
        ])->assertRedirect();
        $lesson = Lesson::firstOrFail();

        $this->actingAs($admin)->post(route('portal.exams.store'), [
            'title' => 'Architecture Check 1',
            'category' => 'Cloud Engineering',
            'prompt' => 'Which protocol balances HTTP Layer 7 traffic?',
            'options' => ['HTTP/HTTPS', 'ICMP', 'ARP', 'DHCP'],
            'correct_index' => 0,
        ])->assertRedirect();
        $exam = Exam::with('questions')->firstOrFail();

        $this->actingAs($admin)->post(route('portal.products.store'), [
            'title' => 'System Design Workbook',
            'category' => 'Books',
            'price' => 35,
            'original_price' => 45,
            'stock' => 10,
            'description' => 'Printed workbook with diagrams.',
        ])->assertRedirect();
        $product = Product::firstOrFail();

        $this->actingAs($admin)->post(route('portal.ebooks.store'), [
            'title' => 'Distributed Patterns Cheat Sheet',
            'level' => 'Intermediate',
            'author' => 'Northstar Faculty',
            'pages_count' => 48,
            'is_free' => true,
            'summary' => 'Quick reference handbook.',
        ])->assertRedirect();
        $ebook = Ebook::firstOrFail();

        $this->actingAs($admin)->post(route('portal.community.store'), [
            'title' => 'Welcome to Cohort Spring',
            'category' => 'Announcements',
            'content' => 'Orientation kicks off Monday at 7 PM.',
        ])->assertRedirect();
        $post = CommunityPost::firstOrFail();

        // 3. Student registers cleanly in pending status, then Main Admin approves before login
        $this->post('/logout');
        $this->post(route('register.post'), [
            'name' => 'Samira Patel',
            'email' => 'samira@student.example',
            'phone' => '+1-555-9090',
            'role' => 'student',
            'branch_id' => $branch->id,
            'password' => 'StudentPass123!',
        ])->assertRedirect(route('login', ['role' => 'student']));

        $student = User::where('email', 'samira@student.example')->firstOrFail();
        $this->assertSame('pending', $student->status);
        $this->assertStringStartsWith('NST-' . date('Y') . '-', (string) $student->roll_number);

        $this->post(route('login.post'), [
            'email' => 'samira@student.example',
            'password' => 'StudentPass123!',
            'expected_role' => 'student',
        ])->assertSessionHasErrors('email');

        $this->actingAs($admin)->post(route('portal.users.approve', $student))->assertRedirect();
        $this->assertSame('active', $student->fresh()->status);

        // 4. Student enrolls (pending until signed webhook confirms payment), completes lesson, submits exam, buys product, claims free ebook, likes community post
        $this->actingAs($student)->post(route('courses.enroll', $course), [
            'branch_id' => $branch->id,
            'payment_method' => 'Online Card / Gateway',
        ])->assertRedirect();
        $enrollment = Enrollment::where('user_id', $student->id)->where('course_id', $course->id)->firstOrFail();
        $this->assertSame('pending', $enrollment->status);

        $webhookPayload = json_encode([
            'enrollment_id' => $enrollment->id,
            'trx_id' => 'GW-TEST-9001',
            'amount' => $enrollment->amount_paid,
            'status' => 'SUCCESS',
        ]);
        $webhookSecret = (string) (env('PAYMENT_WEBHOOK_SECRET') ?: config('app.key'));
        $webhookSig = hash_hmac('sha256', (string) $webhookPayload, $webhookSecret);
        $this->call(
            'POST',
            '/payments/webhook/online',
            [],
            [],
            [],
            ['HTTP_X_WEBHOOK_SIGNATURE' => $webhookSig, 'CONTENT_TYPE' => 'application/json'],
            (string) $webhookPayload
        )->assertOk()->assertJson(['ok' => true, 'status' => 'approved']);
        $this->assertSame('approved', $enrollment->fresh()->status);

        $this->actingAs($student)->get('/learn')->assertOk()->assertSee('Load Balancing Basics');
        $this->actingAs($student)->post(route('learn.progress'), [
            'course_id' => $course->id,
            'lesson_id' => $lesson->id,
        ])->assertRedirect();
        $this->assertContains($lesson->id, $enrollment->fresh()->completed_lesson_ids);

        $questionId = $exam->questions->first()->id;
        $this->actingAs($student)->post(route('exams.submit', $exam), [
            'answers' => [$questionId => 0],
        ])->assertRedirect();
        $this->assertDatabaseHas('exam_attempts', [
            'exam_id' => $exam->id,
            'user_id' => $student->id,
            'percentage' => 100,
            'passed' => 1,
        ]);

        $this->actingAs($student)->post(route('shop.order'), [
            'product_id' => $product->id,
            'quantity' => 2,
            'phone' => '+1-555-9090',
            'delivery_address' => '12 Oak Street',
        ])->assertRedirect();
        $this->assertSame(8, $product->fresh()->stock);
        $this->assertSame(1, Order::where('user_id', $student->id)->count());

        $this->actingAs($student)->post(route('ebooks.claim', $ebook))->assertRedirect();
        $this->post(route('community.like', $post))->assertRedirect();
        $this->assertSame(1, $post->fresh()->likes);

        // 5. Admin publishes Result + Issues & Verifies Certificate
        $this->actingAs($admin)->post(route('portal.results.store'), [
            'roll_number' => $student->roll_number,
            'student_name' => $student->name,
            'batch_name' => 'Cohort Spring',
            'branch_name' => 'Downtown Campus',
            'exam_name' => 'Final Architecture Assessment',
            'mcq_score' => 45,
            'written_score' => 48,
            'grade' => 'A+',
            'merit_position' => 1,
        ])->assertRedirect();

        $this->post(route('results.lookup'), ['roll' => $student->roll_number])
            ->assertOk()
            ->assertSee('Samira Patel')
            ->assertSee('93');

        $this->actingAs($admin)->post(route('portal.certificates.store'), [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'grade' => 'Distinction',
        ])->assertRedirect();
        $cert = Certificate::firstOrFail();
        $this->assertStringStartsWith('NST-CERT-', $cert->certificate_code);
        $this->assertSame('Northstar Learning Co', $cert->issued_by);

        $this->post(route('certificates.lookup'), ['code' => $cert->certificate_code])
            ->assertOk()
            ->assertSee('VERIFIED AUTHENTIC CERTIFICATE')
            ->assertSee('Samira Patel')
            ->assertSee('Cloud Architecture Bootcamp');

        $this->actingAs($admin)->patch(route('portal.certificates.revoke', $cert))->assertRedirect();
        $this->assertTrue((bool) $cert->fresh()->revoked);
        $this->post(route('certificates.lookup'), ['code' => $cert->certificate_code])
            ->assertOk()
            ->assertSee('REVOKED CERTIFICATE');
    }
}
