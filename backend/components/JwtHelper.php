<?php

namespace app\components;

use Yii;

class JwtHelper
{
    public static function encode(array $payload): string
    {
        $secret = Yii::$app->params['jwtSecret'];
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];

        $segments = [
            self::base64UrlEncode(json_encode($header)),
            self::base64UrlEncode(json_encode($payload)),
        ];

        $signingInput = implode('.', $segments);
        $signature = hash_hmac('sha256', $signingInput, $secret, true);
        $segments[] = self::base64UrlEncode($signature);

        return implode('.', $segments);
    }

    public static function decode(string $token): ?array
    {
        $secret = Yii::$app->params['jwtSecret'];
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$headb64, $bodyb64, $cryptob64] = $parts;
        $expectedSig = self::base64UrlEncode(
            hash_hmac('sha256', "$headb64.$bodyb64", $secret, true)
        );

        if (!hash_equals($expectedSig, $cryptob64)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($bodyb64), true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload['exp']) && time() > (int)$payload['exp']) {
            return null;
        }

        return $payload;
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
