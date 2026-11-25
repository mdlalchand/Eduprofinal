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
            'student_verification' => 'nullable|string|max:80',
            'password' => 'required|string|min:6',
        ]);

        $linkedStudent = null;
        if ($data['role'] === 'guardian' && !empty(trim((string) ($data['student_roll_link'] ?? '')))) {
            $rollUpper = strtoupper(trim((string) $data['student_roll_link']));
            $linkedStudent = User::where('role', 'student')
                ->where('roll_number', $rollUpper)
                ->first();

            if (!$linkedStudent) {
                return back()->withInput()->withErrors([
                    'student_roll_link' => 'No matching student account was found for that roll ID.',
                ]);
            }

            $verification = trim((string) ($data['student_verification'] ?? ''));
            $normInputDigits = self::normalizePhoneDigits($verification);
            $normStudentDigits = self::normalizePhoneDigits((string) $linkedStudent->phone);
            $expectedCode = self::guardianLinkCode($linkedStudent);

            $phoneMatches = $normInputDigits !== '' && $normStudentDigits !== '' && $normInputDigits === $normStudentDigits;
            $codeMatches = $verification !== '' && hash_equals($expectedCode, strtoupper($verification));

            if (!$phoneMatches && !$codeMatches) {
                return back()->withInput()->withErrors([
                    'student_verification' => 'Guardian linking requires the student registered phone number or verified linking code.',
                ]);
            }
        }

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

        if ($linkedStudent) {
            DB::table('guardian_student')->insertOrIgnore([
                'guardian_id' => $user->id,
                'student_id' => $linkedStudent->id,
            ]);
        }

        Auth::login($user);
        $request->session()->regenerate();
        return redirect()->route('portal.index')->with('status', 'Account registered successfully.');
    }

    public static function guardianLinkCode(User $student): string
    {
        $key = (string) config('app.key', 'edupro-laravel-key');
        return 'STD-' . strtoupper(substr(hash_hmac('sha256', $student->id . '|' . $student->email, $key), 0, 6));
    }

    private static function normalizePhoneDigits(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '8801') && strlen($digits) === 13) {
            return '0' . substr($digits, 3);
        }
        return $digits;
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('home');
    }
}
