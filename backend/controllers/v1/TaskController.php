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

class TaskController extends BaseApiController
{
    public function actionIndex(int $projectId): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($projectId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $req = Yii::$app->request;
        $query = (new Query())
            ->from(['t' => '{{%tasks}}'])
            ->where(['t.project_id' => $projectId, 't.deleted_at' => null]);

        if (!$req->get('include_archived')) {
            $query->andWhere(['t.archived_at' => null]);
        }
        if ($req->get('status_id')) {
            $query->andWhere(['t.status_id' => (int)$req->get('status_id')]);
        }
        if ($req->get('priority')) {
            $query->andWhere(['t.priority' => (string)$req->get('priority')]);
        }
        if ($req->get('assignee_id')) {
            $aid = $req->get('assignee_id');
            if ($aid === 'unassigned') {
                $query->andWhere(['t.assignee_id' => null]);
            } else {
                $query->andWhere(['t.assignee_id' => (int)$aid]);
            }
        }
        if ($req->get('sprint_id')) {
            $query->andWhere(['t.sprint_id' => (int)$req->get('sprint_id')]);
        }
        if ($req->get('q')) {
            $q = trim((string)$req->get('q'));
            $query->andWhere(['or', ['like', 't.title', $q], ['like', 't.task_key', $q], ['like', 't.description', $q]]);
        }
        if ($req->get('label_id')) {
            $lid = (int)$req->get('label_id');
            $taskIdsWithLabel = (new Query())->select('task_id')->from('{{%task_labels}}')->where(['label_id' => $lid])->column();
            $query->andWhere(['t.id' => $taskIdsWithLabel ?: [-1]]);
        }

        $rows = $query->orderBy(['t.position' => SORT_ASC, 't.id' => SORT_ASC])->all();

        return $this->ok([
            'tasks' => $this->enrichTaskList($rows),
        ]);
    }

    public function actionMyTasks(int $wsId): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $scope = (string)Yii::$app->request->get('scope', 'assigned'); // assigned, created, watching, workspace

        $query = (new Query())
            ->select(['t.*'])
            ->from(['t' => '{{%tasks}}'])
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = t.project_id')
            ->where([
                't.workspace_id' => $wsId,
                't.deleted_at' => null,
                't.archived_at' => null,
                'p.deleted_at' => null,
            ]);

        if ($scope === 'assigned') {
            $query->andWhere(['t.assignee_id' => $userId]);
        } elseif ($scope === 'created') {
            $query->andWhere(['t.reporter_id' => $userId]);
        } elseif ($scope === 'watching') {
            $watchedIds = (new Query())
                ->select('task_id')
                ->from('{{%task_watchers}}')
                ->where(['workspace_id' => $wsId, 'user_id' => $userId])
                ->column();
            $query->andWhere(['t.id' => $watchedIds ?: [-1]]);
        }

