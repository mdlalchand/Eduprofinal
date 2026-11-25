<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommunityPost extends Model
{
    protected $fillable = ['title', 'category', 'content', 'image', 'author_id', 'likes', 'status'];

    public function author()
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
