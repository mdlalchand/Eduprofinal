<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchWaitlist extends Model
{
    protected $fillable = ['batch_id', 'course_id', 'user_id', 'priority', 'status', 'note'];

    public function batch() { return $this->belongsTo(Batch::class); }
    public function user() { return $this->belongsTo(User::class); }
}
