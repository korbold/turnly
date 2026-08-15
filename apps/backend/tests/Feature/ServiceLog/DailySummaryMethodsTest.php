<?php
use App\Infrastructure\Persistence\Models\{ClientResourceModel,ServiceLogModel,ServiceModel,TenantModel,TenantUserModel,UserModel};
use Illuminate\Support\Str;

// A day paid by transfer must show up in the caja tiles, not just in the
// revenue headline.
test('the daily summary breaks down transfer and other', function () {
    $tenant = TenantModel::factory()->create(['status' => 'active']);
    $user = UserModel::factory()->create();
    $service = ServiceModel::factory()->create(['tenant_id' => $tenant->id]);
    $cr = ClientResourceModel::factory()->create(['tenant_id' => $tenant->id, 'client_id' => $user->id, 'type' => 'sedan']);
    TenantUserModel::create(['id' => (string) Str::uuid(), 'tenant_id' => $tenant->id, 'user_id' => $user->id, 'role' => 'owner', 'is_active' => true]);
    app()->instance('current_tenant', $tenant);
    app()->instance('current_tenant_id', $tenant->id);

    foreach ([['transfer', 63.00], ['other', 10.00], ['cash', 5.00]] as [$method, $price]) {
        ServiceLogModel::factory()->create([
            'tenant_id' => $tenant->id, 'client_resource_id' => $cr->id, 'service_id' => $service->id,
            'attended_by' => $user->id, 'created_by' => $user->id, 'payment_method' => $method,
            'payment_status' => 'paid', 'price_charged' => $price, 'log_date' => now()->toDateString(),
        ]);
    }

    $res = $this->actingAs($user)->withHeader('X-Tenant', $tenant->slug)
        ->getJson('/api/v1/service-logs/summary?date=' . now()->toDateString());

    $res->assertOk()
        ->assertJsonPath('data.by_payment_method.transfer.total', 63)
        ->assertJsonPath('data.by_payment_method.other.total', 10)
        ->assertJsonPath('data.by_payment_method.cash.total', 5);
});
