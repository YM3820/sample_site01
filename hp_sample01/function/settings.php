<?php
/**
 * index4.php の設定ファイル
 *
 * ここの値を書き換えるだけで、ページの文言・クリック回数・転送先・演出を変更できます。
 * 文言中の {count} はクリック回数（max_clicks）に置き換わります。
 */

return [
    // ページ情報
    'page' => [
        'title'       => 'スペシャルページ',
        'theme_color' => '#000000',
        // 背景画像（index4.php からの相対パス）
        // スマホ用（画面幅が mobile_breakpoint 未満）
        'background'    => 'img/top_01.png',
        // PC用（画面幅が mobile_breakpoint 以上）
        'background_pc' => 'img/top_PC_01.webp',
    ],

    // 表示する文言
    'text' => [
        'instruction' => '画像を{count}回高速クリックしてね！',
        'aria_label'  => '画面を{count}回押すと特設サイトへ移動します',
        'remaining'   => 'あと{count}回です',
        'redirecting' => '移動します',
    ],

    // クリック・転送
    'click' => [
        // 転送までに必要なクリック回数
        'max_clicks'     => 5,
        // 転送先URL
        'redirect_url'   => 'https://shibuya.lp-rakuen.com',
        // 最後のクリックから転送するまでの時間（ミリ秒）
        'redirect_delay' => 2800,
    ],

    // 飛び散る画像（size は表示幅 [最小, 最大] px）
    'particles' => [
        ['src' => 'img/xl.png', 'size' => [82, 128]],
        ['src' => 'img/l.png',  'size' => [52, 82]],
        ['src' => 'img/m.png',  'size' => [34, 58]],
        ['src' => 'img/s.png',  'size' => [22, 38]],
    ],

    // 通常クリック時の花火
    'burst' => [
        // 1回の花火で飛ぶ画像の数（PC / スマホ）
        'count_pc'     => 18,
        'count_mobile' => 14,
    ],

    // 最後のクリック時のフィナーレ演出
    'finale' => [
        // false にすると通常の花火だけで転送します
        'enabled'       => true,
        // 画面のあちこちで起きる連続爆発の回数（PC / スマホ）
        'waves_pc'      => 20,
        'waves_mobile'  => 14,
        // 連続爆発の間隔（ミリ秒）
        'wave_interval' => 85,
        // 上から降る画像の数（PC / スマホ）
        'rain_pc'       => 80,
        'rain_mobile'   => 50,
        // 画面シェイクとフラッシュ
        'shake'         => true,
        'flash'         => true,
    ],

    // この幅（px）未満をスマホとして扱う
    'mobile_breakpoint' => 600,
];
