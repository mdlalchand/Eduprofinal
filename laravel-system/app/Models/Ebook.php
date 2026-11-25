<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ebook extends Model
{
    protected $fillable = ['title', 'level', 'is_free', 'price', 'original_price', 'author', 'pages_count', 'summary'];
    protected $casts = ['is_free' => 'boolean'];
}
