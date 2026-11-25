<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupSnapshot extends Model
{
    protected $fillable = ['label', 'reason', 'checksum_sha256', 'verified', 'created_by', 'payload_json'];

    protected $casts = ['verified' => 'boolean'];
}
