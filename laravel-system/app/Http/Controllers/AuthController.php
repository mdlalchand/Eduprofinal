<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use App\Support\BrandSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function showLogin()
    {
        $branches = Branch::where('status', 'active')->get();
        return view('auth.login', compact('branches'));
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            $request->session()->regenerate();
            return redirect()->intended(route('portal.index'));
        }

        return back()->withErrors(['email' => 'Invalid email or password.'])->onlyInput('email');
    }

    public function register(Request $request)
    {
        $hasBranches = Branch::where('status', 'active')->exists();

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|max:30',
            'role' => 'required|in:student,guardian',
            'branch_id' => $hasBranches ? 'required|exists:branches,id' : 'nullable|exists:branches,id',
            'student_roll_link' => 'nullable|string|max:60',
            'password' => 'required|string|min:6',
        ]);

        $brand = BrandSettings::all();
        $prefix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($brand['roll_prefix'] ?? 'STD')) ?: 'STD');

        $rollNumber = null;
        if ($data['role'] === 'student') {
            do {
                $candidate = $prefix . '-' . date('Y') . '-' . random_int(1000, 9999);
            } while (User::where('roll_number', $candidate)->exists());
            $rollNumber = $candidate;
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'role' => $data['role'],
            'branch_id' => $data['branch_id'] ?? null,
            'roll_number' => $rollNumber,
            'password' => Hash::make($data['password']),
        ]);

        if ($data['role'] === 'guardian' && !empty($data['student_roll_link'])) {
            $student = User::where('role', 'student')
                ->where('roll_number', strtoupper(trim($data['student_roll_link'])))
                ->first();
            if ($student) {
                DB::table('guardian_student')->insertOrIgnore([
                    'guardian_id' => $user->id,
                    'student_id' => $student->id,
                ]);
            }
        }

        Auth::login($user);
        $request->session()->regenerate();
        return redirect()->route('portal.index')->with('status', 'Account registered successfully.');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('home');
    }
}
