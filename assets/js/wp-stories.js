/**
 * WP Stories – Frontend Logic
 * Version: 0.0.3b
 * Author:  Alejandro Pantoja Malatesta / seekingdog.com
 */

( function () {
  'use strict';

  /* =========================================================================
   * State
   * ====================================================================== */
  let activeWidget    = null;
  let currentUserIdx  = 0;
  let currentSlideIdx = 0;

  let timer         = null;
  let timerStart    = null;
  let timerDuration = 5000;
  let paused        = false;
  let pausedElapsed = 0;

  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging  = false;

  let isEditMode  = false;

  // All initialized widget data – used for editor postMessage preview.
  let allWidgetData = [];

  /* =========================================================================
   * DOM References (built once)
   * ====================================================================== */
  let overlay, viewerInner, viewport, progressBar, header, closeBtn,
      navPrev, navNext, tapPrev, tapNext, sidePrevEl, sideNextEl;

  // Fallback SVG used when no iconHtml is pre-rendered (e.g. fresh editor instance).
  const FALLBACK_LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="wps-link-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  /* =========================================================================
   * Build overlay DOM (once)
   * ====================================================================== */
  function buildOverlay() {
    if ( document.getElementById( 'wps-viewer-overlay' ) ) return;

    isEditMode = !! ( window.elementorFrontend && window.elementorFrontend.isEditMode &&
                      window.elementorFrontend.isEditMode() );

    // Root overlay
    overlay = document.createElement( 'div' );
    overlay.className = 'wps-viewer-overlay' + ( isEditMode ? ' wps-edit-mode' : '' );
    overlay.id        = 'wps-viewer-overlay';
    overlay.setAttribute( 'role', 'dialog' );
    overlay.setAttribute( 'aria-modal', 'true' );
    overlay.setAttribute( 'aria-label', 'Stories viewer' );

    // Inner flex row: [sidePrev][navPrev][viewport][navNext][sideNext]
    viewerInner = document.createElement( 'div' );
    viewerInner.className = 'wps-viewer-inner';

    // Side preview – PREV
    sidePrevEl = document.createElement( 'div' );
    sidePrevEl.className = 'wps-side-preview wps-side-prev';
    sidePrevEl.innerHTML =
      '<img src="" alt="">'
      + '<div class="wps-side-preview-info">'
      +   '<div class="wps-side-preview-avatar"><img src="" alt=""></div>'
      +   '<span class="wps-side-preview-name"></span>'
      + '</div>';

    // Nav prev
    navPrev = document.createElement( 'button' );
    navPrev.className = 'wps-nav-btn wps-nav-prev';
    navPrev.setAttribute( 'aria-label', 'Previous story' );
    navPrev.type = 'button';
    navPrev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    // Main viewport
    viewport = document.createElement( 'div' );
    viewport.className = 'wps-story-viewport';

    progressBar = document.createElement( 'div' );
    progressBar.className = 'wps-progress-bar';

    header = document.createElement( 'div' );
    header.className = 'wps-story-header';
    header.innerHTML =
      '<div class="wps-story-header-avatar"><img src="" alt=""></div>'
      + '<span class="wps-story-header-name"></span>';

    closeBtn = document.createElement( 'button' );
    closeBtn.className = 'wps-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute( 'aria-label', 'Close stories' );
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    tapPrev = document.createElement( 'button' );
    tapPrev.className = 'wps-tap-prev';
    tapPrev.setAttribute( 'aria-label', 'Previous slide' );
    tapPrev.type = 'button';

    tapNext = document.createElement( 'button' );
    tapNext.className = 'wps-tap-next';
    tapNext.setAttribute( 'aria-label', 'Next slide' );
    tapNext.type = 'button';

    viewport.appendChild( progressBar );
    viewport.appendChild( header );
    viewport.appendChild( closeBtn );
    viewport.appendChild( tapPrev );
    viewport.appendChild( tapNext );

    // Nav next
    navNext = document.createElement( 'button' );
    navNext.className = 'wps-nav-btn wps-nav-next';
    navNext.setAttribute( 'aria-label', 'Next story' );
    navNext.type = 'button';
    navNext.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    // Side preview – NEXT
    sideNextEl = document.createElement( 'div' );
    sideNextEl.className = 'wps-side-preview wps-side-next';
    sideNextEl.innerHTML =
      '<img src="" alt="">'
      + '<div class="wps-side-preview-info">'
      +   '<div class="wps-side-preview-avatar"><img src="" alt=""></div>'
      +   '<span class="wps-side-preview-name"></span>'
      + '</div>';

    viewerInner.appendChild( sidePrevEl );
    viewerInner.appendChild( navPrev );
    viewerInner.appendChild( viewport );
    viewerInner.appendChild( navNext );
    viewerInner.appendChild( sideNextEl );
    overlay.appendChild( viewerInner );
    document.body.appendChild( overlay );

    // Events
    closeBtn.addEventListener( 'click', closeViewer );
    navPrev.addEventListener( 'click', function() { changeUser( currentUserIdx - 1, 'right' ); } );
    navNext.addEventListener( 'click', function() { changeUser( currentUserIdx + 1, 'left' ); } );
    sidePrevEl.addEventListener( 'click', function() { changeUser( currentUserIdx - 1, 'right' ); } );
    sideNextEl.addEventListener( 'click', function() { changeUser( currentUserIdx + 1, 'left' ); } );
    tapPrev.addEventListener( 'click', prevSlide );
    tapNext.addEventListener( 'click', nextSlide );

    viewport.addEventListener( 'touchstart', onTouchStart, { passive: true } );
    viewport.addEventListener( 'touchmove',  onTouchMove,  { passive: false } );
    viewport.addEventListener( 'touchend',   onTouchEnd,   { passive: true } );

    viewport.addEventListener( 'mousedown', pauseTimer );
    viewport.addEventListener( 'mouseup',   resumeTimer );

    document.addEventListener( 'keydown', onKeyDown );
    window.addEventListener( 'popstate', onPopState );
  }

  /* =========================================================================
   * Open / Close
   * ====================================================================== */
  function openViewer( widgetData, userIdx ) {
    buildOverlay();
    activeWidget    = widgetData;
    currentUserIdx  = userIdx;
    currentSlideIdx = 0;

    if ( ! isEditMode ) {
      document.body.classList.add( 'wps-open' );
      history.pushState( { wpsOpen: true }, '' );
    }

    overlay.classList.add( 'wps-visible' );
    renderUser( currentUserIdx );
  }

  function closeViewer() {
    stopTimer();
    overlay.classList.remove( 'wps-visible' );

    if ( ! isEditMode ) {
      document.body.classList.remove( 'wps-open' );
      if ( history.state && history.state.wpsOpen ) history.back();
    }

    setTimeout( function() {
      viewport.querySelectorAll( '.wps-story-image, .wps-link-btn, .wps-text-overlay' )
               .forEach( function( el ) { el.remove(); } );
      progressBar.innerHTML = '';
    }, 300 );

    activeWidget = null;
  }

  /* =========================================================================
   * Render a user
   * ====================================================================== */
  function renderUser( userIdx ) {
    if ( ! activeWidget ) return;
    const stories = activeWidget.stories;
    if ( userIdx < 0 || userIdx >= stories.length ) return;

    const user = stories[ userIdx ];

    // Mark circle as seen
    const circleEl = activeWidget.el.querySelector( '[data-story-index="' + userIdx + '"]' );
    if ( circleEl ) circleEl.classList.add( 'wps-seen' );

    // Header
    header.querySelector( 'img' ).src = user.avatar || '';
    header.querySelector( 'img' ).alt = user.username || '';
    header.querySelector( '.wps-story-header-name' ).textContent = user.username || '';

    // Clear previous slide images and overlays
    viewport.querySelectorAll( '.wps-story-image, .wps-link-btn, .wps-text-overlay' )
             .forEach( function( el ) { el.remove(); } );

    // Progress segments
    progressBar.innerHTML = '';
    ( user.slides || [] ).forEach( function( _, i ) {
      const seg  = document.createElement( 'div' );
      seg.className = 'wps-progress-segment';
      const fill = document.createElement( 'div' );
      fill.className = 'wps-progress-fill';
      fill.dataset.index = i;
      seg.appendChild( fill );
      progressBar.appendChild( seg );
    } );

    // Slide images with per-user image styles
    ( user.slides || [] ).forEach( function( slide, i ) {
      const div = document.createElement( 'div' );
      div.className = 'wps-story-image';
      div.dataset.index = i;
      if ( user.imgBg ) div.style.backgroundColor = user.imgBg;

      const img = document.createElement( 'img' );
      img.src = slide.src || '';
      img.alt = slide.alt || '';
      img.style.objectFit = slide.fit || 'contain';
      if ( user.imgW && user.imgW !== '100%' ) img.style.width  = user.imgW;
      if ( user.imgH && user.imgH !== '100%' ) img.style.height = user.imgH;

      div.appendChild( img );
      viewport.appendChild( div );
    } );

    // Link button
    if ( user.link && user.link.on && user.link.url ) {
      viewport.appendChild( createLinkBtn( user.link ) );
    }

    // Text overlay
    if ( user.txt && user.txt.on && user.txt.html ) {
      viewport.appendChild( createTextOverlay( user.txt ) );
    }

    // Side previews + nav visibility
    updateSidePreviews( userIdx );

    showSlide( currentSlideIdx );
  }

  /* =========================================================================
   * Link button element
   * ====================================================================== */
  function createLinkBtn( cfg ) {
    const a = document.createElement( 'a' );
    a.className = 'wps-link-btn';
    a.href      = cfg.url;
    a.target    = cfg.target || '_blank';
    if ( cfg.target === '_blank' ) a.rel = 'noopener noreferrer';

    // Inline styles – all from per-user configuration
    a.style.cssText = [
      'bottom:' + ( 100 - cfg.posY ) + '%',
      'color:'        + cfg.color,
      'background:'   + cfg.bg,
      'border:'       + cfg.bdW + 'px solid ' + cfg.bdColor,
      'border-radius:'+ cfg.bdR + 'px',
      'font-size:'    + cfg.fs  + 'px',
      'font-weight:'  + cfg.fw,
      'padding:'      + cfg.pV  + 'px ' + cfg.pH + 'px',
    ].join(';');

    // Icon – use pre-rendered HTML from PHP (supports any Elementor icon)
    // Fall back to SVG link icon when in editor template mode.
    const iconHtml = cfg.iconHtml || FALLBACK_LINK_SVG;
    if ( iconHtml ) {
      const iconWrap = document.createElement( 'span' );
      iconWrap.className = 'wps-link-btn-icon';
      iconWrap.innerHTML = iconHtml;
      a.appendChild( iconWrap );
    }

    // Text label
    if ( cfg.text ) {
      const textSpan = document.createElement( 'span' );
      textSpan.textContent = cfg.text;
      a.appendChild( textSpan );
    }

    // Prevent tap zones from firing when link is tapped
    a.addEventListener( 'click', function( e ) { e.stopPropagation(); } );

    return a;
  }

  /* =========================================================================
   * Text overlay element
   * ====================================================================== */
  function createTextOverlay( cfg ) {
    const div = document.createElement( 'div' );
    div.className = 'wps-text-overlay';

    // Position: left = X%, top = Y%, with transform based on anchor
    let translateX = '0';
    if ( cfg.ox === 'center' ) translateX = '-50%';
    if ( cfg.ox === 'right'  ) translateX = '-100%';

    div.style.cssText = [
      'left:' + cfg.x + '%',
      'top:'  + cfg.y + '%',
      'transform:translate(' + translateX + ',-50%)',
      'width:' + cfg.w,
      'min-height:' + ( cfg.mh || 'auto' ),
      'color:' + cfg.c,
      'background:' + ( cfg.bg || 'transparent' ),
      'font-size:' + cfg.fs + 'px',
      'font-weight:' + cfg.fw,
      'text-align:' + cfg.ta,
      'line-height:' + cfg.lh,
      'letter-spacing:' + cfg.ls + 'px',
      'padding:' + cfg.pV + 'px ' + cfg.pH + 'px',
      'border-radius:' + cfg.br + 'px',
    ].join(';');

    // Use innerHTML to allow basic formatting tags; content is wp_kses_post sanitized server-side
    div.innerHTML = cfg.html;

    return div;
  }

  /* =========================================================================
   * Side previews
   * ====================================================================== */
  function updateSidePreviews( userIdx ) {
    const stories = activeWidget.stories;

    if ( userIdx > 0 ) {
      const prev       = stories[ userIdx - 1 ];
      const firstSlide = prev.slides && prev.slides[0];
      sidePrevEl.querySelector( 'img:first-child' ).src = firstSlide ? firstSlide.src : '';
      sidePrevEl.querySelector( 'img:first-child' ).alt = prev.username || '';
      sidePrevEl.querySelector( '.wps-side-preview-avatar img' ).src = prev.avatar || '';
      sidePrevEl.querySelector( '.wps-side-preview-name' ).textContent = prev.username || '';
      sidePrevEl.style.visibility = '';
      navPrev.style.visibility    = '';
    } else {
      sidePrevEl.style.visibility = 'hidden';
      navPrev.style.visibility    = 'hidden';
    }

    if ( userIdx < stories.length - 1 ) {
      const next       = stories[ userIdx + 1 ];
      const firstSlide = next.slides && next.slides[0];
      sideNextEl.querySelector( 'img:first-child' ).src = firstSlide ? firstSlide.src : '';
      sideNextEl.querySelector( 'img:first-child' ).alt = next.username || '';
      sideNextEl.querySelector( '.wps-side-preview-avatar img' ).src = next.avatar || '';
      sideNextEl.querySelector( '.wps-side-preview-name' ).textContent = next.username || '';
      sideNextEl.style.visibility = '';
      navNext.style.visibility    = '';
    } else {
      sideNextEl.style.visibility = 'hidden';
      navNext.style.visibility    = 'hidden';
    }
  }

  /* =========================================================================
   * Slide control
   * ====================================================================== */
  function showSlide( slideIdx ) {
    if ( ! activeWidget ) return;
    const user = activeWidget.stories[ currentUserIdx ];
    if ( ! user || ! user.slides ) return;

    currentSlideIdx = slideIdx;

    viewport.querySelectorAll( '.wps-story-image' ).forEach( function( el ) {
      el.classList.toggle( 'wps-active', parseInt( el.dataset.index, 10 ) === slideIdx );
    } );

    progressBar.querySelectorAll( '.wps-progress-fill' ).forEach( function( fill ) {
      const i = parseInt( fill.dataset.index, 10 );
      fill.classList.remove( 'wps-done' );
      fill.style.width = i < slideIdx ? '100%' : '0%';
    } );

    const duration = ( user.slides[ slideIdx ] && user.slides[ slideIdx ].duration
      ? user.slides[ slideIdx ].duration : 5 ) * 1000;

    startTimer( duration );
  }

  function nextSlide() {
    if ( ! activeWidget ) return;
    const user = activeWidget.stories[ currentUserIdx ];
    if ( ! user ) return;
    stopTimer();

    const fill = progressBar.querySelector( '[data-index="' + currentSlideIdx + '"]' );
    if ( fill ) { fill.classList.add( 'wps-done' ); fill.style.width = '100%'; }

    if ( currentSlideIdx < ( user.slides || [] ).length - 1 ) {
      showSlide( currentSlideIdx + 1 );
    } else {
      changeUser( currentUserIdx + 1, 'left' );
    }
  }

  function prevSlide() {
    if ( ! activeWidget ) return;
    stopTimer();
    if ( currentSlideIdx > 0 ) {
      showSlide( currentSlideIdx - 1 );
    } else {
      changeUser( currentUserIdx - 1, 'right' );
    }
  }

  /* =========================================================================
   * User navigation
   * ====================================================================== */
  function changeUser( newIdx, direction ) {
    if ( ! activeWidget ) return;
    if ( newIdx < 0 || newIdx >= activeWidget.stories.length ) {
      closeViewer();
      return;
    }

    stopTimer();
    currentSlideIdx = 0;
    currentUserIdx  = newIdx;

    const animClass = direction === 'left' ? 'wps-swipe-left' : 'wps-swipe-right';
    viewport.classList.add( animClass );

    setTimeout( function() {
      viewport.classList.remove( animClass );
      renderUser( currentUserIdx );
    }, 240 );
  }

  /* =========================================================================
   * Timer (rAF-based)
   * ====================================================================== */
  function startTimer( duration ) {
    stopTimer();
    timerDuration = duration;
    paused        = false;
    pausedElapsed = 0;

    const fill = progressBar.querySelector( '[data-index="' + currentSlideIdx + '"]' );
    if ( ! fill ) return;

    timerStart = performance.now();

    function tick( now ) {
      if ( paused ) { timer = requestAnimationFrame( tick ); return; }
      const elapsed = now - timerStart;
      fill.style.width = Math.min( elapsed / timerDuration * 100, 100 ) + '%';
      if ( elapsed >= timerDuration ) {
        fill.classList.add( 'wps-done' );
        nextSlide();
        return;
      }
      timer = requestAnimationFrame( tick );
    }

    timer = requestAnimationFrame( tick );
  }

  function stopTimer() {
    if ( timer ) { cancelAnimationFrame( timer ); timer = null; }
  }

  function pauseTimer() {
    if ( ! paused && timerStart !== null ) {
      pausedElapsed = performance.now() - timerStart;
      paused = true;
    }
  }

  function resumeTimer() {
    if ( paused ) {
      timerStart = performance.now() - pausedElapsed;
      paused = false;
    }
  }

  /* =========================================================================
   * Touch / Swipe
   * ====================================================================== */
  function onTouchStart( e ) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging  = false;
    pauseTimer();
  }

  function onTouchMove( e ) {
    if ( ! e.touches.length ) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if ( ! isDragging && ( Math.abs(dx) > 8 || Math.abs(dy) > 8 ) ) isDragging = true;

    if ( isDragging && Math.abs(dy) > Math.abs(dx) && dy > 0 ) {
      e.preventDefault();
      viewport.classList.add( 'wps-dragging' );
      const scale   = Math.max( 0.88, 1 - dy / 600 );
      const opacity = Math.max( 0.2,  1 - dy / 280 );
      viewport.style.transform = 'scale(' + scale + ') translateY(' + ( dy * 0.35 ) + 'px)';
      overlay.style.opacity    = opacity;
    }
  }

  function onTouchEnd( e ) {
    const dx    = e.changedTouches[0].clientX - touchStartX;
    const dy    = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs( dx );
    const absDy = Math.abs( dy );

    viewport.classList.remove( 'wps-dragging' );
    viewport.style.transform = '';
    overlay.style.opacity    = '';

    if ( isDragging ) {
      if ( absDy > absDx && dy > 80 )        { closeViewer(); return; }
      if ( absDx > absDy && absDx > 50 )  {
        if ( dx < 0 ) changeUser( currentUserIdx + 1, 'left' );
        else          changeUser( currentUserIdx - 1, 'right' );
        return;
      }
    }

    resumeTimer();
    isDragging = false;
  }

  /* =========================================================================
   * Keyboard
   * ====================================================================== */
  function onKeyDown( e ) {
    if ( ! overlay || ! overlay.classList.contains( 'wps-visible' ) ) return;
    if ( e.key === 'ArrowRight' ) nextSlide();
    if ( e.key === 'ArrowLeft'  ) prevSlide();
    if ( e.key === 'Escape'     ) closeViewer();
  }

  /* =========================================================================
   * Android back
   * ====================================================================== */
  function onPopState() {
    if ( overlay && overlay.classList.contains( 'wps-visible' ) ) {
      overlay.classList.remove( 'wps-visible' );
      document.body.classList.remove( 'wps-open' );
      stopTimer();
      activeWidget = null;
    }
  }

  /* =========================================================================
   * Init
   * ====================================================================== */
  function initWidgets() {
    document.querySelectorAll( '.wps-stories-widget' ).forEach( function( el ) {
      if ( el.dataset.wpsInit ) return;
      el.dataset.wpsInit = '1';

      let stories;
      try { stories = JSON.parse( el.dataset.stories || '[]' ); }
      catch(e) { stories = []; }
      if ( ! stories.length ) return;

      const widgetData = { el: el, stories: stories };
      allWidgetData.push( widgetData );

      el.querySelectorAll( '.wps-story-circle' ).forEach( function( btn ) {
        btn.addEventListener( 'click', function() {
          currentSlideIdx = 0;
          openViewer( widgetData, parseInt( btn.dataset.storyIndex, 10 ) );
        } );
      } );
    } );
  }

  /* =========================================================================
   * Boot
   * ====================================================================== */
  if ( document.readyState === 'loading' ) {
    document.addEventListener( 'DOMContentLoaded', initWidgets );
  } else {
    initWidgets();
  }

  if ( window.elementorFrontend ) {
    window.elementorFrontend.hooks.addAction(
      'frontend/element_ready/wp-stories.default',
      function() { initWidgets(); }
    );
  }

  // Editor postMessage: "▶ Abrir preview" button in Elementor panel.
  // Registered at script-load time (not inside buildOverlay) so it's always
  // available even before the user has clicked any circle in the preview.
  window.addEventListener( 'message', function( e ) {
    if ( ! e.data || e.data.type !== 'wps-preview-open' ) return;
    var idx    = parseInt( e.data.idx ) || 0;
    var widget = allWidgetData[0];   // first (or only) widget on the page
    if ( widget && idx < widget.stories.length ) {
      currentSlideIdx = 0;
      openViewer( widget, idx );
    }
  } );

} )();
