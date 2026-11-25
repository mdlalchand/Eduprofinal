<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamQuestion extends Model
{
    protected $fillable = ['exam_id', 'prompt', 'options', 'correct_index', 'explanation', 'marks'];
    protected $casts = ['options' => 'array'];
}
