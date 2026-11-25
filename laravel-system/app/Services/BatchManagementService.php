<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Batch;
use App\Models\BatchActivityLog;
use App\Models\BatchAnnouncement;
use App\Models\BatchClassroom;
use App\Models\BatchNotification;
use App\Models\BatchSchedule;
use App\Models\BatchTeacher;
use App\Models\BatchTransfer;
use App\Models\BatchWaitlist;
use App\Models\Enrollment;
use App\Models\Exam;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BatchManagementService
{
    public const LIFECYCLE_STATUSES = [
        'draft',
        'upcoming',
        'enrollment_open',
        'enrollment_closed',
        'active',
        'completed',
        'cancelled',
        'archived',
    ];

    public function normalizeLifecycle(Batch $batch): string
    {
        if (!empty($batch->lifecycle_status) && in_array($batch->lifecycle_status, self::LIFECYCLE_STATUSES, true)) {
            return $batch->lifecycle_status;
        }
        return match ($batch->status) {
            'running' => 'active',
            'closed' => 'enrollment_closed',
            default => 'enrollment_open',
        };
    }

    public function toLegacyStatus(string $lifecycle): string
    {
        return match ($lifecycle) {
            'active' => 'running',
            'enrollment_closed', 'completed', 'cancelled', 'archived' => 'closed',
            default => 'open',
        };
    }

    public function dashboardAnalytics(?User $actor = null): array
    {
        $query = Batch::with(['course', 'branch', 'mainTeacher', 'assistantTeacher', 'teachers.user', 'schedules', 'classroom']);

        if ($actor && $actor->role === 'branch' && $actor->branch_id) {
            $query->where('branch_id', $actor->branch_id);
        } elseif ($actor && $actor->role === 'teacher') {
            $query->where(function ($q) use ($actor) {
                $q->where('main_teacher_id', $actor->id)
                    ->orWhere('assistant_teacher_id', $actor->id)
                    ->orWhereHas('teachers', fn ($sub) => $sub->where('user_id', $actor->id));
            });
        }

        $batches = $query->latest()->get();
        $todayShort = now()->format('D'); // Mon, Tue, Wed, Thu, Fri, Sat, Sun

        $totalBatches = $batches->count();
        $activeBatches = 0;
        $upcomingBatches = 0;
        $completedBatches = 0;
        $cancelledBatches = 0;
        $fullBatches = 0;
        $totalSeats = 0;
        $enrolledSeats = 0;
        $teacherIds = [];
        $todayClasses = 0;

        foreach ($batches as $batch) {
            $lc = $this->normalizeLifecycle($batch);
            if ($lc === 'active') {
                $activeBatches++;
            } elseif (in_array($lc, ['upcoming', 'enrollment_open'], true)) {
                $upcomingBatches++;
            } elseif ($lc === 'completed') {
                $completedBatches++;
            } elseif ($lc === 'cancelled') {
                $cancelledBatches++;
            }

            $seatLimit = max(1, (int) $batch->seat_limit);
            $usedSeats = max(0, (int) $batch->enrolled_seats);
            $totalSeats += $seatLimit;
            $enrolledSeats += $usedSeats;
            if ($usedSeats >= $seatLimit) {
                $fullBatches++;
            }

            if ($batch->main_teacher_id) {
                $teacherIds[$batch->main_teacher_id] = true;
            }
            if ($batch->assistant_teacher_id) {
                $teacherIds[$batch->assistant_teacher_id] = true;
            }
            foreach ($batch->teachers as $bt) {
                $teacherIds[$bt->user_id] = true;
            }

            foreach ($batch->schedules as $slot) {
                if ($slot->status !== 'cancelled' && strcasecmp($slot->day_of_week, $todayShort) === 0) {
                    $todayClasses++;
                }
            }
        }

        return [
            'kpis' => [
                'total_batches' => $totalBatches,
                'active_batches' => $activeBatches,
                'upcoming_batches' => $upcomingBatches,
                'completed_batches' => $completedBatches,
                'cancelled_batches' => $cancelledBatches,
                'total_enrolled_students' => $enrolledSeats,
                'available_seats' => max(0, $totalSeats - $enrolledSeats),
                'full_batches' => $fullBatches,
                'total_assigned_teachers' => count($teacherIds),
                'today_classes' => $todayClasses,
            ],
            'batches' => $batches,
            'recent_activities' => BatchActivityLog::with('batch')->latest()->take(25)->get(),
        ];
    }

    public function detectConflicts(array $schedules, ?int $excludeBatchId = null, ?int $branchId = null): array
    {
        $conflicts = [];
        if (empty($schedules)) {
            return $conflicts;
        }

        $otherSlots = BatchSchedule::with('batch')
            ->where('status', '!=', 'cancelled')
            ->when($excludeBatchId, fn ($q) => $q->where('batch_id', '!=', $excludeBatchId))
            ->get();

        foreach ($schedules as $slot) {
            $day = $slot['day_of_week'] ?? '';
            $startMin = $this->timeToMinutes((string) ($slot['start_time'] ?? ''));
            $endMin = $this->timeToMinutes((string) ($slot['end_time'] ?? ''));
            $teacherId = !empty($slot['teacher_id']) ? (int) $slot['teacher_id'] : null;
            $roomLabel = trim(strtolower((string) ($slot['room_label'] ?? '')));

            if ($startMin === null || $endMin === null || $endMin <= $startMin) {
                continue;
            }

            foreach ($otherSlots as $existing) {
                if ($existing->day_of_week !== $day) {
                    continue;
                }
                $exStart = $this->timeToMinutes($existing->start_time);
                $exEnd = $this->timeToMinutes($existing->end_time);
                if ($exStart === null || $exEnd === null || !($startMin < $exEnd && $exStart < $endMin)) {
                    continue;
                }

                if ($teacherId && ((int) $existing->teacher_id === $teacherId || (int) ($existing->batch?->main_teacher_id ?? 0) === $teacherId)) {
                    $conflicts[] = [
                        'type' => 'teacher',
                        'day_of_week' => $day,
                        'time' => "{$slot['start_time']}-{$slot['end_time']}",
                        'conflicting_batch' => $existing->batch?->name ?? "Batch #{$existing->batch_id}",
                        'message' => "Teacher conflict on {$day} ({$slot['start_time']}-{$slot['end_time']}) with {$existing->batch?->name}.",
                    ];
                }

                if ($roomLabel !== '' && trim(strtolower((string) $existing->room_label)) === $roomLabel) {
                    if ($branchId === null || !$existing->batch || (int) $existing->batch->branch_id === (int) $branchId) {
                        $conflicts[] = [
                            'type' => 'room',
                            'day_of_week' => $day,
                            'time' => "{$slot['start_time']}-{$slot['end_time']}",
                            'conflicting_batch' => $existing->batch?->name ?? "Batch #{$existing->batch_id}",
                            'message' => "Room '{$slot['room_label']}' conflict on {$day} ({$slot['start_time']}-{$slot['end_time']}) with {$existing->batch?->name}.",
                        ];
                    }
                }
            }
        }

        return $conflicts;
    }

    public function createOrUpdateEnterpriseBatch(array $payload, User $actor, ?Batch $existing = null): Batch
    {
        $schedules = $payload['schedules'] ?? [];
        $branchId = isset($payload['branch_id']) ? (int) $payload['branch_id'] : null;

        if (!empty($schedules)) {
            $conflicts = $this->detectConflicts($schedules, $existing?->id, $branchId);
            if (!empty($conflicts) && empty($payload['allow_conflict_override'])) {
                throw ValidationException::withMessages([
                    'schedules' => array_map(fn ($c) => $c['message'], $conflicts),
                ]);
            }
        }

        return DB::transaction(function () use ($payload, $actor, $existing, $schedules) {
            $lifecycle = $payload['lifecycle_status'] ?? ($existing ? $this->normalizeLifecycle($existing) : 'enrollment_open');
            $legacyStatus = $this->toLegacyStatus($lifecycle);

            $mainTeacher = !empty($payload['main_teacher_id']) ? User::find($payload['main_teacher_id']) : null;
            $batchData = [
                'course_id' => $payload['course_id'],
                'name' => trim($payload['name']),
                'code' => strtoupper(trim($payload['code'])),
                'description' => $payload['description'] ?? ($existing?->description ?? null),
                'thumbnail' => $payload['thumbnail'] ?? ($existing?->thumbnail ?? null),
                'branch_id' => $payload['branch_id'] ?? null,
                'main_teacher_id' => $payload['main_teacher_id'] ?? null,
                'assistant_teacher_id' => $payload['assistant_teacher_id'] ?? null,
                'instructor_name' => $payload['instructor_name'] ?? ($mainTeacher?->name ?? ($existing?->instructor_name ?? 'TBA')),
                'schedule' => $payload['schedule'] ?? ($existing?->schedule ?? 'TBA'),
                'class_duration_minutes' => (int) ($payload['class_duration_minutes'] ?? 90),
                'break_minutes' => (int) ($payload['break_minutes'] ?? 10),
                'weekly_frequency' => (int) ($payload['weekly_frequency'] ?? max(1, count($schedules))),
                'total_classes' => (int) ($payload['total_classes'] ?? 36),
                'start_date' => $payload['start_date'] ?? ($existing?->start_date ?? now()->toDateString()),
                'end_date' => $payload['end_date'] ?? ($existing?->end_date ?? null),
                'enrollment_start_date' => $payload['enrollment_start_date'] ?? null,
                'enrollment_closing_date' => $payload['enrollment_closing_date'] ?? null,
                'enrollment_deadline' => $payload['enrollment_deadline'] ?? null,
                'seat_limit' => (int) ($payload['seat_limit'] ?? 40),
                'min_students' => (int) ($payload['min_students'] ?? 5),
                'waitlist_enabled' => (bool) ($payload['waitlist_enabled'] ?? true),
                'online_settings' => $payload['online_settings'] ?? ($existing?->online_settings ?? []),
                'fee_settings' => $payload['fee_settings'] ?? ($existing?->fee_settings ?? []),
                'mode' => $payload['mode'] ?? ($existing?->mode ?? 'Hybrid'),
                'batch_type' => $payload['batch_type'] ?? ($existing?->batch_type ?? 'Hybrid'),
                'status' => $legacyStatus,
                'lifecycle_status' => $lifecycle,
                'archived_at' => $lifecycle === 'archived' ? now() : null,
            ];

            $batch = $existing
                ? tap($existing)->update($batchData)
                : Batch::create($batchData);

            // Sync multi-teacher assignments
            if (array_key_exists('teachers', $payload) || !empty($payload['main_teacher_id']) || !empty($payload['assistant_teacher_id'])) {
                BatchTeacher::where('batch_id', $batch->id)->delete();
                $seenUsers = [];
                if (!empty($payload['main_teacher_id'])) {
                    $uid = (int) $payload['main_teacher_id'];
                    $seenUsers[$uid] = true;
                    BatchTeacher::create([
                        'batch_id' => $batch->id,
                        'user_id' => $uid,
                        'role' => 'main',
                        'responsibility' => $payload['main_responsibility'] ?? 'Primary Instructor & Assessments',
                        'assigned_by' => $actor->name,
                    ]);
                }
                if (!empty($payload['assistant_teacher_id']) && !isset($seenUsers[(int) $payload['assistant_teacher_id']])) {
                    $uid = (int) $payload['assistant_teacher_id'];
                    $seenUsers[$uid] = true;
                    BatchTeacher::create([
                        'batch_id' => $batch->id,
                        'user_id' => $uid,
                        'role' => 'assistant',
                        'responsibility' => $payload['assistant_responsibility'] ?? 'Practice Sessions & Attendance',
                        'assigned_by' => $actor->name,
                    ]);
                }
                foreach (($payload['teachers'] ?? []) as $tRow) {
                    $uid = (int) ($tRow['user_id'] ?? 0);
                    if (!$uid || isset($seenUsers[$uid])) {
                        continue;
                    }
                    $seenUsers[$uid] = true;
                    BatchTeacher::create([
                        'batch_id' => $batch->id,
                        'user_id' => $uid,
                        'role' => in_array($tRow['role'] ?? '', ['main', 'assistant', 'co_teacher'], true) ? $tRow['role'] : 'co_teacher',
                        'responsibility' => $tRow['responsibility'] ?? 'Co-Instructor',
                        'assigned_by' => $actor->name,
                    ]);
                }
            }

            // Sync classroom
            if (!empty($payload['classroom'])) {
                $cls = $payload['classroom'];
                BatchClassroom::updateOrCreate(
                    ['batch_id' => $batch->id],
                    [
                        'classroom_name' => $cls['classroom_name'] ?? null,
                        'building' => $cls['building'] ?? null,
                        'floor' => $cls['floor'] ?? null,
                        'room_number' => $cls['room_number'] ?? null,
                    ]
                );
            }

            // Sync schedules if provided
            if (!empty($schedules)) {
                BatchSchedule::where('batch_id', $batch->id)->delete();
                foreach ($schedules as $slot) {
                    BatchSchedule::create([
                        'batch_id' => $batch->id,
                        'title' => $slot['title'] ?? 'Regular Lecture',
                        'day_of_week' => $slot['day_of_week'],
                        'start_time' => $slot['start_time'],
                        'end_time' => $slot['end_time'],
                        'duration_minutes' => (int) ($slot['duration_minutes'] ?? $batch->class_duration_minutes),
                        'break_minutes' => (int) ($slot['break_minutes'] ?? 0),
                        'teacher_id' => $slot['teacher_id'] ?? $batch->main_teacher_id,
                        'room_label' => $slot['room_label'] ?? ($payload['classroom']['room_number'] ?? null),
                        'session_date' => $slot['session_date'] ?? null,
                        'status' => $slot['status'] ?? 'scheduled',
                    ]);
                }
            }

            $this->logActivity(
                $batch,
                $actor,
                $existing ? 'batch_updated' : 'batch_created',
                $existing ? "Updated batch {$batch->code} ({$batch->name})." : "Created enterprise batch {$batch->code} ({$batch->name})."
            );

            return $batch->fresh(['course', 'branch', 'teachers.user', 'schedules', 'classroom']);
        });
    }

    public function enrollStudent(Batch $batch, User $student, User $actor, string $paymentMethod = 'Cash / Office', ?int $amountPaid = null): Enrollment
    {
        return DB::transaction(function () use ($batch, $student, $actor, $paymentMethod, $amountPaid) {
            /** @var Batch $locked */
            $locked = Batch::whereKey($batch->id)->lockForUpdate()->firstOrFail();

            $duplicate = Enrollment::where('user_id', $student->id)
                ->where('batch_id', $locked->id)
                ->where('status', '!=', 'rejected')
                ->first();
            if ($duplicate) {
                throw ValidationException::withMessages(['student_id' => "{$student->name} is already enrolled in {$locked->name}."]);
            }

            if ($locked->enrolled_seats >= $locked->seat_limit) {
                if ($locked->waitlist_enabled) {
                    $nextPriority = (int) BatchWaitlist::where('batch_id', $locked->id)->max('priority') + 1;
                    BatchWaitlist::updateOrCreate(
                        ['batch_id' => $locked->id, 'user_id' => $student->id],
                        ['course_id' => $locked->course_id, 'priority' => $nextPriority, 'status' => 'waiting', 'note' => 'Auto-waitlisted on full capacity']
                    );
                    $this->logActivity($locked, $actor, 'waitlist_added', "Added {$student->name} to waitlist (#{$nextPriority}).");
                }
                throw ValidationException::withMessages(['seat_limit' => 'Batch capacity is full. Student added to waitlist if enabled.']);
            }

            $enrollment = Enrollment::create([
                'user_id' => $student->id,
                'course_id' => $locked->course_id,
                'branch_id' => $locked->branch_id ?? $student->branch_id ?? 1,
                'batch_id' => $locked->id,
                'payment_method' => $paymentMethod,
                'amount_paid' => $amountPaid ?? ($locked->course?->price ?? 0),
                'status' => 'approved',
                'completed_lesson_ids' => [],
            ]);

            $locked->increment('enrolled_seats');
            $this->logActivity($locked, $actor, 'student_enrolled', "Enrolled {$student->name} into {$locked->code}.");

            return $enrollment;
        });
    }

    public function transferStudent(Enrollment $enrollment, Batch $targetBatch, User $actor, string $reason = 'Batch schedule adjustment'): BatchTransfer
    {
        return DB::transaction(function () use ($enrollment, $targetBatch, $actor, $reason) {
            $firstId = min((int) ($enrollment->batch_id ?? 0), (int) $targetBatch->id);
            $secondId = max((int) ($enrollment->batch_id ?? 0), (int) $targetBatch->id);

            $sourceBatch = $enrollment->batch_id ? Batch::whereKey($enrollment->batch_id)->lockForUpdate()->first() : null;
            /** @var Batch $destLocked */
            $destLocked = Batch::whereKey($targetBatch->id)->lockForUpdate()->firstOrFail();

            if ($sourceBatch && $sourceBatch->id === $destLocked->id) {
                throw ValidationException::withMessages(['target_batch_id' => 'Student is already in the selected target batch.']);
            }
            if ($destLocked->enrolled_seats >= $destLocked->seat_limit) {
                throw ValidationException::withMessages(['target_batch_id' => "Target batch {$destLocked->name} is already full."]);
            }

            $preservedAttendance = AttendanceRecord::where('target_id', $enrollment->user_id)
                ->when($sourceBatch, fn ($q) => $q->where('batch_id', $sourceBatch->id))
                ->count();
            $preservedPayments = $enrollment->amount_paid > 0 ? 1 : 0;

            $oldCourseId = $enrollment->course_id;
            $oldBatchId = $enrollment->batch_id;

            // Preserve historical attendance and payment record while switching active batch enrollment
            $enrollment->update([
                'batch_id' => $destLocked->id,
                'course_id' => $destLocked->course_id,
                'branch_id' => $destLocked->branch_id ?? $enrollment->branch_id,
            ]);

            if ($sourceBatch && $sourceBatch->enrolled_seats > 0) {
                $sourceBatch->decrement('enrolled_seats');
            }
            $destLocked->increment('enrolled_seats');

            $transfer = BatchTransfer::create([
                'enrollment_id' => $enrollment->id,
                'student_user_id' => $enrollment->user_id,
                'from_batch_id' => $oldBatchId,
                'to_batch_id' => $destLocked->id,
                'from_course_id' => $oldCourseId,
                'to_course_id' => $destLocked->course_id,
                'reason' => $reason,
                'preserved_attendance_count' => $preservedAttendance,
                'preserved_payment_count' => $preservedPayments,
                'actor_name' => $actor->name,
            ]);

            $studentName = $enrollment->user?->name ?? "Student #{$enrollment->user_id}";
            if ($sourceBatch) {
                $this->logActivity($sourceBatch, $actor, 'student_transferred_out', "Transferred {$studentName} to {$destLocked->code} (preserved {$preservedAttendance} attendance, {$preservedPayments} payment).");
            }
            $this->logActivity($destLocked, $actor, 'student_transferred_in', "Received {$studentName} from " . ($sourceBatch?->code ?? 'Unassigned') . ".");

            return $transfer;
        });
    }

    public function recordBulkAttendance(Batch $batch, string $date, array $entries, User $actor): int
    {
        $saved = 0;
        DB::transaction(function () use ($batch, $date, $entries, $actor, &$saved) {
            foreach ($entries as $row) {
                $studentId = (int) ($row['student_id'] ?? 0);
                $rawStatus = $row['status'] ?? 'present';
                if (!$studentId || !in_array($rawStatus, ['present', 'absent', 'late', 'leave', 'excused'], true)) {
                    continue;
                }
                $status = $rawStatus === 'excused' ? 'leave' : $rawStatus;
                $notes = $row['notes'] ?? null;
                if ($rawStatus === 'excused') {
                    $notes = trim('[Excused] ' . ($notes ?? ''));
                }
                AttendanceRecord::updateOrCreate(
                    ['target_id' => $studentId, 'attendance_date' => $date, 'batch_id' => $batch->id],
                    [
                        'target_type' => 'student',
                        'branch_id' => $batch->branch_id,
                        'status' => $status,
                        'check_in_time' => $row['check_in_time'] ?? now()->format('h:i A'),
                        'notes' => $notes,
                        'recorded_by' => $actor->name,
                    ]
                );
                $saved++;
            }
            $this->logActivity($batch, $actor, 'attendance_marked', "Saved bulk attendance for {$saved} students on {$date}.");
        });
        return $saved;
    }

    public function safeDeleteGuard(Batch $batch): array
    {
        $enrollmentsCount = Enrollment::where('batch_id', $batch->id)->count();
        $attendanceCount = AttendanceRecord::where('batch_id', $batch->id)->count();
        $examsCount = Exam::where('batch_id', $batch->id)->count();
        $hasDependencies = ($enrollmentsCount + $attendanceCount + $examsCount) > 0;

        return [
            'can_delete' => !$hasDependencies,
            'enrollments_count' => $enrollmentsCount,
            'attendance_count' => $attendanceCount,
            'exams_count' => $examsCount,
            'reason' => $hasDependencies
                ? "Cannot delete {$batch->code}: {$enrollmentsCount} enrollments, {$attendanceCount} attendance records, and {$examsCount} exams exist. Archive the batch instead."
                : null,
        ];
    }

    public function logActivity(Batch $batch, User $actor, string $action, string $details): BatchActivityLog
    {
        return BatchActivityLog::create([
            'batch_id' => $batch->id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'details' => $details,
        ]);
    }

    private function timeToMinutes(string $hhmm): ?int
    {
        if (!preg_match('/^(\d{1,2}):(\d{2})$/', trim($hhmm), $m)) {
            return null;
        }
        return ((int) $m[1]) * 60 + (int) $m[2];
    }
}
