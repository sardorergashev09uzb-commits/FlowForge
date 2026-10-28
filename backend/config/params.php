<?php

return [
    'adminEmail' => 'admin@flowforge.local',
    'jwtSecret' => getenv('JWT_SECRET') ?: 'flowforge_enterprise_jwt_secret_key_2026_secure_998877',
    'jwtAccessTtl' => 86400 * 7, // 7 days access token for seamless SPA experience
    'jwtRefreshTtl' => 86400 * 30, // 30 days session validity
];
