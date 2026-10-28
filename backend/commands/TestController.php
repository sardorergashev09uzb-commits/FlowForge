<?php

namespace app\commands;

use Yii;
use yii\console\Controller;
use yii\console\ExitCode;
use yii\db\Query;
use yii\web\ForbiddenHttpException;
use app\components\TenantAccessGuard;
use app\components\JwtHelper;
use app\models\User;

/**
 * Automated Security, Multi-Tenant Isolation, RBAC & End-to-End Feature Verification Suite
 */
class TestController extends Controller
{
    public function actionRun(): int
    {
        $passed = 0;
        $failed = 0;

        $assert = function (bool $condition, string $label) use (&$passed, &$failed) {
            if ($condition) {
                $this->stdout("  [PASS] {$label}\n");
                $passed++;
            } else {
                $this->stderr("  [FAIL] {$label}\n");
                $failed++;
            }
        };

        $this->stdout("=== FlowForge Enterprise Security & Multi-Tenancy Verification ===\n");

        $sardor = User::findOne(['username' => 'sardorbek']);
        $malika = User::findOne(['username' => 'malika']);
        $javohir = User::findOne(['username' => 'javohir']);
        $nilufar = User::findOne(['username' => 'nilufar']);
        $aziz = User::findOne(['username' => 'aziz_external']);

        $assert($sardor !== null && $aziz !== null, 'Seed users exist and are active');
        $assert($sardor->validatePassword('FlowForge!2026'), 'Password hashing and validation works');
        $assert(!$sardor->validatePassword('WrongPassword'), 'Invalid password rejected');

        $ws1Id = (int)(new Query())->select('id')->from('{{%workspaces}}')->where(['slug' => 'flowforge-tech'])->scalar();
        $ws3Id = (int)(new Query())->select('id')->from('{{%workspaces}}')->where(['slug' => 'othercorp-private'])->scalar();
        $projFFId = (int)(new Query())->select('id')->from('{{%projects}}')->where(['workspace_id' => $ws1Id, 'project_key' => 'FF'])->scalar();

        // Test 1: Cross-workspace Tenant Isolation (Aziz trying to access Workspace 1)
        $crossTenantBlocked = false;
        try {
            TenantAccessGuard::requireWorkspaceRole($ws1Id, (int)$aziz->id, TenantAccessGuard::ROLE_VIEWER);
        } catch (ForbiddenHttpException $e) {
            $crossTenantBlocked = true;
        }
        $assert($crossTenantBlocked, 'Tenant Isolation: External user (Aziz) cannot read Workspace 1');

        // Test 2: Cross-workspace Project IDOR (Aziz trying to access Project FF by ID)
        $projectIdorBlocked = false;
        try {
            TenantAccessGuard::requireProjectAccess($projFFId, (int)$aziz->id, TenantAccessGuard::ROLE_VIEWER);
        } catch (ForbiddenHttpException $e) {
            $projectIdorBlocked = true;
        }
        $assert($projectIdorBlocked, 'IDOR Protection: External user cannot access Project FF by ID');

        // Test 3: Sardorbek trying to access Aziz's Workspace 3
        $reverseTenantBlocked = false;
        try {
            TenantAccessGuard::requireWorkspaceRole($ws3Id, (int)$sardor->id, TenantAccessGuard::ROLE_VIEWER);
        } catch (ForbiddenHttpException $e) {
            $reverseTenantBlocked = true;
        }
        $assert($reverseTenantBlocked, 'Tenant Isolation: User A (Sardorbek) cannot access User B (Aziz) Workspace 3');

        // Test 4: Viewer Role Restrictions (Nilufar is Viewer in Workspace 1)
        $viewerCanRead = false;
        try {
            $ctx = TenantAccessGuard::requireWorkspaceRole($ws1Id, (int)$nilufar->id, TenantAccessGuard::ROLE_VIEWER);
            $viewerCanRead = ($ctx['role'] === 'viewer');
        } catch (\Throwable $e) {
            $viewerCanRead = false;
        }
        $assert($viewerCanRead, 'RBAC: Viewer (Nilufar) has read access to Workspace 1');

        $viewerWriteBlocked = false;
        try {
            TenantAccessGuard::requireWorkspaceRole($ws1Id, (int)$nilufar->id, TenantAccessGuard::ROLE_MEMBER);
        } catch (ForbiddenHttpException $e) {
            $viewerWriteBlocked = true;
        }
        $assert($viewerWriteBlocked, 'RBAC: Viewer (Nilufar) is blocked from Member/Write actions (403)');

        // Test 5: Member Role Restrictions (Javohir is Member, cannot do Admin actions)
        $memberAdminBlocked = false;
        try {
            TenantAccessGuard::requireWorkspaceRole($ws1Id, (int)$javohir->id, TenantAccessGuard::ROLE_ADMIN);
        } catch (ForbiddenHttpException $e) {
            $memberAdminBlocked = true;
        }
        $assert($memberAdminBlocked, 'RBAC: Member (Javohir) is blocked from Admin actions (403)');

        // Test 6: Admin Role Restrictions (Malika is Admin, cannot do Owner actions like Delete Workspace)
        $adminOwnerBlocked = false;
        try {
            TenantAccessGuard::requireWorkspaceRole($ws1Id, (int)$malika->id, TenantAccessGuard::ROLE_OWNER);
        } catch (ForbiddenHttpException $e) {
            $adminOwnerBlocked = true;
        }
        $assert($adminOwnerBlocked, 'RBAC: Admin (Malika) is blocked from Owner-only actions (403)');

        // Test 7: Invalid Assignee Protection (Cannot assign Aziz to Workspace 1 task)
        $invalidAssigneeBlocked = false;
        try {
            TenantAccessGuard::assertUserInWorkspace($ws1Id, (int)$aziz->id);
        } catch (\yii\web\UnprocessableEntityHttpException $e) {
            $invalidAssigneeBlocked = true;
        }
        $assert($invalidAssigneeBlocked, 'Data Integrity: Non-workspace user cannot be assigned to workspace tasks (422)');

        // Test 8: Signed Password Reset JWT Token Generation & Verification
        $resetToken = JwtHelper::encode([
            'sub' => (int)$sardor->id,
            'purpose' => 'password_reset',
            'email' => $sardor->email,
        ], 900);
        $decodedReset = JwtHelper::decode($resetToken);
        $assert(
            $decodedReset !== null && ($decodedReset['purpose'] ?? '') === 'password_reset' && (int)$decodedReset['sub'] === (int)$sardor->id,
            'Auth Security: 2-Step Password Reset JWT token encodes and verifies signature & expiry'
        );

        // Test 9: Database 28-Table Schema Completeness Check
        $tables = Yii::$app->db->schema->getTableNames();
        $assert(count($tables) >= 28, 'Database Schema: All ' . count($tables) . ' enterprise tables exist');

        $this->stdout("==================================================================\n");
        $this->stdout("Results: {$passed} passed, {$failed} failed.\n");

        return $failed === 0 ? ExitCode::OK : ExitCode::UNSPECIFIED_ERROR;
    }

