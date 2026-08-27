<?php
/**
 * WP Stories – GitHub Update Checker
 *
 * Hooks into WordPress's native plugin update mechanism to check for new
 * releases on GitHub and surface them in Dashboard → Updates / Plugins.
 *
 * Usage:
 *   ( new \WP_Stories\Updater( WP_STORIES_FILE, 'tu-usuario', 'wp-stories' ) )->init();
 *
 * On GitHub: create a Release with a tag like "v0.0.2". WordPress will
 * compare that version against the plugin header "Version:" and show the
 * update notification automatically.
 *
 * @package WP_Stories
 */

namespace WP_Stories;

if ( ! defined( 'ABSPATH' ) ) exit;

class Updater {

	/** Full filesystem path to the main plugin file. */
	private string $plugin_file;

	/** "folder/plugin.php" slug used by WordPress. */
	private string $plugin_slug;

	/** GitHub repo owner (username or org). */
	private string $github_user;

	/** GitHub repository name. */
	private string $github_repo;

	/** Optional Personal Access Token for private repos. */
	private string $github_token;

	/** Transient cache key. */
	private string $cache_key;

	/** Seconds between remote checks (default 12 h). */
	private int $cache_ttl;

	/** Cached plugin header data. */
	private array $plugin_data = [];

	public function __construct(
		string $plugin_file,
		string $github_user,
		string $github_repo,
		string $github_token = '',
		int    $cache_ttl    = 43200   // 12 hours
	) {
		$this->plugin_file  = $plugin_file;
		$this->plugin_slug  = plugin_basename( $plugin_file );
		$this->github_user  = $github_user;
		$this->github_repo  = $github_repo;
		$this->github_token = $github_token;
		$this->cache_ttl    = $cache_ttl;
		$this->cache_key    = 'wps_ghupdate_' . md5( $this->plugin_slug );
	}

	/** Register all WordPress hooks. */
	public function init(): void {
		// Inject update data into the core update transient.
		add_filter( 'pre_set_site_transient_update_plugins', [ $this, 'check_update' ] );

		// Provide plugin info for the "View version details" modal.
		add_filter( 'plugins_api', [ $this, 'plugin_info' ], 10, 3 );

		// Fix folder name: GitHub zips extract as "repo-tag/" → rename to "repo/".
		add_filter( 'upgrader_source_selection', [ $this, 'fix_source_dir' ], 10, 4 );

		// Clear cached release data after a successful update.
		add_action( 'upgrader_process_complete', [ $this, 'after_update' ], 10, 2 );

		// Add a manual update check alongside the standard plugin actions.
		add_filter( 'plugin_action_links_' . $this->plugin_slug, [ $this, 'action_links' ] );
		add_action( 'admin_init', [ $this, 'maybe_check_updates' ] );
		add_action( 'admin_notices', [ $this, 'update_check_notice' ] );
	}

	/* ------------------------------------------------------------------
	 * Internal helpers
	 * ------------------------------------------------------------------ */

	private function get_plugin_data(): array {
		if ( ! $this->plugin_data ) {
			if ( ! function_exists( 'get_plugin_data' ) ) {
				require_once ABSPATH . 'wp-admin/includes/plugin.php';
			}
			$this->plugin_data = get_plugin_data( $this->plugin_file, false, false );
		}
		return $this->plugin_data;
	}

	private function current_version(): string {
		return $this->get_plugin_data()['Version'] ?? '0.0.0';
	}

	private function plugin_folder(): string {
		return dirname( $this->plugin_slug );   // 'wp-stories'
	}

	/** Fetch the latest GitHub release (cached). Returns stdClass or null. */
	private function get_remote_release(): ?object {

		$cached = get_transient( $this->cache_key );

		// 0 = we tried and failed; avoid hammering the API.
		if ( $cached === '0' ) return null;
		if ( is_object( $cached ) ) return $cached;

		$url      = "https://api.github.com/repos/{$this->github_user}/{$this->github_repo}/releases/latest";
		$headers  = [
			'Accept'     => 'application/vnd.github.v3+json',
			'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . get_bloginfo( 'url' ),
		];

		if ( $this->github_token ) {
			$headers['Authorization'] = 'Bearer ' . $this->github_token;
		}

		$response = wp_remote_get( $url, [
			'headers' => $headers,
			'timeout' => 10,
		] );

		if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			// Cache failure for 1 hour so we don't keep hitting the API.
			set_transient( $this->cache_key, '0', HOUR_IN_SECONDS );
			return null;
		}

