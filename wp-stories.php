<?php
/**
 * Plugin Name:  WP Stories
 * Plugin URI:   https://seekingdog.com/
 * Description:  Instagram-style stories gallery widget for Elementor. Add a circle-avatar story row to any page — click opens a full-screen stories lightbox with auto-advancing slides and swipe/tap gestures.
 * Version:      0.0.1b
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

define( 'WP_STORIES_VERSION', '0.0.1b' );
define( 'WP_STORIES_FILE',    __FILE__ );
define( 'WP_STORIES_PATH',    plugin_dir_path( __FILE__ ) );
define( 'WP_STORIES_URL',     plugin_dir_url( __FILE__ ) );

/* -----------------------------------------------------------------------
 * Boot
 * -------------------------------------------------------------------- */

add_action( 'plugins_loaded', 'wp_stories_init' );

function wp_stories_init() {
	// Bail early if Elementor is not active.
	if ( ! did_action( 'elementor/loaded' ) ) {
		add_action( 'admin_notices', 'wp_stories_elementor_missing_notice' );
		return;
	}

	require_once WP_STORIES_PATH . 'includes/class-wp-stories-widget.php';

	// Register widget with Elementor.
	add_action( 'elementor/widgets/register', function( $widgets_manager ) {
		$widgets_manager->register( new \WP_Stories\Widget() );
	} );

	// Enqueue frontend assets.
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
