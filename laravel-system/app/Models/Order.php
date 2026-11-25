<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = ['user_id', 'phone', 'delivery_address', 'branch_pickup_id', 'items', 'delivery_fee', 'total_amount', 'status'];
    protected $casts = ['items' => 'array'];

    public function user() { return $this->belongsTo(User::class); }
}
