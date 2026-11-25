<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactInquiry extends Model
{
    protected $fillable = ['name', 'email', 'phone', 'branch_id', 'message', 'status'];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }
}