        $rows = $query->orderBy(['t.due_at' => SORT_ASC, 't.id' => SORT_DESC])->limit(300)->all();
        return $this->ok([
            'tasks' => $this->enrichTaskList($rows),
        ]);
    }

    public function actionCreate(int $projectId): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($projectId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $project = $ctx['project'];
        $wsId = (int)$project['workspace_id'];

        $body = $this->bodyParams();
        $this->requireFields($body, ['title']);

        $title = trim((string)$body['title']);
        $priority = (string)($body['priority'] ?? 'medium');
        if (!in_array($priority, ['none', 'low', 'medium', 'high', 'urgent'], true)) {
            $priority = 'medium';
        }

        // Validate status_id belongs to this project
        $statusId = !empty($body['status_id']) ? (int)$body['status_id'] : null;
        if ($statusId) {
            $validStatus = (new Query())->from('{{%task_statuses}}')->where(['id' => $statusId, 'project_id' => $projectId])->one();
            if (!$validStatus) {
                throw new UnprocessableEntityHttpException('Tanlangan status ushbu loyihaga tegishli emas.');
            }
        } else {
            $defaultStatus = (new Query())
                ->from('{{%task_statuses}}')
                ->where(['project_id' => $projectId])
                ->orderBy(['is_default' => SORT_DESC, 'position' => SORT_ASC])
                ->one();
            if (!$defaultStatus) {
                throw new UnprocessableEntityHttpException('Loyihada hech qanday status ustuni topilmadi.');
            }
            $statusId = (int)$defaultStatus['id'];
            $validStatus = $defaultStatus;
        }

        // Validate assignee belongs to workspace
        $assigneeId = !empty($body['assignee_id']) ? (int)$body['assignee_id'] : null;
        if ($assigneeId) {
            TenantAccessGuard::assertUserInWorkspace($wsId, $assigneeId);
        }

        // Validate parent_task_id belongs to same project
        $parentTaskId = !empty($body['parent_task_id']) ? (int)$body['parent_task_id'] : null;
        if ($parentTaskId) {
            $parentTask = (new Query())->from('{{%tasks}}')->where(['id' => $parentTaskId, 'deleted_at' => null])->one();
            if (!$parentTask || (int)$parentTask['project_id'] !== $projectId) {
                throw new UnprocessableEntityHttpException('Subtask ota-vazifasi aynan shu loyiha ichida bo‘lishi shart.');
            }
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $tx = Yii::$app->db->beginTransaction();
        try {
            $currentSeq = (int)(new Query())->select('task_sequence')->from('{{%projects}}')->where(['id' => $projectId])->scalar();
            $maxNum = (int)(new Query())->from('{{%tasks}}')->where(['project_id' => $projectId])->max('task_number');
            $nextNumber = max($currentSeq, $maxNum) + 1;

            Yii::$app->db->createCommand()->update('{{%projects}}', [
                'task_sequence' => $nextNumber,
                'updated_at' => $now,
            ], ['id' => $projectId])->execute();

            $taskKey = $project['project_key'] . '-' . $nextNumber;

            $maxPos = (float)(new Query())
                ->from('{{%tasks}}')
                ->where(['project_id' => $projectId, 'status_id' => $statusId, 'deleted_at' => null])
                ->max('position');
            $position = $maxPos > 0 ? ($maxPos + 1024.0) : 1024.0;

            $completedAt = ($validStatus['category'] === 'done') ? $now : null;

            Yii::$app->db->createCommand()->insert('{{%tasks}}', [
                'workspace_id' => $wsId,
                'project_id' => $projectId,
                'sprint_id' => !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null,
                'parent_task_id' => $parentTaskId,
                'task_number' => $nextNumber,
                'task_key' => $taskKey,
                'title' => $title,
                'description' => isset($body['description']) ? trim((string)$body['description']) : null,
                'status_id' => $statusId,
                'priority' => $priority,
                'assignee_id' => $assigneeId,
                'reporter_id' => $actorId,
                'start_date' => !empty($body['start_date']) ? (string)$body['start_date'] : null,
                'due_at' => !empty($body['due_at']) ? (string)$body['due_at'] : null,
                'completed_at' => $completedAt,
                'estimate_minutes' => isset($body['estimate_minutes']) && $body['estimate_minutes'] !== '' ? (int)$body['estimate_minutes'] : null,
                'logged_minutes' => 0,
                'story_points' => isset($body['story_points']) && $body['story_points'] !== '' ? (int)$body['story_points'] : null,
                'position' => $position,
                'is_milestone' => !empty($body['is_milestone']),
                'created_at' => $now,
                'updated_at' => $now,
            ])->execute();

            $taskId = (int)Yii::$app->db->getLastInsertID();

            // Creator automatically watches the task
            Yii::$app->db->createCommand()->insert('{{%task_watchers}}', [
                'workspace_id' => $wsId,
                'task_id' => $taskId,
                'user_id' => $actorId,
                'created_at' => $now,
            ])->execute();

            if ($assigneeId && $assigneeId !== $actorId) {
                Yii::$app->db->createCommand()->insert('{{%task_watchers}}', [
                    'workspace_id' => $wsId,
                    'task_id' => $taskId,
                    'user_id' => $assigneeId,
                    'created_at' => $now,
                ])->execute();
            }

            // Attach labels if provided
            if (!empty($body['label_ids']) && is_array($body['label_ids'])) {
                foreach (array_unique(array_map('intval', $body['label_ids'])) as $lid) {
                    $labelExists = (new Query())->from('{{%labels}}')->where(['id' => $lid, 'workspace_id' => $wsId])->exists();
                    if ($labelExists) {
                        Yii::$app->db->createCommand()->insert('{{%task_labels}}', [
                            'task_id' => $taskId,
                            'label_id' => $lid,
                        ])->execute();
                    }
                }
            }

            ActivityLogService::log(
                $wsId,
                $actorId,
                'task',
                $taskId,
                'task.created',
                "{$taskKey}: '{$title}' vazifasi yaratildi.",
                ['task_key' => $taskKey, 'priority' => $priority],
                $projectId,
                $taskId
            );

            if ($assigneeId && $assigneeId !== $actorId) {
                NotificationService::notify(
                    $wsId,
                    $assigneeId,
                    $actorId,
                    'task_assigned',
                    "Sizga yangi vazifa biriktirildi: {$taskKey}",
                    $title,
                    'task',
                    $taskId,
                    $projectId,
                    $taskKey
                );
            }

            $tx->commit();
            return $this->actionView($taskId);
        } catch (\Throwable $e) {
            $tx->rollBack();
            throw $e;
        }
    }

    public function actionView(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];

        $enriched = $this->enrichTaskList([$task])[0];

        // Subtasks
        $subtaskRows = (new Query())
            ->from('{{%tasks}}')
            ->where(['parent_task_id' => $id, 'deleted_at' => null])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();
        $subtasks = $this->enrichTaskList($subtaskRows);

        // Parent task info if any
        $parentTask = null;
        if (!empty($task['parent_task_id'])) {
            $pt = (new Query())
                ->select(['id', 'task_key', 'title', 'status_id'])
                ->from('{{%tasks}}')
                ->where(['id' => (int)$task['parent_task_id']])
                ->one();
            if ($pt) {
                $parentTask = [
                    'id' => (int)$pt['id'],
                    'task_key' => $pt['task_key'],
                    'title' => $pt['title'],
                    'status_id' => (int)$pt['status_id'],
                ];
            }
        }

        // Checklists
        $checklists = (new Query())
            ->from('{{%task_checklists}}')
            ->where(['task_id' => $id])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $checklistItems = (new Query())
            ->from('{{%task_checklist_items}}')
            ->where(['task_id' => $id])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $itemsByChecklist = [];
        foreach ($checklistItems as $item) {
            $cid = (int)$item['checklist_id'];
            $itemsByChecklist[$cid][] = [
                'id' => (int)$item['id'],
                'checklist_id' => $cid,
                'title' => $item['title'],
                'is_completed' => (bool)$item['is_completed'],
                'assignee_id' => $item['assignee_id'] ? (int)$item['assignee_id'] : null,
                'position' => (int)$item['position'],
            ];
        }

        $formattedChecklists = array_map(function ($cl) use ($itemsByChecklist) {
            $cid = (int)$cl['id'];
            return [
                'id' => $cid,
                'task_id' => (int)$cl['task_id'],
                'title' => $cl['title'],
                'items' => $itemsByChecklist[$cid] ?? [],
            ];
        }, $checklists);

        // Dependencies: blocked_by (tasks this task depends on) & blocking (tasks that depend on this task)
        $blockedByRows = (new Query())
            ->select([
                'd.id AS dep_id', 'd.dependency_type', 'd.depends_on_task_id AS other_task_id',
                't.task_key', 't.title', 't.priority', 't.status_id',
                's.name AS status_name', 's.category AS status_category', 's.color AS status_color',
            ])
            ->from(['d' => '{{%task_dependencies}}'])
            ->innerJoin(['t' => '{{%tasks}}'], 't.id = d.depends_on_task_id')
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['d.task_id' => $id, 't.deleted_at' => null])
            ->all();

        $blockingRows = (new Query())
            ->select([
                'd.id AS dep_id', 'd.dependency_type', 'd.task_id AS other_task_id',
                't.task_key', 't.title', 't.priority', 't.status_id',
                's.name AS status_name', 's.category AS status_category', 's.color AS status_color',
            ])
            ->from(['d' => '{{%task_dependencies}}'])
            ->innerJoin(['t' => '{{%tasks}}'], 't.id = d.task_id')
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['d.depends_on_task_id' => $id, 't.deleted_at' => null])
            ->all();

        // Watchers
        $watcherIds = array_map('intval', (new Query())
            ->select('user_id')
            ->from('{{%task_watchers}}')
            ->where(['task_id' => $id])
            ->column());

        // Time entries
        $timeEntries = (new Query())
            ->from('{{%time_entries}}')
            ->where(['task_id' => $id])
            ->orderBy(['id' => SORT_DESC])
            ->all();

        // Attachments
        $attachments = (new Query())
            ->from('{{%task_attachments}}')
            ->where(['task_id' => $id])
            ->orderBy(['id' => SORT_DESC])
            ->all();

        // Comments
        $comments = (new Query())
            ->from('{{%task_comments}}')
            ->where(['task_id' => $id, 'deleted_at' => null])
            ->orderBy(['is_pinned' => SORT_DESC, 'id' => SORT_ASC])
            ->all();

        // Activity history
        $activities = (new Query())
            ->from('{{%activity_logs}}')
            ->where(['task_id' => $id])
            ->orderBy(['id' => SORT_DESC])
            ->limit(60)
            ->all();

        $allUserIds = array_merge(
            $watcherIds,
            array_column($timeEntries, 'user_id'),
            array_column($attachments, 'uploaded_by'),
            array_column($comments, 'author_id'),
            array_column($activities, 'actor_id')
        );
        $usersMap = $this->enrichUsersMap($allUserIds);

        return $this->ok([
            'task' => array_merge($enriched, [
                'parent_task' => $parentTask,
                'subtasks' => $subtasks,
                'checklists' => $formattedChecklists,
                'dependencies' => [
                    'blocked_by' => array_map(function ($r) {
                        return [
                            'id' => (int)$r['dep_id'],
                            'task_id' => (int)$r['other_task_id'],
                            'task_key' => $r['task_key'],
                            'title' => $r['title'],
                            'priority' => $r['priority'],
                            'status_name' => $r['status_name'],
                            'status_category' => $r['status_category'],
                            'status_color' => $r['status_color'],
                            'is_resolved' => ($r['status_category'] === 'done'),
                        ];
                    }, $blockedByRows),
                    'blocking' => array_map(function ($r) {
                        return [
                            'id' => (int)$r['dep_id'],
                            'task_id' => (int)$r['other_task_id'],
                            'task_key' => $r['task_key'],
                            'title' => $r['title'],
                            'priority' => $r['priority'],
                            'status_name' => $r['status_name'],
                            'status_category' => $r['status_category'],
                            'status_color' => $r['status_color'],
                            'is_resolved' => ($r['status_category'] === 'done'),
                        ];
                    }, $blockingRows),
                ],
                'watcher_ids' => $watcherIds,
                'is_watching' => in_array($userId, $watcherIds, true),
                'time_entries' => array_map(function ($te) use ($usersMap) {
                    $uid = (int)$te['user_id'];
                    return [
                        'id' => (int)$te['id'],
                        'task_id' => (int)$te['task_id'],
                        'user_id' => $uid,
                        'user' => $usersMap[$uid] ?? null,
                        'description' => $te['description'],
                        'duration_minutes' => (int)$te['duration_minutes'],
                        'logged_date' => $te['logged_date'],
                        'is_billable' => (bool)$te['is_billable'],
                        'created_at' => $te['created_at'],
                    ];
                }, $timeEntries),
                'attachments' => array_map(function ($att) use ($usersMap) {
                    $uid = (int)$att['uploaded_by'];
                    return [
                        'id' => (int)$att['id'],
                        'task_id' => (int)$att['task_id'],
                        'uploaded_by' => $uid,
                        'uploader' => $usersMap[$uid] ?? null,
                        'original_name' => $att['original_name'],
                        'file_url' => $att['file_url'],
                        'mime_type' => $att['mime_type'],
                        'size_bytes' => (int)$att['size_bytes'],
                        'created_at' => $att['created_at'],
                    ];
                }, $attachments),
                'comments' => array_map(function ($c) use ($usersMap) {
                    $aid = (int)$c['author_id'];
                    return [
                        'id' => (int)$c['id'],
                        'task_id' => (int)$c['task_id'],
                        'parent_comment_id' => $c['parent_comment_id'] ? (int)$c['parent_comment_id'] : null,
                        'author_id' => $aid,
                        'author' => $usersMap[$aid] ?? null,
                        'body' => $c['body'],
                        'is_pinned' => (bool)$c['is_pinned'],
                        'reactions' => $c['reactions_json'] ? json_decode($c['reactions_json'], true) : new \stdClass(),
                        'edited_at' => $c['edited_at'],
                        'created_at' => $c['created_at'],
                    ];
                }, $comments),
                'activities' => array_map(function ($act) use ($usersMap) {
                    $aid = (int)$act['actor_id'];
                    return [
                        'id' => (int)$act['id'],
                        'actor_id' => $aid,
                        'actor' => $usersMap[$aid] ?? null,
                        'action' => $act['action'],
                        'summary' => $act['summary'],
                        'metadata' => $act['metadata_json'] ? json_decode($act['metadata_json'], true) : [],
                        'created_at' => $act['created_at'],
                    ];
                }, $activities),
            ]),
        ]);
    }

    public function actionUpdate(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $projectId = (int)$task['project_id'];
        $body = $this->bodyParams();

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $updates = ['updated_at' => $now];
        $changesLog = [];

        if (isset($body['title']) && trim((string)$body['title']) !== '') {
            $newTitle = trim((string)$body['title']);
            if ($newTitle !== $task['title']) {
                $updates['title'] = $newTitle;
                $changesLog[] = "Sarlavha yangilandi";
            }
        }

        if (array_key_exists('description', $body)) {
            $updates['description'] = $body['description'] !== null ? (string)$body['description'] : null;
        }

        if (isset($body['priority'])) {
            $prio = (string)$body['priority'];
            if (in_array($prio, ['none', 'low', 'medium', 'high', 'urgent'], true) && $prio !== $task['priority']) {
                $updates['priority'] = $prio;
                $changesLog[] = "Ustuvorlik '{$task['priority']}' dan '{$prio}' ga o‘zgartirildi";
            }
        }

        if (array_key_exists('assignee_id', $body)) {
            $newAssignee = !empty($body['assignee_id']) ? (int)$body['assignee_id'] : null;
            if ($newAssignee !== ($task['assignee_id'] ? (int)$task['assignee_id'] : null)) {
                if ($newAssignee) {
                    TenantAccessGuard::assertUserInWorkspace($wsId, $newAssignee);
                }
                $updates['assignee_id'] = $newAssignee;
                $changesLog[] = $newAssignee ? "Mas’ul foydalanuvchi #{$newAssignee} etib belgilandi" : "Mas’ul shaxs olib tashlandi";
            }
        }

        if (isset($body['status_id'])) {
            $newStatusId = (int)$body['status_id'];
            if ($newStatusId !== (int)$task['status_id']) {
                $newStatus = (new Query())->from('{{%task_statuses}}')->where(['id' => $newStatusId, 'project_id' => $projectId])->one();
                if (!$newStatus) {
                    throw new UnprocessableEntityHttpException('Tanlangan status ushbu loyihaga tegishli emas.');
                }
                $oldStatus = (new Query())->from('{{%task_statuses}}')->where(['id' => (int)$task['status_id']])->one();
                $oldStatusName = $oldStatus ? $oldStatus['name'] : 'Oldingi';

                // Check unresolved blockers if moving to done
                if ($newStatus['category'] === 'done' && empty($body['force'])) {
                    $unresolvedBlocker = (new Query())
                        ->select(['t.task_key', 't.title'])
                        ->from(['d' => '{{%task_dependencies}}'])
                        ->innerJoin(['t' => '{{%tasks}}'], 't.id = d.depends_on_task_id')
                        ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
                        ->where(['d.task_id' => $id, 't.deleted_at' => null])
                        ->andWhere(['<>', 's.category', 'done'])
                        ->one();
                    if ($unresolvedBlocker) {
                        throw new UnprocessableEntityHttpException(
                            "Ushbu vazifani yakunlashdan oldin uni to‘sib turgan bloker vazifa ({$unresolvedBlocker['task_key']}: {$unresolvedBlocker['title']}) bajarilishi kerak!"
                        );
                    }
                }

                $updates['status_id'] = $newStatusId;
                $updates['completed_at'] = ($newStatus['category'] === 'done') ? $now : null;
                $changesLog[] = "Status '{$oldStatusName}' ➔ '{$newStatus['name']}' ga o‘zgartirildi";
            }
        }

        foreach (['sprint_id', 'start_date', 'due_at', 'estimate_minutes', 'story_points', 'is_milestone', 'archived_at', 'parent_task_id'] as $field) {
            if (array_key_exists($field, $body)) {
                if ($field === 'parent_task_id' && !empty($body['parent_task_id'])) {
                    $pid = (int)$body['parent_task_id'];
                    if ($pid === $id) {
                        throw new UnprocessableEntityHttpException('Vazifa o‘ziga ota-vazifa bo‘la olmaydi.');
                    }
                    $pt = (new Query())->from('{{%tasks}}')->where(['id' => $pid, 'deleted_at' => null])->one();
                    if (!$pt || (int)$pt['project_id'] !== $projectId) {
                        throw new UnprocessableEntityHttpException('Subtask ota-vazifasi aynan shu loyiha ichida bo‘lishi kerak.');
                    }
                }
                $updates[$field] = $body[$field];
            }
        }

        Yii::$app->db->createCommand()->update('{{%tasks}}', $updates, ['id' => $id])->execute();

        if (!empty($changesLog)) {
            $summary = $task['task_key'] . ': ' . implode('; ', $changesLog);
            ActivityLogService::log($wsId, $actorId, 'task', $id, 'task.updated', $summary, $updates, $projectId, $id);
        }

        // Notify newly assigned user
        if (array_key_exists('assignee_id', $updates) && $updates['assignee_id'] && (int)$updates['assignee_id'] !== $actorId) {
            NotificationService::notify(
                $wsId,
                (int)$updates['assignee_id'],
                $actorId,
                'task_assigned',
                "Sizga vazifa biriktirildi: {$task['task_key']}",
                $updates['title'] ?? $task['title'],
                'task',
                $id,
                $projectId,
                $task['task_key']
            );
        }

        // If task was just completed, notify assignees of any tasks that were blocked by this task!
        if (!empty($updates['completed_at']) && empty($task['completed_at'])) {
            $dependentTasks = (new Query())
                ->select(['t.id', 't.task_key', 't.title', 't.assignee_id', 't.project_id'])
                ->from(['d' => '{{%task_dependencies}}'])
                ->innerJoin(['t' => '{{%tasks}}'], 't.id = d.task_id')
                ->where(['d.depends_on_task_id' => $id, 't.deleted_at' => null])
                ->all();

            foreach ($dependentTasks as $dt) {
                if (!empty($dt['assignee_id']) && (int)$dt['assignee_id'] !== $actorId) {
                    NotificationService::notify(
                        $wsId,
                        (int)$dt['assignee_id'],
                        $actorId,
                        'blocker_resolved',
                        "Bloker yechildi! ({$task['task_key']} bajarildi)",
                        "Endi {$dt['task_key']}: '{$dt['title']}' vazifasini davom ettirishingiz mumkin.",
                        'task',
                        (int)$dt['id'],
                        (int)$dt['project_id'],
                        $dt['task_key']
                    );
                }
            }
        }

        return $this->actionView($id);
    }

    /**
     * Kanban Board Drag-and-Drop endpoint with fractional position & status persistence.
     */
    public function actionMove(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $projectId = (int)$task['project_id'];
        $body = $this->bodyParams();

        $targetStatusId = isset($body['status_id']) ? (int)$body['status_id'] : (int)$task['status_id'];
        $statusRow = (new Query())->from('{{%task_statuses}}')->where(['id' => $targetStatusId, 'project_id' => $projectId])->one();
        if (!$statusRow) {
            throw new UnprocessableEntityHttpException('Maqsadli status ustuni ushbu loyihaga tegishli emas.');
        }

        // Calculate new fractional position
        $newPosition = isset($body['position']) ? (float)$body['position'] : null;
        if ($newPosition === null) {
            $beforeId = !empty($body['before_task_id']) ? (int)$body['before_task_id'] : null;
            $afterId = !empty($body['after_task_id']) ? (int)$body['after_task_id'] : null;

            $beforePos = $beforeId ? (float)(new Query())->select('position')->from('{{%tasks}}')->where(['id' => $beforeId])->scalar() : null;
            $afterPos = $afterId ? (float)(new Query())->select('position')->from('{{%tasks}}')->where(['id' => $afterId])->scalar() : null;

            if ($beforePos !== null && $afterPos !== null) {
                $newPosition = ($beforePos + $afterPos) / 2.0;
            } elseif ($beforePos !== null) {
                $newPosition = $beforePos / 2.0;
            } elseif ($afterPos !== null) {
                $newPosition = $afterPos + 1024.0;
            } else {
                $maxPos = (float)(new Query())->from('{{%tasks}}')->where(['project_id' => $projectId, 'status_id' => $targetStatusId])->max('position');
                $newPosition = $maxPos + 1024.0;
            }
        }

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $oldStatusId = (int)$task['status_id'];

        $updates = [
            'status_id' => $targetStatusId,
            'position' => $newPosition,
            'updated_at' => $now,
        ];

        if ($oldStatusId !== $targetStatusId) {
            $updates['completed_at'] = ($statusRow['category'] === 'done') ? $now : null;
        }

        Yii::$app->db->createCommand()->update('{{%tasks}}', $updates, ['id' => $id])->execute();

        if ($oldStatusId !== $targetStatusId) {
            $oldStatusName = (string)(new Query())->select('name')->from('{{%task_statuses}}')->where(['id' => $oldStatusId])->scalar();
            ActivityLogService::log(
                $wsId,
                $actorId,
                'task',
                $id,
                'task.moved',
                "{$task['task_key']} Kanban doskada '{$oldStatusName}' ustunidan '{$statusRow['name']}' ustuniga ko‘chirildi.",
                ['from_status_id' => $oldStatusId, 'to_status_id' => $targetStatusId, 'position' => $newPosition],
                $projectId,
                $id
            );
        }

        return $this->ok([
            'task_id' => $id,
            'status_id' => $targetStatusId,
            'position' => $newPosition,
            'completed_at' => $updates['completed_at'] ?? $task['completed_at'],
        ]);
    }

    public function actionBulkUpdate(int $wsId): array
    {
        $actorId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['task_ids', 'action']);

        $taskIds = array_values(array_unique(array_filter(array_map('intval', (array)$body['task_ids']))));
        if (empty($taskIds)) {
            throw new UnprocessableEntityHttpException('Hech qanday vazifa tanlanmagan.');
        }

        $action = (string)$body['action'];
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $cond = ['id' => $taskIds, 'workspace_id' => $wsId];

        if ($action === 'priority' && !empty($body['value'])) {
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['priority' => (string)$body['value'], 'updated_at' => $now], $cond)->execute();
        } elseif ($action === 'assignee') {
            $aid = !empty($body['value']) ? (int)$body['value'] : null;
            if ($aid) TenantAccessGuard::assertUserInWorkspace($wsId, $aid);
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['assignee_id' => $aid, 'updated_at' => $now], $cond)->execute();
        } elseif ($action === 'status' && !empty($body['value'])) {
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['status_id' => (int)$body['value'], 'updated_at' => $now], $cond)->execute();
        } elseif ($action === 'sprint') {
            $spId = !empty($body['value']) ? (int)$body['value'] : null;
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['sprint_id' => $spId, 'updated_at' => $now], $cond)->execute();
        } elseif ($action === 'archive') {
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['archived_at' => $now, 'updated_at' => $now], $cond)->execute();
        } elseif ($action === 'delete') {
            Yii::$app->db->createCommand()->update('{{%tasks}}', ['deleted_at' => $now, 'updated_at' => $now], $cond)->execute();
        }

        ActivityLogService::log($wsId, $actorId, 'task', $taskIds[0], 'task.bulk_updated', count($taskIds) . " ta vazifa ommaviy yangilandi ({$action}).");
        return $this->ok(['updated_count' => count($taskIds)]);
    }

    public function actionDelete(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];

        $now = gmdate('Y-m-d\TH:i:s\Z');
        Yii::$app->db->createCommand()->update('{{%tasks}}', ['deleted_at' => $now, 'updated_at' => $now], ['id' => $id])->execute();

        ActivityLogService::log($wsId, $actorId, 'task', $id, 'task.deleted', "{$task['task_key']}: '{$task['title']}' savatga o‘tkazildi.", [], (int)$task['project_id'], $id);
        return $this->ok(['message' => 'Vazifa savatga joylandi.']);
    }

    public function actionToggleWatch(int $id): array
    {
        $userId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);
        $wsId = (int)$ctx['task']['workspace_id'];

        $existing = (new Query())
            ->from('{{%task_watchers}}')
            ->where(['task_id' => $id, 'user_id' => $userId])
            ->one();

        if ($existing) {
            Yii::$app->db->createCommand()->delete('{{%task_watchers}}', ['id' => $existing['id']])->execute();
        } else {
            Yii::$app->db->createCommand()->insert('{{%task_watchers}}', [
                'workspace_id' => $wsId,
                'task_id' => $id,
                'user_id' => $userId,
                'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ])->execute();
        }

        return $this->actionView($id);
    }

    public function actionSyncLabels(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $wsId = (int)$ctx['task']['workspace_id'];
        $body = $this->bodyParams();

        $labelIds = array_values(array_unique(array_filter(array_map('intval', (array)($body['label_ids'] ?? [])))));
        Yii::$app->db->createCommand()->delete('{{%task_labels}}', ['task_id' => $id])->execute();

        foreach ($labelIds as $lid) {
            $valid = (new Query())->from('{{%labels}}')->where(['id' => $lid, 'workspace_id' => $wsId])->exists();
            if ($valid) {
                Yii::$app->db->createCommand()->insert('{{%task_labels}}', [
                    'task_id' => $id,
                    'label_id' => $lid,
                ])->execute();
            }
        }

        return $this->actionView($id);
    }

    // --- CHECKLISTS ---
    public function actionCreateChecklist(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $wsId = (int)$ctx['task']['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['title']);

        Yii::$app->db->createCommand()->insert('{{%task_checklists}}', [
            'workspace_id' => $wsId,
            'task_id' => $id,
            'title' => trim((string)$body['title']),
            'position' => 100,
        ])->execute();

        return $this->actionView($id);
    }

    public function actionDeleteChecklist(int $id): array
    {
        $actorId = $this->currentUserId();
        $cl = (new Query())->from('{{%task_checklists}}')->where(['id' => $id])->one();
        if (!$cl) {
            throw new NotFoundHttpException('Checklist topilmadi.');
        }

        $taskId = (int)$cl['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->delete('{{%task_checklist_items}}', ['checklist_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%task_checklists}}', ['id' => $id])->execute();

        return $this->actionView($taskId);
    }

    public function actionAddChecklistItem(int $id): array
    {
        $actorId = $this->currentUserId();
        $cl = (new Query())->from('{{%task_checklists}}')->where(['id' => $id])->one();
        if (!$cl) {
            throw new NotFoundHttpException('Checklist topilmadi.');
        }

        $taskId = (int)$cl['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['title']);

        Yii::$app->db->createCommand()->insert('{{%task_checklist_items}}', [
            'checklist_id' => $id,
            'task_id' => $taskId,
            'title' => trim((string)$body['title']),
            'is_completed' => false,
            'assignee_id' => !empty($body['assignee_id']) ? (int)$body['assignee_id'] : null,
            'position' => 100,
        ])->execute();

        return $this->actionView($taskId);
    }

    public function actionUpdateChecklistItem(int $id): array
    {
        $actorId = $this->currentUserId();
        $item = (new Query())->from('{{%task_checklist_items}}')->where(['id' => $id])->one();
        if (!$item) {
            throw new NotFoundHttpException('Checklist elementi topilmadi.');
        }

        $taskId = (int)$item['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        foreach (['title', 'is_completed', 'assignee_id'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }
        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%task_checklist_items}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionView($taskId);
    }

    public function actionDeleteChecklistItem(int $id): array
    {
        $actorId = $this->currentUserId();
        $item = (new Query())->from('{{%task_checklist_items}}')->where(['id' => $id])->one();
        if (!$item) {
            throw new NotFoundHttpException('Checklist elementi topilmadi.');
        }

        $taskId = (int)$item['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        Yii::$app->db->createCommand()->delete('{{%task_checklist_items}}', ['id' => $id])->execute();

        return $this->actionView($taskId);
    }

    // --- DEPENDENCIES (WITH CYCLE DETECTION) ---
    public function actionAddDependency(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['depends_on_task_id']);

        $blockerId = (int)$body['depends_on_task_id'];
        if ($blockerId === $id) {
            throw new UnprocessableEntityHttpException('Vazifa o‘z-o‘ziga bog‘liq bo‘lishi mumkin emas.');
        }

        $blockerTask = (new Query())->from('{{%tasks}}')->where(['id' => $blockerId, 'workspace_id' => $wsId, 'deleted_at' => null])->one();
        if (!$blockerTask) {
            throw new NotFoundHttpException('Bog‘lanayotgan vazifa topilmadi.');
        }

        // Prevent circular dependency (if $blockerId already depends on $id directly or transitively)
        if ($this->createsDependencyCycle($blockerId, $id)) {
            throw new UnprocessableEntityHttpException('Xatolik: Ushbu bog‘liqlik halqasimon (circular dependency) sikl hosil qiladi!');
        }

        $exists = (new Query())
            ->from('{{%task_dependencies}}')
            ->where(['task_id' => $id, 'depends_on_task_id' => $blockerId])
            ->exists();

        if (!$exists) {
            Yii::$app->db->createCommand()->insert('{{%task_dependencies}}', [
                'workspace_id' => $wsId,
                'task_id' => $id,
                'depends_on_task_id' => $blockerId,
                'dependency_type' => $body['dependency_type'] ?? 'blocked_by',
                'created_by' => $actorId,
                'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
            ])->execute();

            ActivityLogService::log(
                $wsId,
                $actorId,
                'task',
                $id,
                'dependency.added',
                "{$task['task_key']} vazifasiga {$blockerTask['task_key']} bloker sifatida biriktirildi.",
                [],
                (int)$task['project_id'],
                $id
            );
        }

        return $this->actionView($id);
    }

    public function actionRemoveDependency(int $id): array
    {
        $actorId = $this->currentUserId();
        $dep = (new Query())->from('{{%task_dependencies}}')->where(['id' => $id])->one();
        if (!$dep) {
            throw new NotFoundHttpException('Bog‘liqlik topilmadi.');
        }

        $taskId = (int)$dep['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        Yii::$app->db->createCommand()->delete('{{%task_dependencies}}', ['id' => $id])->execute();

        return $this->actionView($taskId);
    }

    private function createsDependencyCycle(int $startTaskId, int $targetTaskId): bool
    {
        $visited = [];
        $queue = [$startTaskId];

        while (!empty($queue)) {
            $curr = array_shift($queue);
            if ($curr === $targetTaskId) {
                return true;
            }
            if (isset($visited[$curr])) {
                continue;
            }
            $visited[$curr] = true;

            $nextIds = (new Query())
                ->select('depends_on_task_id')
                ->from('{{%task_dependencies}}')
                ->where(['task_id' => $curr])
                ->column();

            foreach ($nextIds as $nid) {
                $queue[] = (int)$nid;
            }
        }
        return false;
    }

    // --- TIME TRACKING ---
    public function actionAddTimeEntry(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $projectId = (int)$task['project_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['duration_minutes']);

        $minutes = max(1, (int)$body['duration_minutes']);
        $now = gmdate('Y-m-d\TH:i:s\Z');

        Yii::$app->db->createCommand()->insert('{{%time_entries}}', [
            'workspace_id' => $wsId,
            'project_id' => $projectId,
            'task_id' => $id,
            'user_id' => $actorId,
            'description' => trim((string)($body['description'] ?? 'Ish jarayoni')),
            'duration_minutes' => $minutes,
            'logged_date' => $body['logged_date'] ?? gmdate('Y-m-d'),
            'is_billable' => isset($body['is_billable']) ? (bool)$body['is_billable'] : true,
            'created_at' => $now,
        ])->execute();

        $totalLogged = (int)(new Query())->from('{{%time_entries}}')->where(['task_id' => $id])->sum('duration_minutes');
        Yii::$app->db->createCommand()->update('{{%tasks}}', ['logged_minutes' => $totalLogged, 'updated_at' => $now], ['id' => $id])->execute();

        ActivityLogService::log($wsId, $actorId, 'task', $id, 'time.logged', "{$task['task_key']} uchun {$minutes} daqiqa ish vaqti qayd etildi.", ['minutes' => $minutes], $projectId, $id);
        return $this->actionView($id);
    }

    public function actionDeleteTimeEntry(int $id): array
    {
        $actorId = $this->currentUserId();
        $te = (new Query())->from('{{%time_entries}}')->where(['id' => $id])->one();
        if (!$te) {
            throw new NotFoundHttpException('Vaqt qaydi topilmadi.');
        }

        $taskId = (int)$te['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->delete('{{%time_entries}}', ['id' => $id])->execute();
        $totalLogged = (int)(new Query())->from('{{%time_entries}}')->where(['task_id' => $taskId])->sum('duration_minutes');
        Yii::$app->db->createCommand()->update('{{%tasks}}', ['logged_minutes' => $totalLogged], ['id' => $taskId])->execute();

        return $this->actionView($taskId);
    }

    public function actionWorkspaceTimeEntries(int $wsId): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireWorkspaceRole($wsId, $userId, TenantAccessGuard::ROLE_VIEWER);

        $rows = (new Query())
            ->select(['te.*', 't.task_key', 't.title AS task_title', 'p.name AS project_name', 'p.color AS project_color'])
            ->from(['te' => '{{%time_entries}}'])
            ->innerJoin(['t' => '{{%tasks}}'], 't.id = te.task_id')
            ->innerJoin(['p' => '{{%projects}}'], 'p.id = te.project_id')
            ->where(['te.workspace_id' => $wsId, 't.deleted_at' => null])
            ->orderBy(['te.logged_date' => SORT_DESC, 'te.id' => SORT_DESC])
            ->limit(200)
            ->all();

        $usersMap = $this->enrichUsersMap(array_column($rows, 'user_id'));

        return $this->ok([
            'time_entries' => array_map(function ($r) use ($usersMap) {
                $uid = (int)$r['user_id'];
                return [
                    'id' => (int)$r['id'],
                    'project_id' => (int)$r['project_id'],
                    'project_name' => $r['project_name'],
                    'project_color' => $r['project_color'],
                    'task_id' => (int)$r['task_id'],
                    'task_key' => $r['task_key'],
                    'task_title' => $r['task_title'],
                    'user_id' => $uid,
                    'user' => $usersMap[$uid] ?? null,
                    'description' => $r['description'],
                    'duration_minutes' => (int)$r['duration_minutes'],
                    'logged_date' => $r['logged_date'],
                    'is_billable' => (bool)$r['is_billable'],
                    'created_at' => $r['created_at'],
                ];
            }, $rows),
        ]);
    }

    // --- ATTACHMENTS ---
    public function actionAddAttachment(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['original_name']);

        $originalName = basename(trim((string)$body['original_name']));
        $mimeType = (string)($body['mime_type'] ?? 'application/octet-stream');
        $sizeBytes = (int)($body['size_bytes'] ?? 0);
        $fileUrl = (string)($body['file_url'] ?? '');

        // Handle real file upload if base64 content is provided
        if (!empty($body['file_content_base64'])) {
            $rawBase64 = (string)$body['file_content_base64'];
            if (strpos($rawBase64, ',') !== false) {
                $rawBase64 = explode(',', $rawBase64, 2)[1];
            }
            $binary = base64_decode($rawBase64, true);
            if ($binary === false) {
                throw new UnprocessableEntityHttpException('Yuklangan fayl ma’lumotlari yaroqsiz.');
            }
            $sizeBytes = strlen($binary);
            if ($sizeBytes > 10 * 1024 * 1024) {
                throw new UnprocessableEntityHttpException('Fayl hajmi 10 MB dan oshmasligi kerak.');
            }

            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            $blockedExts = ['php', 'phtml', 'phar', 'exe', 'bat', 'cmd', 'sh'];
            if (in_array($ext, $blockedExts, true)) {
                throw new UnprocessableEntityHttpException('Xavfsizlik qoidasi: ushbu turdagi fayllarni yuklash taqiqlanadi.');
            }

            $uploadDir = Yii::getAlias('@app/web/uploads/tasks');
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0777, true);
            }

            $safeFilename = 'task_' . $id . '_' . time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $originalName);
            file_put_contents($uploadDir . DIRECTORY_SEPARATOR . $safeFilename, $binary);
            $fileUrl = '/uploads/tasks/' . $safeFilename;
        }

        if ($fileUrl === '') {
            $fileUrl = '#';
        }

        Yii::$app->db->createCommand()->insert('{{%task_attachments}}', [
            'workspace_id' => $wsId,
            'task_id' => $id,
            'uploaded_by' => $actorId,
            'original_name' => $originalName,
            'file_url' => $fileUrl,
            'mime_type' => $mimeType,
            'size_bytes' => $sizeBytes > 0 ? $sizeBytes : 1024,
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ])->execute();

        ActivityLogService::log(
            $wsId,
            $actorId,
            'task',
            $id,
            'attachment.added',
            "{$task['task_key']} vazifasiga '{$originalName}' fayli biriktirildi.",
            ['file_name' => $originalName, 'size_bytes' => $sizeBytes],
            (int)$task['project_id'],
            $id
        );

        return $this->actionView($id);
    }

    public function actionDeleteAttachment(int $id): array
    {
        $actorId = $this->currentUserId();
        $att = (new Query())->from('{{%task_attachments}}')->where(['id' => $id])->one();
        if (!$att) {
            throw new NotFoundHttpException('Fayl topilmadi.');
        }

        $taskId = (int)$att['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        Yii::$app->db->createCommand()->delete('{{%task_attachments}}', ['id' => $id])->execute();

        return $this->actionView($taskId);
    }

    // --- COMMENTS & @MENTIONS & REACTIONS ---
    public function actionAddComment(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireTaskAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $task = $ctx['task'];
        $wsId = (int)$task['workspace_id'];
        $projectId = (int)$task['project_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['body']);

        $text = trim((string)$body['body']);
        $now = gmdate('Y-m-d\TH:i:s\Z');

        Yii::$app->db->createCommand()->insert('{{%task_comments}}', [
            'workspace_id' => $wsId,
            'task_id' => $id,
            'parent_comment_id' => !empty($body['parent_comment_id']) ? (int)$body['parent_comment_id'] : null,
            'author_id' => $actorId,
            'body' => $text,
            'is_pinned' => false,
            'reactions_json' => json_encode(new \stdClass()),
            'created_at' => $now,
        ])->execute();

        $commentId = (int)Yii::$app->db->getLastInsertID();

        ActivityLogService::log(
            $wsId,
            $actorId,
            'comment',
            $commentId,
            'comment.added',
            "{$task['task_key']} vazifasiga yangi izoh qoldirildi.",
            ['preview' => mb_substr($text, 0, 90)],
            $projectId,
            $id
        );

        // Parse @username mentions and notify mentioned users
        $notifiedUserIds = [$actorId];
        if (preg_match_all('/@([a-zA-Z0-9_.-]+)/', $text, $matches)) {
            $usernames = array_unique(array_map('strtolower', $matches[1]));
            $mentionedUsers = (new Query())
                ->select(['id', 'username'])
                ->from('{{%users}}')
                ->where(['username' => $usernames])
                ->all();

            foreach ($mentionedUsers as $mu) {
                $muId = (int)$mu['id'];
                if (!in_array($muId, $notifiedUserIds, true)) {
                    NotificationService::notify(
                        $wsId,
                        $muId,
                        $actorId,
                        'mentioned',
                        "{$task['task_key']} izohida sizni @eslab o‘tishdi",
                        mb_substr($text, 0, 140),
                        'task',
                        $id,
                        $projectId,
                        $task['task_key']
                    );
                    $notifiedUserIds[] = $muId;
                }
            }
        }

        // Notify watchers and assignee
        $watcherIds = (new Query())->select('user_id')->from('{{%task_watchers}}')->where(['task_id' => $id])->column();
        if (!empty($task['assignee_id'])) {
            $watcherIds[] = (int)$task['assignee_id'];
        }
        foreach (array_unique(array_map('intval', $watcherIds)) as $wid) {
            if (!in_array($wid, $notifiedUserIds, true)) {
                NotificationService::notify(
                    $wsId,
                    $wid,
                    $actorId,
                    'comment_added',
                    "{$task['task_key']} vazifasida yangi izoh",
                    mb_substr($text, 0, 140),
                    'task',
                    $id,
                    $projectId,
                    $task['task_key']
                );
                $notifiedUserIds[] = $wid;
            }
        }

        return $this->actionView($id);
    }

    public function actionUpdateComment(int $id): array
    {
        $actorId = $this->currentUserId();
        $comment = (new Query())->from('{{%task_comments}}')->where(['id' => $id, 'deleted_at' => null])->one();
        if (!$comment) {
            throw new NotFoundHttpException('Izoh topilmadi.');
        }

        $taskId = (int)$comment['task_id'];
        $ctx = TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [];
        if (isset($body['body']) && trim((string)$body['body']) !== '') {
            if ((int)$comment['author_id'] !== $actorId && !in_array($ctx['role'], ['owner', 'admin'], true)) {
                throw new ForbiddenHttpException('Siz faqat o‘z izohingizni tahrirlay olasiz.');
            }
            $updates['body'] = trim((string)$body['body']);
            $updates['edited_at'] = gmdate('Y-m-d\TH:i:s\Z');
        }

        if (array_key_exists('is_pinned', $body)) {
            $updates['is_pinned'] = (bool)$body['is_pinned'];
        }

        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%task_comments}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionView($taskId);
    }

    public function actionDeleteComment(int $id): array
    {
        $actorId = $this->currentUserId();
        $comment = (new Query())->from('{{%task_comments}}')->where(['id' => $id, 'deleted_at' => null])->one();
        if (!$comment) {
            throw new NotFoundHttpException('Izoh topilmadi.');
        }

        $taskId = (int)$comment['task_id'];
        $ctx = TenantAccessGuard::requireTaskAccess($taskId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        if ((int)$comment['author_id'] !== $actorId && !in_array($ctx['role'], ['owner', 'admin'], true)) {
            throw new ForbiddenHttpException('Siz faqat o‘z izohingizni o‘chira olasiz.');
        }

        Yii::$app->db->createCommand()->update(
            '{{%task_comments}}',
            ['deleted_at' => gmdate('Y-m-d\TH:i:s\Z')],
            ['id' => $id]
        )->execute();

        return $this->actionView($taskId);
    }

    public function actionReactComment(int $id): array
    {
        $userId = $this->currentUserId();
        $comment = (new Query())->from('{{%task_comments}}')->where(['id' => $id, 'deleted_at' => null])->one();
        if (!$comment) {
            throw new NotFoundHttpException('Izoh topilmadi.');
        }

        $taskId = (int)$comment['task_id'];
        TenantAccessGuard::requireTaskAccess($taskId, $userId, TenantAccessGuard::ROLE_VIEWER);
        $body = $this->bodyParams();
        $this->requireFields($body, ['emoji']);

        $emoji = (string)$body['emoji'];
        $reactions = $comment['reactions_json'] ? json_decode($comment['reactions_json'], true) : [];
        if (!is_array($reactions)) {
            $reactions = [];
        }

        $list = $reactions[$emoji] ?? [];
        if (in_array($userId, $list, true)) {
            $list = array_values(array_diff($list, [$userId]));
            if (empty($list)) {
                unset($reactions[$emoji]);
            } else {
                $reactions[$emoji] = $list;
            }
        } else {
            $list[] = $userId;
            $reactions[$emoji] = array_values(array_unique($list));
        }

        Yii::$app->db->createCommand()->update(
            '{{%task_comments}}',
            ['reactions_json' => json_encode($reactions ?: new \stdClass())],
            ['id' => $id]
        )->execute();

        return $this->actionView($taskId);
    }

    /**
     * Enriches raw task rows with status, project, assignee, reporter, labels, subtask counts,
     * checklist item counts, unresolved blocker counts, and comment counts.
     */
    private function enrichTaskList(array $rows): array
    {
        if (empty($rows)) {
            return [];
        }

        $taskIds = array_map(fn($r) => (int)$r['id'], $rows);
        $projectIds = array_unique(array_map(fn($r) => (int)$r['project_id'], $rows));
        $statusIds = array_unique(array_map(fn($r) => (int)$r['status_id'], $rows));
        $userIds = array_merge(
            array_column($rows, 'assignee_id'),
            array_column($rows, 'reporter_id')
        );

        $usersMap = $this->enrichUsersMap($userIds);

        // Statuses map
        $statusesMap = [];
        foreach ((new Query())->from('{{%task_statuses}}')->where(['id' => $statusIds])->all() as $st) {
            $statusesMap[(int)$st['id']] = [
                'id' => (int)$st['id'],
                'name' => $st['name'],
                'category' => $st['category'],
                'color' => $st['color'],
            ];
        }

        // Projects map
        $projectsMap = [];
        foreach ((new Query())->select(['id', 'name', 'project_key', 'color', 'icon'])->from('{{%projects}}')->where(['id' => $projectIds])->all() as $pr) {
            $projectsMap[(int)$pr['id']] = [
                'id' => (int)$pr['id'],
                'name' => $pr['name'],
                'project_key' => $pr['project_key'],
                'color' => $pr['color'],
                'icon' => $pr['icon'],
            ];
        }

        // Labels per task
        $labelLinks = (new Query())
            ->select(['tl.task_id', 'l.id', 'l.name', 'l.color'])
            ->from(['tl' => '{{%task_labels}}'])
            ->innerJoin(['l' => '{{%labels}}'], 'l.id = tl.label_id')
            ->where(['tl.task_id' => $taskIds])
            ->all();
        $labelsByTask = [];
        foreach ($labelLinks as $ll) {
            $labelsByTask[(int)$ll['task_id']][] = [
                'id' => (int)$ll['id'],
                'name' => $ll['name'],
                'color' => $ll['color'],
            ];
        }

        // Subtask counts
        $subCounts = (new Query())
            ->select([
                't.parent_task_id',
                'COUNT(*) AS total',
                'SUM(CASE WHEN s.category = \'done\' THEN 1 ELSE 0 END) AS done',
            ])
            ->from(['t' => '{{%tasks}}'])
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['t.parent_task_id' => $taskIds, 't.deleted_at' => null])
            ->groupBy('t.parent_task_id')
            ->all();
        $subByTask = [];
        foreach ($subCounts as $sc) {
            $subByTask[(int)$sc['parent_task_id']] = [
                'total' => (int)$sc['total'],
                'done' => (int)$sc['done'],
            ];
        }

        // Checklist item counts
        $clCounts = (new Query())
            ->select([
                'task_id',
                'COUNT(*) AS total',
                'SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS done',
            ])
            ->from('{{%task_checklist_items}}')
            ->where(['task_id' => $taskIds])
            ->groupBy('task_id')
            ->all();
        $clByTask = [];
        foreach ($clCounts as $cc) {
            $clByTask[(int)$cc['task_id']] = [
                'total' => (int)$cc['total'],
                'done' => (int)$cc['done'],
            ];
        }

        // Unresolved blocker counts
        $blockerCounts = (new Query())
            ->select(['d.task_id', 'COUNT(*) AS cnt'])
            ->from(['d' => '{{%task_dependencies}}'])
            ->innerJoin(['t' => '{{%tasks}}'], 't.id = d.depends_on_task_id')
            ->leftJoin(['s' => '{{%task_statuses}}'], 's.id = t.status_id')
            ->where(['d.task_id' => $taskIds, 't.deleted_at' => null])
            ->andWhere(['<>', 's.category', 'done'])
            ->groupBy('d.task_id')
            ->all();
        $blockersByTask = [];
        foreach ($blockerCounts as $bc) {
            $blockersByTask[(int)$bc['task_id']] = (int)$bc['cnt'];
        }

        // Comment counts
        $commCounts = (new Query())
            ->select(['task_id', 'COUNT(*) AS cnt'])
            ->from('{{%task_comments}}')
            ->where(['task_id' => $taskIds, 'deleted_at' => null])
            ->groupBy('task_id')
            ->all();
        $commentsByTask = [];
        foreach ($commCounts as $cm) {
            $commentsByTask[(int)$cm['task_id']] = (int)$cm['cnt'];
        }

        return array_map(function ($t) use ($usersMap, $statusesMap, $projectsMap, $labelsByTask, $subByTask, $clByTask, $blockersByTask, $commentsByTask) {
            $tid = (int)$t['id'];
            $pid = (int)$t['project_id'];
            $sid = (int)$t['status_id'];
            $aid = $t['assignee_id'] ? (int)$t['assignee_id'] : null;
            $rid = (int)$t['reporter_id'];

            return [
                'id' => $tid,
                'workspace_id' => (int)$t['workspace_id'],
                'project_id' => $pid,
                'project' => $projectsMap[$pid] ?? null,
                'sprint_id' => $t['sprint_id'] ? (int)$t['sprint_id'] : null,
                'parent_task_id' => $t['parent_task_id'] ? (int)$t['parent_task_id'] : null,
                'task_number' => (int)$t['task_number'],
                'task_key' => $t['task_key'],
                'title' => $t['title'],
                'description' => $t['description'],
                'status_id' => $sid,
                'status' => $statusesMap[$sid] ?? null,
                'priority' => $t['priority'],
                'assignee_id' => $aid,
                'assignee' => $aid ? ($usersMap[$aid] ?? null) : null,
                'reporter_id' => $rid,
                'reporter' => $usersMap[$rid] ?? null,
                'start_date' => $t['start_date'],
                'due_at' => $t['due_at'],
                'completed_at' => $t['completed_at'],
                'estimate_minutes' => $t['estimate_minutes'] !== null ? (int)$t['estimate_minutes'] : null,
                'logged_minutes' => (int)$t['logged_minutes'],
                'story_points' => $t['story_points'] !== null ? (int)$t['story_points'] : null,
                'position' => (float)$t['position'],
                'is_milestone' => (bool)$t['is_milestone'],
                'labels' => $labelsByTask[$tid] ?? [],
                'subtasks_summary' => $subByTask[$tid] ?? ['total' => 0, 'done' => 0],
                'checklists_summary' => $clByTask[$tid] ?? ['total' => 0, 'done' => 0],
                'unresolved_blockers_count' => $blockersByTask[$tid] ?? 0,
                'comments_count' => $commentsByTask[$tid] ?? 0,
                'archived_at' => $t['archived_at'],
                'created_at' => $t['created_at'],
                'updated_at' => $t['updated_at'],
            ];
        }, $rows);
    }
}
