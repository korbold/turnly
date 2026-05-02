<?php

namespace App\Infrastructure\Http\Controllers\Upload;

use App\Infrastructure\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'max:5120', 'mimes:jpg,jpeg,png,webp'],
            'folder' => ['nullable', 'string', 'in:logos,covers,gallery,services'],
        ]);

        $disk = env('R2_BUCKET') ? 'r2' : 'public';
        $folder = 'uploads/' . ($request->input('folder', 'general'));
        $path = $request->file('file')->store($folder, $disk);
        $url = Storage::disk($disk)->url($path);

        return response()->json([
            'data' => [
                'url' => $url,
                'path' => $path,
                'disk' => $disk,
            ],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }
}
