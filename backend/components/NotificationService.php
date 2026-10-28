<?php

namespace app\components;

use Yii;
use yii\db\Query;

class NotificationService
{
    public static function notify(
        int $workspaceId,
        int $recipientId,
        ?int $actorId,
        string $type,
        string $title,
        ?string $body,
        string $entityType,
        int $entityId,
        ?int $projectId = null,
        ?string $taskKey = null
    ): void {
        // Check if recipient is an active member of workspace
        $isMember = (new Query())
            ->from('{{%workspace_members}}')
            ->where(['workspace_id' => $workspaceId, 'user_id' => $recipientId, 'status' => 'active'])
            ->exists();

        if (!$isMember) {
            return;
        }

        // Check user notification preferences
        $pref = (new Query())
            ->from('{{%user_notification_prefs}}')
            ->where(['user_id' => $recipientId, 'event_type' => $type])
            ->one();

        if ($pref && !(bool)$pref['in_app_enabled']) {
            return;
        }

        Yii::$app->db->createCommand()->insert('{{%notifications}}', [
            'workspace_id' => $workspaceId,
            'recipient_id' => $recipientId,
            'actor_id' => $actorId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'project_id' => $projectId,
            'task_key' => $taskKey,
            'read_at' => null,
            'archived_at' => null,
            'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ])->execute();
    }
}
