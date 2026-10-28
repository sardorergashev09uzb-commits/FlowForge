<?php

namespace app\components;

use Yii;
use yii\db\Query;

class ActivityLogService
{
    public static function log(
        int $workspaceId,
        int $actorId,
        string $entityType,
        int $entityId,
        string $action,
        string $summary,
        array $metadata = [],
        ?int $projectId = null,
        ?int $taskId = null
    ): void {
        Yii::$app->db->createCommand()->insert('{{%activity_logs}}', [
            'workspace_id' => $workspaceId,
            'project_id' => $projectId,
            'task_id' => $taskId,
            'actor_id' => $actorId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'summary' => $summary,
            'metadata_json' => !empty($metadata) ? json_encode($metadata, JSON_UNESCAPED_UNICODE) : null,
            'ip_address' => Yii::$app->has('request') && !Yii::$app->request->isConsoleRequest
                ? Yii::$app->request->userIP
                : '127.0.0.1',
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ])->execute();
    }
}
