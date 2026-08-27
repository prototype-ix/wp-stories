/**
 * WP Stories – Frontend Logic
 * Version: 0.0.10
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
  let historyEntryPushed = false;

  // All initialized widget data – used for editor postMessage preview.
  let allWidgetData = [];

  /* =========================================================================
   * DOM References (built once)
   * ====================================================================== */
  let overlay, viewerInner, cubeStage, cubeRotator, viewport, progressBar, header, closeBtn,
      navPrev, navNext, tapPrev, tapNext, sidePrevEl, sideNextEl;

  // Fallback SVG used when no iconHtml is pre-rendered (e.g. fresh editor instance).
  const FALLBACK_LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="wps-link-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  const I18N = window.wpStoriesI18n || {};

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
    overlay.setAttribute( 'aria-label', I18N.viewerLabel || 'Stories viewer' );

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
    navPrev.setAttribute( 'aria-label', I18N.previousSlide || 'Previous slide' );
    navPrev.type = 'button';
    navPrev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    // Main viewport
    viewport = document.createElement( 'div' );
    viewport.className = 'wps-story-viewport wps-cube-current';

    cubeStage = document.createElement( 'div' );
    cubeStage.className = 'wps-cube-stage';
    cubeRotator = document.createElement( 'div' );
    cubeRotator.className = 'wps-cube-rotator';

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
    closeBtn.setAttribute( 'aria-label', I18N.closeStories || 'Close stories' );
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    tapPrev = document.createElement( 'button' );
    tapPrev.className = 'wps-tap-prev';
    tapPrev.setAttribute( 'aria-label', I18N.previousSlide || 'Previous slide' );
    tapPrev.type = 'button';

    tapNext = document.createElement( 'button' );
    tapNext.className = 'wps-tap-next';
    tapNext.setAttribute( 'aria-label', I18N.nextSlide || 'Next slide' );
    tapNext.type = 'button';

    viewport.appendChild( progressBar );
    viewport.appendChild( header );
    viewport.appendChild( tapPrev );
    viewport.appendChild( tapNext );
    cubeRotator.appendChild( viewport );
    cubeStage.appendChild( cubeRotator );

    // Nav next
    navNext = document.createElement( 'button' );
    navNext.className = 'wps-nav-btn wps-nav-next';
    navNext.setAttribute( 'aria-label', I18N.nextSlide || 'Next slide' );
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
    viewerInner.appendChild( cubeStage );
    viewerInner.appendChild( closeBtn );
    viewerInner.appendChild( navNext );
    viewerInner.appendChild( sideNextEl );
    overlay.appendChild( viewerInner );
    document.body.appendChild( overlay );

    // Events
    closeBtn.addEventListener( 'click', closeViewer );
    // The arrows advance slides; the adjacent user cards change users.
    navPrev.addEventListener( 'click', function() { prevSlide( false ); } );
    navNext.addEventListener( 'click', function() { nextSlide( false ); } );
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
      history.pushState( { ...( history.state || {} ), wpsViewerOpen: true }, '' );
      historyEntryPushed = true;
    }

    overlay.classList.add( 'wps-visible' );
    renderUser( currentUserIdx );
  }

  function clearViewer() {
    stopTimer();
    overlay.classList.remove( 'wps-visible' );
    overlay.style.opacity = '';
    viewport.style.transform = '';
    viewport.classList.remove( 'wps-dragging' );
    cubeRotator.classList.remove( 'wps-cube-turn-left', 'wps-cube-turn-right' );
    cubeRotator.querySelectorAll( '.wps-cube-face' ).forEach( function( face ) { face.remove(); } );
    document.body.classList.remove( 'wps-open' );

    window.setTimeout( function() {
      viewport.querySelectorAll( '.wps-story-image, .wps-link-btn, .wps-text-overlay' )
               .forEach( function( el ) { el.remove(); } );
      progressBar.innerHTML = '';
    }, 300 );

    activeWidget = null;
    isDragging = false;
  }

  function closeViewer() {
    if ( ! overlay || ! overlay.classList.contains( 'wps-visible' ) ) return;

    clearViewer();

    if ( ! isEditMode ) {
      if ( historyEntryPushed ) {
        historyEntryPushed = false;
        history.back();
      }
    }
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
      const fit = [ 'cover', 'contain', 'scale-down' ].indexOf( slide.fit ) !== -1 ? slide.fit : 'cover';
      img.style.objectFit = fit;
      img.style.objectPosition = 'center center';
      img.style.width = '100%';
      img.style.height = '100%';

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
    } else {
      sidePrevEl.style.visibility = 'hidden';
    }

    if ( userIdx < stories.length - 1 ) {
      const next       = stories[ userIdx + 1 ];
      const firstSlide = next.slides && next.slides[0];
      sideNextEl.querySelector( 'img:first-child' ).src = firstSlide ? firstSlide.src : '';
      sideNextEl.querySelector( 'img:first-child' ).alt = next.username || '';
      sideNextEl.querySelector( '.wps-side-preview-avatar img' ).src = next.avatar || '';
      sideNextEl.querySelector( '.wps-side-preview-name' ).textContent = next.username || '';
      sideNextEl.style.visibility = '';
    } else {
      sideNextEl.style.visibility = 'hidden';
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
    navPrev.style.visibility = slideIdx > 0 ? '' : 'hidden';
    navNext.style.visibility = slideIdx < user.slides.length - 1 ? '' : 'hidden';

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

  function nextSlide( allowUserAdvance ) {
    if ( ! activeWidget ) return;
    const user = activeWidget.stories[ currentUserIdx ];
    if ( ! user ) return;
    stopTimer();

    const fill = progressBar.querySelector( '[data-index="' + currentSlideIdx + '"]' );
    if ( fill ) { fill.classList.add( 'wps-done' ); fill.style.width = '100%'; }

    if ( currentSlideIdx < ( user.slides || [] ).length - 1 ) {
      showSlide( currentSlideIdx + 1 );
    } else if ( allowUserAdvance !== false ) {
      changeUser( currentUserIdx + 1, 'left' );
    } else {
      showSlide( currentSlideIdx );
    }
  }

  function prevSlide( allowUserAdvance ) {
    if ( ! activeWidget ) return;
    stopTimer();
    if ( currentSlideIdx > 0 ) {
      showSlide( currentSlideIdx - 1 );
    } else if ( allowUserAdvance !== false ) {
      changeUser( currentUserIdx - 1, 'right' );
    } else {
      showSlide( currentSlideIdx );
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

    if ( cubeRotator.classList.contains( 'wps-cube-turn-left' ) ||
         cubeRotator.classList.contains( 'wps-cube-turn-right' ) ) return;

    stopTimer();
    const incoming = buildCubeFace( activeWidget.stories[ newIdx ], direction );
    const turnClass = direction === 'left' ? 'wps-cube-turn-left' : 'wps-cube-turn-right';
    cubeRotator.appendChild( incoming );

    // Force the incoming 90-degree face to be painted before rotating the cube.
    void cubeRotator.offsetWidth;
    cubeRotator.classList.add( turnClass );

    setTimeout( function() {
      currentSlideIdx = 0;
      currentUserIdx  = newIdx;
      cubeRotator.classList.add( 'wps-cube-reset' );
      cubeRotator.classList.remove( turnClass );
      incoming.remove();
      renderUser( currentUserIdx );
      void cubeRotator.offsetWidth;
      cubeRotator.classList.remove( 'wps-cube-reset' );
    }, 520 );
  }

  /** Build the visible incoming side of the cube with the next user's first story. */
  function buildCubeFace( user, direction ) {
    const face = document.createElement( 'div' );
    face.className = 'wps-cube-face ' + ( direction === 'left' ? 'wps-cube-face-right' : 'wps-cube-face-left' );

    const firstSlide = user.slides && user.slides[0];
    if ( firstSlide ) {
      const image = document.createElement( 'img' );
      image.className = 'wps-cube-face-image';
      image.src = firstSlide.src || '';
      image.alt = firstSlide.alt || '';
      image.style.objectFit = firstSlide.fit || 'cover';
      face.appendChild( image );
    }

    const faceProgress = document.createElement( 'div' );
    faceProgress.className = 'wps-progress-bar wps-cube-face-progress';
    ( user.slides || [] ).forEach( function() {
      const segment = document.createElement( 'div' );
      segment.className = 'wps-progress-segment';
      faceProgress.appendChild( segment );
    } );
    face.appendChild( faceProgress );

    const faceHeader = document.createElement( 'div' );
    faceHeader.className = 'wps-story-header wps-cube-face-header';
    const avatar = document.createElement( 'div' );
    avatar.className = 'wps-story-header-avatar';
    const avatarImage = document.createElement( 'img' );
    avatarImage.src = user.avatar || '';
    avatarImage.alt = user.username || '';
    avatar.appendChild( avatarImage );
    const name = document.createElement( 'span' );
    name.className = 'wps-story-header-name';
    name.textContent = user.username || '';
    faceHeader.appendChild( avatar );
    faceHeader.appendChild( name );
    face.appendChild( faceHeader );

    return face;
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
      // Android's back gesture arrives here. Reset every transient state so a
      // subsequent tap on any story circle can open the same overlay again.
      historyEntryPushed = false;
      clearViewer();
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

      // Replace stale entry for same widget ID (Elementor re-renders create new DOM nodes).
      allWidgetData = allWidgetData.filter( function( w ) { return w.el.id !== el.id; } );
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

  // Elementor hook (fires after widget renders in both editor and frontend).
  var _hookRegistered = false;
  function _registerElementorHook() {
    if ( _hookRegistered || ! window.elementorFrontend ) return;
    _hookRegistered = true;
    window.elementorFrontend.hooks.addAction(
      'frontend/element_ready/wp-stories.default',
      function() { initWidgets(); }
    );
  }
  _registerElementorHook();

  // In the Elementor editor the hook registration might run before elementorFrontend
  // is ready. Use a MutationObserver as a reliable fallback: call initWidgets()
  // whenever new .wps-stories-widget nodes appear in the DOM.
  if ( typeof MutationObserver !== 'undefined' ) {
    var _observer = new MutationObserver( function( mutations ) {
      var needsInit = false;
      mutations.forEach( function( m ) {
        m.addedNodes.forEach( function( node ) {
          if ( node.nodeType !== 1 ) return;
          if ( node.classList && node.classList.contains( 'wps-stories-widget' ) ) {
            needsInit = true;
          } else if ( node.querySelector && node.querySelector( '.wps-stories-widget' ) ) {
            needsInit = true;
          }
        } );
      } );
      if ( needsInit ) initWidgets();
    } );
    _observer.observe( document.documentElement, { childList: true, subtree: true } );
  }

  // Also register the Elementor hook once elementorFrontend is available
  // (in case it wasn't ready at script-load time).
  document.addEventListener( 'DOMContentLoaded', function() {
    _registerElementorHook();
    // Retry a second time for slow Elementor initialisation.
    setTimeout( function() { _registerElementorHook(); initWidgets(); }, 800 );
  } );

  // Editor postMessage: preview button in Elementor panel sends this message.
  // Registered at script-load time so it's always available.
  window.addEventListener( 'message', function( e ) {
    if ( ! e.data || e.data.type !== 'wps-preview-open' ) return;
    var idx = parseInt( e.data.idx ) || 0;

    // Re-scan DOM so we always have the latest widget data after Elementor re-renders.
    initWidgets();

    // Use the most recently registered widget (newest after re-render).
    var widget = allWidgetData[ allWidgetData.length - 1 ];

    // Last-resort: read directly from DOM.
    if ( ! widget ) {
      var el = document.querySelector( '.wps-stories-widget' );
      if ( el ) {
        try {
          var s = JSON.parse( el.dataset.stories || '[]' );
          if ( s.length ) widget = { el: el, stories: s };
        } catch(e) {}
      }
    }

    if ( widget && idx < widget.stories.length ) {
      currentSlideIdx = 0;
      openViewer( widget, idx );
    }
  } );

} )();
