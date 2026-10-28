<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\web\IdentityInterface;
use app\components\JwtHelper;

class User extends ActiveRecord implements IdentityInterface
{
    public static $currentSessionId = null;

    public static function tableName(): string
    {
        return '{{%users}}';
    }

    public static function findIdentity($id)
    {
        return static::findOne(['id' => $id, 'status' => 'active']);
    }

    public static function findIdentityByAccessToken($token, $type = null)
    {
        $payload = JwtHelper::decode((string)$token);
        if (!$payload || empty($payload['uid']) || empty($payload['jti'])) {
            return null;
        }

        $tokenHash = hash('sha256', (string)$payload['jti']);
        $session = (new \yii\db\Query())
            ->from('{{%user_sessions}}')
            ->where([
                'user_id' => (int)$payload['uid'],
                'token_hash' => $tokenHash,
                'revoked_at' => null,
            ])
            ->one();

        if (!$session) {
            return null;
        }

        if (strtotime($session['expires_at']) < time()) {
            return null;
        }

        self::$currentSessionId = (int)$session['id'];

        // Touch session last_active_at
        Yii::$app->db->createCommand()->update(
            '{{%user_sessions}}',
            ['last_active_at' => gmdate('Y-m-d\TH:i:s\Z')],
            ['id' => $session['id']]
        )->execute();

        return static::findIdentity((int)$payload['uid']);
    }

    public function getId()
    {
        return $this->id;
    }

    public function getAuthKey()
    {
        return null;
    }

    public function validateAuthKey($authKey)
    {
        return false;
    }

    public function validatePassword(string $password): bool
    {
        return Yii::$app->security->validatePassword($password, $this->password_hash);
    }

    public function setPassword(string $password): void
    {
        $this->password_hash = Yii::$app->security->generatePasswordHash($password);
    }

    public function toProfileArray(): array
    {
        $profile = (new \yii\db\Query())
            ->from('{{%user_profiles}}')
            ->where(['user_id' => $this->id])
            ->one();

        return [
            'id' => (int)$this->id,
            'email' => $this->email,
            'username' => $this->username,
            'status' => $this->status,
            'is_platform_admin' => (bool)$this->is_platform_admin,
            'last_login_at' => $this->last_login_at,
            'created_at' => $this->created_at,
            'profile' => $profile ? [
                'full_name' => $profile['full_name'],
                'job_title' => $profile['job_title'],
                'department' => $profile['department'],
                'avatar_url' => $profile['avatar_url'],
                'bio' => $profile['bio'],
                'phone' => $profile['phone'],
                'timezone' => $profile['timezone'],
                'locale' => $profile['locale'],
                'theme' => $profile['theme'],
                'ui_density' => $profile['ui_density'],
                'availability_status' => $profile['availability_status'],
                'availability_note' => $profile['availability_note'],
                'telegram_handle' => $profile['telegram_handle'],
            ] : [
                'full_name' => $this->username,
                'job_title' => 'Team Member',
                'department' => 'General',
                'avatar_url' => null,
                'bio' => null,
                'phone' => null,
                'timezone' => 'Asia/Tashkent',
                'locale' => 'uz',
                'theme' => 'dark',
                'ui_density' => 'comfortable',
                'availability_status' => 'available',
                'availability_note' => null,
                'telegram_handle' => null,
            ],
        ];
    }
}
