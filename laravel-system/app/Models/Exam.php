<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Exam extends Model
{
    protected $fillable = ['title', 'course_id', 'category', 'duration_minutes', 'pass_percentage', 'visibility', 'teacher_id'];

    public function questions() { return $this->hasMany(ExamQuestion::class); }
}
