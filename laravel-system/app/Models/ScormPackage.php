<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScormPackage extends Model
{
    protected $fillable = [
        'course_id',
        'title',
        'identifier',
        'launch_file',
        'manifest_xml',
        'html_content',
        'xp_reward',
    ];
}
