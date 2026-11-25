<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\ExamAttempt;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    public function index(Request $request)
    {
        $exams = Exam::with('questions')->latest()->get();
        $attempts = ExamAttempt::where('user_id', $request->user()->id)->with('exam')->latest()->get();
        return view('exams.index', compact('exams', 'attempts'));
    }

    public function submit(Request $request, Exam $exam)
    {
        $exam->load('questions');
        $answers = $request->input('answers', []);
        $score = 0;
        $total = 0;

        foreach ($exam->questions as $q) {
            $total += $q->marks;
            if (isset($answers[$q->id]) && (int) $answers[$q->id] === (int) $q->correct_index) {
                $score += $q->marks;
            }
        }

        $pct = $total > 0 ? (int) round(($score / $total) * 100) : 0;
        $grade = $pct >= 80 ? 'A+' : ($pct >= 70 ? 'A' : ($pct >= 60 ? 'A-' : ($pct >= 50 ? 'B' : ($pct >= 40 ? 'C' : 'F'))));

        ExamAttempt::create([
            'exam_id' => $exam->id,
            'user_id' => $request->user()->id,
            'score' => $score,
            'total_marks' => $total,
            'percentage' => $pct,
            'grade' => $grade,
            'passed' => $pct >= $exam->pass_percentage,
            'answers' => $answers,
        ]);

        return back()->with('status', "Exam submitted! Score: {$score}/{$total} ({$grade})");
    }
}
