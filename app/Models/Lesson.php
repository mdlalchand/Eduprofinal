<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    protected $fillable = [
        'course_id',
        'batch_id',
        'lesson_type',
        'title',
        'module_name',
        'duration',
        'video_url',
        'lecture_sheet_url',
        'live_join_url',
        'live_status',
        'scheduled_at',
        'sheet_summary',
        'is_free_preview',
        'order_index',
    ];

    protected $casts = [
        'is_free_preview' => 'boolean',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }
}
