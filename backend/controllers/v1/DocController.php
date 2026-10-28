<?php

namespace app\controllers\v1;

use Yii;
use yii\db\Query;
use yii\web\NotFoundHttpException;
use app\components\TenantAccessGuard;
use app\components\ActivityLogService;

class DocController extends BaseApiController
{
    public function actionIndex(int $id): array
    {
        $userId = $this->currentUserId();
        TenantAccessGuard::requireProjectAccess($id, $userId, TenantAccessGuard::ROLE_VIEWER);

        $docs = (new Query())
            ->from('{{%project_docs}}')
            ->where(['project_id' => $id])
            ->orderBy(['position' => SORT_ASC, 'id' => SORT_ASC])
            ->all();

        $usersMap = $this->enrichUsersMap(array_merge(
            array_column($docs, 'created_by'),
            array_column($docs, 'updated_by')
        ));

        return $this->ok([
            'docs' => array_map(function ($d) use ($usersMap) {
                return [
                    'id' => (int)$d['id'],
                    'workspace_id' => (int)$d['workspace_id'],
                    'project_id' => (int)$d['project_id'],
                    'parent_doc_id' => $d['parent_doc_id'] ? (int)$d['parent_doc_id'] : null,
                    'title' => $d['title'],
                    'icon' => $d['icon'],
                    'content_md' => $d['content_md'],
                    'created_by' => (int)$d['created_by'],
                    'updated_by' => (int)$d['updated_by'],
                    'author' => $usersMap[(int)$d['updated_by']] ?? null,
                    'position' => (int)$d['position'],
                    'created_at' => $d['created_at'],
                    'updated_at' => $d['updated_at'],
                ];
            }, $docs),
        ]);
    }

    public function actionCreate(int $id): array
    {
        $actorId = $this->currentUserId();
        $ctx = TenantAccessGuard::requireProjectAccess($id, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $wsId = (int)$ctx['project']['workspace_id'];
        $body = $this->bodyParams();
        $this->requireFields($body, ['title']);

        $now = gmdate('Y-m-d\TH:i:s\Z');
        $title = trim((string)$body['title']);

        Yii::$app->db->createCommand()->insert('{{%project_docs}}', [
            'workspace_id' => $wsId,
            'project_id' => $id,
            'parent_doc_id' => !empty($body['parent_doc_id']) ? (int)$body['parent_doc_id'] : null,
            'title' => $title,
            'icon' => $body['icon'] ?? 'file-text',
            'content_md' => $body['content_md'] ?? "# {$title}\n\n",
            'created_by' => $actorId,
            'updated_by' => $actorId,
            'position' => (int)($body['position'] ?? 100),
            'created_at' => $now,
            'updated_at' => $now,
        ])->execute();

        $docId = (int)Yii::$app->db->getLastInsertID();
        ActivityLogService::log($wsId, $actorId, 'doc', $docId, 'doc.created', "'{$title}' hujjati yaratildi.", [], $id);

        return $this->actionIndex($id);
    }

    public function actionView(int $id): array
    {
        $userId = $this->currentUserId();
        $doc = (new Query())->from('{{%project_docs}}')->where(['id' => $id])->one();
        if (!$doc) {
            throw new NotFoundHttpException('Hujjat topilmadi.');
        }

        TenantAccessGuard::requireProjectAccess((int)$doc['project_id'], $userId, TenantAccessGuard::ROLE_VIEWER);
        return $this->ok(['doc' => $doc]);
    }

    public function actionUpdate(int $id): array
    {
        $actorId = $this->currentUserId();
        $doc = (new Query())->from('{{%project_docs}}')->where(['id' => $id])->one();
        if (!$doc) {
            throw new NotFoundHttpException('Hujjat topilmadi.');
        }

        $projectId = (int)$doc['project_id'];
        TenantAccessGuard::requireProjectAccess($projectId, $actorId, TenantAccessGuard::ROLE_MEMBER);
        $body = $this->bodyParams();

        $updates = [
            'updated_by' => $actorId,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        foreach (['title', 'icon', 'content_md', 'parent_doc_id', 'position'] as $f) {
            if (array_key_exists($f, $body)) {
                $updates[$f] = $body[$f];
            }
        }

        Yii::$app->db->createCommand()->update('{{%project_docs}}', $updates, ['id' => $id])->execute();
        return $this->actionIndex($projectId);
    }

    public function actionDelete(int $id): array
    {
        $actorId = $this->currentUserId();
        $doc = (new Query())->from('{{%project_docs}}')->where(['id' => $id])->one();
        if (!$doc) {
            throw new NotFoundHttpException('Hujjat topilmadi.');
        }

        $projectId = (int)$doc['project_id'];
        TenantAccessGuard::requireProjectAccess($projectId, $actorId, TenantAccessGuard::ROLE_MEMBER);

        Yii::$app->db->createCommand()->update('{{%project_docs}}', ['parent_doc_id' => null], ['parent_doc_id' => $id])->execute();
        Yii::$app->db->createCommand()->delete('{{%project_docs}}', ['id' => $id])->execute();

        return $this->actionIndex($projectId);
    }
}
