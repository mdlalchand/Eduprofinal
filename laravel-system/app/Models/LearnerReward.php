<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LearnerReward extends Model
{
    protected $fillable = [
        'user_id',
        'xp',
        'streak_days',
        'badges',
        'show_on_leaderboard',
    ];

    protected $casts = [
        'badges' => 'array',
        'show_on_leaderboard' => 'boolean',
    ];
}
