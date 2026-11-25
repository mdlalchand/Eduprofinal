<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['title', 'category', 'price', 'original_price', 'stock', 'image', 'description'];
}
