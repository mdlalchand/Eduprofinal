<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchTransfer extends Model
{
    protected $fillable = [
        'enrollment_id', 'student_user_id', 'from_batch_id', 'to_batch_id',
        'from_course_id', 'to_course_id', 'reason',
        'preserved_attendance_count', 'preserved_payment_count', 'actor_name',
    ];
}
