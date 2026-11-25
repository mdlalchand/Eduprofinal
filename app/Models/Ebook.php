<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ebook extends Model
{
    protected $fillable = ['title', 'level', 'is_free', 'price', 'original_price', 'author', 'pages_count', 'summary'];
    protected $casts = ['is_free' => 'boolean'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ebook_user')->withTimestamps();
    }
}