		$release = json_decode( wp_remote_retrieve_body( $response ) );

		if ( empty( $release->tag_name ) ) {
			set_transient( $this->cache_key, '0', HOUR_IN_SECONDS );
			return null;
		}

		set_transient( $this->cache_key, $release, $this->cache_ttl );
		return $release;
	}

	/** Normalise "v0.0.2" → "0.0.2". */
	private function clean_version( string $tag ): string {
		return ltrim( $tag, 'vV' );
	}

	/** URL of the zip to download. Prefers release assets, falls back to zipball. */
	private function zip_url( object $release ): string {
		// If a .zip asset was uploaded to the release, use it (cleaner folder name).
		if ( ! empty( $release->assets ) ) {
			foreach ( $release->assets as $asset ) {
				if ( '.zip' === strtolower( substr( $asset->name, -4 ) ) ) {
					// For private repos the asset URL requires auth; use the API redirect.
					return $this->github_token
						? $asset->url   // 'Accept: application/octet-stream' handled by WP upgrader
						: $asset->browser_download_url;
				}
			}
		}

		// Auto-generated source zipball from GitHub.
		return $release->zipball_url;
	}

	/* ------------------------------------------------------------------
	 * WordPress hooks
	 * ------------------------------------------------------------------ */

	/**
	 * Inject an update entry into the WordPress update transient when the
	 * GitHub release version is newer than the installed version.
	 */
	public function check_update( $transient ) {
		if ( empty( $transient->checked ) ) return $transient;

		$release = $this->get_remote_release();
		if ( ! $release ) return $transient;

		$remote_version  = $this->clean_version( $release->tag_name );
		$current_version = $this->current_version();

		if ( version_compare( $remote_version, $current_version, '>' ) ) {
			$transient->response[ $this->plugin_slug ] = (object) [
				'id'          => "github.com/{$this->github_user}/{$this->github_repo}",
				'slug'        => $this->plugin_folder(),
				'plugin'      => $this->plugin_slug,
				'new_version' => $remote_version,
				'url'         => "https://github.com/{$this->github_user}/{$this->github_repo}",
				'package'     => $this->zip_url( $release ),
				'icons'       => [],
				'banners'     => [],
				'tested'      => get_bloginfo( 'version' ),
				'requires_php'=> '7.4',
			];
		} else {
			// No update – ensure no stale entry lingers.
			unset( $transient->response[ $this->plugin_slug ] );
		}

		return $transient;
	}

	/**
	 * Supply plugin details for the "View version X details" modal.
	 */
	public function plugin_info( $res, string $action, object $args ) {
		if ( $action !== 'plugin_information' ) return $res;
		if ( $args->slug !== $this->plugin_folder() )  return $res;

		$release = $this->get_remote_release();
		if ( ! $release ) return $res;

		$data    = $this->get_plugin_data();
		$version = $this->clean_version( $release->tag_name );

		// Convert GitHub Markdown changelog to basic HTML.
		$changelog = '';
		if ( ! empty( $release->body ) ) {
			$changelog = '<pre style="white-space:pre-wrap">'
				. esc_html( $release->body )
				. '</pre>';
		}

		return (object) [
			'name'          => $data['Name']   ?? 'WP Stories',
			'slug'          => $this->plugin_folder(),
			'version'       => $version,
			'author'        => '<a href="' . esc_url( $data['AuthorURI'] ?? '' ) . '">' . esc_html( $data['Author'] ?? '' ) . '</a>',
			'homepage'      => "https://github.com/{$this->github_user}/{$this->github_repo}",
			'download_link' => $this->zip_url( $release ),
			'requires'      => $data['RequiresWP']  ?? '5.9',
			'requires_php'  => $data['RequiresPHP'] ?? '7.4',
			'tested'        => get_bloginfo( 'version' ),
			'last_updated'  => $release->published_at ?? '',
			'sections'      => [
				'description' => $data['Description'] ?? '',
				'changelog'   => $changelog ?: '<p><a href="https://github.com/' . esc_attr( $this->github_user ) . '/' . esc_attr( $this->github_repo ) . '/releases">' . esc_html__( 'View GitHub Releases', 'wp-stories' ) . '</a>.</p>',
			],
		];
	}

	/**
	 * After download + extraction, GitHub zip folders are named "{repo}-{hash}/"
	 * or "{repo}-{tag}/". Rename to match the expected plugin folder name.
	 *
	 * @param string      $source        Path to the extracted folder.
	 * @param string      $remote_source Path to the temp folder containing it.
	 * @param \WP_Upgrader $upgrader
	 * @param array       $hook_extra
	 */
	public function fix_source_dir( string $source, string $remote_source, $upgrader, array $hook_extra = [] ): string {
		global $wp_filesystem;

		// Only act on our own plugin update.
		if ( ! isset( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== $this->plugin_slug ) {
			return $source;
		}

		$expected   = trailingslashit( $remote_source ) . $this->plugin_folder();
		$source_dir = rtrim( $source, '/\\' );

		if ( $source_dir === rtrim( $expected, '/\\' ) ) {
			return $source;   // Already correct.
		}

		if ( $wp_filesystem->move( $source, $expected ) ) {
			return trailingslashit( $expected );
		}

		// If rename failed, return original and let WP handle it (may fail).
		return $source;
	}

	/** Clear cached release after the plugin is updated. */
	public function after_update( $upgrader, array $hook_extra ): void {
		if ( isset( $hook_extra['plugin'] ) && $hook_extra['plugin'] === $this->plugin_slug ) {
			delete_transient( $this->cache_key );
		}
	}

	/** Add the manual update-check link to this plugin's row. */
	public function action_links( array $links ): array {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return $links;
		}

		$url = wp_nonce_url(
			add_query_arg( 'wps_check_updates', '1', admin_url( 'plugins.php' ) ),
			'wps_check_updates'
		);

		$links[] = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Check for updates', 'wp-stories' ) . '</a>';
		return $links;
	}

	/** Clear caches and ask WordPress/GitHub for the latest release immediately. */
	public function maybe_check_updates(): void {
		if ( ! isset( $_GET['wps_check_updates'] ) ) {
			return;
		}

		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_die( esc_html__( 'You are not allowed to update plugins.', 'wp-stories' ) );
		}

		check_admin_referer( 'wps_check_updates' );
		delete_transient( $this->cache_key );
		delete_site_transient( 'update_plugins' );

		$release = $this->get_remote_release();
		$status  = 'error';
		$version = '';

		if ( $release ) {
			$version = $this->clean_version( $release->tag_name );
			$status  = version_compare( $version, $this->current_version(), '>' ) ? 'available' : 'current';
			wp_update_plugins();
		}

		$redirect = add_query_arg(
			[
				'wps_update_check' => $status,
				'wps_version'      => $version,
			],
			admin_url( 'plugins.php' )
		);
		wp_safe_redirect( $redirect );
		exit;
	}

	/** Show the result of a manual update check. */
	public function update_check_notice(): void {
		if ( empty( $_GET['wps_update_check'] ) ) {
			return;
		}

		$status  = sanitize_key( wp_unslash( $_GET['wps_update_check'] ) );
		$version = isset( $_GET['wps_version'] ) ? sanitize_text_field( wp_unslash( $_GET['wps_version'] ) ) : '';

		if ( 'available' === $status ) {
			$message = sprintf( __( 'WP Stories %s is available. You can update it now.', 'wp-stories' ), $version );
			$class   = 'notice notice-info is-dismissible';
		} elseif ( 'current' === $status ) {
			$message = sprintf( __( 'WP Stories is up to date (version %s).', 'wp-stories' ), $this->current_version() );
			$class   = 'notice notice-success is-dismissible';
		} else {
			$message = __( 'WP Stories could not contact GitHub. Please try again later.', 'wp-stories' );
			$class   = 'notice notice-error is-dismissible';
		}

		echo '<div class="' . esc_attr( $class ) . '"><p>' . esc_html( $message ) . '</p></div>';
	}
}
