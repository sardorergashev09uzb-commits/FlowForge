<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\NotFoundHttpException;

class NotificationController extends BaseApiController
{
    public function actionIndex(): array
    {
        $userId = $this->currentUserId();
        $wsId = Yii::$app->request->get('workspace_id');
        $filter = (string)Yii::$app->request->get('filter', 'all'); // all, unread, mentioned, archived

        $query = (new Query())
            ->from('{{%notifications}}')
            ->where(['recipient_id' => $userId])
            ->orderBy(['id' => SORT_DESC])
            ->limit(100);

        if ($wsId) {
            $query->andWhere(['workspace_id' => (int)$wsId]);
        }

        if ($filter === 'unread') {
            $query->andWhere(['read_at' => null, 'archived_at' => null]);
        } elseif ($filter === 'mentioned') {
            $query->andWhere(['type' => 'mentioned', 'archived_at' => null]);
        } elseif ($filter === 'archived') {
            $query->andWhere(['not', ['archived_at' => null]]);
        } else {
            $query->andWhere(['archived_at' => null]);
        }

        $rows = $query->all();
        $usersMap = $this->enrichUsersMap(array_column($rows, 'actor_id'));

        $unreadCount = (int)(new Query())
            ->from('{{%notifications}}')
            ->where(['recipient_id' => $userId, 'read_at' => null, 'archived_at' => null])
            ->count();

        return $this->ok([
            'unread_count' => $unreadCount,
            'notifications' => array_map(function ($n) use ($usersMap) {
                $actorId = $n['actor_id'] ? (int)$n['actor_id'] : null;
                return [
                    'id' => (int)$n['id'],
                    'workspace_id' => (int)$n['workspace_id'],
                    'recipient_id' => (int)$n['recipient_id'],
                    'actor_id' => $actorId,
                    'actor' => $actorId ? ($usersMap[$actorId] ?? null) : null,
                    'type' => $n['type'],
                    'title' => $n['title'],
                    'body' => $n['body'],
                    'entity_type' => $n['entity_type'],
                    'entity_id' => (int)$n['entity_id'],
                    'project_id' => $n['project_id'] ? (int)$n['project_id'] : null,
                    'task_key' => $n['task_key'],
                    'read_at' => $n['read_at'],
                    'archived_at' => $n['archived_at'],
                    'created_at' => $n['created_at'],
                ];
            }, $rows),
        ]);
    }

    public function actionUpdate(int $id): array
    {
        $userId = $this->currentUserId();
        $notif = (new Query())
            ->from('{{%notifications}}')
            ->where(['id' => $id, 'recipient_id' => $userId])
            ->one();

        if (!$notif) {
            throw new NotFoundHttpException('Bildirishnoma topilmadi.');
        }

        $body = $this->bodyParams();
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $updates = [];

        if (array_key_exists('read', $body)) {
            $updates['read_at'] = $body['read'] ? $now : null;
        }
        if (array_key_exists('archived', $body)) {
            $updates['archived_at'] = $body['archived'] ? $now : null;
            if ($body['archived'] && !$notif['read_at']) {
                $updates['read_at'] = $now;
            }
        }

        if (!empty($updates)) {
            Yii::$app->db->createCommand()->update('{{%notifications}}', $updates, ['id' => $id])->execute();
        }

        return $this->actionIndex();
    }

    public function actionMarkAllRead(): array
    {
        $userId = $this->currentUserId();
        $body = $this->bodyParams();
        $wsId = !empty($body['workspace_id']) ? (int)$body['workspace_id'] : null;

        $cond = ['recipient_id' => $userId, 'read_at' => null];
        if ($wsId) {
            $cond['workspace_id'] = $wsId;
        }

        Yii::$app->db->createCommand()->update(
            '{{%notifications}}',
            ['read_at' => gmdate('Y-m-d\TH:i:s\Z')],
            $cond
        )->execute();

        return $this->actionIndex();
    }
}
