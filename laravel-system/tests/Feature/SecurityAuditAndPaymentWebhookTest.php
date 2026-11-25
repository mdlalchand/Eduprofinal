<?php

namespace Tests\Feature;

use App\Http\Controllers\AuthController;
use App\Models\Branch;
use App\Models\Course;
use App\Models\Ebook;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecurityAuditAndPaymentWebhookTest extends TestCase
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

    public function test_guardian_registration_requires_student_phone_or_hmac_linking_code(): void
    {
        $branch = Branch::create([
            'name' => 'Central Campus',
            'code' => 'CNT',
            'city' => 'Dhaka',
            'address' => '10 Main St',
            'status' => 'active',
        ]);

        $student = User::create([
            'name' => 'Nadia Karim',
            'email' => 'nadia@student.example',
            'phone' => '01710000088',
            'role' => 'student',
            'branch_id' => $branch->id,
            'roll_number' => 'AEC-2026-8801',
            'password' => Hash::make('StudentPass123!'),
        ]);

        // 1. Missing/wrong verification must fail and not create user or link
        $this->post(route('register.post'), [
            'name' => 'Fake Guardian',
            'email' => 'fake.guardian@example.com',
            'phone' => '01811111111',
            'role' => 'guardian',
            'branch_id' => $branch->id,
            'student_roll_link' => 'AEC-2026-8801',
            'student_verification' => '01999999999',
            'password' => 'GuardPass123!',
        ])->assertSessionHasErrors('student_verification');

        $this->assertNull(User::where('email', 'fake.guardian@example.com')->first());

        // 2. Valid HMAC linking code succeeds
        $linkCode = AuthController::guardianLinkCode($student);
        $this->post(route('register.post'), [
            'name' => 'Verified Parent',
            'email' => 'verified.parent@example.com',
            'phone' => '01822223333',
            'role' => 'guardian',
            'branch_id' => $branch->id,
            'student_roll_link' => 'AEC-2026-8801',
            'student_verification' => $linkCode,
            'password' => 'GuardPass123!',
        ])->assertRedirect(route('portal.index'));

        $guardian = User::where('email', 'verified.parent@example.com')->firstOrFail();
        $this->assertTrue(
            DB::table('guardian_student')
                ->where('guardian_id', $guardian->id)
                ->where('student_id', $student->id)
                ->exists()
        );
    }

    public function test_paid_enrollment_rejects_invalid_webhook_and_requires_signed_settlement(): void
    {
        $branch = Branch::create([
            'name' => 'Uttara Campus',
            'code' => 'UTR',
            'city' => 'Dhaka',
            'address' => 'Road 7, Sector 4',
            'status' => 'active',
        ]);
        $student = User::create([
            'name' => 'Tariq Hasan',
            'email' => 'tariq@student.example',
            'phone' => '01755551111',
            'role' => 'student',
            'branch_id' => $branch->id,
            'roll_number' => 'AEC-2026-4402',
            'password' => Hash::make('StudentPass123!'),
        ]);
        $course = Course::create([
            'slug' => 'ielts-intensive',
            'title' => 'IELTS Intensive',
            'subtitle' => 'Band 8.0 Cohort',
            'category' => 'IELTS',
            'level_tag' => 'Advanced',
            'price' => 4500,
            'original_price' => 6000,
            'description' => 'Full IELTS preparation course.',
            'status' => 'active',
        ]);

        $this->actingAs($student)->post(route('courses.enroll', $course), [
            'branch_id' => $branch->id,
            'payment_method' => 'Online Card / Gateway',
        ])->assertRedirect();

        $enrollment = Enrollment::where('user_id', $student->id)->firstOrFail();
        $this->assertSame('pending', $enrollment->status);

        $badPayload = json_encode([
            'enrollment_id' => $enrollment->id,
            'trx_id' => 'TRX-FAKE-1',
            'amount' => 4500,
            'status' => 'SUCCESS',
        ]);

        // Bad signature returns 401
        $this->call(
            'POST',
            '/payments/webhook/bkash',
            [],
            [],
            [],
            ['HTTP_X_WEBHOOK_SIGNATURE' => 'forged-signature', 'CONTENT_TYPE' => 'application/json'],
            (string) $badPayload
        )->assertStatus(401);
        $this->assertSame('pending', $enrollment->fresh()->status);

        // Valid signature but mismatched amount returns 400
        $secret = (string) (env('PAYMENT_WEBHOOK_SECRET') ?: config('app.key'));
        $mismatchPayload = json_encode([
            'enrollment_id' => $enrollment->id,
            'trx_id' => 'TRX-UNDERPAY-1',
            'amount' => 100,
            'status' => 'SUCCESS',
        ]);
        $mismatchSig = hash_hmac('sha256', (string) $mismatchPayload, $secret);
        $this->call(
            'POST',
            '/payments/webhook/bkash',
            [],
            [],
            [],
            ['HTTP_X_WEBHOOK_SIGNATURE' => $mismatchSig, 'CONTENT_TYPE' => 'application/json'],
            (string) $mismatchPayload
        )->assertStatus(400);

        // Valid signature & matching amount approves enrollment and deduplicates replays
        $goodPayload = json_encode([
            'enrollment_id' => $enrollment->id,
            'trx_id' => 'TRX-BKASH-7788',
            'amount' => 4500,
            'status' => 'SUCCESS',
        ]);
        $goodSig = hash_hmac('sha256', (string) $goodPayload, $secret);
        $this->call(
            'POST',
            '/payments/webhook/bkash',
            [],
            [],
            [],
            ['HTTP_X_WEBHOOK_SIGNATURE' => $goodSig, 'CONTENT_TYPE' => 'application/json'],
            (string) $goodPayload
        )->assertOk()->assertJson(['ok' => true, 'status' => 'approved']);

        $this->assertSame('approved', $enrollment->fresh()->status);
        $this->assertSame(1, $course->fresh()->enrolled_count);

        // Replay is deduplicated without double counting
        $this->call(
            'POST',
            '/payments/webhook/bkash',
            [],
            [],
            [],
            ['HTTP_X_WEBHOOK_SIGNATURE' => $goodSig, 'CONTENT_TYPE' => 'application/json'],
            (string) $goodPayload
        )->assertOk()->assertJson(['ok' => true, 'deduplicated' => true]);
        $this->assertSame(1, $course->fresh()->enrolled_count);

        // Paid e-book cannot be claimed without trx_id
        $paidEbook = Ebook::create([
            'title' => 'Premium IELTS Essays',
            'level' => 'IELTS',
            'author' => 'Faculty',
            'pages_count' => 110,
            'is_free' => false,
            'price' => 450,
            'original_price' => 600,
            'summary' => 'Paid guide.',
        ]);
        $this->actingAs($student)->post(route('ebooks.claim', $paidEbook))
            ->assertSessionHasErrors('ebook');
    }
}