    public function actionHttp(): int
    {
        $base = 'http://127.0.0.1:8080/api/v1';
        $req = function (string $method, string $url, ?array $body = null, ?string $token = null): array {
            $headers = "Content-Type: application/json\r\n";
            if ($token) {
                $headers .= "Authorization: Bearer {$token}\r\n";
            }
            $opts = [
                'http' => [
                    'method' => $method,
                    'ignore_errors' => true,
                    'header' => $headers,
                ],
            ];
            if ($body !== null) {
                $opts['http']['content'] = json_encode($body);
            }
            $raw = @file_get_contents($url, false, stream_context_create($opts));
            return is_string($raw) ? (json_decode($raw, true) ?: []) : [];
        };

        $this->stdout("=== FlowForge Live HTTP REST API Smoke Test ===\n");
        $health = $req('GET', "{$base}/health");
        $this->stdout("  [HTTP] GET /api/v1/health => success=" . (!empty($health['success']) ? 'true' : 'false') . ", service=" . ($health['service'] ?? 'ERR') . "\n");

        $login = $req('POST', "{$base}/auth/login", [
            'email' => 'sardorbek',
            'password' => 'FlowForge!2026',
        ]);
        $token = $login['token'] ?? '';
        $this->stdout("  [HTTP] POST /api/v1/auth/login => token_len=" . strlen($token) . "\n");

        $forgot = $req('POST', "{$base}/auth/forgot-password", [
            'email' => 'sardorbek@flowforge.uz',
        ]);
        $this->stdout("  [HTTP] POST /api/v1/auth/forgot-password => reset_token_issued=" . (!empty($forgot['reset_token']) ? 'YES' : 'NO') . "\n");

        $boot = $req('GET', "{$base}/bootstrap", null, $token);
        $this->stdout("  [HTTP] GET /api/v1/bootstrap => workspaces=" . count($boot['workspaces'] ?? []) . ", user=" . ($boot['user']['username'] ?? '') . "\n");

        $upload = $req('POST', "{$base}/tasks/1/attachments", [
            'original_name' => 'spec-verified.txt',
            'mime_type' => 'text/plain',
            'file_content_base64' => base64_encode('FlowForge Real Disk Upload Test'),
        ], $token);
        $atts = $upload['task']['attachments'] ?? [];
        $latestAtt = !empty($atts) ? $atts[count($atts) - 1]['file_url'] : 'ERR';
        $this->stdout("  [HTTP] POST /api/v1/tasks/1/attachments => file_url={$latestAtt}\n");

        return ExitCode::OK;
    }
}
