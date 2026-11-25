<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return view('profile.index', ['user' => $request->user()]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|min:2|max:120',
            'phone' => 'nullable|string|max:30',
            'education' => 'nullable|string|max:180',
            'subject_specialty' => 'nullable|string|max:120',
            'bio' => 'nullable|string|max:1000',
        ]);

        $user->update($data);

        return back()->with('status', 'Your profile has been updated.');
    }

    public function updatePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|current_password',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $request->user()->update([
            'password' => Hash::make($data['password']),
        ]);

        return back()->with('status', 'Your password has been changed successfully.');
    }
}
