<?php
/**
 * Elementor Widget: WP Stories
 *
 * @package WP_Stories
 */

namespace WP_Stories;

use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;
use Elementor\Utils;
use Elementor\Group_Control_Image_Size;
use Elementor\Group_Control_Border;
use Elementor\Group_Control_Box_Shadow;
use Elementor\Group_Control_Typography;
use Elementor\Group_Control_Background;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Widget extends Widget_Base {

	public function get_name()  { return 'wp-stories'; }
	public function get_title() { return esc_html__( 'WP Stories', 'wp-stories' ); }
	public function get_icon()  { return 'eicon-instagram-gallery'; }
	public function get_categories() { return [ 'general' ]; }
	public function get_keywords() { return [ 'stories', 'instagram', 'gallery', 'slider' ]; }

	/* -----------------------------------------------------------------------
	 * Controls
	 * -------------------------------------------------------------------- */

	protected function register_controls() {

		/* ============================================================
		 * SECTION: Stories (repeater)
		 * ========================================================== */
		$this->start_controls_section( 'section_stories', [
			'label' => esc_html__( 'Stories', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_CONTENT,
		] );

		$repeater = new Repeater();

		// ----- User name -----
		$repeater->add_control( 'username', [
			'label'       => esc_html__( 'Username / Title', 'wp-stories' ),
			'type'        => Controls_Manager::TEXT,
			'default'     => esc_html__( 'username', 'wp-stories' ),
			'label_block' => true,
		] );

		$repeater->add_control( 'title_tag', [
			'label'   => esc_html__( 'Title Tag', 'wp-stories' ),
			'type'    => Controls_Manager::SELECT,
			'default' => 'span',
			'options' => [
				'h1'   => 'H1',
				'h2'   => 'H2',
				'h3'   => 'H3',
				'h4'   => 'H4',
				'h5'   => 'H5',
				'h6'   => 'H6',
				'p'    => 'P',
				'span' => 'Span',
				'div'  => 'Div',
			],
		] );

		// ----- Avatar image -----
		$repeater->add_control( 'avatar', [
			'label'   => esc_html__( 'Avatar Image', 'wp-stories' ),
			'type'    => Controls_Manager::MEDIA,
			'default' => [ 'url' => Utils::get_placeholder_image_src() ],
		] );

		// ----- Slide gallery -----
		$repeater->add_control( 'gallery', [
			'label'      => esc_html__( 'Story Images', 'wp-stories' ),
			'type'       => Controls_Manager::GALLERY,
			'show_label' => true,
		] );

		// ----- Per-slide duration -----
		$repeater->add_control( 'slide_duration', [
			'label'   => esc_html__( 'Seconds per slide', 'wp-stories' ),
			'type'    => Controls_Manager::NUMBER,
			'default' => 5,
			'min'     => 1,
			'max'     => 30,
			'step'    => 1,
		] );

		// ----- Image fit -----
		$repeater->add_control( 'image_fit', [
			'label'   => esc_html__( 'Image Fit', 'wp-stories' ),
			'type'    => Controls_Manager::SELECT,
			'default' => 'contain',
			'options' => [
				'contain' => esc_html__( 'Contain (full image visible)', 'wp-stories' ),
				'cover'   => esc_html__( 'Cover (fill, may crop)', 'wp-stories' ),
				'fill'    => esc_html__( 'Fill (stretch)', 'wp-stories' ),
			],
		] );

		$this->add_control( 'stories', [
			'label'       => esc_html__( 'Stories', 'wp-stories' ),
			'type'        => Controls_Manager::REPEATER,
			'fields'      => $repeater->get_controls(),
			'default'     => [
				[
					'username'       => 'username_1',
					'title_tag'      => 'span',
					'slide_duration' => 5,
					'image_fit'      => 'contain',
				],
			],
			'title_field' => '{{{ username }}}',
		] );

		$this->end_controls_section();

		/* ============================================================
		 * SECTION: Circle / Avatar Options
		 * ========================================================== */
		$this->start_controls_section( 'section_circle', [
			'label' => esc_html__( 'Avatar Circles', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_CONTENT,
		] );

		$this->add_control( 'circle_size', [
			'label'      => esc_html__( 'Circle Size (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 40, 'max' => 160, 'step' => 2 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 72 ],
			'selectors'  => [
				'{{WRAPPER}} .wps-story-circle' => '--wps-circle-size: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'circle_gap', [
			'label'      => esc_html__( 'Gap between circles (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 4, 'max' => 40, 'step' => 2 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 16 ],
			'selectors'  => [
				'{{WRAPPER}} .wps-stories-row' => 'gap: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'ring_color_start', [
			'label'   => esc_html__( 'Ring Gradient Start', 'wp-stories' ),
			'type'    => Controls_Manager::COLOR,
			'default' => '#f09433',
			'selectors' => [
				'{{WRAPPER}} .wps-story-circle' => '--wps-ring-start: {{VALUE}};',
			],
		] );

		$this->add_control( 'ring_color_end', [
			'label'   => esc_html__( 'Ring Gradient End', 'wp-stories' ),
			'type'    => Controls_Manager::COLOR,
			'default' => '#c13584',
			'selectors' => [
				'{{WRAPPER}} .wps-story-circle' => '--wps-ring-end: {{VALUE}};',
			],
		] );

		$this->add_control( 'ring_width', [
			'label'      => esc_html__( 'Ring Width (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 1, 'max' => 8, 'step' => 1 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 3 ],
			'selectors'  => [
				'{{WRAPPER}} .wps-story-circle' => '--wps-ring-width: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'ring_gap', [
			'label'      => esc_html__( 'Gap between ring and avatar (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 0, 'max' => 6, 'step' => 1 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 2 ],
			'selectors'  => [
				'{{WRAPPER}} .wps-story-circle' => '--wps-ring-gap: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'avatar_fit', [
			'label'   => esc_html__( 'Avatar Image Fit', 'wp-stories' ),
			'type'    => Controls_Manager::SELECT,
			'default' => 'cover',
			'options' => [
				'cover'   => esc_html__( 'Cover', 'wp-stories' ),
				'contain' => esc_html__( 'Contain', 'wp-stories' ),
			],
			'selectors' => [
				'{{WRAPPER}} .wps-story-circle .wps-avatar img' => 'object-fit: {{VALUE}};',
			],
		] );

		$this->end_controls_section();

		/* ============================================================
		 * SECTION: Username Typography
		 * ========================================================== */
		$this->start_controls_section( 'section_username_style', [
			'label' => esc_html__( 'Username Style', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_STYLE,
		] );

		$this->add_group_control( Group_Control_Typography::get_type(), [
			'name'     => 'username_typography',
			'selector' => '{{WRAPPER}} .wps-story-label',
		] );

		$this->add_control( 'username_color', [
			'label'     => esc_html__( 'Color', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'selectors' => [
				'{{WRAPPER}} .wps-story-label' => 'color: {{VALUE}};',
			],
		] );

		$this->end_controls_section();

		/* ============================================================
		 * SECTION: Lightbox / Viewer Style
		 * ========================================================== */
		$this->start_controls_section( 'section_viewer_style', [
			'label' => esc_html__( 'Viewer Style', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'viewer_bg_color', [
			'label'     => esc_html__( 'Viewer Background', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#000000',
			'selectors' => [
				'.wps-viewer-overlay' => 'background: {{VALUE}};',
			],
		] );

		$this->add_control( 'progress_bar_color', [
			'label'     => esc_html__( 'Progress Bar Color', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'selectors' => [
				'.wps-progress-fill' => 'background: {{VALUE}};',
			],
		] );

		$this->add_control( 'progress_bar_bg_color', [
			'label'     => esc_html__( 'Progress Bar Background', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => 'rgba(255,255,255,0.35)',
			'selectors' => [
				'.wps-progress-segment' => 'background: {{VALUE}};',
			],
		] );

		$this->add_control( 'close_button_color', [
			'label'     => esc_html__( 'Close Button Color', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'selectors' => [
				'.wps-close-btn' => 'color: {{VALUE}}; border-color: {{VALUE}};',
			],
		] );

		$this->end_controls_section();

		/* ============================================================
		 * SECTION: Row Layout
		 * ========================================================== */
		$this->start_controls_section( 'section_row_layout', [
			'label' => esc_html__( 'Row Layout', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'row_bg_color', [
			'label'     => esc_html__( 'Row Background', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#1a1a1a',
			'selectors' => [
				'{{WRAPPER}} .wps-stories-row' => 'background: {{VALUE}};',
			],
		] );

		$this->add_control( 'row_padding', [
			'label'      => esc_html__( 'Row Padding', 'wp-stories' ),
			'type'       => Controls_Manager::DIMENSIONS,
			'size_units' => [ 'px', 'em', '%' ],
			'default'    => [
				'top'    => '12',
				'right'  => '16',
				'bottom' => '12',
				'left'   => '16',
				'unit'   => 'px',
				'isLinked' => false,
			],
			'selectors' => [
				'{{WRAPPER}} .wps-stories-row' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
			],
		] );

		$this->add_control( 'row_scrollbar', [
			'label'        => esc_html__( 'Show Scrollbar', 'wp-stories' ),
			'type'         => Controls_Manager::SWITCHER,
			'label_on'     => esc_html__( 'Show', 'wp-stories' ),
			'label_off'    => esc_html__( 'Hide', 'wp-stories' ),
			'return_value' => 'yes',
			'default'      => '',
			'selectors'    => [
				'{{WRAPPER}} .wps-stories-row' => 'scrollbar-width: auto;',
			],
		] );

		$this->end_controls_section();
	}

	/* -----------------------------------------------------------------------
	 * Render
	 * -------------------------------------------------------------------- */

	protected function render() {
		$settings = $this->get_settings_for_display();
		$stories  = $settings['stories'] ?? [];

		if ( empty( $stories ) ) {
			return;
		}

		// Build the JSON data payload consumed by JS.
		$data = [];
		foreach ( $stories as $idx => $story ) {
			$slides = [];
			if ( ! empty( $story['gallery'] ) ) {
				foreach ( $story['gallery'] as $img ) {
					$slides[] = [
						'src'      => esc_url( $img['url'] ),
						'alt'      => esc_attr( $img['alt'] ?? '' ),
						'fit'      => esc_attr( $story['image_fit'] ?? 'contain' ),
						'duration' => absint( $story['slide_duration'] ?? 5 ),
					];
				}
			}
			$data[] = [
				'id'       => esc_attr( $story['_id'] ?? $idx ),
				'username' => esc_html( $story['username'] ?? '' ),
				'avatar'   => esc_url( $story['avatar']['url'] ?? '' ),
				'slides'   => $slides,
			];
		}

		$widget_id = 'wps-' . $this->get_id();
		?>
		<div
			class="wps-stories-widget"
			id="<?php echo esc_attr( $widget_id ); ?>"
			data-stories="<?php echo esc_attr( wp_json_encode( $data ) ); ?>"
		>
			<div class="wps-stories-row">
				<?php foreach ( $stories as $idx => $story ) :
					$tag        = in_array( $story['title_tag'] ?? 'span', [ 'h1','h2','h3','h4','h5','h6','p','span','div' ], true )
					              ? $story['title_tag']
					              : 'span';
					$has_slides = ! empty( $story['gallery'] );
				?>
				<button
					class="wps-story-circle<?php echo $has_slides ? '' : ' wps-no-slides'; ?>"
					data-story-index="<?php echo esc_attr( $idx ); ?>"
					aria-label="<?php echo esc_attr( sprintf( __( 'Open stories from %s', 'wp-stories' ), $story['username'] ?? '' ) ); ?>"
					<?php echo $has_slides ? '' : 'disabled'; ?>
				>
					<span class="wps-ring-wrap">
						<span class="wps-avatar">
							<?php if ( ! empty( $story['avatar']['url'] ) ) : ?>
								<img
									src="<?php echo esc_url( $story['avatar']['url'] ); ?>"
									alt="<?php echo esc_attr( $story['username'] ?? '' ); ?>"
									loading="lazy"
								>
							<?php else : ?>
								<span class="wps-avatar-placeholder"></span>
							<?php endif; ?>
						</span>
					</span>
					<<?php echo esc_attr( $tag ); ?> class="wps-story-label">
						<?php echo esc_html( $story['username'] ?? '' ); ?>
					</<?php echo esc_attr( $tag ); ?>>
				</button>
				<?php endforeach; ?>
			</div><!-- .wps-stories-row -->
		</div><!-- .wps-stories-widget -->

		<!-- Viewer overlay (shared singleton, inserted once by JS) -->
		<?php
	}

	protected function content_template() {
		// Live preview in editor is handled via the data attribute approach.
		?>
		<div class="wps-stories-widget wps-editor-preview">
			<div class="wps-stories-row">
				<# _.each( settings.stories, function( story, idx ) {
					var tag = ['h1','h2','h3','h4','h5','h6','p','span','div'].indexOf(story.title_tag) !== -1 ? story.title_tag : 'span';
					var avatarUrl = story.avatar && story.avatar.url ? story.avatar.url : '';
				#>
				<button class="wps-story-circle" data-story-index="{{ idx }}">
					<span class="wps-ring-wrap">
						<span class="wps-avatar">
							<# if ( avatarUrl ) { #>
								<img src="{{ avatarUrl }}" alt="{{ story.username }}">
							<# } else { #>
								<span class="wps-avatar-placeholder"></span>
							<# } #>
						</span>
					</span>
					<{{{ tag }}} class="wps-story-label">{{{ story.username }}}</{{{ tag }}}>
				</button>
				<# }); #>
			</div>
		</div>
		<?php
	}
}
