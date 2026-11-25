<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $fillable = [
        'name',
        'role_label',
        'text',
        'rating',
        'row',
        'status',
        'featured',
        'course_tag',
        'avatar',
    ];

    protected $casts = [
        'rating' => 'integer',
        'row' => 'integer',
        'featured' => 'boolean',
    ];
}
