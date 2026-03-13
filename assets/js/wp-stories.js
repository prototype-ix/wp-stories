/**
 * WP Stories – Frontend Logic
 * Version: 0.0.1b
 * Author:  Alejandro Pantoja Malatesta / seekingdog.com
 *
 * Features:
 *  - Click story circle → open viewer
 *  - Auto-advancing slides with per-slide timer + progress bars
 *  - Auto-advance to next user when all slides consumed
 *  - Tap left zone → previous slide; tap right zone → next slide
 *  - Desktop arrow buttons for prev/next user
 *  - Keyboard: ArrowLeft/ArrowRight (slides), Escape (close)
 *  - Touch swipe: horizontal → change user, vertical → close (iOS style)
 *  - Android back button → close (popstate)
 *  - Body scroll lock while viewer is open
 *  - "Seen" ring state per user
 */

( function () {
  'use strict';

  /* =========================================================================
   * State
   * ====================================================================== */
  let allWidgets   = [];   // [{ el, stories: [...] }]
  let flatStories  = [];   // merged list across all widgets on page
  let activeWidget = null;

  let currentUserIdx = 0;
  let currentSlideIdx = 0;

  let timer        = null;   // requestAnimationFrame handle
  let timerStart   = null;
  let timerDuration = 5000;  // ms for current slide
  let paused       = false;

  let touchStartX  = 0;
  let touchStartY  = 0;
  let isDragging   = false;
  let dragDeltaY   = 0;

  /* =========================================================================
   * DOM References (created once)
   * ====================================================================== */
  let overlay, viewport, progressBar, header, closeBtn,
      navPrev, navNext, tapPrev, tapNext;

  /* =========================================================================
   * Build overlay DOM (once)
   * ====================================================================== */
  function buildOverlay() {
    if ( document.getElementById( 'wps-viewer-overlay' ) ) return;

    overlay = document.createElement( 'div' );
    overlay.className = 'wps-viewer-overlay';
    overlay.id        = 'wps-viewer-overlay';
    overlay.setAttribute( 'role', 'dialog' );
    overlay.setAttribute( 'aria-modal', 'true' );
    overlay.setAttribute( 'aria-label', 'Stories viewer' );

    viewport = document.createElement( 'div' );
    viewport.className = 'wps-story-viewport';

    // Progress bar container
    progressBar = document.createElement( 'div' );
    progressBar.className = 'wps-progress-bar';

    // Story header (avatar + name)
    header = document.createElement( 'div' );
    header.className = 'wps-story-header';
    header.innerHTML = '<div class="wps-story-header-avatar"><img src="" alt=""></div>'
                     + '<span class="wps-story-header-name"></span>';

    // Close button
    closeBtn = document.createElement( 'button' );
    closeBtn.className   = 'wps-close-btn';
    closeBtn.setAttribute( 'aria-label', 'Close stories' );
    closeBtn.innerHTML   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    // Desktop prev/next user
    navPrev = document.createElement( 'button' );
    navPrev.className = 'wps-nav-btn wps-nav-prev';
    navPrev.setAttribute( 'aria-label', 'Previous story' );
    navPrev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    navNext = document.createElement( 'button' );
    navNext.className = 'wps-nav-btn wps-nav-next';
    navNext.setAttribute( 'aria-label', 'Next story' );
    navNext.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    // Tap zones
    tapPrev = document.createElement( 'button' );
    tapPrev.className = 'wps-tap-prev';
    tapPrev.setAttribute( 'aria-label', 'Previous slide' );

    tapNext = document.createElement( 'button' );
    tapNext.className = 'wps-tap-next';
    tapNext.setAttribute( 'aria-label', 'Next slide' );

    viewport.appendChild( progressBar );
    viewport.appendChild( header );
    viewport.appendChild( closeBtn );
    viewport.appendChild( tapPrev );
    viewport.appendChild( tapNext );
    overlay.appendChild( navPrev );
    overlay.appendChild( viewport );
    overlay.appendChild( navNext );
    document.body.appendChild( overlay );

    /* ----- Events ----- */
    closeBtn.addEventListener( 'click', closeViewer );
    navPrev.addEventListener( 'click', function() { changeUser( currentUserIdx - 1, 'right' ); } );
    navNext.addEventListener( 'click', function() { changeUser( currentUserIdx + 1, 'left' ); } );
    tapPrev.addEventListener( 'click', prevSlide );
    tapNext.addEventListener( 'click', nextSlide );

    // Touch events on viewport
    viewport.addEventListener( 'touchstart', onTouchStart, { passive: true } );
    viewport.addEventListener( 'touchmove',  onTouchMove,  { passive: false } );
    viewport.addEventListener( 'touchend',   onTouchEnd,   { passive: true } );

    // Keyboard
    document.addEventListener( 'keydown', onKeyDown );

    // Android back button / browser history back
    window.addEventListener( 'popstate', onPopState );

    // Hold to pause
    viewport.addEventListener( 'mousedown',  pauseTimer );
    viewport.addEventListener( 'mouseup',    resumeTimer );
    viewport.addEventListener( 'touchstart', pauseOnTouchStart, { passive: true } );
    viewport.addEventListener( 'touchend',   resumeOnTouchEnd,  { passive: true } );
  }

  /* =========================================================================
   * Open / Close
   * ====================================================================== */
  function openViewer( widgetData, userIdx ) {
    buildOverlay();
    activeWidget = widgetData;
    currentUserIdx  = userIdx;
    currentSlideIdx = 0;

    document.body.classList.add( 'wps-open' );
    overlay.classList.add( 'wps-visible' );

    // Push a history state so Android back closes the viewer
    history.pushState( { wpsOpen: true }, '' );

    renderUser( currentUserIdx );
  }

  function closeViewer() {
    stopTimer();
    overlay.classList.remove( 'wps-visible' );
    document.body.classList.remove( 'wps-open' );

    // Remove the history state we pushed (if it's still there)
    if ( history.state && history.state.wpsOpen ) {
      history.back();
    }

    // Clean up slide images
    setTimeout( function() {
      while ( viewport.querySelector( '.wps-story-image' ) ) {
        viewport.removeChild( viewport.querySelector( '.wps-story-image' ) );
      }
      progressBar.innerHTML = '';
    }, 300 );

    activeWidget = null;
  }

  /* =========================================================================
   * Render a user (all their slides, update header, progress segments)
   * ====================================================================== */
  function renderUser( userIdx ) {
    if ( ! activeWidget ) return;
    const stories = activeWidget.stories;
    if ( userIdx < 0 || userIdx >= stories.length ) return;

    const user = stories[ userIdx ];

    // Mark circle as seen
    const circleEl = activeWidget.el.querySelector( '[data-story-index="' + userIdx + '"]' );
    if ( circleEl ) circleEl.classList.add( 'wps-seen' );

    // Update header
    header.querySelector( 'img' ).src = user.avatar || '';
    header.querySelector( 'img' ).alt = user.username || '';
    header.querySelector( '.wps-story-header-name' ).textContent = user.username || '';

    // Remove old images
    viewport.querySelectorAll( '.wps-story-image' ).forEach( function(el) { el.remove(); } );

    // Build progress segments
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

    // Build slide images (all preloaded, opacity toggled)
    ( user.slides || [] ).forEach( function( slide, i ) {
      const div = document.createElement( 'div' );
      div.className = 'wps-story-image';
      div.dataset.index = i;
      const img = document.createElement( 'img' );
      img.src = slide.src || '';
      img.alt = slide.alt || '';
      img.style.objectFit = slide.fit || 'contain';
      div.appendChild( img );
      viewport.appendChild( div );
    } );

    // Update nav visibility
    navPrev.style.visibility = userIdx > 0 ? 'visible' : 'hidden';
    navNext.style.visibility = userIdx < stories.length - 1 ? 'visible' : 'hidden';

    showSlide( currentSlideIdx );
  }

  /* =========================================================================
   * Slide control
   * ====================================================================== */
  function showSlide( slideIdx ) {
    if ( ! activeWidget ) return;
    const user = activeWidget.stories[ currentUserIdx ];
    if ( ! user || ! user.slides ) return;

    currentSlideIdx = slideIdx;

    // Activate the right image
    viewport.querySelectorAll( '.wps-story-image' ).forEach( function( el ) {
      el.classList.toggle( 'wps-active', parseInt( el.dataset.index, 10 ) === slideIdx );
    } );

    // Update progress fills
    progressBar.querySelectorAll( '.wps-progress-fill' ).forEach( function( fill ) {
      const i = parseInt( fill.dataset.index, 10 );
      fill.classList.remove( 'wps-done' );
      fill.style.width     = '';
      fill.style.transition = '';
      if ( i < slideIdx ) {
        fill.classList.add( 'wps-done' );
      }
      if ( i > slideIdx ) {
        fill.style.width = '0%';
      }
    } );

    const duration = ( user.slides[ slideIdx ] && user.slides[ slideIdx ].duration
      ? user.slides[ slideIdx ].duration
      : 5 ) * 1000;

    startTimer( duration );
  }

  function nextSlide() {
    if ( ! activeWidget ) return;
    const user = activeWidget.stories[ currentUserIdx ];
    if ( ! user ) return;
    stopTimer();

    const fill = progressBar.querySelector( '[data-index="' + currentSlideIdx + '"]' );
    if ( fill ) fill.classList.add( 'wps-done' );

    if ( currentSlideIdx < ( user.slides || [] ).length - 1 ) {
      showSlide( currentSlideIdx + 1 );
    } else {
      // Last slide of this user → next user
      changeUser( currentUserIdx + 1, 'left' );
    }
  }

  function prevSlide() {
    if ( ! activeWidget ) return;
    stopTimer();

    if ( currentSlideIdx > 0 ) {
      showSlide( currentSlideIdx - 1 );
    } else {
      // First slide of this user → previous user
      changeUser( currentUserIdx - 1, 'right' );
    }
  }

  /* =========================================================================
   * User navigation (with slide animation)
   * ====================================================================== */
  function changeUser( newIdx, direction ) {
    if ( ! activeWidget ) return;
    const stories = activeWidget.stories;

    if ( newIdx < 0 ) {
      closeViewer();
      return;
    }
    if ( newIdx >= stories.length ) {
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
    }, 260 );
  }

  /* =========================================================================
   * Timer (requestAnimationFrame-based for smooth progress bar)
   * ====================================================================== */
  function startTimer( duration ) {
    stopTimer();
    timerDuration = duration;
    paused        = false;

    const fill = progressBar.querySelector( '[data-index="' + currentSlideIdx + '"]' );
    if ( ! fill ) return;

    timerStart = performance.now();

    function tick( now ) {
      if ( paused ) {
        timer = requestAnimationFrame( tick );
        return;
      }
      const elapsed = now - timerStart;
      const pct     = Math.min( elapsed / timerDuration * 100, 100 );
      fill.style.width = pct + '%';

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
    if ( timer ) {
      cancelAnimationFrame( timer );
      timer = null;
    }
  }

  function pauseTimer() {
    paused = true;
  }

  function resumeTimer() {
    if ( paused ) {
      // Shift timerStart so elapsed time doesn't count paused duration
      timerStart = performance.now() - ( timerStart
        ? ( performance.now() - timerStart )
        : 0 );
      paused = false;
    }
  }

  // Separate handlers so we don't accidentally pause on swipe gestures
  function pauseOnTouchStart() {
    // Defer a tiny bit so swipe detection wins
    setTimeout( function() {
      if ( ! isDragging ) pauseTimer();
    }, 60 );
  }

  function resumeOnTouchEnd() {
    if ( ! isDragging ) resumeTimer();
  }

  /* =========================================================================
   * Touch / Swipe
   * ====================================================================== */
  function onTouchStart( e ) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging  = false;
    dragDeltaY  = 0;
  }

  function onTouchMove( e ) {
    if ( ! e.touches.length ) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    // Determine swipe axis on first significant movement
    if ( ! isDragging && ( Math.abs(dx) > 8 || Math.abs(dy) > 8 ) ) {
      isDragging = true;
    }

    if ( isDragging ) {
      const absDx = Math.abs( dx );
      const absDy = Math.abs( dy );

      // Primarily vertical → swipe down to close
      if ( absDy > absDx ) {
        dragDeltaY = dy;
        if ( dy > 0 ) {
          e.preventDefault(); // prevent page scroll while dragging down
          viewport.classList.add( 'wps-dragging' );
          const scale   = Math.max( 0.88, 1 - dy / 600 );
          const opacity = Math.max( 0.2, 1 - dy / 280 );
          viewport.style.transform = 'scale(' + scale + ') translateY(' + ( dy * 0.35 ) + 'px)';
          overlay.style.opacity    = opacity;
        }
      } else {
        // Horizontal dominant – let tapPrev/tapNext handle at touchend
        dragDeltaY = 0;
        viewport.style.transform = '';
        overlay.style.opacity    = '';
      }
    }
  }

  function onTouchEnd( e ) {
    if ( isDragging ) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs( dx );
      const absDy = Math.abs( dy );

      viewport.classList.remove( 'wps-dragging' );
      viewport.style.transform = '';
      overlay.style.opacity    = '';

      if ( absDy > absDx && dy > 80 ) {
        // Swipe down → close (iOS style)
        closeViewer();
      } else if ( absDx > absDy && absDx > 50 ) {
        // Horizontal swipe → change user
        if ( dx < 0 ) {
          changeUser( currentUserIdx + 1, 'left' );
        } else {
          changeUser( currentUserIdx - 1, 'right' );
        }
      } else {
        // Treated as a tap → let tap zones handle it (they already fired)
        resumeTimer();
      }
    } else {
      resumeTimer();
    }

    isDragging = false;
    dragDeltaY = 0;
  }

  /* =========================================================================
   * Keyboard
   * ====================================================================== */
  function onKeyDown( e ) {
    if ( ! overlay || ! overlay.classList.contains( 'wps-visible' ) ) return;
    switch ( e.key ) {
      case 'ArrowRight': nextSlide(); break;
      case 'ArrowLeft':  prevSlide(); break;
      case 'Escape':     closeViewer(); break;
    }
  }

  /* =========================================================================
   * Android back button (popstate)
   * ====================================================================== */
  function onPopState( e ) {
    if ( overlay && overlay.classList.contains( 'wps-visible' ) ) {
      // Don't call history.back() inside closeViewer when triggered by popstate
      overlay.classList.remove( 'wps-visible' );
      document.body.classList.remove( 'wps-open' );
      stopTimer();
      activeWidget = null;
    }
  }

  /* =========================================================================
   * Init – scan the page for all wps-stories-widget instances
   * ====================================================================== */
  function initWidgets() {
    document.querySelectorAll( '.wps-stories-widget' ).forEach( function( el ) {
      let stories;
      try {
        stories = JSON.parse( el.dataset.stories || '[]' );
      } catch(e) {
        stories = [];
      }

      if ( ! stories.length ) return;

      const widgetData = { el: el, stories: stories };

      el.querySelectorAll( '.wps-story-circle' ).forEach( function( btn ) {
        btn.addEventListener( 'click', function() {
          const idx = parseInt( btn.dataset.storyIndex, 10 );
          currentSlideIdx = 0;
          openViewer( widgetData, idx );
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

  // Elementor editor live-reload support
  if ( window.elementorFrontend ) {
    window.elementorFrontend.hooks.addAction(
      'frontend/element_ready/wp-stories.default',
      function( $scope ) {
        initWidgets();
      }
    );
  }

} )();
