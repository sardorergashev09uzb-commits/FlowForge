<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\NotFoundHttpException;
use app\components\TenantAccessGuard;
use app\components\ActivityLogService;

class HierarchyController extends BaseApiController
{
    /**
     * Returns full nested Workspace tree:
     * - Favorites (projects favorited by user)
     * - Spaces -> Folders -> Projects + Space-level Projects
     * - Unassigned / Root Projects
     */
    public function actionTree(int $wsId): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireWorkspaceRole($wsId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $spaces = (new Query())
            ->from('{{%spaces}}')
            ->where(['workspace_id' => $wsId, 'archived_at' => null])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $folders = (new Query())
            ->from('{{%folders}}')
            ->where(['workspace_id' => $wsId, 'archived_at' => null])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $projects = (new Query())
            ->from('{{%projects}}')
            ->where(['workspace_id' => $wsId, 'deleted_at' => null])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        $favProjectIds = (new Query())
            ->select('project_id')
            ->from('{{%project_members}}')
            ->where(['workspace_id' => $wsId, 'user_id' => $userId, 'is_favorite' => true])
            ->column();
        $favSet = array_flip(array_map('intval', $favProjectIds));

        // Task counts per project
        $taskStats = (new Query())
            ->select([
                't.project_id',
                'COUNT(*) AS total_tasks',
                'SUM(CASE WHEN s.category = \'done\' THEN 1 ELSE 0 END) AS done_tasks',
            ])
            ->from(['t' => '{{%tasks}}'])
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['t.workspace_id' => $wsId, 't.deleted_at' => null])
            ->groupBy('t.project_id')
            ->all();

        $statsMap = [];
        foreach ($taskStats as $st) {
            $statsMap[(int)$st['project_id']] = [
                'total_tasks' => (int)$st['total_tasks'],
                'done_tasks' => (int)$st['done_tasks'],
            ];
        }

        $formattedProjects = [];
        foreach ($projects as $p) {
            $pid = (int)$p['id'];
            $st = $statsMap[$pid] ?? ['total_tasks' => 0, 'done_tasks' => 0];
            $formattedProjects[] = [
                'id' => $pid,
                'workspace_id' => (int)$p['workspace_id'],
                'space_id' => $p['space_id'] ? (int)$p['space_id'] : null,
                'folder_id' => $p['folder_id'] ? (int)$p['folder_id'] : null,
                'name' => $p['name'],
                'project_key' => $p['project_key'],
                'description' => $p['description'],
                'status' => $p['status'],
                'visibility' => $p['visibility'],
                'template_type' => $p['template_type'],
                'color' => $p['color'],
                'icon' => $p['icon'],
                'start_date' => $p['start_date'],
                'due_date' => $p['due_date'],
                'lead_user_id' => $p['lead_user_id'] ? (int)$p['lead_user_id'] : null,
                'is_favorite' => isset($favSet[$pid]),
                'total_tasks' => $st['total_tasks'],
                'done_tasks' => $st['done_tasks'],
                'archived_at' => $p['archived_at'],
            ];
        }

        $foldersById = [];
        foreach ($folders as $f) {
            $fid = (int)$f['id'];
            $foldersById[$fid] = [
                'id' => $fid,
                'workspace_id' => (int)$f['workspace_id'],
                'space_id' => (int)$f['space_id'],
                'name' => $f['name'],
                'color' => $f['color'],
                'position' => (int)$f['position'],
                'projects' => [],
            ];
        }

        $spacesById = [];
        foreach ($spaces as $s) {
            $sid = (int)$s['id'];
            $spacesById[$sid] = [
                'id' => $sid,
                'workspace_id' => (int)$s['workspace_id'],
                'name' => $s['name'],
                'key_code' => $s['key_code'],
                'description' => $s['description'],
                'color' => $s['color'],
                'icon' => $s['icon'],
                'is_private' => (bool)$s['is_private'],
                'position' => (int)$s['position'],
                'folders' => [],
                'projects' => [],
            ];
        }

        $rootProjects = [];
        $favorites = [];

        foreach ($formattedProjects as $fp) {
            if ($fp['is_favorite'] && !$fp['archived_at']) {
                $favorites[] = $fp;
            }
            if ($fp['folder_id'] && isset($foldersById[$fp['folder_id']])) {
                $foldersById[$fp['folder_id']]['projects'][] = $fp;
            } elseif ($fp['space_id'] && isset($spacesById[$fp['space_id']])) {
                $spacesById[$fp['space_id']]['projects'][] = $fp;
            } else {
                $rootProjects[] = $fp;
            }
        }

