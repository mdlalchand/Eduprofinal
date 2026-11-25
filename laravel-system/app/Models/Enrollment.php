<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Enrollment extends Model
{
    protected $fillable = ['user_id', 'course_id', 'branch_id', 'batch_id', 'payment_method', 'amount_paid', 'coupon_used', 'status', 'completed_lesson_ids'];

    protected $casts = ['completed_lesson_ids' => 'array'];

    public function user() { return $this->belongsTo(User::class); }
    public function course() { return $this->belongsTo(Course::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function batch() { return $this->belongsTo(Batch::class); }
}
