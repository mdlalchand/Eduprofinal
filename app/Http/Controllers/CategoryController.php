<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'type' => 'nullable|in:course,product,ebook',
            'image' => 'nullable|string|max:400',
        ]);

        $type = $data['type'] ?? 'course';
        $slug = Str::slug($data['name']);
        if (Category::where('slug', $slug)->exists()) {
            $slug .= '-' . rand(100, 999);
        }

        Category::create([
            'name' => trim($data['name']),
            'slug' => $slug,
            'type' => $type,
            'image' => $data['image'] ?? null,
            'active' => true,
        ]);

        return back()->with('status', "Category '{$data['name']}' created and available in Course Studio.");
    }

    public function toggle(Category $category)
    {
        $category->update(['active' => !$category->active]);
        return back()->with('status', "Category '{$category->name}' status updated.");
    }

    public function destroy(Category $category)
    {
        if ($category->type === 'course' && Course::where('category', $category->name)->exists()) {
            return back()->withErrors(['category' => "Cannot delete '{$category->name}' because existing courses use it. Deactivate instead."]);
        }
        $name = $category->name;
        $category->delete();
        return back()->with('status', "Category '{$name}' deleted.");
    }
}
