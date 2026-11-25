<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchAnnouncement extends Model
{
    protected $fillable = ['batch_id', 'course_id', 'author_id', 'title', 'message', 'pinned'];
    protected $casts = ['pinned' => 'boolean'];
}
