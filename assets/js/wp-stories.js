/**
 * WP Stories – Frontend Logic
 * Version: 0.0.1b
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

  /* =========================================================================
   * DOM References (built once)
   * ====================================================================== */
  let overlay, viewerInner, viewport, progressBar, header, closeBtn,
      navPrev, navNext, tapPrev, tapNext, sidePrevEl, sideNextEl;

  /* =========================================================================
   * Build overlay DOM (once)
   * ====================================================================== */
  function buildOverlay() {
    if ( document.getElementById( 'wps-viewer-overlay' ) ) return;

    // Root overlay
    overlay = document.createElement( 'div' );
    overlay.className = 'wps-viewer-overlay';
    overlay.id        = 'wps-viewer-overlay';
    overlay.setAttribute( 'role', 'dialog' );
    overlay.setAttribute( 'aria-modal', 'true' );
    overlay.setAttribute( 'aria-label', 'Stories viewer' );

    // Inner flex row
    viewerInner = document.createElement( 'div' );
    viewerInner.className = 'wps-viewer-inner';

    // ---- Side preview – PREV ----
    sidePrevEl = document.createElement( 'div' );
    sidePrevEl.className = 'wps-side-preview wps-side-prev';
    sidePrevEl.innerHTML =
      '<img src="" alt="">'
      + '<div class="wps-side-preview-info">'
      +   '<div class="wps-side-preview-avatar"><img src="" alt=""></div>'
      +   '<span class="wps-side-preview-name"></span>'
      + '</div>';

    // ---- Nav prev ----
    navPrev = document.createElement( 'button' );
    navPrev.className = 'wps-nav-btn wps-nav-prev';
    navPrev.setAttribute( 'aria-label', 'Previous story' );
    navPrev.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

    // ---- Main viewport ----
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

    // ---- Nav next ----
    navNext = document.createElement( 'button' );
    navNext.className = 'wps-nav-btn wps-nav-next';
    navNext.setAttribute( 'aria-label', 'Next story' );
    navNext.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

    // ---- Side preview – NEXT ----
    sideNextEl = document.createElement( 'div' );
    sideNextEl.className = 'wps-side-preview wps-side-next';
    sideNextEl.innerHTML =
      '<img src="" alt="">'
      + '<div class="wps-side-preview-info">'
      +   '<div class="wps-side-preview-avatar"><img src="" alt=""></div>'
      +   '<span class="wps-side-preview-name"></span>'
      + '</div>';

    // Assemble: [sidePrev] [navPrev] [viewport] [navNext] [sideNext]
    viewerInner.appendChild( sidePrevEl );
    viewerInner.appendChild( navPrev );
    viewerInner.appendChild( viewport );
    viewerInner.appendChild( navNext );
    viewerInner.appendChild( sideNextEl );
    overlay.appendChild( viewerInner );
    document.body.appendChild( overlay );

    // ---- Events ----
    closeBtn.addEventListener( 'click', closeViewer );

    navPrev.addEventListener( 'click', function() { changeUser( currentUserIdx - 1, 'right' ); } );
    navNext.addEventListener( 'click', function() { changeUser( currentUserIdx + 1, 'left' ); } );

    sidePrevEl.addEventListener( 'click', function() { changeUser( currentUserIdx - 1, 'right' ); } );
    sideNextEl.addEventListener( 'click', function() { changeUser( currentUserIdx + 1, 'left' ); } );

    tapPrev.addEventListener( 'click', prevSlide );
    tapNext.addEventListener( 'click', nextSlide );

    // Touch events on the viewport
    viewport.addEventListener( 'touchstart', onTouchStart, { passive: true } );
    viewport.addEventListener( 'touchmove',  onTouchMove,  { passive: false } );
    viewport.addEventListener( 'touchend',   onTouchEnd,   { passive: true } );

    // Hold-to-pause (desktop mouse)
    viewport.addEventListener( 'mousedown', pauseTimer );
    viewport.addEventListener( 'mouseup',   resumeTimer );

    // Keyboard
    document.addEventListener( 'keydown', onKeyDown );

    // Android back button
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

    document.body.classList.add( 'wps-open' );
    overlay.classList.add( 'wps-visible' );

    history.pushState( { wpsOpen: true }, '' );

    renderUser( currentUserIdx );
  }

  function closeViewer() {
    stopTimer();
    overlay.classList.remove( 'wps-visible' );
    document.body.classList.remove( 'wps-open' );

    if ( history.state && history.state.wpsOpen ) {
      history.back();
    }

    setTimeout( function() {
      viewport.querySelectorAll( '.wps-story-image' ).forEach( function( el ) { el.remove(); } );
      progressBar.innerHTML = '';
    }, 300 );

    activeWidget = null;
  }

  /* =========================================================================
   * Render a user's slides
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

    // Clear old images
    viewport.querySelectorAll( '.wps-story-image' ).forEach( function( el ) { el.remove(); } );

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

    // Build slide images
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

    // Update side previews and nav arrows
    updateSidePreviews( userIdx );

    showSlide( currentSlideIdx );
  }

  /* =========================================================================
   * Side previews
   * ====================================================================== */
  function updateSidePreviews( userIdx ) {
    const stories = activeWidget.stories;

    // Previous user preview
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

    // Next user preview
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
    const stories = activeWidget.stories;

    if ( newIdx < 0 || newIdx >= stories.length ) {
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
   * Timer (rAF-based for smooth progress bar)
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
      if ( paused ) {
        timer = requestAnimationFrame( tick );
        return;
      }
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

    if ( ! isDragging && ( Math.abs(dx) > 8 || Math.abs(dy) > 8 ) ) {
      isDragging = true;
    }

    if ( isDragging && Math.abs(dy) > Math.abs(dx) && dy > 0 ) {
      e.preventDefault();
      viewport.classList.add( 'wps-dragging' );
      const scale   = Math.max( 0.88, 1 - dy / 600 );
      const opacity = Math.max( 0.2, 1 - dy / 280 );
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
      if ( absDy > absDx && dy > 80 ) {
        closeViewer();
        return;
      } else if ( absDx > absDy && absDx > 50 ) {
        if ( dx < 0 ) changeUser( currentUserIdx + 1, 'left' );
        else          changeUser( currentUserIdx - 1, 'right' );
        return;
      }
    }

    // Short tap → handled by tapPrev/tapNext click events
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
   * Android back button
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
      // Avoid double-binding
      if ( el.dataset.wpsInit ) return;
      el.dataset.wpsInit = '1';

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

} )();
