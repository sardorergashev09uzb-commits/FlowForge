<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\BadRequestHttpException;
use yii\web\UnauthorizedHttpException;
use yii\web\UnprocessableEntityHttpException;
use app\models\User;
use app\components\JwtHelper;
use app\components\ActivityLogService;

class AuthController extends BaseApiController
{
    protected array $publicActions = ['register', 'login', 'forgot-password', 'reset-password'];

    public function actionRegister(): array
    {
        $body = $this->bodyParams();
        $this->requireFields($body, ['email', 'password', 'full_name']);

        $email = strtolower(trim((string)$body['email']));
        $fullName = trim((string)$body['full_name']);
        $password = (string)$body['password'];
        $workspaceName = trim((string)($body['workspace_name'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new UnprocessableEntityHttpException('Email manzili noto‘g‘ri formatda.');
        }

        if (strlen($password) < 8) {
            throw new UnprocessableEntityHttpException('Parol kamida 8 ta belgidan iborat bo‘lishi shart.');
        }

        $exists = (new Query())->from('{{%users}}')->where(['email' => $email])->exists();
        if ($exists) {
            throw new UnprocessableEntityHttpException('Ushbu email manzili bilan hisob allaqachon ro‘yxatdan o‘tgan.');
        }

        $baseUsername = preg_replace('/[^a-z0-9_]/', '', strtolower(explode('@', $email)[0])) ?: 'user';
        $username = $baseUsername;
        $counter = 1;
        while ((new Query())->from('{{%users}}')->where(['username' => $username])->exists()) {
            $username = $baseUsername . $counter;
            $counter++;
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $tx = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand()->insert('{{%users}}', [
                'email' => $email,
                'username' => $username,
                'password_hash' => Yii::$app->security->generatePasswordHash($password),
                'status' => 'active',
                'is_platform_admin' => false,
                'email_verified_at' => $now,
                'last_login_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            $userId = (int)Yii::$app->db->getLastInsertID();

            Yii::$app->db->createCommand()->insert('{{%user_profiles}}', [
                'user_id' => $userId,
                'full_name' => $fullName,
                'job_title' => trim((string)($body['job_title'] ?? 'Product Lead')),
                'department' => trim((string)($body['department'] ?? 'Management')),
                'timezone' => 'Asia/Tashkent',
                'locale' => 'uz',
                'theme' => 'dark',
                'ui_density' => 'comfortable',
                'availability_status' => 'available',
                'updated_at' => $now,
            ])->execute();

            // Create default notification prefs
            $events = ['task_assigned', 'mentioned', 'comment_added', 'status_changed', 'due_soon', 'blocker_resolved'];
            foreach ($events as $ev) {
                Yii::$app->db->createCommand()->insert('{{%user_notification_prefs}}', [
                    'user_id' => $userId,
                    'event_type' => $ev,
                    'in_app_enabled' => true,
                    'email_enabled' => true,
                    'telegram_enabled' => false,
                ])->execute();
            }

            // Create initial workspace if requested or default
            $wsTitle = $workspaceName ?: ($fullName . ' Workspace');
            $slugBase = preg_replace('/[^a-z0-9-]/', '-', strtolower($wsTitle));
            $slugBase = trim(preg_replace('/-+/', '-', $slugBase), '-') ?: 'workspace';
            $slug = $slugBase . '-' . substr( md5(uniqid('', true)), 0, 5 );

            Yii::$app->db->createCommand()->insert('{{%workspaces}}', [
                'name' => $wsTitle,
                'slug' => $slug,
                'description' => 'Asosiy ishchi muhit',
                'owner_id' => $userId,
                'plan_tier' => 'enterprise',
                'settings_json' => json_encode([
                    'allow_member_project_creation' => true,
                    'default_timezone' => 'Asia/Tashkent',
                    'working_days' => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $wsId = (int)Yii::$app->db->getLastInsertID();

            Yii::$app->db->createCommand()->insert('{{%workspace_members}}', [
                'workspace_id' => $wsId,
                'user_id' => $userId,
                'role' => 'owner',
                'status' => 'active',
                'title_in_workspace' => 'Workspace Owner',
                'weekly_capacity_hours' => 40,
                'joined_at' => $now,
            ])->execute();

            // Create default Space & Starter Project
            Yii::$app->db->createCommand()->insert('{{%spaces}}', [
                'workspace_id' => $wsId,
                'name' => 'Asosiy Bo‘lim (Core Space)',
                'key_code' => 'CORE',
                'description' => 'Jamoaning asosiy loyihalari',
                'color' => '#6366f1',
                'icon' => 'layers',
                'is_private' => false,
                'position' => 100,
                'created_by' => $userId,
                'created_at' => $now,
            ])->execute();
            $spaceId = (int)Yii::$app->db->getLastInsertID();

            Yii::$app->db->createCommand()->insert('{{%projects}}', [
                'workspace_id' => $wsId,
                'space_id' => $spaceId,
                'name' => 'Birinchi Loyiha',
                'project_key' => 'PRJ',
                'task_sequence' => 1,
                'description' => 'FlowForge orqali boshqarilayotgan ilk loyiha',
                'status' => 'on_track',
                'visibility' => 'workspace',
                'template_type' => 'software',
                'color' => '#6366f1',
                'icon' => 'rocket',
                'lead_user_id' => $userId,
                'created_by' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();
            $projId = (int)Yii::$app->db->getLastInsertID();

            Yii::$app->db->createCommand()->insert('{{%project_members}}', [
                'workspace_id' => $wsId,
                'project_id' => $projId,
                'user_id' => $userId,
                'project_role' => 'manager',
                'is_favorite' => true,
                'joined_at' => $now,
            ])->execute();

            $defaultStatuses = [
                ['Backlog', 'backlog', '#64748b', 100, false],
                ['Todo', 'todo', '#3b82f6', 200, true],
                ['In Progress', 'in_progress', '#f59e0b', 300, false],
                ['Review', 'review', '#a855f7', 400, false],
                ['Done', 'done', '#10b981', 500, false],
            ];
            $todoStatusId = null;
            foreach ($defaultStatuses as [$sName, $sCat, $sColor, $sPos, $sDef]) {
                Yii::$app->db->createCommand()->insert('{{%task_statuses}}', [
                    'workspace_id' => $wsId,
                    'project_id' => $projId,
                    'name' => $sName,
                    'category' => $sCat,
                    'color' => $sColor,
                    'position' => $sPos,
                    'is_default' => $sDef,
                ])->execute();
                if ($sDef) {
                    $todoStatusId = (int)Yii::$app->db->getLastInsertID();
                }
            }

            Yii::$app->db->createCommand()->insert('{{%tasks}}', [
                'workspace_id' => $wsId,
                'project_id' => $projId,
                'task_number' => 1,
                'task_key' => 'PRJ-1',
                'title' => 'FlowForge platformasi imkoniyatlari bilan tanishish',
                'description' => 'Yangi vazifalar yarating, Kanban ustunlarida suring va jamoa a’zolarini taklif qiling.',
                'status_id' => $todoStatusId,
                'priority' => 'high',
                'assignee_id' => $userId,
                'reporter_id' => $userId,
                'due_at' => gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 3),
                'estimate_minutes' => 60,
                'story_points' => 3,
                'position' => 1000,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            ActivityLogService::log($wsId, $userId, 'workspace', $wsId, 'workspace.created', "{$fullName} yangi '{$wsTitle}' workspace yaratdi.");

            $tx->commit();

            $user = User::findOne($userId);
            $sessionData = $this->issueSessionToken($user);

            return $this->ok([
                'token' => $sessionData['token'],
                'session_id' => $sessionData['session_id'],
                'user' => $user->toProfileArray(),
            ], 201);
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }
    }

    public function actionLogin(): array
    {
        $body = $this->bodyParams();
        $this->requireFields($body, ['email', 'password']);

        $login = strtolower(trim((string)$body['email']));
        $password = (string)$body['password'];

        /** @var User|null $user */
        $user = User::find()
            ->where(['email' => $login])
            ->orWhere(['username' => $login])
            ->one();

        if (!$user || !$user->validatePassword($password)) {
            throw new UnauthorizedHttpException('Email (yoki username) yoki parol noto‘g‘ri.');
        }

        if ($user->status !== 'active') {
            throw new UnauthorizedHttpException('Sizning hisobingiz vaqtincha bloklangan.');
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $user->last_login_at = $now;
        $user->save(false, ['last_login_at']);

        $sessionData = $this->issueSessionToken($user);

        return $this->ok([
            'token' => $sessionData['token'],
            'session_id' => $sessionData['session_id'],
            'user' => $user->toProfileArray(),
        ]);
    }

    public function actionLogout(): array
    {
        if (User::$currentSessionId) {
            Yii::$app->db->createCommand()->update(
                '{{%user_sessions}}',
                ['revoked_at' => gmdate('Y-m-d\TH:i:s\Z')],
                ['id' => User::$currentSessionId, 'user_id' => $this->currentUserId()]
            )->execute();
        }
        return $this->ok(['message' => 'Tizimdan muvaffaqiyatli chiqildi.']);
    }

    public function actionForgotPassword(): array
    {
        $body = $this->bodyParams();
        $this->requireFields($body, ['email']);
        $email = strtolower(trim((string)$body['email']));

        $user = User::findOne(['email' => $email, 'status' => 'active']);
        $resetToken = null;
        if ($user) {
            // Generate a short-lived signed JWT reset token (15 minutes)
            $now = time();
            $resetToken = JwtHelper::encode([
                'purpose' => 'password_reset',
                'uid' => (int)$user->id,
                'email' => $user->email,
                'iat' => $now,
                'exp' => $now + 900,
            ]);
        }

        return $this->ok([
            'message' => 'Parolni tiklash kodi yaratildi. Quyidagi shakl orqali yangi parolni o‘rnating.',
            'reset_token' => $resetToken, // Provided in dev/local environment so password reset works end-to-end without external SMTP
        ]);
    }

    public function actionResetPassword(): array
    {
        $body = $this->bodyParams();
        $this->requireFields($body, ['reset_token', 'new_password']);

        $payload = JwtHelper::decode(trim((string)$body['reset_token']));
        if (!$payload || ($payload['purpose'] ?? '') !== 'password_reset' || empty($payload['uid'])) {
            throw new UnprocessableEntityHttpException('Parolni tiklash kodi yaroqsiz yoki muddati tugagan.');
        }

        $newPassword = (string)$body['new_password'];
        if (strlen($newPassword) < 8) {
            throw new UnprocessableEntityHttpException('Yangi parol kamida 8 ta belgidan iborat bo‘lishi shart.');
        }

        $user = User::findOne(['id' => (int)$payload['uid'], 'status' => 'active']);
        if (!$user) {
            throw new UnprocessableEntityHttpException('Foydalanuvchi topilmadi.');
        }

        $user->setPassword($newPassword);
        $user->updated_at = gmdate('Y-m-d\TH:i:s\Z');
        $user->save(false);

        // Revoke old sessions on password reset for security
        Yii::$app->db->createCommand()->update(
            '{{%user_sessions}}',
            ['revoked_at' => gmdate('Y-m-d\TH:i:s\Z')],
            ['user_id' => $user->id, 'revoked_at' => null]
        )->execute();

        return $this->ok([
            'message' => 'Parolingiz muvaffaqiyatli yangilandi! Endi yangi parol bilan tizimga kirishingiz mumkin.',
        ]);
    }

    public function actionMe(): array
    {
        return $this->ok([
            'user' => $this->currentUser()->toProfileArray(),
            'current_session_id' => User::$currentSessionId,
        ]);
    }

    private function issueSessionToken(User $user): array
    {
        $jti = bin2hex(random_bytes(24));
        $tokenHash = hash('sha256', $jti);
        $now = time();
        $ttl = (int)(Yii::$app->params['jwtAccessTtl'] ?? 604800);

        $ua = Yii::$app->request->userAgent ?: 'Unknown Browser';
        $deviceName = $this->parseDeviceName($ua);

        Yii::$app->db->createCommand()->insert('{{%user_sessions}}', [
            'user_id' => $user->id,
            'token_hash' => $tokenHash,
            'ip_address' => Yii::$app->request->userIP ?: '127.0.0.1',
            'user_agent' => substr($ua, 0, 490),
            'device_name' => $deviceName,
            'last_active_at' => gmdate('Y-m-d\TH:i:s\Z', $now),
            'expires_at' => gmdate('Y-m-d\TH:i:s\Z', $now + $ttl),
            'created_at' => gmdate('Y-m-d\TH:i:s\Z', $now),
        ])->execute();

        $sessionId = (int)Yii::$app->db->getLastInsertID();

        $jwt = JwtHelper::encode([
            'uid' => (int)$user->id,
            'sid' => $sessionId,
            'jti' => $jti,
            'iat' => $now,
            'exp' => $now + $ttl,
        ]);

        return [
            'token' => $jwt,
            'session_id' => $sessionId,
        ];
    }

    private function parseDeviceName(string $ua): string
    {
        $os = 'Desktop OS';
        if (stripos($ua, 'Windows') !== false) $os = 'Windows PC';
        elseif (stripos($ua, 'Macintosh') !== false) $os = 'MacOS';
        elseif (stripos($ua, 'iPhone') !== false) $os = 'iPhone iOS';
        elseif (stripos($ua, 'Android') !== false) $os = 'Android';
        elseif (stripos($ua, 'Linux') !== false) $os = 'Linux';

        $browser = 'Browser';
        if (stripos($ua, 'Edg/') !== false) $browser = 'Microsoft Edge';
        elseif (stripos($ua, 'Chrome/') !== false) $browser = 'Google Chrome';
        elseif (stripos($ua, 'Firefox/') !== false) $browser = 'Mozilla Firefox';
        elseif (stripos($ua, 'Safari/') !== false) $browser = 'Safari';

        return "$browser on $os";
    }
}
