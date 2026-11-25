<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    protected $fillable = ['name', 'code', 'city', 'address', 'phone', 'manager_name', 'active_students', 'status'];
}
