<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchTeacher extends Model
{
    protected $fillable = ['batch_id', 'user_id', 'role', 'responsibility', 'assigned_by'];

    public function batch() { return $this->belongsTo(Batch::class); }
    public function user() { return $this->belongsTo(User::class); }
}
