<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BatchActivityLog extends Model
{
    protected $fillable = ['batch_id', 'actor_id', 'actor_name', 'actor_role', 'action', 'details'];
}
