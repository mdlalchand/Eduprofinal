<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Batch extends Model
{
    protected $fillable = [
        'course_id',
        'name',
        'code',
        'description',
        'thumbnail',
        'branch_id',
        'main_teacher_id',
        'assistant_teacher_id',
        'instructor_name',
        'schedule',
        'class_duration_minutes',
        'break_minutes',
        'weekly_frequency',
        'total_classes',
        'start_date',
        'end_date',
        'enrollment_start_date',
        'enrollment_closing_date',
        'enrollment_deadline',
        'seat_limit',
        'min_students',
        'enrolled_seats',
        'waitlist_enabled',
        'online_settings',
        'fee_settings',
        'mode',
        'batch_type',
        'status',
        'lifecycle_status',
        'archived_at',
    ];

    protected $casts = [
        'waitlist_enabled' => 'boolean',
        'online_settings' => 'array',
        'fee_settings' => 'array',
        'archived_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function mainTeacher()
    {
        return $this->belongsTo(User::class, 'main_teacher_id');
    }

    public function assistantTeacher()
    {
        return $this->belongsTo(User::class, 'assistant_teacher_id');
    }

    public function teachers()
    {
        return $this->hasMany(BatchTeacher::class);
    }

    public function schedules()
    {
        return $this->hasMany(BatchSchedule::class);
    }

    public function classroom()
    {
        return $this->hasOne(BatchClassroom::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function waitlists()
    {
        return $this->hasMany(BatchWaitlist::class)->orderBy('priority');
    }

    public function announcements()
    {
        return $this->hasMany(BatchAnnouncement::class)->latest();
    }

    public function activityLogs()
    {
        return $this->hasMany(BatchActivityLog::class)->latest();
    }

    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('order_index');
    }
}
