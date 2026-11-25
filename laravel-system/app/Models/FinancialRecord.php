<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FinancialRecord extends Model
{
    protected $fillable = [
        'type',
        'category',
        'title',
        'amount',
        'branch_id',
        'entry_date',
        'recorded_by',
    ];
}
