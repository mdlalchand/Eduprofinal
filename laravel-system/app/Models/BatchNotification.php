<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchNotification extends Model
{
    protected $fillable = ['batch_id', 'course_id', 'type', 'title', 'message', 'channel', 'created_by'];
}