        foreach ($foldersById as $folder) {
            $sid = $folder['space_id'];
            if (isset($spacesById[$sid])) {
                $spacesById[$sid]['folders'][] = $folder;
            }
        }

        return $this->ok([
            'favorites' => $favorites,
            'spaces' => array_values($spacesById),
            'root_projects' => $rootProjects,
            'all_projects' => $formattedProjects,
        ]);
    }

    public function actionCreateSpace(int $wsId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $name = trim((string)$body['name']);
        $key = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($body['key_code'] ?? substr($name, 0, 4)))) ?: 'SPC';
        $now = gmdate('Y-m-d\TH:i:s\Z');

        Yii::$app->db->createCommand()->insert('{{%spaces}}', [
            'workspace_id' => $wsId,
            'name' => $name,
            'key_code' => substr($key, 0, 10),
            'description' => trim((string)($body['description'] ?? '')),
            'color' => $body['color'] ?? '#6366f1',
            'icon' => $body['icon'] ?? 'layers',
            'is_private' => !empty($body['is_private']),
            'position' => (int)($body['position'] ?? 100),
            'created_by' => $actorId,
            'created_at' => $now,
        ])->execute();

        $spaceId = (int)Yii::$app->db->getLastInsertID();
        ActivityLogService::log($wsId, $actorId, 'space', $spaceId, 'space.created', "Yangi bo‘lim (Space) '{$name}' yaratildi.");

        return $this->actionTree($wsId);
    }

    public function actionUpdateSpace(int $id): array
    {
        $actorId = $this->currentUserId();
        $space = (new Query())->from('{{%spaces}}')->where(['id' => $id])->one();
        if (!$space) {
            throw new NotFoundHttpException('Space topilmadi.');
        }

        $wsId = (int)$space['workspace_id'];
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['name', 'key_code', 'description', 'color', 'icon', 'is_private', 'position', 'archived_at'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%spaces}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionTree($wsId);
    }

    public function actionDeleteSpace(int $id): array
    {
        $actorId = $this->currentUserId();
        $space = (new Query())->from('{{%spaces}}')->where(['id' => $id])->one();
        if (!$space) {
            throw new NotFoundHttpException('Space topilmadi.');
        }

        $wsId = (int)$space['workspace_id'];
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_ADMIN);

        // Move projects inside this space to root before deleting space
        Yii::$app->db->createCommand()->update('{{%projects}}', ['space_id' => null, 'folder_id' => null], ['space_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%folders}}', ['space_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%spaces}}', ['id' => $id])->execute();

        ActivityLogService::log($wsId, $actorId, 'space', $id, 'space.deleted', "'{$space['name']}' bo‘limi o‘chirildi.");
        return $this->actionTree($wsId);
    }

    public function actionCreateFolder(int $spaceId): array
    {
        $actorId = $this->currentUserId();
        $space = (new Query())->from('{{%spaces}}')->where(['id' => $spaceId])->one();
        if (!$space) {
            throw new NotFoundHttpException('Space topilmadi.');
        }

        $wsId = (int)$space['workspace_id'];
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $name = trim((string)$body['name']);
        Yii::$app->db->createCommand()->insert('{{%folders}}', [
            'workspace_id' => $wsId,
            'space_id' => $spaceId,
            'name' => $name,
            'color' => $body['color'] ?? '#94a3b8',
            'position' => (int)($body['position'] ?? 100),
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ])->execute();

        $fid = (int)Yii::$app->db->getLastInsertID();
        ActivityLogService::log($wsId, $actorId, 'folder', $fid, 'folder.created', "'{$name}' papkasi '{$space['name']}' ichida yaratildi.");

        return $this->actionTree($wsId);
    }

    public function actionUpdateFolder(int $id): array
    {
        $actorId = $this->currentUserId();
        $folder = (new Query())->from('{{%folders}}')->where(['id' => $id])->one();
        if (!$folder) {
            throw new NotFoundHttpException('Papka topilmadi.');
        }

        $wsId = (int)$folder['workspace_id'];
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['name', 'color', 'position', 'space_id'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%folders}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionTree($wsId);
    }

    public function actionDeleteFolder(int $id): array
    {
        $actorId = $this->currentUserId();
        $folder = (new Query())->from('{{%folders}}')->where(['id' => $id])->one();
        if (!$folder) {
            throw new NotFoundHttpException('Papka topilmadi.');
        }

        $wsId = (int)$folder['workspace_id'];
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->update('{{%projects}}', ['folder_id' => null], ['folder_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%folders}}', ['id' => $id])->execute();

        return $this->actionTree($wsId);
    }
}
