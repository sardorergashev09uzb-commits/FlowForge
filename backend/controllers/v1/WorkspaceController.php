<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\UnprocessableEntityHttpException;
use app\components\TenantAccessGuard;
use app\components\ActivityLogService;
use app\components\NotificationService;

class WorkspaceController extends BaseApiController
{
    public function actionIndex(): array
    {
        $userId = $this->currentUserId();
        $rows = (new Query())
            ->select(['w.*', 'wm.role AS my_role', 'wm.joined_at'])
            ->from(['w' => '{{%workspaces}}'])
            ->innerJoin(['wm' => '{{%workspace_members}}'], 'wm.workspace_id = w.id')
            ->where(['wm.user_id' => $userId, 'wm.status' => 'active'])
            ->orderBy(['w.id' => SORT_ASC])
            ->all();

        return $this->ok([
            'workspaces' => array_map([$this, 'formatWorkspace'], $rows),
        ]);
    }

    public function actionCreate(): array
    {
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $userId = $this->currentUserId();
        $name = trim((string)$body['name']);
        $slugInput = trim((string)($body['slug'] ?? $name));
        $slugBase = preg_replace('/[^a-z0-9-]/', '-', strtolower($slugInput));
        $slugBase = trim(preg_replace('/-+/', '-', $slugBase), '-') ?: 'workspace';
        $slug = $slugBase;
        if ((new Query())->from('{{%workspaces}}')->where(['slug' => $slug])->exists()) {
            $slug = $slugBase . '-' . substr(md5(uniqid('', true)), 0, 4);
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $tx = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand()->insert('{{%workspaces}}', [
                'name' => $name,
                'slug' => $slug,
                'description' => trim((string)($body['description'] ?? '')),
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
                'title_in_workspace' => 'Founder & Owner',
                'weekly_capacity_hours' => 40,
                'joined_at' => $now,
            ])->execute();

            // Create default Space
            Yii::$app->db->createCommand()->insert('{{%spaces}}', [
                'workspace_id' => $wsId,
                'name' => 'Engineering & Product',
                'key_code' => 'ENG',
                'description' => 'Asosiy ishchi bo‘lim',
                'color' => '#6366f1',
                'icon' => 'layers',
                'is_private' => false,
                'position' => 100,
                'created_by' => $userId,
                'created_at' => $now,
            ])->execute();

            // Default labels
            $defaultLabels = [
                ['Feature', '#6366f1'],
                ['Bug', '#ef4444'],
                ['Security', '#f59e0b'],
                ['UX / UI', '#ec4899'],
                ['Backend', '#10b981'],
            ];
            foreach ($defaultLabels as [$lName, $lColor]) {
                Yii::$app->db->createCommand()->insert('{{%labels}}', [
                    'workspace_id' => $wsId,
                    'name' => $lName,
                    'color' => $lColor,
                ])->execute();
            }

            ActivityLogService::log($wsId, $userId, 'workspace', $wsId, 'workspace.created', "Yangi workspace '{$name}' yaratildi.");
            $tx->commit();

            $ws = (new Query())->from('{{%workspaces}}')->where(['id' => $wsId])->one();
            $ws['my_role'] = 'owner';
            return $this->ok(['workspace' => $this->formatWorkspace($ws)], 201);
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }
    }

    public function actionView(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);
        $ws = $ctx['workspace'];
        $ws['my_role'] = $ctx['role'];

