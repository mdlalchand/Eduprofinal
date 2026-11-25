<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemUpdate extends Model
{
    protected $fillable = [
        'from_version',
        'to_version',
        'package_name',
        'checksum_sha256',
        'files_updated_count',
        'migrations_applied',
        'backup_snapshot_id',
        'backup_file_path',
        'status',
        'notes',
        'applied_by',
        'applied_at',
    ];

    protected $casts = [
        'migrations_applied' => 'array',
        'applied_at' => 'datetime',
    ];

    public function backupSnapshot()
    {
        return $this->belongsTo(BackupSnapshot::class, 'backup_snapshot_id');
    }
}
