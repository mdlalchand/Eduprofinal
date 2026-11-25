<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionBankItem extends Model
{
    protected $fillable = [
        'subject',
        'chapter',
        'difficulty',
        'prompt',
        'options',
        'correct_index',
        'explanation',
        'marks',
    ];

    protected $casts = [
        'options' => 'array',
        'correct_index' => 'integer',
        'marks' => 'integer',
    ];
}
