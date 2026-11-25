<?php

namespace App\Policies;

use App\Models\Batch;
use App\Models\BatchTeacher;
use App\Models\Enrollment;
use App\Models\User;

class BatchPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'branch', 'teacher', 'student'], true);
    }

    public function view(User $user, Batch $batch): bool
    {
        if ($user->role === 'admin') {
            return true;
        }
        if ($user->role === 'branch') {
            return !$user->branch_id || (int) $batch->branch_id === (int) $user->branch_id;
        }
        if ($user->role === 'teacher') {
            return (int) $batch->main_teacher_id === (int) $user->id
                || (int) $batch->assistant_teacher_id === (int) $user->id
                || BatchTeacher::where('batch_id', $batch->id)->where('user_id', $user->id)->exists();
        }
        if ($user->role === 'student') {
            return Enrollment::where('batch_id', $batch->id)
                ->where('user_id', $user->id)
                ->where('status', 'approved')
                ->exists();
        }
        return false;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'branch'], true);
    }

    public function update(User $user, Batch $batch): bool
    {
        if ($user->role === 'admin') {
            return true;
        }
        if ($user->role === 'branch') {
            return !$user->branch_id || (int) $batch->branch_id === (int) $user->branch_id;
        }
        return false;
    }

    public function manageAttendance(User $user, Batch $batch): bool
    {
        if ($user->role === 'admin' || $user->role === 'branch') {
            return $this->update($user, $batch);
        }
        return $user->role === 'teacher' && $this->view($user, $batch);
    }

    public function delete(User $user, Batch $batch): bool
    {
        return $user->role === 'admin';
    }
}