        return $this->ok([
            'workspace' => $this->formatWorkspace($ws),
        ]);
    }

    public function actionUpdate(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_ADMIN);
        $body = $this->bodyParams();

        $updates = ['updated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        if (isset($body['name']) && trim((string)$body['name']) !== '') {
            $updates['name'] = trim((string)$body['name']);
        }
        if (array_key_exists('description', $body)) {
            $updates['description'] = trim((string)$body['description']);
        }
        if (array_key_exists('logo_url', $body)) {
            $updates['logo_url'] = $body['logo_url'];
        }
        if (isset($body['slug']) && trim((string)$body['slug']) !== '') {
            $slug = preg_replace('/[^a-z0-9-]/', '-', strtolower(trim((string)$body['slug'])));
            $taken = (new Query())->from('{{%workspaces}}')->where(['slug' => $slug])->andWhere(['<>', 'id', $id])->exists();
            if ($taken) {
                throw new UnprocessableEntityHttpException('Ushbu workspace slug band.');
            }
            $updates['slug'] = $slug;
        }
        if (isset($body['settings']) && is_array($body['settings'])) {
            $currentSettings = $ctx['workspace']['settings_json'] ? json_decode($ctx['workspace']['settings_json'], true) : [];
            $updates['settings_json'] = json_encode(array_merge($currentSettings, $body['settings']));
        }

        Yii::$app->db->createCommand()->update('{{%workspaces}}', $updates, ['id' => $id])->execute();
        ActivityLogService::log($id, $userId, 'workspace', $id, 'workspace.updated', 'Workspace sozlamalari yangilandi.');

        return $this->actionView($id);
    }

    public function actionDelete(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_OWNER);

        // Delete workspace and memberships
        Yii::$app->db->createCommand()->delete('{{%workspace_members}}', ['workspace_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%workspaces}}', ['id' => $id])->execute();

        return $this->ok(['message' => 'Workspace o‘chirildi.']);
    }

    public function actionTransferOwnership(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_OWNER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['new_owner_user_id']);

        $newOwnerId = (int)$body['new_owner_user_id'];
        if ($newOwnerId === $userId) {
            throw new UnprocessableEntityHttpException('Siz allaqachon ushbu workspace egasisiz.');
        }

        TenantAccessGuard::assertUserInWorkspace($id, $newOwnerId);

        $tx = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand()->update('{{%workspaces}}', [
                'owner_id' => $newOwnerId,
                'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ], ['id' => $id])->execute();

            Yii::$app->db->createCommand()->update('{{%workspace_members}}', [
                'role' => 'admin',
            ], ['workspace_id' => $id, 'user_id' => $userId])->execute();

            Yii::$app->db->createCommand()->update('{{%workspace_members}}', [
                'role' => 'owner',
            ], ['workspace_id' => $id, 'user_id' => $newOwnerId])->execute();

            ActivityLogService::log($id, $userId, 'workspace', $id, 'workspace.ownership_transferred', "Workspace egaligi foydalanuvchi #{$newOwnerId} ga topshirildi.");
            $tx->commit();
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }

        return $this->actionView($id);
    }

    public function actionMembers(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $rows = (new Query())
            ->select([
                'wm.id AS membership_id',
                'wm.user_id',
                'wm.role',
                'wm.status',
                'wm.title_in_workspace',
                'wm.weekly_capacity_hours',
                'wm.joined_at',
                'u.email',
                'u.username',
                'u.last_login_at',
                'p.full_name',
                'p.job_title',
                'p.department',
                'p.avatar_url',
                'p.availability_status',
                'p.availability_note',
            ])
            ->from(['wm' => '{{%workspace_members}}'])
            ->innerJoin(['u' => '{{%users}}'], 'u.id = wm.user_id')
            ->leftJoin(['p' => '{{%user_profiles}}'], 'p.user_id = u.id')
            ->where(['wm.workspace_id' => $id])
            ->orderBy(['wm.id' => SORT_ASC])
            ->all();

        $members = array_map(function ($r) {
            return [
                'membership_id' => (int)$r['membership_id'],
                'user_id' => (int)$r['user_id'],
                'role' => $r['role'],
                'status' => $r['status'],
                'title_in_workspace' => $r['title_in_workspace'] ?: $r['job_title'] ?: 'Member',
                'weekly_capacity_hours' => (int)$r['weekly_capacity_hours'],
                'joined_at' => $r['joined_at'],
                'email' => $r['email'],
                'username' => $r['username'],
                'full_name' => $r['full_name'] ?: $r['username'],
                'job_title' => $r['job_title'],
                'department' => $r['department'],
                'avatar_url' => $r['avatar_url'],
                'availability_status' => $r['availability_status'] ?: 'available',
                'availability_note' => $r['availability_note'],
                'last_login_at' => $r['last_login_at'],
            ];
        }, $rows);

        return $this->ok(['members' => $members]);
    }

    public function actionUpdateMember(int $id, int $memberId): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $body = $this->bodyParams();

        $target = (new Query())
            ->from('{{%workspace_members}}')
            ->where(['workspace_id' => $id, 'user_id' => $memberId])
            ->one();

        if (!$target) {
            throw new NotFoundHttpException('A’zo topilmadi.');
        }

        if ($target['role'] === 'owner' && $ctx['role'] !== 'owner') {
            throw new ForbiddenHttpException('Admin workspace egasining rolini yoki holatini o‘zgartira olmaydi.');
        }

        $updates = [];
        if (isset($body['role'])) {
            $newRole = (string)$body['role'];
            if (!in_array($newRole, ['admin', 'member', 'viewer'], true)) {
                throw new UnprocessableEntityHttpException('Rol faqat admin, member yoki viewer bo‘lishi mumkin. Egalikni topshirish uchun transfer-ownership endpointidan foydalaning.');
            }
            if ($target['role'] === 'owner') {
                throw new UnprocessableEntityHttpException('Workspace egasining rolini pasaytirib bo‘lmaydi. Avval egalikni boshqa a’zoga topshiring.');
            }
            $updates['role'] = $newRole;
        }

        if (isset($body['status']) && in_array($body['status'], ['active', 'deactivated'], true)) {
            if ($target['role'] === 'owner' && $body['status'] === 'deactivated') {
                throw new UnprocessableEntityHttpException('Workspace egasini deaktivatsiya qilib bo‘lmaydi.');
            }
            $updates['status'] = $body['status'];
        }

        if (array_key_exists('title_in_workspace', $body)) {
            $updates['title_in_workspace'] = trim((string)$body['title_in_workspace']);
        }
        if (isset($body['weekly_capacity_hours'])) {
            $updates['weekly_capacity_hours'] = max(1, min(100, (int)$body['weekly_capacity_hours']));
        }

        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%workspace_members}}', $updates, ['id' => $target['id']])->execute();
            ActivityLogService::log($id, $actorId, 'member', $memberId, 'member.updated', "A’zo #{$memberId} roli/ ma’lumotlari yangilandi.", $updates);
        }

        return $this->actionMembers($id);
    }

    public function actionRemoveMember(int $id, int $memberId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);

        $target = (new Query())
            ->from('{{%workspace_members}}')
            ->where(['workspace_id' => $id, 'user_id' => $memberId])
            ->one();

        if (!$target) {
            throw new NotFoundHttpException('A’zo topilmadi.');
        }

        if ($target['role'] === 'owner') {
            throw new ForbiddenHttpException('Workspace egasini o‘chirib bo‘lmaydi.');
        }

        Yii::$app->db->createCommand()->delete('{{%workspace_members}}', ['id' => $target['id']])->execute();
        ActivityLogService::log($id, $actorId, 'member', $memberId, 'member.removed', "A’zo #{$memberId} workspace'dan chiqarildi.");

        return $this->ok(['message' => 'A’zo workspace safidan chiqarildi.']);
    }

    public function actionInvitations(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $rows = (new Query())
            ->from('{{%workspace_invitations}}')
            ->where(['workspace_id' => $id])
            ->orderBy(['id' => SORT_DESC])
            ->all();

        return $this->ok([
            'invitations' => array_map(function ($inv) {
                return [
                    'id' => (int)$inv['id'],
                    'workspace_id' => (int)$inv['workspace_id'],
                    'email' => $inv['email'],
                    'role' => $inv['role'],
                    'invite_code' => $inv['invite_code'],
                    'invited_by' => (int)$inv['invited_by'],
                    'expires_at' => $inv['expires_at'],
                    'accepted_at' => $inv['accepted_at'],
                    'revoked_at' => $inv['revoked_at'],
                    'created_at' => $inv['created_at'],
                ];
            }, $rows),
        ]);
    }

    public function actionInvite(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $body = $this->bodyParams();
        $this->requireFields($body, ['email']);

        $email = strtolower(trim((string)$body['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new UnprocessableEntityHttpException('Email manzili noto‘g‘ri.');
        }

        $role = (string)($body['role'] ?? 'member');
        if (!in_array($role, ['admin', 'member', 'viewer'], true)) {
            throw new UnprocessableEntityHttpException('Taklif roli admin, member yoki viewer bo‘lishi kerak.');
        }

        // Check if already a member
        $existingUser = (new Query())->from('{{%users}}')->where(['email' => $email])->one();
        if ($existingUser) {
            $alreadyMember = (new Query())
                ->from('{{%workspace_members}}')
                ->where(['workspace_id' => $id, 'user_id' => $existingUser['id'], 'status' => 'active'])
                ->exists();
            if ($alreadyMember) {
                throw new UnprocessableEntityHttpException('Ushbu foydalanuvchi allaqachon workspace a’zosi.');
            }
        }

        // Prevent duplicate active invitation
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $existingInvite = (new Query())
            ->from('{{%workspace_invitations}}')
            ->where([
                'workspace_id' => $id,
                'email' => $email,
                'accepted_at' => null,
                'revoked_at' => null,
            ])
            ->andWhere(['>', 'expires_at', $now])
            ->one();

        if ($existingInvite) {
            throw new UnprocessableEntityHttpException('Ushbu emailga faol taklifnoma allaqachon yuborilgan.');
        }

        $inviteCode = 'FF-INV-' . strtoupper(bin2hex(random_bytes(5)));
        $tokenHash = hash('sha256', $inviteCode);
        $expiresAt = gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 7);

        Yii::$app->db->createCommand()->insert('{{%workspace_invitations}}', [
            'workspace_id' => $id,
            'email' => $email,
            'role' => $role,
            'token_hash' => $tokenHash,
            'invite_code' => $inviteCode,
            'invited_by' => $actorId,
            'expires_at' => $expiresAt,
            'created_at' => $now,
        ])->execute();

        $invId = (int)Yii::$app->db->getLastInsertID();

        // If user already exists on platform, also create an instant notification
        if ($existingUser) {
            Yii::$app->db->createCommand()->insert('{{%notifications}}', [
                'workspace_id' => $id,
                'recipient_id' => (int)$existingUser['id'],
                'actor_id' => $actorId,
                'type' => 'invitation',
                'title' => "{$ctx['workspace']['name']} jamoasiga taklifnoma",
                'body' => "Siz {$role} sifatida taklif qilindingiz. Kod: {$inviteCode}",
                'entity_type' => 'workspace',
                'entity_id' => $id,
                'created_at' => $now,
            ])->execute();
        }

        ActivityLogService::log($id, $actorId, 'invitation', $invId, 'member.invited', "{$email} manzili ({$role}) sifatida taklif qilindi.");

        return $this->actionInvitations($id);
    }

    public function actionRevokeInvitation(int $id, int $invId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);

        Yii::$app->db->createCommand()->update(
            '{{%workspace_invitations}}',
            ['revoked_at' => gmdate('Y-m-d\TH:i:s\Z')],
            ['id' => $invId, 'workspace_id' => $id]
        )->execute();

        ActivityLogService::log($id, $actorId, 'invitation', $invId, 'invitation.revoked', "Taklifnoma #{$invId} bekor qilindi.");
        return $this->actionInvitations($id);
    }

    public function actionAcceptInvitation(): array
    {
        $user = $this->currentUser();
        $body = $this->bodyParams();
        $this->requireFields($body, ['invite_code']);

        $code = trim((string)$body['invite_code']);
        $tokenHash = hash('sha256', $code);

        $inv = (new Query())
            ->from('{{%workspace_invitations}}')
            ->where(['token_hash' => $tokenHash])
            ->orWhere(['invite_code' => $code])
            ->one();

        if (!$inv) {
            throw new NotFoundHttpException('Taklifnoma topilmadi yoki kod xato.');
        }

        if ($inv['revoked_at'] !== null) {
            throw new UnprocessableEntityHttpException('Ushbu taklifnoma bekor qilingan.');
        }

        if ($inv['accepted_at'] !== null) {
            throw new UnprocessableEntityHttpException('Ushbu taklifnoma allaqachon ishlatilgan.');
        }

        if (strtotime($inv['expires_at']) < time()) {
            throw new UnprocessableEntityHttpException('Taklifnoma muddati tugagan.');
        }

        if (strtolower($inv['email']) !== strtolower($user->email)) {
            throw new ForbiddenHttpException('Ushbu taklifnoma boshqa email manzili uchun chiqarilgan.');
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $wsId = (int)$inv['workspace_id'];

        $tx = Yii::$app->db->beginTransaction();
        try {
            $existingMember = (new Query())
                ->from('{{%workspace_members}}')
                ->where(['workspace_id' => $wsId, 'user_id' => $user->id])
                ->one();

            if ($existingMember) {
                Yii::$app->db->createCommand()->update('{{%workspace_members}}', [
                    'status' => 'active',
                    'role' => $inv['role'],
                ], ['id' => $existingMember['id']])->execute();
            } else {
                Yii::$app->db->createCommand()->insert('{{%workspace_members}}', [
                    'workspace_id' => $wsId,
                    'user_id' => $user->id,
                    'role' => $inv['role'],
                    'status' => 'active',
                    'weekly_capacity_hours' => 40,
                    'joined_at' => $now,
                ])->execute();
            }

            Yii::$app->db->createCommand()->update('{{%workspace_invitations}}', [
                'accepted_at' => $now,
            ], ['id' => $inv['id']])->execute();

            ActivityLogService::log($wsId, (int)$user->id, 'workspace', $wsId, 'invitation.accepted', "{$user->email} taklifnomani qabul qilib jamoaga qo‘shildi.");
            $tx->commit();
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }

        return $this->actionView($wsId);
    }

    public function actionTeams(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $teams = (new Query())
            ->from('{{%workspace_teams}}')
            ->where(['workspace_id' => $id])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        $teamIds = array_column($teams, 'id');
        $teamMembers = [];
        if (!empty($teamIds)) {
            $tmRows = (new Query())
                ->from('{{%workspace_team_members}}')
                ->where(['team_id' => $teamIds])
                ->all();
            foreach ($tmRows as $tm) {
                $teamMembers[(int)$tm['team_id']][] = (int)$tm['user_id'];
            }
        }

        return $this->ok([
            'teams' => array_map(function ($t) use ($teamMembers) {
                $tid = (int)$t['id'];
                return [
                    'id' => $tid,
                    'workspace_id' => (int)$t['workspace_id'],
                    'name' => $t['name'],
                    'handle' => $t['handle'],
                    'color' => $t['color'],
                    'description' => $t['description'],
                    'lead_user_id' => $t['lead_user_id'] ? (int)$t['lead_user_id'] : null,
                    'member_ids' => $teamMembers[$tid] ?? [],
                    'created_at' => $t['created_at'],
                ];
            }, $teams),
        ]);
    }

    public function actionCreateTeam(int $id): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $name = trim((string)$body['name']);
        $handle = preg_replace('/[^a-z0-9-_]/', '-', strtolower(trim((string)($body['handle'] ?? $name))));
        $now = gmdate('Y-m-d\TH:i:s\Z');

        Yii::$app->db->createCommand()->insert('{{%workspace_teams}}', [
            'workspace_id' => $id,
            'name' => $name,
            'handle' => $handle,
            'color' => $body['color'] ?? '#6366f1',
            'description' => trim((string)($body['description'] ?? '')),
            'lead_user_id' => !empty($body['lead_user_id']) ? (int)$body['lead_user_id'] : null,
            'created_at' => $now,
        ])->execute();

        $teamId = (int)Yii::$app->db->getLastInsertID();
        $memberIds = is_array($body['member_ids'] ?? null) ? $body['member_ids'] : [];
        foreach (array_unique(array_map('intval', $memberIds)) as $uid) {
            if ($uid > 0) {
                Yii::$app->db->createCommand()->insert('{{%workspace_team_members}}', [
                    'team_id' => $teamId,
                    'user_id' => $uid,
                    'joined_at' => $now,
                ])->execute();
            }
        }

        ActivityLogService::log($id, $actorId, 'team', $teamId, 'team.created', "'{$name}' (@{$handle}) jamoasi yaratildi.");
        return $this->actionTeams($id);
    }

    public function actionUpdateTeam(int $id, int $teamId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $body = $this->bodyParams();

        $team = (new Query())->from('{{%workspace_teams}}')->where(['id' => $teamId, 'workspace_id' => $id])->one();
        if (!$team) {
            throw new NotFoundHttpException('Jamoa topilmadi.');
        }

        $updates = [];
        foreach (['name', 'handle', 'color', 'description', 'lead_user_id'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%workspace_teams}}', $updates, ['id' => $teamId])->execute();
        }

        if (isset($body['member_ids']) && is_array($body['member_ids'])) {
            Yii::$app->db->createCommand()->delete('{{%workspace_team_members}}', ['team_id' => $teamId])->execute();
            $now = gmdate('Y-m-d\TH:i:s\Z');
            foreach (array_unique(array_map('intval', $body['member_ids'])) as $uid) {
                if ($uid > 0) {
                    Yii::$app->db->createCommand()->insert('{{%workspace_team_members}}', [
                        'team_id' => $teamId,
                        'user_id' => $uid,
                        'joined_at' => $now,
                    ])->execute();
                }
            }
        }

        return $this->actionTeams($id);
    }

    public function actionDeleteTeam(int $id, int $teamId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);

        Yii::$app->db->createCommand()->delete('{{%workspace_team_members}}', ['team_id' => $teamId])->execute();
        Yii::$app->db->createCommand()->delete('{{%workspace_teams}}', ['id' => $teamId, 'workspace_id' => $id])->execute();

        return $this->actionTeams($id);
    }

    public function actionLabels(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $labels = (new Query())
            ->from('{{%labels}}')
            ->where(['workspace_id' => $id])
            ->orderBy(['name' => SORT_ASC])
            ->all();

        return $this->ok([
            'labels' => array_map(function ($l) {
                return [
                    'id' => (int)$l['id'],
                    'workspace_id' => (int)$l['workspace_id'],
                    'project_id' => $l['project_id'] ? (int)$l['project_id'] : null,
                    'name' => $l['name'],
                    'color' => $l['color'],
                    'description' => $l['description'],
                ];
            }, $labels),
        ]);
    }

    public function actionCreateLabel(int $id): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        Yii::$app->db->createCommand()->insert('{{%labels}}', [
            'workspace_id' => $id,
            'project_id' => !empty($body['project_id']) ? (int)$body['project_id'] : null,
            'name' => trim((string)$body['name']),
            'color' => $body['color'] ?? '#6366f1',
            'description' => trim((string)($body['description'] ?? '')),
        ])->execute();

        return $this->actionLabels($id);
    }

    public function actionUpdateLabel(int $id, int $labelId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['name', 'color', 'description'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%labels}}', $updates, ['id' => $labelId, 'workspace_id' => $id])->execute();
        }
        return $this->actionLabels($id);
    }

    public function actionDeleteLabel(int $id, int $labelId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->delete('{{%task_labels}}', ['label_id' => $labelId])->execute();
        Yii::$app->db->createCommand()->delete('{{%labels}}', ['id' => $labelId, 'workspace_id' => $id])->execute();

        return $this->actionLabels($id);
    }

    public function actionActivity(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $projectId = Yii::$app->request->get('project_id');
        $entityType = Yii::$app->request->get('entity_type');
        $limit = min(100, max(10, (int)Yii::$app->request->get('limit', 50)));

        $query = (new Query())
            ->from('{{%activity_logs}}')
            ->where(['workspace_id' => $id])
            ->orderBy(['id' => SORT_DESC])
            ->limit($limit);

        if ($projectId) {
            $query->andWhere(['project_id' => (int)$projectId]);
        }
        if ($entityType) {
            $query->andWhere(['entity_type' => (string)$entityType]);
        }

        $logs = $query->all();
        $usersMap = $this->enrichUsersMap(array_column($logs, 'actor_id'));

        return $this->ok([
            'activities' => array_map(function ($log) use ($usersMap) {
                $actorId = (int)$log['actor_id'];
                return [
                    'id' => (int)$log['id'],
                    'workspace_id' => (int)$log['workspace_id'],
                    'project_id' => $log['project_id'] ? (int)$log['project_id'] : null,
                    'task_id' => $log['task_id'] ? (int)$log['task_id'] : null,
                    'actor_id' => $actorId,
                    'actor' => $usersMap[$actorId] ?? null,
                    'entity_type' => $log['entity_type'],
                    'entity_id' => (int)$log['entity_id'],
                    'action' => $log['action'],
                    'summary' => $log['summary'],
                    'metadata' => $log['metadata_json'] ? json_decode($log['metadata_json'], true) : [],
                    'ip_address' => $log['ip_address'],
                    'created_at' => $log['created_at'],
                ];
            }, $logs),
        ]);
    }

    public function actionTrash(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $deletedTasks = (new Query())
            ->select(['t.id', 't.task_key', 't.title', 't.priority', 't.deleted_at', 'p.name AS project_name'])
            ->from(['t' => '{{%tasks}}'])
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = t.project_id')
            ->where(['t.workspace_id' => $id])
            ->andWhere(['not', ['t.deleted_at' => null]])
            ->orderBy(['t.deleted_at' => SORT_DESC])
            ->all();

        $deletedProjects = (new Query())
            ->select(['id', 'name', 'project_key', 'deleted_at'])
            ->from('{{%projects}}')
            ->where(['workspace_id' => $id])
            ->andWhere(['not', ['deleted_at' => null]])
            ->orderBy(['deleted_at' => SORT_DESC])
            ->all();

        return $this->ok([
            'tasks' => array_map(function ($t) {
                $t['id'] = (int)$t['id'];
                return $t;
            }, $deletedTasks),
            'projects' => array_map(function ($p) {
                $p['id'] = (int)$p['id'];
                return $p;
            }, $deletedProjects),
        ]);
    }

    public function actionRestoreTrash(int $id): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['entity_type', 'entity_id']);

        $type = (string)$body['entity_type'];
        $eid = (int)$body['entity_id'];

        if ($type === 'task') {
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['deleted_at' => null], ['id' => $eid, 'workspace_id' => $id])->execute();
            ActivityLogService::log($id, $actorId, 'task', $eid, 'task.restored', "Vazifa #{$eid} savatdan qayta tiklandi.");
        } elseif ($type === 'project') {
            Yii::$app->db->createCommand()->update('{{%projects}}', ['deleted_at' => null], ['id' => $eid, 'workspace_id' => $id])->execute();
            ActivityLogService::log($id, $actorId, 'project', $eid, 'project.restored', "Loyiha #{$eid} savatdan qayta tiklandi.");
        }

        return $this->actionTrash($id);
    }

    public function actionPurgeTrash(int $id): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $type = (string)Yii::$app->request->get('entity_type', '');
        $eid = (int)Yii::$app->request->get('entity_id', 0);

        if ($type === 'task' && $eid > 0) {
            Yii::$app->db->createCommand()->delete('{{%tasks}}', ['id' => $eid, 'workspace_id' => $id])->execute();
        } elseif ($type === 'project' && $eid > 0) {
            Yii::$app->db->createCommand()->delete('{{%tasks}}', ['project_id' => $eid, 'workspace_id' => $id])->execute();
            Yii::$app->db->createCommand()->delete('{{%projects}}', ['id' => $eid, 'workspace_id' => $id])->execute();
        }

        return $this->actionTrash($id);
    }

    /**
     * Real Database-Driven Analytics, Metrics, Project Health & Team Workload
     */
    public function actionReports(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $tasks = (new Query())
            ->select([
                't.id', 't.project_id', 't.status_id', 't.priority', 't.assignee_id',
                't.due_at', 't.completed_at', 't.estimate_minutes', 't.logged_minutes', 't.story_points',
                's.category AS status_category',
            ])
            ->from(['t' => '{{%tasks}}'])
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = t.project_id')
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['t.workspace_id' => $id, 't.deleted_at' => null, 'p.deleted_at' => null])
            ->all();

        $nowIso = gmdate('Y-m-d\TH:i:s\Z');
        $soonIso = gmdate('Y-m-d\TH:i:s\Z', time() + 86400 * 7);

        $totalTasks = count($tasks);
        $completedTasks = 0;
        $inProgressTasks = 0;
        $overdueTasks = 0;
        $upcomingDeadlines = 0;
        $totalEstimatedMinutes = 0;
        $totalLoggedMinutes = 0;

        $byPriority = ['urgent' => 0, 'high' => 0, 'medium' => 0, 'low' => 0, 'none' => 0];
        $byCategory = ['backlog' => 0, 'todo' => 0, 'in_progress' => 0, 'review' => 0, 'done' => 0];
        $byProject = [];
        $byMember = [];

        foreach ($tasks as $t) {
            $cat = $t['status_category'] ?: 'todo';
            $prio = $t['priority'] ?: 'medium';
            $pid = (int)$t['project_id'];
            $aid = $t['assignee_id'] ? (int)$t['assignee_id'] : 0;

            $byPriority[$prio] = ($byPriority[$prio] ?? 0) + 1;
            $byCategory[$cat] = ($byCategory[$cat] ?? 0) + 1;

            $totalEstimatedMinutes += (int)$t['estimate_minutes'];
            $totalLoggedMinutes += (int)$t['logged_minutes'];

            $isDone = ($cat === 'done');
            if ($isDone) {
                $completedTasks++;
            } else {
                if (in_array($cat, ['in_progress', 'review'], true)) {
                    $inProgressTasks++;
                }
                if (!empty($t['due_at'])) {
                    if ($t['due_at'] < $nowIso) {
                        $overdueTasks++;
                    } elseif ($t['due_at'] <= $soonIso) {
                        $upcomingDeadlines++;
                    }
                }
            }

            if (!isset($byProject[$pid])) {
                $byProject[$pid] = ['total' => 0, 'done' => 0, 'in_progress' => 0, 'overdue' => 0, 'logged_minutes' => 0];
            }
            $byProject[$pid]['total']++;
            if ($isDone) $byProject[$pid]['done']++;
            if (in_array($cat, ['in_progress', 'review'], true)) $byProject[$pid]['in_progress']++;
            if (!$isDone && !empty($t['due_at']) && $t['due_at'] < $nowIso) $byProject[$pid]['overdue']++;
            $byProject[$pid]['logged_minutes'] += (int)$t['logged_minutes'];

            if ($aid > 0) {
                if (!isset($byMember[$aid])) {
                    $byMember[$aid] = [
                        'total_assigned' => 0,
                        'active_tasks' => 0,
                        'completed_tasks' => 0,
                        'overdue_tasks' => 0,
                        'estimated_minutes' => 0,
                        'logged_minutes' => 0,
                        'story_points' => 0,
                    ];
                }
                $byMember[$aid]['total_assigned']++;
                if ($isDone) {
                    $byMember[$aid]['completed_tasks']++;
                } else {
                    $byMember[$aid]['active_tasks']++;
                    if (!empty($t['due_at']) && $t['due_at'] < $nowIso) {
                        $byMember[$aid]['overdue_tasks']++;
                    }
                }
                $byMember[$aid]['estimated_minutes'] += (int)$t['estimate_minutes'];
                $byMember[$aid]['logged_minutes'] += (int)$t['logged_minutes'];
                $byMember[$aid]['story_points'] += (int)$t['story_points'];
            }
        }

        $projects = (new Query())
            ->select(['id', 'name', 'project_key', 'status', 'color', 'due_date', 'lead_user_id'])
            ->from('{{%projects}}')
            ->where(['workspace_id' => $id, 'deleted_at' => null])
            ->all();

        $projectSummaries = array_map(function ($p) use ($byProject) {
            $pid = (int)$p['id'];
            $stats = $byProject[$pid] ?? ['total' => 0, 'done' => 0, 'in_progress' => 0, 'overdue' => 0, 'logged_minutes' => 0];
            $progress = $stats['total'] > 0 ? round(($stats['done'] / $stats['total']) * 100) : 0;
            return [
                'id' => $pid,
                'name' => $p['name'],
                'project_key' => $p['project_key'],
                'status' => $p['status'],
                'color' => $p['color'],
                'due_date' => $p['due_date'],
                'total_tasks' => $stats['total'],
                'completed_tasks' => $stats['done'],
                'in_progress_tasks' => $stats['in_progress'],
                'overdue_tasks' => $stats['overdue'],
                'logged_minutes' => $stats['logged_minutes'],
                'progress_percent' => $progress,
            ];
        }, $projects);

        $membersResp = $this->actionMembers($id)['members'];
        $workload = array_map(function ($m) use ($byMember) {
            $uid = (int)$m['user_id'];
            $stats = $byMember[$uid] ?? [
                'total_assigned' => 0,
                'active_tasks' => 0,
                'completed_tasks' => 0,
                'overdue_tasks' => 0,
                'estimated_minutes' => 0,
                'logged_minutes' => 0,
                'story_points' => 0,
            ];
            return array_merge($m, $stats);
        }, $membersResp);

        return $this->ok([
            'metrics' => [
                'total_tasks' => $totalTasks,
                'active_tasks' => $totalTasks - $completedTasks,
                'completed_tasks' => $completedTasks,
                'in_progress_tasks' => $inProgressTasks,
                'overdue_tasks' => $overdueTasks,
                'upcoming_deadlines' => $upcomingDeadlines,
                'completion_rate' => $totalTasks > 0 ? round(($completedTasks / $totalTasks) * 100) : 0,
                'total_estimated_minutes' => $totalEstimatedMinutes,
                'total_logged_minutes' => $totalLoggedMinutes,
            ],
            'by_priority' => $byPriority,
            'by_category' => $byCategory,
            'projects' => $projectSummaries,
            'workload' => $workload,
        ]);
    }

    private function formatWorkspace(array $w): array
    {
        return [
            'id' => (int)$w['id'],
            'name' => $w['name'],
            'slug' => $w['slug'],
            'logo_url' => $w['logo_url'],
            'description' => $w['description'],
            'owner_id' => (int)$w['owner_id'],
            'plan_tier' => $w['plan_tier'],
            'my_role' => $w['my_role'] ?? 'member',
            'settings' => !empty($w['settings_json']) ? json_decode($w['settings_json'], true) : [],
            'created_at' => $w['created_at'],
        ];
    }
}
