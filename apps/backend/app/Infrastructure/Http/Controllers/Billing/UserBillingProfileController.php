<?php

declare(strict_types=1);

namespace App\Infrastructure\Http\Controllers\Billing;

use App\Domain\Identity\EcuadorIdValidator;
use App\Infrastructure\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Models\UserBillingProfileModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserBillingProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profiles = UserBillingProfileModel::where('user_id', $request->user()->id)
            ->orderByDesc('is_default')
            ->orderBy('legal_name')
            ->get();

        return response()->json([
            'data' => $profiles->map(fn ($p) => $this->present($p))->all(),
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);

        $profile = DB::transaction(function () use ($request, $data) {
            if (!empty($data['is_default'])) {
                UserBillingProfileModel::where('user_id', $request->user()->id)->update(['is_default' => false]);
            }

            return UserBillingProfileModel::create([
                ...$data,
                'user_id' => $request->user()->id,
            ]);
        });

        return response()->json(['data' => $this->present($profile)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $profile = UserBillingProfileModel::where('user_id', $request->user()->id)->findOrFail($id);
        $data = $this->validatePayload($request, $profile->id);

        DB::transaction(function () use ($request, $profile, $data) {
            if (!empty($data['is_default'])) {
                UserBillingProfileModel::where('user_id', $request->user()->id)
                    ->where('id', '!=', $profile->id)
                    ->update(['is_default' => false]);
            }
            $profile->update($data);
        });

        return response()->json(['data' => $this->present($profile->fresh())]);
    }

    public function setDefault(Request $request, string $id): JsonResponse
    {
        $profile = UserBillingProfileModel::where('user_id', $request->user()->id)->findOrFail($id);

        DB::transaction(function () use ($request, $profile) {
            UserBillingProfileModel::where('user_id', $request->user()->id)->update(['is_default' => false]);
            $profile->update(['is_default' => true]);
        });

        return response()->json(['data' => $this->present($profile->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $profile = UserBillingProfileModel::where('user_id', $request->user()->id)->findOrFail($id);
        $profile->delete();

        return response()->json([
            'data' => ['message' => 'Perfil eliminado'],
            'meta' => ['timestamp' => now()->toIso8601String()],
        ]);
    }

    private function validatePayload(Request $request, ?string $ignoreId = null): array
    {
        $data = $request->validate([
            'doc_type'   => ['required', Rule::in(['ruc', 'cedula', 'passport', 'final_consumer'])],
            'doc_number' => ['required', 'string', 'max:13'],
            'legal_name' => ['required', 'string', 'max:255'],
            'email'      => ['required', 'email', 'max:255'],
            'address'    => ['nullable', 'string', 'max:500'],
            'phone'      => ['nullable', 'string', 'max:30'],
            'is_default' => ['boolean'],
        ]);

        // Checksum validation for Ecuador's official documents.
        if ($data['doc_type'] === 'cedula' && !EcuadorIdValidator::isCedula($data['doc_number'])) {
            abort(422, 'Cédula inválida');
        }
        if ($data['doc_type'] === 'ruc' && !EcuadorIdValidator::isRuc($data['doc_number'])) {
            abort(422, 'RUC inválido');
        }
        if ($data['doc_type'] === 'final_consumer') {
            $data['doc_number'] = '9999999999999';
            if (empty($data['legal_name'])) $data['legal_name'] = 'CONSUMIDOR FINAL';
        }

        return $data;
    }

    private function present(UserBillingProfileModel $p): array
    {
        return [
            'id'         => $p->id,
            'doc_type'   => $p->doc_type,
            'doc_number' => $p->doc_number,
            'legal_name' => $p->legal_name,
            'email'      => $p->email,
            'address'    => $p->address,
            'phone'      => $p->phone,
            'is_default' => (bool) $p->is_default,
            'created_at' => $p->created_at?->toIso8601String(),
        ];
    }
}
