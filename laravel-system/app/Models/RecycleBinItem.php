<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecycleBinItem extends Model
{
    protected $fillable = ['entity_type', 'original_id', 'label', 'deleted_by', 'snapshot_json'];
}
