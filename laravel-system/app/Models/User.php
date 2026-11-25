<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'phone', 'role', 'branch_id', 'roll_number', 'password',
    ];

    protected $hidden = ['password', 'remember_token'];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function enrollments()
    {
        return $this->hasMany(Enrollment::class);
    }

    public function examAttempts()
    {
        return $this->hasMany(ExamAttempt::class);
    }

    public function certificates()
    {
        return $this->hasMany(Certificate::class);
    }

    public function linkedStudents()
    {
        return $this->belongsToMany(User::class, 'guardian_student', 'guardian_id', 'student_id');
    }
}
