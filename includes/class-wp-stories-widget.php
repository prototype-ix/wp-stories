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
use Elementor\Group_Control_Typography;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Widget extends Widget_Base {

	public function get_name()        { return 'wp-stories'; }
	public function get_title()       { return esc_html__( 'WP Stories', 'wp-stories' ); }
	public function get_icon()        { return 'eicon-instagram-gallery'; }
	public function get_categories()  { return [ 'general' ]; }
	public function get_keywords()    { return [ 'stories', 'instagram', 'gallery', 'slider' ]; }

	/* -----------------------------------------------------------------------
	 * Helpers
	 * -------------------------------------------------------------------- */

	private function sanitize_color( $color ) {
		if ( empty( $color ) ) return '';
		$c = trim( $color );
		if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $c ) ) return $c;
		if ( preg_match( '/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+)?\s*\)$/i', $c ) ) return $c;
		return '';
	}

	/** Render an Elementor icon to an HTML string (captures output). */
	private function render_icon_html( $icon_data ) {
		if ( empty( $icon_data['value'] ) ) return '';
		ob_start();
		\Elementor\Icons_Manager::render_icon( $icon_data, [
			'aria-hidden' => 'true',
			'class'       => 'wps-link-icon',
		] );
		$html = ob_get_clean();
		// Allow <i>, <svg>, <path>, <use>, <img> – all used by Elementor icons.
		return wp_kses( $html, [
			'i'    => [ 'class' => [], 'aria-hidden' => [] ],
			'svg'  => [ 'xmlns' => [], 'viewbox' => [], 'width' => [], 'height' => [],
			            'class' => [], 'aria-hidden' => [], 'fill' => [], 'stroke' => [],
			            'stroke-width' => [], 'stroke-linecap' => [], 'stroke-linejoin' => [] ],
			'path' => [ 'd' => [], 'fill' => [], 'stroke' => [], 'class' => [] ],
			'use'  => [ 'href' => [], 'xlink:href' => [] ],
			'line' => [ 'x1' => [], 'y1' => [], 'x2' => [], 'y2' => [], 'class' => [] ],
			'polyline' => [ 'points' => [], 'class' => [] ],
			'circle'   => [ 'cx' => [], 'cy' => [], 'r' => [], 'class' => [] ],
			'img'  => [ 'src' => [], 'alt' => [], 'class' => [] ],
		] );
	}

	/** Build the per-story data array consumed by JS. */
	private function build_story_data( array $story, $idx ) {

		// ── Slides ───────────────────────────────────────────────────────────
		$slides = [];
		if ( ! empty( $story['gallery'] ) ) {
			foreach ( $story['gallery'] as $img ) {
				$slides[] = [
					'src'      => esc_url( $img['url'] ?? '' ),
					'alt'      => esc_attr( $img['alt'] ?? '' ),
					'fit'      => esc_attr( $story['image_fit'] ?? 'contain' ),
					'duration' => absint( $story['slide_duration'] ?? 5 ),
				];
			}
		}

		// ── Link button ──────────────────────────────────────────────────────
		$link_on  = ! empty( $story['link_enable'] ) && $story['link_enable'] === 'yes';
		$link_url = $link_on ? esc_url( $story['link_url']['url'] ?? '' ) : '';

		// Render icon HTML server-side using Elementor's Icons_Manager.
		$icon_html = '';
		if ( $link_on && ! empty( $story['link_icon']['value'] ) ) {
			$icon_html = $this->render_icon_html( $story['link_icon'] );
		}

		$link = [
			'on'       => $link_on,
			'url'      => $link_url,
			'text'     => esc_html( $story['link_text'] ?? '' ),
			'iconHtml' => $icon_html,
			'posY'     => (float) ( $story['link_pos_y']['size'] ?? 85 ),
			'color'    => $this->sanitize_color( $story['link_text_color'] ?? '#1a1a1a' ) ?: '#1a1a1a',
			'bg'       => $this->sanitize_color( $story['link_bg_color'] ?? '#ffffff' ) ?: '#ffffff',
			'bdColor'  => $this->sanitize_color( $story['link_border_color'] ?? 'rgba(0,0,0,0.12)' ) ?: 'rgba(0,0,0,0.12)',
			'bdW'      => (float) ( $story['link_border_width']['size'] ?? 1.5 ),
			'bdR'      => (float) ( $story['link_border_radius']['size'] ?? 50 ),
			'fs'       => (float) ( $story['link_font_size']['size'] ?? 13 ),
			'fw'       => esc_attr( $story['link_font_weight'] ?? '600' ),
			'pV'       => (float) ( $story['link_padding_v']['size'] ?? 10 ),
			'pH'       => (float) ( $story['link_padding_h']['size'] ?? 22 ),
			'target'   => in_array( $story['link_target'] ?? '_blank', [ '_blank', '_self' ], true )
			              ? $story['link_target'] : '_blank',
		];

		// ── Text overlay ─────────────────────────────────────────────────────
		$txt_on = ! empty( $story['text_overlay_enable'] ) && $story['text_overlay_enable'] === 'yes';

		$txt_w_size = (float) ( $story['text_overlay_width']['size'] ?? 80 );
		$txt_w_unit = $story['text_overlay_width']['unit'] ?? '%';
		$txt_mh     = (float) ( $story['text_overlay_min_height']['size'] ?? 0 );

		$txt = [
			'on'   => $txt_on,
			'html' => $txt_on ? wp_kses_post( $story['text_overlay_content'] ?? '' ) : '',
			'x'    => (float) ( $story['text_overlay_pos_x']['size'] ?? 50 ),
			'y'    => (float) ( $story['text_overlay_pos_y']['size'] ?? 50 ),
			'ox'   => in_array( $story['text_overlay_origin_x'] ?? 'center', [ 'left', 'center', 'right' ], true )
			          ? $story['text_overlay_origin_x'] : 'center',
			'w'    => $txt_w_size . $txt_w_unit,
			'mh'   => $txt_mh > 0 ? ( $txt_mh . 'px' ) : 'auto',
			'c'    => $this->sanitize_color( $story['text_overlay_color'] ?? '#ffffff' ) ?: '#ffffff',
			'bg'   => $this->sanitize_color( $story['text_overlay_bg'] ?? '' ),
			'fs'   => (float) ( $story['text_overlay_font_size']['size'] ?? 16 ),
			'fw'   => esc_attr( $story['text_overlay_font_weight'] ?? '400' ),
			'ta'   => in_array( $story['text_overlay_text_align'] ?? 'center', [ 'left', 'center', 'right' ], true )
			          ? $story['text_overlay_text_align'] : 'center',
			'lh'   => (float) ( $story['text_overlay_line_height']['size'] ?? 1.4 ),
			'ls'   => (float) ( $story['text_overlay_letter_spacing']['size'] ?? 0 ),
			'pV'   => (float) ( $story['text_overlay_padding_v']['size'] ?? 12 ),
			'pH'   => (float) ( $story['text_overlay_padding_h']['size'] ?? 16 ),
			'br'   => (float) ( $story['text_overlay_border_radius']['size'] ?? 8 ),
		];

		return [
			'id'       => esc_attr( $story['_id'] ?? $idx ),
			'username' => esc_html( $story['username'] ?? '' ),
			'avatar'   => esc_url( $story['avatar']['url'] ?? '' ),
			'slides'   => $slides,
			'link'     => $link,
			'txt'      => $txt,
		];
	}

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

		// ── Identity ─────────────────────────────────────────────────────────
		// Preview button – shows inline preview inside the repeater panel item.
		$repeater->add_control( 'preview_story_btn', [
			'type' => Controls_Manager::RAW_HTML,
			'raw'  => '<button type="button" class="wps-preview-btn"
				style="width:100%;padding:8px 0;margin-bottom:2px;background:#6a5acd;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:.5px;"
				onclick="(function(btn){
					var row = btn.closest(\'.elementor-repeater-row\');
					if (!row) return;

					/* Toggle */
					var existing = row.querySelector(\'.wps-inline-preview\');
					if (existing) {
						existing.remove();
						btn.textContent = \'▶ Previsualizar story\';
						return;
					}

					/* Story index */
					var idx = 0;
					var siblings = row.parentElement
						? row.parentElement.querySelectorAll(\':scope > .elementor-repeater-row\')
						: [];
					siblings.forEach(function(r,i){ if(r===row) idx=i; });

					/* Gallery images via Elementor Backbone model */
					var imgs = [];
					try {
						var pv  = window.elementor && window.elementor.getPanelView();
						var cv  = pv && pv.content && pv.content.currentView;
						var st  = cv && cv.model && cv.model.get(\'settings\');
						var col = st && st.get(\'stories\');
						var m   = col && col.at(idx);
						var gal = m && m.get(\'gallery\');
						if (gal) gal.forEach(function(img){ if (img.url) imgs.push(img.url); });
					} catch(e) {}

					/* Build preview */
					var wrap = document.createElement(\'div\');
					wrap.className = \'wps-inline-preview\';
					wrap.style.cssText = \'margin:4px 0 10px;border-radius:6px;overflow:hidden;background:#111;position:relative;\';

					if (imgs.length) {
						var curIdx = 0;
						var imgEl  = document.createElement(\'img\');
						imgEl.src  = imgs[0];
						imgEl.style.cssText = \'width:100%;height:220px;object-fit:contain;display:block;background:#111;\';
						wrap.appendChild(imgEl);

						if (imgs.length > 1) {
							var bar = document.createElement(\'div\');
							bar.style.cssText = \'display:flex;justify-content:center;align-items:center;gap:5px;padding:5px 0;background:#1a1a1a;\';
							imgs.forEach(function(src,i){
								var dot = document.createElement(\'button\');
								dot.type = \'button\';
								dot.style.cssText = \'width:7px;height:7px;border-radius:50%;border:none;cursor:pointer;padding:0;background:\'+(i===0?\'#8b7cf8\':\'#444\')+\';\';
								dot.addEventListener(\'click\', function(e){
									e.stopPropagation();
									curIdx = i;
									imgEl.src = src;
									bar.querySelectorAll(\'button\').forEach(function(b,j){ b.style.background = j===i ? \'#8b7cf8\' : \'#444\'; });
								});
								bar.appendChild(dot);
							});
							wrap.appendChild(bar);
						}
					} else {
						var msg = document.createElement(\'p\');
						msg.textContent = \'Sin imágenes — añade fotos en "Story Images".\';
						msg.style.cssText = \'color:#888;text-align:center;padding:14px 8px;margin:0;font-size:11px;\';
						wrap.appendChild(msg);
					}

					btn.insertAdjacentElement(\'afterend\', wrap);
					btn.textContent = \'✕ Cerrar preview\';

					/* Also trigger full viewer in preview iframe */
					var frame = document.getElementById(\'elementor-preview-iframe\');
					if (frame) frame.contentWindow.postMessage({type:\'wps-preview-open\',idx:idx},\'*\');
				})(this)">▶ Previsualizar story</button>',
			'content_classes' => 'elementor-descriptor',
		] );

		$repeater->add_control( 'username', [
			'label'       => esc_html__( 'Username / Title', 'wp-stories' ),
			'type'        => Controls_Manager::TEXT,
			'default'     => 'username',
			'label_block' => true,
		] );

		$repeater->add_control( 'title_tag', [
			'label'   => esc_html__( 'Title Tag', 'wp-stories' ),
			'type'    => Controls_Manager::SELECT,
			'default' => 'span',
			'options' => [
				'h1' => 'H1', 'h2' => 'H2', 'h3' => 'H3',
				'h4' => 'H4', 'h5' => 'H5', 'h6' => 'H6',
				'p'  => 'P',  'span' => 'Span', 'div' => 'Div',
			],
		] );

		$repeater->add_control( 'avatar', [
			'label'   => esc_html__( 'Avatar Image', 'wp-stories' ),
			'type'    => Controls_Manager::MEDIA,
			'default' => [ 'url' => Utils::get_placeholder_image_src() ],
		] );

		$repeater->add_control( 'gallery', [
			'label'      => esc_html__( 'Story Images', 'wp-stories' ),
			'type'       => Controls_Manager::GALLERY,
			'show_label' => true,
		] );

		$repeater->add_control( 'slide_duration', [
			'label'   => esc_html__( 'Seconds per slide', 'wp-stories' ),
			'type'    => Controls_Manager::NUMBER,
			'default' => 5,
			'min'     => 1,
			'max'     => 30,
		] );

		$repeater->add_control( 'image_fit', [
			'label'   => esc_html__( 'Image Fit', 'wp-stories' ),
			'type'    => Controls_Manager::SELECT,
			'default' => 'contain',
			'options' => [
				'contain'    => esc_html__( 'Contain (full image visible)', 'wp-stories' ),
				'cover'      => esc_html__( 'Cover (fill, may crop)', 'wp-stories' ),
				'fill'       => esc_html__( 'Fill (stretch)', 'wp-stories' ),
			],
		] );

		// ── Link Button ───────────────────────────────────────────────────────
		$repeater->add_control( 'link_heading', [
			'label'     => esc_html__( '── Botón de enlace', 'wp-stories' ),
			'type'      => Controls_Manager::HEADING,
			'separator' => 'before',
		] );

		$repeater->add_control( 'link_enable', [
			'label'   => esc_html__( 'Activar enlace', 'wp-stories' ),
			'type'    => Controls_Manager::SWITCHER,
			'default' => '',
		] );

		$repeater->add_control( 'link_url', [
			'label'       => esc_html__( 'URL destino', 'wp-stories' ),
			'type'        => Controls_Manager::URL,
			'placeholder' => 'https://tusitio.com',
			'condition'   => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_text', [
			'label'     => esc_html__( 'Texto del botón', 'wp-stories' ),
			'type'      => Controls_Manager::TEXT,
			'default'   => '',
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_icon', [
			'label'     => esc_html__( 'Icono', 'wp-stories' ),
			'type'      => Controls_Manager::ICONS,
			'default'   => [
				'value'   => 'fas fa-link',
				'library' => 'fa-solid',
			],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_pos_y', [
			'label'       => esc_html__( 'Posición vertical (%)', 'wp-stories' ),
			'description' => esc_html__( '0 = arriba · 100 = abajo · 85 = cerca del fondo', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'range'       => [ 'px' => [ 'min' => 0, 'max' => 100 ] ],
			'default'     => [ 'size' => 85 ],
			'condition'   => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_text_color', [
			'label'     => esc_html__( 'Color texto', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#1a1a1a',
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_bg_color', [
			'label'     => esc_html__( 'Fondo botón', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_border_color', [
			'label'     => esc_html__( 'Color borde', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => 'rgba(0,0,0,0.12)',
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_border_width', [
			'label'     => esc_html__( 'Grosor borde (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 6 ] ],
			'default'   => [ 'size' => 1.5, 'unit' => 'px' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_border_radius', [
			'label'     => esc_html__( 'Radio borde (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
			'default'   => [ 'size' => 50, 'unit' => 'px' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_font_size', [
			'label'     => esc_html__( 'Tamaño fuente (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 8, 'max' => 36 ] ],
			'default'   => [ 'size' => 13, 'unit' => 'px' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_font_weight', [
			'label'     => esc_html__( 'Peso fuente', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => '600',
			'options'   => [
				'300' => 'Light (300)', '400' => 'Normal (400)',
				'500' => 'Medium (500)', '600' => 'SemiBold (600)',
				'700' => 'Bold (700)',   '800' => 'ExtraBold (800)',
			],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_padding_v', [
			'label'     => esc_html__( 'Padding vertical (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 40 ] ],
			'default'   => [ 'size' => 10, 'unit' => 'px' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_padding_h', [
			'label'     => esc_html__( 'Padding horizontal (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
			'default'   => [ 'size' => 22, 'unit' => 'px' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		$repeater->add_control( 'link_target', [
			'label'     => esc_html__( 'Abrir en', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => '_blank',
			'options'   => [ '_blank' => 'Nueva pestaña', '_self' => 'Misma pestaña' ],
			'condition' => [ 'link_enable' => 'yes' ],
		] );

		// ── Text Overlay ──────────────────────────────────────────────────────
		$repeater->add_control( 'text_overlay_heading', [
			'label'     => esc_html__( '── Texto superpuesto', 'wp-stories' ),
			'type'      => Controls_Manager::HEADING,
			'separator' => 'before',
		] );

		$repeater->add_control( 'text_overlay_enable', [
			'label'   => esc_html__( 'Activar texto', 'wp-stories' ),
			'type'    => Controls_Manager::SWITCHER,
			'default' => '',
		] );

		$repeater->add_control( 'text_overlay_content', [
			'label'     => esc_html__( 'Contenido (HTML permitido)', 'wp-stories' ),
			'type'      => Controls_Manager::TEXTAREA,
			'rows'      => 4,
			'default'   => '',
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_pos_x', [
			'label'       => esc_html__( 'Posición X (%)', 'wp-stories' ),
			'description' => esc_html__( '0 = izquierda · 50 = centro · 100 = derecha', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'range'       => [ 'px' => [ 'min' => 0, 'max' => 100 ] ],
			'default'     => [ 'size' => 50 ],
			'condition'   => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_pos_y', [
			'label'       => esc_html__( 'Posición Y (%)', 'wp-stories' ),
			'description' => esc_html__( '0 = arriba · 100 = abajo', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'range'       => [ 'px' => [ 'min' => 0, 'max' => 100 ] ],
			'default'     => [ 'size' => 50 ],
			'condition'   => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_origin_x', [
			'label'     => esc_html__( 'Ancla horizontal', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => 'center',
			'options'   => [
				'left'   => 'Izquierda del contenedor en X',
				'center' => 'Centro del contenedor en X',
				'right'  => 'Derecha del contenedor en X',
			],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_width', [
			'label'      => esc_html__( 'Ancho contenedor', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ '%', 'px' ],
			'range'      => [ '%' => [ 'min' => 10, 'max' => 100 ], 'px' => [ 'min' => 50, 'max' => 600 ] ],
			'default'    => [ 'unit' => '%', 'size' => 80 ],
			'condition'  => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_min_height', [
			'label'     => esc_html__( 'Alto mínimo (px, 0 = auto)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 500 ] ],
			'default'   => [ 'size' => 0, 'unit' => 'px' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_color', [
			'label'     => esc_html__( 'Color texto', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_bg', [
			'label'     => esc_html__( 'Fondo contenedor', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '',
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_font_size', [
			'label'     => esc_html__( 'Tamaño fuente (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 8, 'max' => 72 ] ],
			'default'   => [ 'size' => 16, 'unit' => 'px' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_font_weight', [
			'label'     => esc_html__( 'Peso fuente', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => '400',
			'options'   => [
				'300' => 'Light (300)', '400' => 'Normal (400)',
				'500' => 'Medium (500)', '600' => 'SemiBold (600)',
				'700' => 'Bold (700)',   '800' => 'ExtraBold (800)',
			],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_text_align', [
			'label'     => esc_html__( 'Alineación texto', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => 'center',
			'options'   => [ 'left' => 'Izquierda', 'center' => 'Centro', 'right' => 'Derecha' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_line_height', [
			'label'     => esc_html__( 'Interlineado', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0.8, 'max' => 3, 'step' => 0.1 ] ],
			'default'   => [ 'size' => 1.4 ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_letter_spacing', [
			'label'     => esc_html__( 'Espaciado letras (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => -2, 'max' => 10, 'step' => 0.1 ] ],
			'default'   => [ 'size' => 0 ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_padding_v', [
			'label'     => esc_html__( 'Padding vertical (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
			'default'   => [ 'size' => 12, 'unit' => 'px' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_padding_h', [
			'label'     => esc_html__( 'Padding horizontal (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
			'default'   => [ 'size' => 16, 'unit' => 'px' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		$repeater->add_control( 'text_overlay_border_radius', [
			'label'     => esc_html__( 'Radio borde (px)', 'wp-stories' ),
			'type'      => Controls_Manager::SLIDER,
			'range'     => [ 'px' => [ 'min' => 0, 'max' => 60 ] ],
			'default'   => [ 'size' => 8, 'unit' => 'px' ],
			'condition' => [ 'text_overlay_enable' => 'yes' ],
		] );

		// ── Register repeater ─────────────────────────────────────────────────
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
		 * SECTION: Avatar Circles
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
			'selectors'  => [ '{{WRAPPER}} .wps-story-circle' => '--wps-circle-size: {{SIZE}}{{UNIT}};' ],
		] );

		$this->add_control( 'circle_gap', [
			'label'      => esc_html__( 'Gap between circles (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 4, 'max' => 40, 'step' => 2 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 16 ],
			'selectors'  => [ '{{WRAPPER}} .wps-stories-row' => 'gap: {{SIZE}}{{UNIT}};' ],
		] );

		$this->add_control( 'ring_color_start', [
			'label'     => esc_html__( 'Ring Gradient Start', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#f09433',
			'selectors' => [ '{{WRAPPER}} .wps-story-circle' => '--wps-ring-start: {{VALUE}};' ],
		] );

		$this->add_control( 'ring_color_end', [
			'label'     => esc_html__( 'Ring Gradient End', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#c13584',
			'selectors' => [ '{{WRAPPER}} .wps-story-circle' => '--wps-ring-end: {{VALUE}};' ],
		] );

		$this->add_control( 'ring_width', [
			'label'      => esc_html__( 'Ring Width (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 1, 'max' => 8 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 3 ],
			'selectors'  => [ '{{WRAPPER}} .wps-story-circle' => '--wps-ring-width: {{SIZE}}{{UNIT}};' ],
		] );

		$this->add_control( 'ring_gap', [
			'label'      => esc_html__( 'Ring-to-avatar gap (px)', 'wp-stories' ),
			'type'       => Controls_Manager::SLIDER,
			'size_units' => [ 'px' ],
			'range'      => [ 'px' => [ 'min' => 0, 'max' => 6 ] ],
			'default'    => [ 'unit' => 'px', 'size' => 2 ],
			'selectors'  => [ '{{WRAPPER}} .wps-story-circle' => '--wps-ring-gap: {{SIZE}}{{UNIT}};' ],
		] );

		$this->add_control( 'ring_bg_color', [
			'label'       => esc_html__( 'Color fondo del anillo (gap)', 'wp-stories' ),
			'description' => esc_html__( 'Debe coincidir con el fondo de la fila de stories. Por defecto #1a1a1a.', 'wp-stories' ),
			'type'        => Controls_Manager::COLOR,
			'default'     => '#1a1a1a',
			'selectors'   => [ '{{WRAPPER}} .wps-ring-wrap::before' => 'background: {{VALUE}};' ],
		] );

		$this->end_controls_section();

		/* ============================================================
		 * SECTION: Avatar Image (STYLE TAB)
		 * ========================================================== */
		$this->start_controls_section( 'section_avatar_style', [
			'label' => esc_html__( 'Avatar Image', 'wp-stories' ),
			'tab'   => Controls_Manager::TAB_STYLE,
		] );

		$this->add_control( 'avatar_fit', [
			'label'     => esc_html__( 'Object-fit', 'wp-stories' ),
			'type'      => Controls_Manager::SELECT,
			'default'   => 'cover',
			'options'   => [
				'cover'      => 'Cover — rellena, recorta si hace falta',
				'contain'    => 'Contain — imagen completa, con fondo',
				'fill'       => 'Fill — estira al círculo',
				'none'       => 'None — tamaño natural',
				'scale-down' => 'Scale-down',
			],
			'selectors' => [
				'{{WRAPPER}} .wps-avatar img' => 'object-fit: {{VALUE}};',
			],
		] );

		$this->add_control( 'avatar_pos_x', [
			'label'       => esc_html__( 'Posición horizontal (%)', 'wp-stories' ),
			'description' => esc_html__( '0 = izquierda · 50 = centro · 100 = derecha', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'size_units'  => [ '%' ],
			'range'       => [ '%' => [ 'min' => 0, 'max' => 100 ] ],
			'default'     => [ 'size' => 50, 'unit' => '%' ],
			'selectors'   => [
				'{{WRAPPER}} .wps-avatar' => '--wps-av-x: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'avatar_pos_y', [
			'label'       => esc_html__( 'Posición vertical (%)', 'wp-stories' ),
			'description' => esc_html__( '0 = arriba · 50 = centro · 100 = abajo', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'size_units'  => [ '%' ],
			'range'       => [ '%' => [ 'min' => 0, 'max' => 100 ] ],
			'default'     => [ 'size' => 50, 'unit' => '%' ],
			'selectors'   => [
				'{{WRAPPER}} .wps-avatar' => '--wps-av-y: {{SIZE}}{{UNIT}};',
			],
		] );

		$this->add_control( 'avatar_bg_color', [
			'label'       => esc_html__( 'Color de fondo del avatar', 'wp-stories' ),
			'description' => esc_html__( 'Visible con object-fit: contain o PNG transparentes.', 'wp-stories' ),
			'type'        => Controls_Manager::COLOR,
			'default'     => '#333333',
			'selectors'   => [
				'{{WRAPPER}} .wps-avatar' => 'background: {{VALUE}};',
			],
		] );

		$this->add_control( 'avatar_scale', [
			'label'       => esc_html__( 'Escala imagen (%)', 'wp-stories' ),
			'description' => esc_html__( '100 = normal · < 100 = más pequeña · > 100 = más grande (recorta)', 'wp-stories' ),
			'type'        => Controls_Manager::SLIDER,
			'size_units'  => [ 'px' ],
			'range'       => [ 'px' => [ 'min' => 10, 'max' => 200, 'step' => 1 ] ],
			'default'     => [ 'size' => 100, 'unit' => 'px' ],
			'selectors'   => [
				'{{WRAPPER}} .wps-avatar img' => 'transform: scale(calc({{SIZE}} / 100)); transform-origin: center;',
			],
		] );

		$this->end_controls_section();
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
			'selectors' => [ '{{WRAPPER}} .wps-story-label' => 'color: {{VALUE}};' ],
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
			'selectors' => [ '.wps-viewer-overlay' => 'background: {{VALUE}};' ],
		] );

		$this->add_control( 'progress_bar_color', [
			'label'     => esc_html__( 'Progress Bar Color', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'selectors' => [ '.wps-progress-fill' => 'background: {{VALUE}};' ],
		] );

		$this->add_control( 'progress_bar_bg_color', [
			'label'     => esc_html__( 'Progress Bar Background', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => 'rgba(255,255,255,0.35)',
			'selectors' => [ '.wps-progress-segment' => 'background: {{VALUE}};' ],
		] );

		$this->add_control( 'close_button_color', [
			'label'     => esc_html__( 'Close Button Color', 'wp-stories' ),
			'type'      => Controls_Manager::COLOR,
			'default'   => '#ffffff',
			'selectors' => [ '.wps-close-btn' => 'color: {{VALUE}};' ],
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
			'selectors' => [ '{{WRAPPER}} .wps-stories-row' => 'background: {{VALUE}};' ],
		] );

		$this->add_control( 'row_padding', [
			'label'      => esc_html__( 'Row Padding', 'wp-stories' ),
			'type'       => Controls_Manager::DIMENSIONS,
			'size_units' => [ 'px', 'em', '%' ],
			'default'    => [
				'top' => '12', 'right' => '16', 'bottom' => '12', 'left' => '16',
				'unit' => 'px', 'isLinked' => false,
			],
			'selectors' => [
				'{{WRAPPER}} .wps-stories-row' => 'padding: {{TOP}}{{UNIT}} {{RIGHT}}{{UNIT}} {{BOTTOM}}{{UNIT}} {{LEFT}}{{UNIT}};',
			],
		] );

		$this->add_control( 'row_scrollbar', [
			'label'        => esc_html__( 'Show Scrollbar', 'wp-stories' ),
			'type'         => Controls_Manager::SWITCHER,
			'return_value' => 'yes',
			'default'      => '',
			'selectors'    => [ '{{WRAPPER}} .wps-stories-row' => 'scrollbar-width: auto;' ],
		] );

		$this->end_controls_section();
	}

	/* -----------------------------------------------------------------------
	 * Render (PHP / frontend)
	 * -------------------------------------------------------------------- */

	protected function render() {
		$settings = $this->get_settings_for_display();
		$stories  = $settings['stories'] ?? [];
		if ( empty( $stories ) ) return;

		$data = [];
		foreach ( $stories as $idx => $story ) {
			$data[] = $this->build_story_data( $story, $idx );
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
					$tag = in_array( $story['title_tag'] ?? 'span',
					        [ 'h1','h2','h3','h4','h5','h6','p','span','div' ], true )
					       ? $story['title_tag'] : 'span';
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
								<img src="<?php echo esc_url( $story['avatar']['url'] ); ?>"
								     alt="<?php echo esc_attr( $story['username'] ?? '' ); ?>"
								     loading="lazy">
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
			</div>
		</div>
		<?php
	}

	/* -----------------------------------------------------------------------
	 * Elementor live editor template (Underscore.js)
	 * -------------------------------------------------------------------- */

	protected function content_template() {
		?>
		<#

		var storyData = [];
		_.each( settings.stories, function( story, idx ) {
			var slides = [];
			if ( story.gallery ) {
				_.each( story.gallery, function( img ) {
					slides.push({
						src:      img.url || '',
						alt:      img.alt || '',
						fit:      story.image_fit      || 'contain',
						duration: parseInt( story.slide_duration ) || 5
					});
				});
			}

			// Icon: for class-based icons render <i>, for SVG pass img tag
			var iconHtml = '';
			if ( story.link_icon && story.link_icon.value ) {
				if ( story.link_icon.library === 'svg' && story.link_icon.value && story.link_icon.value.url ) {
					iconHtml = '<img src="' + story.link_icon.value.url + '" class="wps-link-icon" aria-hidden="true">';
				} else if ( story.link_icon.value ) {
					iconHtml = '<i class="' + story.link_icon.value + ' wps-link-icon" aria-hidden="true"></i>';
				}
			}

			var link = {
				on:      story.link_enable === 'yes',
				url:     story.link_url && story.link_url.url ? story.link_url.url : '',
				text:    story.link_text     || '',
				iconHtml: iconHtml,
				posY:    story.link_pos_y    && story.link_pos_y.size    !== undefined ? story.link_pos_y.size    : 85,
				color:   story.link_text_color   || '#1a1a1a',
				bg:      story.link_bg_color      || '#ffffff',
				bdColor: story.link_border_color  || 'rgba(0,0,0,0.12)',
				bdW:     story.link_border_width  && story.link_border_width.size  !== undefined ? story.link_border_width.size  : 1.5,
				bdR:     story.link_border_radius && story.link_border_radius.size !== undefined ? story.link_border_radius.size : 50,
				fs:      story.link_font_size     && story.link_font_size.size     !== undefined ? story.link_font_size.size     : 13,
				fw:      story.link_font_weight   || '600',
				pV:      story.link_padding_v     && story.link_padding_v.size     !== undefined ? story.link_padding_v.size     : 10,
				pH:      story.link_padding_h     && story.link_padding_h.size     !== undefined ? story.link_padding_h.size     : 22,
				target:  story.link_target        || '_blank'
			};

			var txtW  = ( story.text_overlay_width && story.text_overlay_width.size ? story.text_overlay_width.size : 80 ) + ( story.text_overlay_width && story.text_overlay_width.unit ? story.text_overlay_width.unit : '%' );
			var txtMH = story.text_overlay_min_height && story.text_overlay_min_height.size > 0 ? story.text_overlay_min_height.size + 'px' : 'auto';
			var txt = {
				on:  story.text_overlay_enable === 'yes',
				html: story.text_overlay_content || '',
				x:   story.text_overlay_pos_x    && story.text_overlay_pos_x.size    !== undefined ? story.text_overlay_pos_x.size    : 50,
				y:   story.text_overlay_pos_y    && story.text_overlay_pos_y.size    !== undefined ? story.text_overlay_pos_y.size    : 50,
				ox:  story.text_overlay_origin_x  || 'center',
				w:   txtW, mh: txtMH,
				c:   story.text_overlay_color        || '#ffffff',
				bg:  story.text_overlay_bg            || '',
				fs:  story.text_overlay_font_size    && story.text_overlay_font_size.size    !== undefined ? story.text_overlay_font_size.size    : 16,
				fw:  story.text_overlay_font_weight   || '400',
				ta:  story.text_overlay_text_align    || 'center',
				lh:  story.text_overlay_line_height  && story.text_overlay_line_height.size  !== undefined ? story.text_overlay_line_height.size  : 1.4,
				ls:  story.text_overlay_letter_spacing && story.text_overlay_letter_spacing.size !== undefined ? story.text_overlay_letter_spacing.size : 0,
				pV:  story.text_overlay_padding_v    && story.text_overlay_padding_v.size    !== undefined ? story.text_overlay_padding_v.size    : 12,
				pH:  story.text_overlay_padding_h    && story.text_overlay_padding_h.size    !== undefined ? story.text_overlay_padding_h.size    : 16,
				br:  story.text_overlay_border_radius && story.text_overlay_border_radius.size !== undefined ? story.text_overlay_border_radius.size : 8
			};

			storyData.push({
				id: story._id || idx, username: story.username || '',
				avatar: story.avatar && story.avatar.url ? story.avatar.url : '',
				slides: slides, link: link, txt: txt
			});
		});
		var _storyJson = JSON.stringify( storyData );
		#>
		<div class="wps-stories-widget" data-stories="{{ _storyJson }}" data-wps-edit="1">
			<div class="wps-stories-row">
				<# _.each( settings.stories, function( story, idx ) {
					var tag = ['h1','h2','h3','h4','h5','h6','p','span','div'].indexOf(story.title_tag) !== -1 ? story.title_tag : 'span';
					var avatarUrl = story.avatar && story.avatar.url ? story.avatar.url : '';
				#>
				<button class="wps-story-circle" data-story-index="{{ idx }}">
					<span class="wps-ring-wrap">
						<span class="wps-avatar" >
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
