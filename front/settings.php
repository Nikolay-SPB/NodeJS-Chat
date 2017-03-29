<?php
/**
 * Author: Nikolay Pilipovic.
 * Email: nikola.pilipovic@gmail.com
 * Date: 28.03.2017
 * Time: 23:46
 */

namespace NodeJS_Chat;

class Settings
{
    private static $settings;

    public function init()
    {
        $file = __DIR__ . "/../public_html/settings.json";
        $devFile = __DIR__ . "/../public_html/settings.development.json";

        if (!file_exists($file)) {
            throw new \Exception('Settings file does not exists');
        }

        $content = file_get_contents($file);
        $json = json_decode($content, true);

        if (file_exists($devFile)) {
            $devContent = file_get_contents($devFile);
            $devJson = json_decode($devContent, true);

            self::$settings = array_merge($json, $devJson);
        } else {
            self::$settings = $json;
        }
    }

    public static function get($key)
    {
        return isset(self::$settings[$key]) ? self::$settings[$key] : false;
    }
}