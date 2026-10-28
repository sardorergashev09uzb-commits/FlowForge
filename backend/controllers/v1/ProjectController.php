<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\NotFoundHttpException;
use yii\web\UnprocessableEntityHttpException;
use app\components\TenantAccessGuard;
use app\components\ActivityLogService;

class ProjectController extends BaseApiController
{
    public function actionIndex(int $wsId): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $rows = (new Query())
            ->from('{{%projects}}')
            ->where(['workspace_id' => $wsId, 'deleted_at' => null])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        return $this->ok([
            'projects' => array_map([$this, 'formatProjectSummary'], $rows),
        ]);
    }

    public function actionCreate(int $wsId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $name = trim((string)$body['name']);
        $rawKey = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($body['project_key'] ?? '')));
        if ($rawKey === '') {
            $words = preg_split('/\s+/', $name);
            $rawKey = '';
            foreach ($words as $w) {
                $rawKey .= strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $w), 0, 1));
            }
            if (strlen($rawKey) < 2) {
                $rawKey = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name), 0, 3)) ?: 'PRJ';
            }
        }
        $projectKey = substr($rawKey, 0, 8);
        $suffix = 1;
        while ((new Query())->from('{{%projects}}')->where(['workspace_id' => $wsId, 'project_key' => $projectKey])->exists()) {
            $projectKey = substr($rawKey, 0, 5) . $suffix;
            $suffix++;
        }

        $template = (string)($body['template_type'] ?? 'software');
        $now = gmdate('Y-m-d\TH:i:s\Z');

        $tx = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand()->insert('{{%projects}}', [
                'workspace_id' => $wsId,
                'space_id' => !empty($body['space_id']) ? (int)$body['space_id'] : null,
                'folder_id' => !empty($body['folder_id']) ? (int)$body['folder_id'] : null,
                'name' => $name,
                'project_key' => $projectKey,
                'task_sequence' => 0,
                'description' => trim((string)($body['description'] ?? '')),
                'status' => $body['status'] ?? 'on_track',
                'visibility' => $body['visibility'] ?? 'workspace',
                'template_type' => $template,
                'color' => $body['color'] ?? '#6366f1',
                'icon' => $body['icon'] ?? 'folder-kanban',
                'start_date' => $body['start_date'] ?? gmdate('Y-m-d'),
                'due_date' => $body['due_date'] ?? gmdate('Y-m-d', time() + 86400 * 30),
                'lead_user_id' => !empty($body['lead_user_id']) ? (int)$body['lead_user_id'] : $actorId,
                'created_by' => $actorId,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            $projectId = (int)Yii::$app->db->getLastInsertID();

            Yii::$app->db->createCommand()->insert('{{%project_members}}', [
                'workspace_id' => $wsId,
                'project_id' => $projectId,
                'user_id' => $actorId,
                'project_role' => 'manager',
                'is_favorite' => !empty($body['is_favorite']),
                'joined_at' => $now,
            ])->execute();

            // Provision template statuses
            $statusPresets = $this->getTemplateStatuses($template);
            foreach ($statusPresets as [$sName, $sCat, $sColor, $sPos, $sDef, $sWip]) {
                Yii::$app->db->createCommand()->insert('{{%task_statuses}}', [
                    'workspace_id' => $wsId,
                    'project_id' => $projectId,
                    'name' => $sName,
                    'category' => $sCat,
                    'color' => $sColor,
                    'wip_limit' => $sWip,
                    'position' => $sPos,
                    'is_default' => $sDef,
                ])->execute();
            }

            // Provision initial Sprint & Overview Doc
            Yii::$app->db->createCommand()->insert('{{%project_sprints}}', [
                'workspace_id' => $wsId,
                'project_id' => $projectId,
                'name' => 'Sprint 1 — Foundation',
                'goal' => "{$name} loyihasining dastlabki bosqichi va asosiy vazifalarini yakunlash",
                'status' => 'active',
                'start_date' => gmdate('Y-m-d'),
                'end_date' => gmdate('Y-m-d', time() + 86400 * 14),
                'created_at' => $now,
            ])->execute();

            Yii::$app->db->createCommand()->insert('{{%project_docs}}', [
                'workspace_id' => $wsId,
                'project_id' => $projectId,
                'title' => "{$name} — Texnik Topshiriq va Qoidalar (PRD)",
                'icon' => 'book-open',
                'content_md' => "# {$name} ({$projectKey})\n\n## 1. Loyiha Maqsadi\nUshbu hujjat loyiha talablari, me'moriy qarorlar va jamoa kelishuvlarini saqlash uchun mo'ljallangan.\n\n## 2. Qabul Mezonlari (Definition of Done)\n- Barcha vazifalar kod ko'rigidan (Review) o'tishi shart.\n- Muddatlar va sarflangan vaqt (`Time Tracking`) o'z vaqtida kiritib boriladi.",
                'created_by' => $actorId,
                'updated_by' => $actorId,
                'position' => 100,
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            ActivityLogService::log($wsId, $actorId, 'project', $projectId, 'project.created', "Yangi loyiha '{$name}' ({$projectKey}) yaratildi.", ['template' => $template], $projectId);
            $tx->commit();

            return $this->actionView($projectId);
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }
    }

    public function actionView(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);
        $project = $ctx['project'];

        $statuses = (new Query())
            ->from('{{%task_statuses}}')
            ->where(['project_id' => $id])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $sprints = (new Query())
            ->from('{{%project_sprints}}')
            ->where(['project_id' => $id])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        $docs = (new Query())
            ->from('{{%project_docs}}')
            ->where(['project_id' => $id])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $pm = (new Query())
            ->from('{{%project_members}}')
            ->where(['project_id' => $id, 'user_id' => $userId])
            ->one();

        $milestones = (new Query())
            ->from('{{%tasks}}')
            ->where(['project_id' => $id, 'is_milestone' => true, 'deleted_at' => null])
            ->orderBy(['due_at' => SORT_ASC])
            ->all();

        return $this->ok([
            'project' => array_merge($this->formatProjectSummary($project), [
                'is_favorite' => $pm ? (bool)$pm['is_favorite'] : false,
                'statuses' => array_map(function ($s) {
                    return [
                        'id' => (int)$s['id'],
                        'project_id' => (int)$s['project_id'],
                        'name' => $s['name'],
                        'category' => $s['category'],
                        'color' => $s['color'],
                        'wip_limit' => $s['wip_limit'] ? (int)$s['wip_limit'] : null,
                        'position' => (int)$s['position'],
                        'is_default' => (bool)$s['is_default'],
                    ];
                }, $statuses),
                'sprints' => array_map(function ($sp) {
                    return [
                        'id' => (int)$sp['id'],
                        'project_id' => (int)$sp['project_id'],
                        'name' => $sp['name'],
                        'goal' => $sp['goal'],
                        'status' => $sp['status'],
                        'start_date' => $sp['start_date'],
                        'end_date' => $sp['end_date'],
                    ];
                }, $sprints),
                'docs' => array_map(function ($d) {
                    return [
                        'id' => (int)$d['id'],
                        'project_id' => (int)$d['project_id'],
                        'parent_doc_id' => $d['parent_doc_id'] ? (int)$d['parent_doc_id'] : null,
                        'title' => $d['title'],
                        'icon' => $d['icon'],
                        'content_md' => $d['content_md'],
                        'updated_at' => $d['updated_at'],
                    ];
                }, $docs),
                'milestones' => array_map(function ($m) {
                    return [
                        'id' => (int)$m['id'],
                        'task_key' => $m['task_key'],
                        'title' => $m['title'],
                        'due_at' => $m['due_at'],
                        'completed_at' => $m['completed_at'],
                    ];
                }, $milestones),
            ]),
        ]);
    }

    public function actionUpdate(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $project = $ctx['project'];
        $wsId = (int)$project['workspace_id'];
        $body = $this->bodyParams();

        $updates = ['updated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        $allowed = ['name', 'description', 'status', 'visibility', 'color', 'icon', 'start_date', 'due_date', 'lead_user_id', 'space_id', 'folder_id', 'archived_at'];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }

        Yii::$app->db->createCommand()->update('{{%projects}}', $updates, ['id' => $id])->execute();
        ActivityLogService::log($wsId, $actorId, 'project', $id, 'project.updated', "Loyiha '{$project['name']}' sozlamalari yangilandi.", $updates, $id);

        return $this->actionView($id);
    }

    public function actionDelete(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_ADMIN);
        $project = $ctx['project'];
        $wsId = (int)$project['workspace_id'];

        $now = gmdate('Y-m-d\TH:i:s\Z');
        Yii::$app->db->createCommand()->update('{{%projects}}', ['deleted_at' => $now], ['id' => $id])->execute();
        ActivityLogService::log($wsId, $actorId, 'project', $id, 'project.deleted', "Loyiha '{$project['name']}' savatga o‘tkazildi.", [], $id);

        return $this->ok(['message' => 'Loyiha savatga (Trash) joylandi.']);
    }

    public function actionToggleFavorite(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);
        $wsId = (int)$ctx['project']['workspace_id'];

        $pm = (new Query())
            ->from('{{%project_members}}')
            ->where(['project_id' => $id, 'user_id' => $userId])
            ->one();

        if ($pm) {
            $newFav = !(bool)$pm['is_favorite'];
            Yii::$app->db->createCommand()->update('{{%project_members}}', ['is_favorite' => $newFav], ['id' => $pm['id']])->execute();
        } else {
            $newFav = true;
            Yii::$app->db->createCommand()->insert('{{%project_members}}', [
                'workspace_id' => $wsId,
                'project_id' => $id,
                'user_id' => $userId,
                'project_role' => 'contributor',
                'is_favorite' => true,
                'joined_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ])->execute();
        }

        return $this->ok(['is_favorite' => $newFav]);
    }

    public function actionCreateStatus(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $wsId = (int)$ctx['project']['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        $maxPos = (int)(new Query())->from('{{%task_statuses}}')->where(['project_id' => $id])->max('position');

        Yii::$app->db->createCommand()->insert('{{%task_statuses}}', [
            'workspace_id' => $wsId,
            'project_id' => $id,
            'name' => trim((string)$body['name']),
            'category' => $body['category'] ?? 'in_progress',
            'color' => $body['color'] ?? '#6366f1',
            'wip_limit' => !empty($body['wip_limit']) ? (int)$body['wip_limit'] : null,
            'position' => $maxPos + 100,
            'is_default' => false,
        ])->execute();

        return $this->actionView($id);
    }

    public function actionUpdateStatus(int $id, int $statusId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['name', 'category', 'color', 'wip_limit', 'position'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%task_statuses}}', $updates, ['id' => $statusId, 'project_id' => $id])->execute();
        }

        return $this->actionView($id);
    }

    public function actionDeleteStatus(int $id, int $statusId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);

        $allStatuses = (new Query())->from('{{%task_statuses}}')->where(['project_id' => $id])->orderBy(['position' => SORT_ASC])->all();
        if (count($allStatuses) <= 1) {
            throw new UnprocessableEntityHttpException('Loyihada kamida bitta status ustuni qolishi shart.');
        }

        $fallbackId = null;
        foreach ($allStatuses as $st) {
            if ((int)$st['id'] !== $statusId) {
                $fallbackId = (int)$st['id'];
                break;
            }
        }

        Yii::$app->db->createCommand()->update('{{%tasks}}', ['status_id' => $fallbackId], ['project_id' => $id, 'status_id' => $statusId])->execute();
        Yii::$app->db->createCommand()->delete('{{%task_statuses}}', ['id' => $statusId, 'project_id' => $id])->execute();

        return $this->actionView($id);
    }

    public function actionReorderStatuses(int $id): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $orderedIds = $body['status_ids'] ?? [];

        if (is_array($orderedIds)) {
            $pos = 100;
            foreach ($orderedIds as $sid) {
                Yii::$app->db->createCommand()->update(
                    '{{%task_statuses}}',
                    ['position' => $pos],
                    ['id' => (int)$sid, 'project_id' => $id]
                )->execute();
                $pos += 100;
            }
        }

        return $this->actionView($id);
    }

    public function actionSprints(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireProjectAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $sprints = (new Query())
            ->from('{{%project_sprints}}')
            ->where(['project_id' => $id])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        return $this->ok(['sprints' => $sprints]);
    }

    public function actionCreateSprint(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $wsId = (int)$ctx['project']['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['name']);

        Yii::$app->db->createCommand()->insert('{{%project_sprints}}', [
            'workspace_id' => $wsId,
            'project_id' => $id,
            'name' => trim((string)$body['name']),
            'goal' => trim((string)($body['goal'] ?? '')),
            'status' => $body['status'] ?? 'planned',
            'start_date' => $body['start_date'] ?? gmdate('Y-m-d'),
            'end_date' => $body['end_date'] ?? gmdate('Y-m-d', time() + 86400 * 14),
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ])->execute();

        return $this->actionView($id);
    }

    public function actionUpdateSprint(int $id): array
    {
        $actorId = $this->currentUserId();
        $sprint = (new Query())->from('{{%project_sprints}}')->where(['id' => $id])->one();
        if (!$sprint) {
            throw new NotFoundHttpException('Sprint topilmadi.');
        }

        $projectId = (int)$sprint['project_id'];
        TenantAccessGuard::requireProjectAccess($projectId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['name', 'goal', 'status', 'start_date', 'end_date'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%project_sprints}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionView($projectId);
    }

    public function actionDeleteSprint(int $id): array
    {
        $actorId = $this->currentUserId();
        $sprint = (new Query())->from('{{%project_sprints}}')->where(['id' => $id])->one();
        if (!$sprint) {
            throw new NotFoundHttpException('Sprint topilmadi.');
        }

        $projectId = (int)$sprint['project_id'];
        TenantAccessGuard::requireProjectAccess($projectId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->update('{{%tasks}}', ['sprint_id' => null], ['sprint_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%project_sprints}}', ['id' => $id])->execute();

        return $this->actionView($projectId);
    }

    private function getTemplateStatuses(string $template): array
    {
        if ($template === 'marketing') {
            return [
                ['G‘oyalar (Ideation)', 'backlog', '#64748b', 100, false, null],
                ['Rejada (Planned)', 'todo', '#3b82f6', 200, true, null],
                ['Kontent & Dizayn', 'in_progress', '#f59e0b', 300, false, 5],
                ['Tasdiqlashda (Review)', 'review', '#a855f7', 400, false, 4],
                ['E’lon qilindi (Published)', 'done', '#10b981', 500, false, null],
            ];
        }
        if ($template === 'kanban') {
            return [
                ['To Do', 'todo', '#3b82f6', 100, true, null],
                ['Doing', 'in_progress', '#f59e0b', 200, false, 5],
                ['Done', 'done', '#10b981', 300, false, null],
            ];
        }
        // Default: software engineering
        return [
            ['Backlog', 'backlog', '#64748b', 100, false, null],
            ['Todo', 'todo', '#3b82f6', 200, true, null],
            ['In Progress', 'in_progress', '#f59e0b', 300, false, 6],
            ['Code Review & QA', 'review', '#a855f7', 400, false, 4],
            ['Done', 'done', '#10b981', 500, false, null],
        ];
    }

    private function formatProjectSummary(array $p): array
    {
        return [
            'id' => (int)$p['id'],
            'workspace_id' => (int)$p['workspace_id'],
            'space_id' => $p['space_id'] ? (int)$p['space_id'] : null,
            'folder_id' => $p['folder_id'] ? (int)$p['folder_id'] : null,
            'name' => $p['name'],
            'project_key' => $p['project_key'],
            'task_sequence' => (int)$p['task_sequence'],
            'description' => $p['description'],
            'status' => $p['status'],
            'visibility' => $p['visibility'],
            'template_type' => $p['template_type'],
            'color' => $p['color'],
            'icon' => $p['icon'],
            'start_date' => $p['start_date'],
            'due_date' => $p['due_date'],
            'lead_user_id' => $p['lead_user_id'] ? (int)$p['lead_user_id'] : null,
            'created_by' => (int)$p['created_by'],
            'archived_at' => $p['archived_at'],
            'created_at' => $p['created_at'],
            'updated_at' => $p['updated_at'],
        ];
    }
}
