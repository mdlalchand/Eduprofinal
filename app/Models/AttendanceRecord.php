<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    protected $fillable = [
        'target_type',
        'target_id',
        'branch_id',
        'batch_id',
        'attendance_date',
        'status',
        'check_in_time',
        'notes',
        'recorded_by',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'target_id');
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }
}
