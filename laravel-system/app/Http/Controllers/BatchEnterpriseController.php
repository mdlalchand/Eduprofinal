<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\BatchAnnouncement;
use App\Models\BatchNotification;
use App\Models\BatchSchedule;
use App\Models\BatchWaitlist;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\BatchManagementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BatchEnterpriseController extends Controller
{
    public function __construct(private readonly BatchManagementService $service)
    {
    }

    public function dashboard(Request $request)
    {
        $analytics = $this->service->dashboardAnalytics($request->user());
        return response()->json($analytics);
    }

    public function checkConflicts(Request $request)
    {
        $data = $request->validate([
            'exclude_batch_id' => 'nullable|integer',
            'branch_id' => 'nullable|integer',
            'schedules' => 'required|array',
        ]);

        $conflicts = $this->service->detectConflicts(
            $data['schedules'],
            $data['exclude_batch_id'] ?? null,
            $data['branch_id'] ?? null
        );

        return response()->json(['conflicts' => $conflicts]);
    }

    public function store(Request $request)
    {
        Gate::authorize('create', Batch::class);
        $data = $this->validateBatchPayload($request);
        $batch = $this->service->createOrUpdateEnterpriseBatch($data, $request->user());

        return $request->expectsJson()
            ? response()->json(['batch' => $batch], 201)
            : back()->with('status', "Enterprise batch '{$batch->name}' ({$batch->code}) created.");
    }

    public function update(Request $request, Batch $batch)
    {
        Gate::authorize('update', $batch);
        $data = $this->validateBatchPayload($request, $batch->id);
        $updated = $this->service->createOrUpdateEnterpriseBatch($data, $request->user(), $batch);

        return $request->expectsJson()
            ? response()->json(['batch' => $updated])
            : back()->with('status', "Enterprise batch '{$updated->name}' updated.");
    }

    public function enrollStudent(Request $request, Batch $batch)
    {
        Gate::authorize('update', $batch);
        $data = $request->validate([
            'student_id' => 'required|exists:users,id',
            'payment_method' => 'nullable|string|max:80',
            'amount_paid' => 'nullable|integer|min:0',
        ]);

        $student = User::findOrFail($data['student_id']);
        $enrollment = $this->service->enrollStudent(
            $batch,
            $student,
            $request->user(),
            $data['payment_method'] ?? 'Cash / Office',
            $data['amount_paid'] ?? null
        );

        return $request->expectsJson()
            ? response()->json(['enrollment' => $enrollment], 201)
            : back()->with('status', "Enrolled {$student->name} into {$batch->code}.");
    }

    public function transferStudent(Request $request, Batch $batch)
    {
        Gate::authorize('update', $batch);
        $data = $request->validate([
            'enrollment_id' => 'required|exists:enrollments,id',
            'target_batch_id' => 'required|exists:batches,id',
            'reason' => 'nullable|string|max:240',
        ]);

        $enrollment = Enrollment::with('user')->findOrFail($data['enrollment_id']);
        $target = Batch::findOrFail($data['target_batch_id']);
        $transfer = $this->service->transferStudent(
            $enrollment,
            $target,
            $request->user(),
            $data['reason'] ?? 'Batch schedule adjustment'
        );

        return $request->expectsJson()
            ? response()->json(['transfer' => $transfer])
            : back()->with('status', "Transferred student cleanly (preserved {$transfer->preserved_attendance_count} attendance & {$transfer->preserved_payment_count} payment records).");
    }

    public function promoteWaitlist(Request $request, Batch $batch, BatchWaitlist $waitlist)
    {
        Gate::authorize('update', $batch);
        $student = User::findOrFail($waitlist->user_id);
        $enrollment = $this->service->enrollStudent($batch, $student, $request->user());
        $waitlist->update(['status' => 'promoted']);

        return $request->expectsJson()
            ? response()->json(['enrollment' => $enrollment])
            : back()->with('status', "Promoted {$student->name} from waitlist.");
    }

    public function bulkAttendance(Request $request, Batch $batch)
    {
        Gate::authorize('manageAttendance', $batch);
        $data = $request->validate([
            'attendance_date' => 'required|date',
            'entries' => 'required|array|min:1',
        ]);

        $saved = $this->service->recordBulkAttendance($batch, $data['attendance_date'], $data['entries'], $request->user());

        return $request->expectsJson()
            ? response()->json(['saved_count' => $saved])
            : back()->with('status', "Saved attendance for {$saved} students.");
    }

    public function addAnnouncement(Request $request, Batch $batch)
    {
        Gate::authorize('manageAttendance', $batch);
        $data = $request->validate([
            'title' => 'required|string|max:160',
            'message' => 'required|string|max:2000',
            'pinned' => 'nullable|boolean',
        ]);

        $announcement = BatchAnnouncement::create([
            'batch_id' => $batch->id,
            'course_id' => $batch->course_id,
            'author_id' => $request->user()->id,
            'title' => $data['title'],
            'message' => $data['message'],
            'pinned' => $request->boolean('pinned'),
        ]);

        BatchNotification::create([
            'batch_id' => $batch->id,
            'course_id' => $batch->course_id,
            'type' => 'announcement',
            'title' => $data['title'],
            'message' => $data['message'],
            'channel' => 'in_app',
            'created_by' => $request->user()->name,
        ]);

        return $request->expectsJson()
            ? response()->json(['announcement' => $announcement], 201)
            : back()->with('status', 'Batch announcement sent to students.');
    }

    public function updateLifecycle(Request $request, Batch $batch)
    {
        Gate::authorize('update', $batch);
        $data = $request->validate([
            'lifecycle_status' => 'required|in:' . implode(',', BatchManagementService::LIFECYCLE_STATUSES),
        ]);

        $lc = $data['lifecycle_status'];
        $batch->update([
            'lifecycle_status' => $lc,
            'status' => $this->service->toLegacyStatus($lc),
            'archived_at' => $lc === 'archived' ? now() : null,
        ]);
        $this->service->logActivity($batch, $request->user(), 'lifecycle_changed', "Lifecycle changed to {$lc}.");

        return $request->expectsJson()
            ? response()->json(['batch' => $batch])
            : back()->with('status', "Batch {$batch->code} marked as {$lc}.");
    }

    public function safeDestroy(Request $request, Batch $batch)
    {
        Gate::authorize('delete', $batch);
        $guard = $this->service->safeDeleteGuard($batch);

        if (!$guard['can_delete']) {
            return $request->expectsJson()
                ? response()->json(['error' => $guard['reason'], 'guard' => $guard], 409)
                : back()->withErrors(['batch' => $guard['reason']]);
        }

        $code = $batch->code;
        BatchSchedule::where('batch_id', $batch->id)->delete();
        $batch->delete();

        return $request->expectsJson()
            ? response()->json(['deleted' => true])
            : back()->with('status', "Empty batch {$code} safely deleted.");
    }

    private function validateBatchPayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'course_id' => 'required|exists:courses,id',
            'name' => 'required|string|max:140',
            'code' => 'required|string|max:32|unique:batches,code' . ($ignoreId ? ',' . $ignoreId : ''),
            'description' => 'nullable|string|max:2000',
            'thumbnail' => 'nullable|string|max:400',
            'branch_id' => 'nullable|exists:branches,id',
            'main_teacher_id' => 'nullable|exists:users,id',
            'assistant_teacher_id' => 'nullable|exists:users,id',
            'instructor_name' => 'nullable|string|max:120',
            'schedule' => 'nullable|string|max:140',
            'class_duration_minutes' => 'nullable|integer|min:15|max:480',
            'break_minutes' => 'nullable|integer|min:0|max:120',
            'weekly_frequency' => 'nullable|integer|min:1|max:7',
            'total_classes' => 'nullable|integer|min:1|max:500',
            'start_date' => 'nullable|string|max:40',
            'end_date' => 'nullable|string|max:40',
            'enrollment_start_date' => 'nullable|string|max:40',
            'enrollment_closing_date' => 'nullable|string|max:40',
            'enrollment_deadline' => 'nullable|string|max:40',
            'seat_limit' => 'nullable|integer|min:1|max:5000',
            'min_students' => 'nullable|integer|min:1|max:500',
            'waitlist_enabled' => 'nullable|boolean',
            'online_settings' => 'nullable|array',
            'fee_settings' => 'nullable|array',
            'mode' => 'nullable|in:Online Live,Offline Branch,Hybrid',
            'batch_type' => 'nullable|in:Offline,Online,Hybrid',
            'lifecycle_status' => 'nullable|in:' . implode(',', BatchManagementService::LIFECYCLE_STATUSES),
            'teachers' => 'nullable|array',
            'classroom' => 'nullable|array',
            'schedules' => 'nullable|array',
            'allow_conflict_override' => 'nullable|boolean',
        ]);
    }
}
