<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchSchedule extends Model
{
    protected $fillable = [
        'batch_id', 'title', 'day_of_week', 'start_time', 'end_time',
        'duration_minutes', 'break_minutes', 'teacher_id', 'room_label',
        'session_date', 'status', 'cancel_reason',
    ];

    public function batch() { return $this->belongsTo(Batch::class); }
    public function teacher() { return $this->belongsTo(User::class, 'teacher_id'); }
}
