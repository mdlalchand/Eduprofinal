<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Batch;
use App\Models\Branch;
use App\Models\Course;
use App\Models\User;
use App\Services\BatchManagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BatchManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_and_room_schedule_conflict_is_detected(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $teacher = User::factory()->create(['role' => 'teacher']);
        $branch = Branch::create(['name' => 'North Campus', 'code' => 'NTH', 'city' => 'Metro', 'address' => '100 Main Ave', 'status' => 'active']);
        $course = Course::create([
            'slug' => 'applied-science',
            'title' => 'Applied Science Track',
            'subtitle' => 'Full Cohort',
            'category' => 'Core Programs',
            'level_tag' => 'Level 1',
            'price' => 2000,
            'original_price' => 3000,
            'description' => 'Comprehensive Applied Science Program',
            'status' => 'active',
        ]);

        $service = app(BatchManagementService::class);
        $service->createOrUpdateEnterpriseBatch([
            'course_id' => $course->id,
            'name' => 'Cohort Alpha',
            'code' => 'SCI-ALP-01',
            'branch_id' => $branch->id,
            'main_teacher_id' => $teacher->id,
            'seat_limit' => 30,
            'schedules' => [
                ['day_of_week' => 'Sat', 'start_time' => '16:00', 'end_time' => '17:30', 'teacher_id' => $teacher->id, 'room_label' => 'Room 301'],
            ],
        ], $admin);

        $conflicts = $service->detectConflicts([
            ['day_of_week' => 'Sat', 'start_time' => '16:30', 'end_time' => '18:00', 'teacher_id' => $teacher->id, 'room_label' => 'Room 301'],
        ], null, $branch->id);

        $this->assertCount(2, $conflicts);
    }

    public function test_student_transfer_preserves_historical_attendance_and_updates_seats(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $student = User::factory()->create(['role' => 'student']);
        $branch = Branch::create(['name' => 'West Campus', 'code' => 'WST', 'city' => 'Metro', 'address' => '250 West Blvd', 'status' => 'active']);
        $course = Course::create([
            'slug' => 'communication-pro',
            'title' => 'Communication Pro',
            'subtitle' => 'Executive Track',
            'category' => 'Professional Skills',
            'level_tag' => 'Pro',
            'price' => 4500,
            'original_price' => 6000,
            'description' => 'Communication Intensive',
            'status' => 'active',
        ]);

        $service = app(BatchManagementService::class);
        $batchA = Batch::create(['course_id' => $course->id, 'name' => 'Morning A', 'code' => 'COM-A', 'branch_id' => $branch->id, 'schedule' => 'Sat 10 AM', 'seat_limit' => 25, 'enrolled_seats' => 0, 'mode' => 'Hybrid', 'status' => 'open']);
        $batchB = Batch::create(['course_id' => $course->id, 'name' => 'Evening B', 'code' => 'COM-B', 'branch_id' => $branch->id, 'schedule' => 'Sat 6 PM', 'seat_limit' => 25, 'enrolled_seats' => 0, 'mode' => 'Hybrid', 'status' => 'open']);

        $enrollment = $service->enrollStudent($batchA, $student, $admin, 'Bank Transfer', 4500);
        $service->recordBulkAttendance($batchA, '2026-04-10', [['student_id' => $student->id, 'status' => 'present']], $admin);

        $transfer = $service->transferStudent($enrollment->fresh('user'), $batchB, $admin, 'Shift preference');

        $this->assertEquals(1, $transfer->preserved_attendance_count);
        $this->assertEquals(1, $transfer->preserved_payment_count);
        $this->assertEquals(0, $batchA->fresh()->enrolled_seats);
        $this->assertEquals(1, $batchB->fresh()->enrolled_seats);
        $this->assertEquals(1, AttendanceRecord::where('target_id', $student->id)->count());

        $guard = $service->safeDeleteGuard($batchA->fresh());
        $this->assertFalse($guard['can_delete']);
    }
}
