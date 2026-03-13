<?php
/**
 * Plugin Name:  WP Stories
 * Plugin URI:   https://seekingdog.com/
 * Description:  Instagram-style stories gallery widget for Elementor. Add a circle-avatar story row to any page — click opens a full-screen stories lightbox with auto-advancing slides and swipe/tap gestures.
 * Version:      0.0.4
 * Author:       Alejandro Pantoja Malatesta
 * Author URI:   https://seekingdog.com/
 * License:      GPL-2.0+
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:  wp-stories
 * Domain Path:  /languages
 *
 * Requires at least: 5.9
 * Requires PHP:      7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WP_STORIES_VERSION', '0.0.4' );
define( 'WP_STORIES_FILE',    __FILE__ );
define( 'WP_STORIES_PATH',    plugin_dir_path( __FILE__ ) );
define( 'WP_STORIES_URL',     plugin_dir_url( __FILE__ ) );

/*
 * ── GitHub Update Settings ───────────────────────────────────────────────────
 *
 * Set your GitHub username/org and repository name.
 * The updater will check GitHub Releases for a newer tag (e.g. "v0.0.3").
 *
 * For PRIVATE repositories, define WP_STORIES_GITHUB_TOKEN in wp-config.php:
 *   define( 'WP_STORIES_GITHUB_TOKEN', 'ghp_xxxxxxxxxxxxxxxxxx' );
 */
define( 'WP_STORIES_GITHUB_USER', 'prototype-ix' );   // ← tu usuario/org de GitHub
define( 'WP_STORIES_GITHUB_REPO', 'wp-stories'    );   // ← nombre del repositorio

/* -----------------------------------------------------------------------
 * Boot
 * -------------------------------------------------------------------- */

add_action( 'plugins_loaded', 'wp_stories_init' );

function wp_stories_init() {

	// ── GitHub Updater ────────────────────────────────────────────────────
	// Only runs in WP admin so it never slows down the frontend.
	if ( is_admin() ) {
		require_once WP_STORIES_PATH . 'includes/class-wp-stories-updater.php';

		$token = defined( 'WP_STORIES_GITHUB_TOKEN' ) ? WP_STORIES_GITHUB_TOKEN : '';

		( new \WP_Stories\Updater(
			WP_STORIES_FILE,
			WP_STORIES_GITHUB_USER,
			WP_STORIES_GITHUB_REPO,
			$token
		) )->init();
	}

	// ── Elementor check ───────────────────────────────────────────────────
	if ( ! did_action( 'elementor/loaded' ) ) {
		add_action( 'admin_notices', 'wp_stories_elementor_missing_notice' );
		return;
	}

	// ── Register Elementor widget ─────────────────────────────────────────
	add_action( 'elementor/widgets/register', function( $widgets_manager ) {
		require_once WP_STORIES_PATH . 'includes/class-wp-stories-widget.php';
		$widgets_manager->register( new \WP_Stories\Widget() );
	} );

	// ── Frontend assets ───────────────────────────────────────────────────
	add_action( 'wp_enqueue_scripts', 'wp_stories_enqueue_assets' );
}

function wp_stories_enqueue_assets() {
	wp_enqueue_style(
		'wp-stories',
		WP_STORIES_URL . 'assets/css/wp-stories.css',
		[],
		WP_STORIES_VERSION
	);

	wp_enqueue_script(
		'wp-stories',
		WP_STORIES_URL . 'assets/js/wp-stories.js',
		[],
		WP_STORIES_VERSION,
		true
	);
}

function wp_stories_elementor_missing_notice() {
	echo '<div class="notice notice-warning is-dismissible"><p>'
		. esc_html__( 'WP Stories requires Elementor to be installed and activated.', 'wp-stories' )
		. '</p></div>';
}
