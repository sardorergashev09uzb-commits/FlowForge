<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\UnprocessableEntityHttpException;
use yii\web\NotFoundHttpException;
use app\models\User;

class ProfileController extends BaseApiController
{
    public function actionUpdate(): array
    {
        $user = $this->currentUser();
        $body = $this->bodyParams();

        if (isset($body['username'])) {
            $newUsername = preg_replace('/[^a-z0-9_.-]/', '', strtolower(trim((string)$body['username'])));
            if (strlen($newUsername) < 3) {
                throw new UnprocessableEntityHttpException('Username kamida 3 ta belgidan iborat bo‘lishi kerak.');
            }
            $taken = (new Query())
                ->from('{{%users}}')
                ->where(['username' => $newUsername])
                ->andWhere(['<>', 'id', $user->id])
                ->exists();
            if ($taken) {
                throw new UnprocessableEntityHttpException('Ushbu username band.');
            }
            $user->username = $newUsername;
            $user->updated_at = gmdate('Y-m-d\TH:i:s\Z');
            $user->save(false);
        }

        $allowedProfileFields = [
            'full_name', 'job_title', 'department', 'avatar_url',
            'bio', 'phone', 'timezone', 'locale', 'theme',
            'ui_density', 'availability_status', 'availability_note', 'telegram_handle'
        ];

        $updates = ['updated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        foreach ($allowedProfileFields as $field) {
            if (array_key_exists($field, $body)) {
                $updates[$field] = is_string($body[$field]) ? trim($body[$field]) : $body[$field];
            }
        }

        $exists = (new Query())->from('{{%user_profiles}}')->where(['user_id' => $user->id])->exists();
        if ($exists) {
            Yii::$app->db->createCommand()->update('{{%user_profiles}}', $updates, ['user_id' => $user->id])->execute();
        } else {
            $updates['user_id'] = $user->id;
            $updates['full_name'] = $updates['full_name'] ?? $user->username;
            Yii::$app->db->createCommand()->insert('{{%user_profiles}}', $updates)->execute();
        }

        return $this->ok([
            'user' => $user->toProfileArray(),
        ]);
    }

    public function actionChangePassword(): array
    {
        $user = $this->currentUser();
        $body = $this->bodyParams();
        $this->requireFields($body, ['current_password', 'new_password']);

        if (!$user->validatePassword((string)$body['current_password'])) {
            throw new UnprocessableEntityHttpException('Joriy parol noto‘g‘ri kiritildi.');
        }

        $newPassword = (string)$body['new_password'];
        if (strlen($newPassword) < 8) {
            throw new UnprocessableEntityHttpException('Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak.');
        }

        $user->setPassword($newPassword);
        $user->updated_at = gmdate('Y-m-d\TH:i:s\Z');
        $user->save(false);

        return $this->ok(['message' => 'Parol muvaffaqiyatli yangilandi.']);
    }

    public function actionSessions(): array
    {
        $sessions = (new Query())
            ->select(['id', 'ip_address', 'user_agent', 'device_name', 'last_active_at', 'expires_at', 'revoked_at', 'created_at'])
            ->from('{{%user_sessions}}')
            ->where(['user_id' => $this->currentUserId(), 'revoked_at' => null])
            ->orderBy(['last_active_at' => SORT_DESC])
            ->all();

        $formatted = array_map(function ($s) {
            $s['id'] = (int)$s['id'];
            $s['is_current'] = ((int)$s['id'] === (int)User::$currentSessionId);
            return $s;
        }, $sessions);

        return $this->ok(['sessions' => $formatted]);
    }

    public function actionRevokeSession(int $id): array
    {
        $session = (new Query())
            ->from('{{%user_sessions}}')
            ->where(['id' => $id, 'user_id' => $this->currentUserId()])
            ->one();

        if (!$session) {
            throw new NotFoundHttpException('Sessiya topilmadi.');
        }

        Yii::$app->db->createCommand()->update(
            '{{%user_sessions}}',
            ['revoked_at' => gmdate('Y-m-d\TH:i:s\Z')],
            ['id' => $id, 'user_id' => $this->currentUserId()]
        )->execute();

        return $this->ok(['message' => 'Qurilma sessiyasi yakunlandi.']);
    }

    public function actionRevokeOtherSessions(): array
    {
        Yii::$app->db->createCommand()->update(
            '{{%user_sessions}}',
            ['revoked_at' => gmdate('Y-m-d\TH:i:s\Z')],
            [
                'and',
                ['user_id' => $this->currentUserId()],
                ['revoked_at' => null],
                ['<>', 'id', (int)User::$currentSessionId],
            ]
        )->execute();

        return $this->ok(['message' => 'Boshqa barcha qurilmalardagi sessiyalar yakunlandi.']);
    }

    public function actionNotificationPrefs(): array
    {
        $prefs = (new Query())
            ->from('{{%user_notification_prefs}}')
            ->where(['user_id' => $this->currentUserId()])
            ->all();

        return $this->ok([
            'preferences' => array_map(function ($p) {
                return [
                    'id' => (int)$p['id'],
                    'event_type' => $p['event_type'],
                    'in_app_enabled' => (bool)$p['in_app_enabled'],
                    'email_enabled' => (bool)$p['email_enabled'],
                    'telegram_enabled' => (bool)$p['telegram_enabled'],
                ];
            }, $prefs),
        ]);
    }

    public function actionUpdateNotificationPrefs(): array
    {
        $body = $this->bodyParams();
        $items = $body['preferences'] ?? [];
        if (!is_array($items)) {
            throw new UnprocessableEntityHttpException('Noto‘g‘ri format.');
        }

        $userId = $this->currentUserId();
        foreach ($items as $item) {
            if (empty($item['event_type'])) continue;
            $eventType = (string)$item['event_type'];
            $exists = (new Query())
                ->from('{{%user_notification_prefs}}')
                ->where(['user_id' => $userId, 'event_type' => $eventType])
                ->exists();

            $row = [
                'in_app_enabled' => !empty($item['in_app_enabled']),
                'email_enabled' => !empty($item['email_enabled']),
                'telegram_enabled' => !empty($item['telegram_enabled']),
            ];

            if ($exists) {
                Yii::$app->db->createCommand()->update(
                    '{{%user_notification_prefs}}',
                    $row,
                    ['user_id' => $userId, 'event_type' => $eventType]
                )->execute();
            } else {
                $row['user_id'] = $userId;
                $row['event_type'] = $eventType;
                Yii::$app->db->createCommand()->insert('{{%user_notification_prefs}}', $row)->execute();
            }
        }

        return $this->actionNotificationPrefs();
    }
}
