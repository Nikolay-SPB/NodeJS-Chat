<?php
/**
 * Author: Nikolay Pilipovic.
 * Email: nikola.pilipovic@gmail.com
 * Date: 28.03.2017
 * Time: 23:39
 */

namespace NodeJS_Chat;

class Localization
{
    private static $localization;

    public function init()
    {
        $file = __DIR__ . "/../public_html/i18n.json";

        if (!file_exists($file)) {
            throw new \Exception('Localization file does not exists');
        }

        $content = file_get_contents($file);

        $json = json_decode($content, true);

        $locale = Settings::get('generalLocalization');

        self::$localization = $json[$locale];
    }

    public static function get($key)
    {
        return isset(self::$localization[$key]) ? self::$localization[$key] : false;
    }
}