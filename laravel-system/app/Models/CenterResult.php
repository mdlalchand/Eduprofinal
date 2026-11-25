<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CenterResult extends Model
{
    protected $fillable = ['roll_number', 'student_name', 'batch_name', 'branch_name', 'exam_name', 'mcq_score', 'written_score', 'total_score', 'grade', 'merit_position'];
}
