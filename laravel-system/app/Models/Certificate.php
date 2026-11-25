<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    protected $fillable = [
        'certificate_code',
        'user_id',
        'course_id',
        'student_name',
        'course_title',
        'grade',
        'issued_by',
        'issued_at',
        'revoked',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
        'revoked' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
