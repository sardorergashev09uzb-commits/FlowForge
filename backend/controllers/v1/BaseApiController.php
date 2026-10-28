<?php

namespace app\controllers\v1;

use Yii;
use yii\web\Controller;
use yii\web\UnauthorizedHttpException;
use yii\web\BadRequestHttpException;
use app\models\User;

abstract class BaseApiController extends Controller
{
    public $enableCsrfValidation = false;

    /**
     * actions that do NOT require authentication
     */
    protected array $publicActions = [];

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        if (Yii::$app->request->isOptions) {
            return true;
        }

        if (in_array($action->id, $this->publicActions, true)) {
            return true;
        }

        $authHeader = Yii::$app->request->headers->get('Authorization');
        if (!$authHeader || !preg_match('/^Bearer\s+(.*?)$/i', $authHeader, $matches)) {
            throw new UnauthorizedHttpException('Avtorizatsiya talab etiladi (Bearer token topilmadi).');
        }

        $token = trim($matches[1]);
        $identity = User::findIdentityByAccessToken($token);
        if (!$identity) {
            throw new UnauthorizedHttpException('Sessiya muddati tugagan yoki yaroqsiz token.');
        }

        Yii::$app->user->setIdentity($identity);
        return true;
    }

    protected function currentUser(): User
    {
        /** @var User|null $identity */
        $identity = Yii::$app->user->identity;
        if (!$identity) {
            throw new UnauthorizedHttpException('Foydalanuvchi tizimga kirmagan.');
        }
        return $identity;
    }

    protected function currentUserId(): int
    {
        return (int)$this->currentUser()->id;
    }

    protected function bodyParams(): array
    {
        $params = Yii::$app->request->bodyParams;
        return is_array($params) ? $params : [];
    }

    protected function requireFields(array $data, array $fields): void
    {
        $missing = [];
        foreach ($fields as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $missing[] = $field;
            }
        }
        if (!empty($missing)) {
            throw new BadRequestHttpException('Majburiy maydonlar to‘ldirilmagan: ' . implode(', ', $missing));
        }
    }

    protected function ok(array $data = [], int $statusCode = 200): array
    {
        Yii::$app->response->statusCode = $statusCode;
        return array_merge(['success' => true], $data);
    }

    protected function enrichUsersMap(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (empty($ids)) {
            return [];
        }

        $rows = (new \yii\db\Query())
            ->select([
                'u.id',
                'u.email',
                'u.username',
                'p.full_name',
                'p.job_title',
                'p.department',
                'p.avatar_url',
                'p.availability_status',
                'p.availability_note',
            ])
            ->from(['u' => '{{%users}}'])
            ->leftJoin(['p' => '{{%user_profiles}}'], 'p.user_id = u.id')
            ->where(['u.id' => $ids])
            ->all();

        $map = [];
        foreach ($rows as $r) {
            $map[(int)$r['id']] = [
                'id' => (int)$r['id'],
                'email' => $r['email'],
                'username' => $r['username'],
                'full_name' => $r['full_name'] ?: $r['username'],
                'job_title' => $r['job_title'] ?: 'Member',
                'department' => $r['department'],
                'avatar_url' => $r['avatar_url'],
                'availability_status' => $r['availability_status'] ?: 'available',
                'availability_note' => $r['availability_note'],
            ];
        }
        return $map;
    }
}
