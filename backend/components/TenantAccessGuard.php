<?php

namespace app\components;

use Yii;
use yii\db\Query;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

/**
 * Centralized Multi-Tenant & RBAC Authorization Guard
 * Roles hierarchy:
 * - owner: Full control including workspace deletion & ownership transfer
 * - admin: Manage workspace settings, members, spaces, folders, projects, tasks
 * - member: Create/edit projects (if allowed), tasks, subtasks, comments, time entries, docs
 * - viewer: Read-only access across workspace resources
 */
class TenantAccessGuard
{
    public const ROLE_OWNER = 'owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_MEMBER = 'member';
    public const ROLE_VIEWER = 'viewer';

    private static array $roleWeights = [
        self::ROLE_VIEWER => 10,
        self::ROLE_MEMBER => 20,
        self::ROLE_ADMIN  => 30,
        self::ROLE_OWNER  => 40,
    ];

    /**
     * Verifies user is an active member of the workspace and meets minimum required role.
     */
    public static function requireWorkspaceRole(int $workspaceId, int $userId, string $minRole = self::ROLE_VIEWER): array
    {
        $workspace = (new Query())
            ->from('{{%workspaces}}')
            ->where(['id' => $workspaceId])
            ->one();

        if (!$workspace) {
            throw new NotFoundHttpException('Workspace topilmadi yoki sizda unga ruxsat yo‘q.');
        }

        $membership = (new Query())
            ->from('{{%workspace_members}}')
            ->where([
                'workspace_id' => $workspaceId,
                'user_id' => $userId,
                'status' => 'active',
            ])
            ->one();

        if (!$membership) {
            // Return 404 or 403 without leaking workspace existence details
            throw new ForbiddenHttpException('Siz ushbu workspace a’zosi emassiz (Tenant Isolation himoyasi).');
        }

        $userRole = $membership['role'];
        $userWeight = self::$roleWeights[$userRole] ?? 0;
        $requiredWeight = self::$roleWeights[$minRole] ?? 100;

        if ($userWeight < $requiredWeight) {
            throw new ForbiddenHttpException(
                sprintf('Ushbu amalni bajarish uchun kamida "%s" roli talab etiladi (sizning rolingiz: "%s").', strtoupper($minRole), strtoupper($userRole))
            );
        }

        return [
            'workspace' => $workspace,
            'membership' => $membership,
            'role' => $userRole,
        ];
    }

    /**
     * Verifies project exists, is not permanently deleted, and user has required workspace/project role.
     */
    public static function requireProjectAccess(int $projectId, int $userId, string $minWorkspaceRole = self::ROLE_VIEWER): array
    {
        $project = (new Query())
            ->from('{{%projects}}')
            ->where(['id' => $projectId, 'deleted_at' => null])
            ->one();

        if (!$project) {
            throw new NotFoundHttpException('Loyiha topilmadi.');
        }

        $wsContext = self::requireWorkspaceRole((int)$project['workspace_id'], $userId, $minWorkspaceRole);

        // If project is private, ensure user is either owner/admin of workspace or explicit project member
        if ($project['visibility'] === 'private' && !in_array($wsContext['role'], [self::ROLE_OWNER, self::ROLE_ADMIN], true)) {
            $pm = (new Query())
                ->from('{{%project_members}}')
                ->where(['project_id' => $projectId, 'user_id' => $userId])
                ->one();
            if (!$pm) {
                throw new ForbiddenHttpException('Ushbu maxfiy loyihaga kirish huquqingiz yo‘q.');
            }
        }

        return array_merge($wsContext, ['project' => $project]);
    }

    /**
     * Verifies task exists and user has access to its workspace & project.
     */
    public static function requireTaskAccess(int $taskId, int $userId, string $minWorkspaceRole = self::ROLE_VIEWER): array
    {
        $task = (new Query())
            ->from('{{%tasks}}')
            ->where(['id' => $taskId, 'deleted_at' => null])
            ->one();

        if (!$task) {
            throw new NotFoundHttpException('Vazifa topilmadi.');
        }

        $projContext = self::requireProjectAccess((int)$task['project_id'], $userId, $minWorkspaceRole);
        return array_merge($projContext, ['task' => $task]);
    }

    /**
     * Ensures target user is an active member of the given workspace (e.g. before assigning a task).
     */
    public static function assertUserInWorkspace(int $workspaceId, int $targetUserId): array
    {
        $member = (new Query())
            ->from('{{%workspace_members}}')
            ->where([
                'workspace_id' => $workspaceId,
                'user_id' => $targetUserId,
                'status' => 'active',
            ])
            ->one();

        if (!$member) {
            throw new \yii\web\UnprocessableEntityHttpException('Tanlangan foydalanuvchi ushbu workspace a’zosi emas.');
        }

        return $member;
    }
}
