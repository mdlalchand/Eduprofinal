<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchClassroom extends Model
{
    protected $fillable = ['batch_id', 'classroom_name', 'building', 'floor', 'room_number'];

    public function batch() { return $this->belongsTo(Batch::class); }
}
