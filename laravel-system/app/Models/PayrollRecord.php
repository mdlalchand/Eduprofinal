<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollRecord extends Model
{
    protected $fillable = [
        'employee_id',
        'month_key',
        'base_salary',
        'allowances',
        'bonuses',
        'deductions',
        'advance',
        'net_salary',
        'status',
    ];

    public function employee()
    {
        return $this->belongsTo(User::class, 'employee_id');
    }
}
