// ── Workshop Native Video Gallery & Custom Player ───────────────────────────
let workshopVideos = [];
let workshopCurrentIndex = 0;
let ytWorkshopPlayer = null;
let ytWorkshopIsReady = false;
let workshopProgressTimer = null;
let workshopControlsTimer = null;
let workshopKeyboardHandler = null;

function loadWorkshopGallery() {
    const grid = document.getElementById('workshop-grid') || document.getElementById('work-showcase-grid');
    if (!grid) return;

    fetch('assets/youtube-videos.json?v=' + Date.now())
        .then(function(r) {
            if (!r.ok) throw new Error('Network response not ok');
            return r.json();
        })
        .then(function(data) {
            const raw = data.videos || [];
            // De-duplicate and preserve newest-first order
            const seen = new Set();
            workshopVideos = [];
            for (let i = 0; i < raw.length; i++) {
                if (raw[i].id && !seen.has(raw[i].id)) {
                    seen.add(raw[i].id);
                    workshopVideos.push(raw[i]);
                }
            }

            if (workshopVideos.length === 0) {
                grid.innerHTML =
                    '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:3rem 0;">' +
                    '<i class="fas fa-video-slash" style="font-size:2.5rem;color:var(--primary-cyan);display:block;margin-bottom:1rem;"></i>' +
                    'No videos currently available.' +
                    '</p>';
                return;
            }

            renderWorkshopGallery();
        })
        .catch(function(err) {
            console.log('Workshop: Notice - using fallback manifest', err);
            // Fallback: try loading media-manifest if youtube-videos is not present yet
            if (typeof loadWorkShowcaseFallback === 'function') {
                loadWorkShowcaseFallback();
            }
        });
}

function renderWorkshopGallery() {
    const grid = document.getElementById('workshop-grid') || document.getElementById('work-showcase-grid');
    if (!grid) return;

    grid.innerHTML = '';

    for (let i = 0; i < workshopVideos.length; i++) {
        const item = workshopVideos[i];
        if (!item || !item.id) continue;

        const card = document.createElement('div');
        card.className = 'workshop-card reveal active';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'Play video ' + (i + 1) + (item.title ? ': ' + item.title : ''));
        card.dataset.index = i;
        card.dataset.id = item.id;

        // Clean high-res thumbnail with crisp fallback
        const img = document.createElement('img');
        img.src = item.thumbnail || ('https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg');
        img.alt = item.title || 'Video thumbnail';
        img.loading = 'lazy';
        img.onerror = function() {
            if (this.src.indexOf('hqdefault.jpg') === -1) {
                this.src = 'https://i.ytimg.com/vi/' + item.id + '/hqdefault.jpg';
            }
        };
        card.appendChild(img);

        // Center glowing Play Overlay
        const overlay = document.createElement('div');
        overlay.className = 'play-overlay';
        overlay.innerHTML = '<div class="play-btn"><i class="fas fa-play" style="margin-left: 3px;"></i></div>';
        card.appendChild(overlay);

        // Click & keyboard handlers
        const curIdx = i;
        card.onclick = function() {
            openWorkshopModal(item.id, curIdx);
        };
        card.onkeydown = function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWorkshopModal(item.id, curIdx);
            }
        };

        grid.appendChild(card);
    }

    if (typeof initReveal === 'function') initReveal();
    if (window.location.hash) {
        setTimeout(function () {
            if (typeof handleDirectHashNavigation === 'function') {
                handleDirectHashNavigation(false);
            }
        }, 120);
    }
}

function renderWorkshopBatch() {
    renderWorkshopGallery();
}

// ── YouTube IFrame API & Player Lifecycle ───────────────────────────────────
function onYouTubeIframeAPIReady() {
    ytWorkshopIsReady = true;
}

function openWorkshopModal(videoId, index) {
    workshopCurrentIndex = typeof index === 'number' ? index : 0;
    const modal = document.getElementById('workshop-modal');
    if (!modal) return;

    // Pause background portfolio audio or other playing videos
    if (modalBgAudio) {
        modalBgAudio.pause();
    }

    modal.style.display = 'flex';
    setTimeout(function() {
        modal.style.opacity = '1';
        const wrapper = document.getElementById('workshop-player-wrapper');
        if (wrapper) wrapper.style.transform = 'translateY(0)';
    }, 10);

    initOrPlayWorkshopVideo(videoId);
    initWorkshopControlsEvents();
}

function initOrPlayWorkshopVideo(videoId) {
    const container = document.getElementById('workshop-yt-iframe-container');
    if (!container) return;

    resetWorkshopUIState();

    if (ytWorkshopPlayer && typeof ytWorkshopPlayer.loadVideoById === 'function') {
        ytWorkshopPlayer.loadVideoById({
            videoId: videoId,
            startSeconds: 0
        });
        // Respect no autoplay with sound: keep muted initially
        ytWorkshopPlayer.mute();
        updateMuteButtonUI(true);
    } else {
        container.innerHTML = '<div id="workshop-yt-iframe"></div>';
        if (window.YT && window.YT.Player) {
            ytWorkshopPlayer = new YT.Player('workshop-yt-iframe', {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    fs: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                    enablejsapi: 1,
                    disablekb: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: function(e) {
                        ytWorkshopIsReady = true;
                        e.target.mute();
                        e.target.playVideo();
                        updateMuteButtonUI(true);
                    },
                    onStateChange: onWorkshopPlayerStateChange,
                    onError: onWorkshopPlayerError
                }
            });
        }
    }

    startWorkshopProgressTracker();
}

function closeWorkshopModal() {
    const modal = document.getElementById('workshop-modal');
    if (!modal) return;

    modal.style.opacity = '0';
    const wrapper = document.getElementById('workshop-player-wrapper');
    if (wrapper) wrapper.style.transform = 'translateY(20px)';

    if (ytWorkshopPlayer && typeof ytWorkshopPlayer.pauseVideo === 'function') {
        try { ytWorkshopPlayer.pauseVideo(); } catch(e) {}
    }

    stopWorkshopProgressTracker();
    removeWorkshopKeyboardHandler();

    const speedMenu = document.getElementById('ws-speed-menu');
    if (speedMenu) speedMenu.classList.remove('show');

    setTimeout(function() {
        modal.style.display = 'none';
    }, 300);
}

function onWorkshopPlayerStateChange(event) {
    const playBtn = document.getElementById('ws-play-pause-btn');
    if (!playBtn) return;

    if (event.data === YT.PlayerState.PLAYING) {
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        resetControlsInactivity();
    } else if (event.data === YT.PlayerState.PAUSED) {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        showWorkshopControls();
    } else if (event.data === YT.PlayerState.ENDED) {
        playBtn.innerHTML = '<i class="fas fa-rotate-right"></i>';
        showWorkshopControls();
    }
}

function onWorkshopPlayerError(event) {
    console.log('Workshop player notice (video unavailable or restricted):', event.data);
    const container = document.getElementById('workshop-yt-iframe-container');
    if (container) {
        container.innerHTML =
            '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050505;color:var(--text-secondary);padding:2rem;text-align:center;">' +
            '<i class="fas fa-circle-exclamation" style="font-size:2.5rem;color:var(--primary-cyan);margin-bottom:1rem;"></i>' +
            '<p style="font-size:0.95rem;margin-bottom:1.5rem;color:#fff;">This video is currently unavailable.</p>' +
            '<button class="workshop-load-more-btn" onclick="nextWorkshopVideo()" style="padding:0.6rem 1.4rem;font-size:0.85rem;"><i class="fas fa-forward-step"></i> Next Video</button>' +
            '</div>';
    }
}

// ── Custom Video Controls Logic ─────────────────────────────────────────────
function toggleWorkshopPlay() {
    if (!ytWorkshopPlayer || typeof ytWorkshopPlayer.getPlayerState !== 'function') return;
    const state = ytWorkshopPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        ytWorkshopPlayer.pauseVideo();
    } else {
        ytWorkshopPlayer.playVideo();
    }
}

function prevWorkshopVideo() {
    if (workshopVideos.length === 0) return;
    workshopCurrentIndex = (workshopCurrentIndex - 1 + workshopVideos.length) % workshopVideos.length;
    const nextItem = workshopVideos[workshopCurrentIndex];
    if (nextItem) initOrPlayWorkshopVideo(nextItem.id);
}

function nextWorkshopVideo() {
    if (workshopVideos.length === 0) return;
    workshopCurrentIndex = (workshopCurrentIndex + 1) % workshopVideos.length;
    const nextItem = workshopVideos[workshopCurrentIndex];
    if (nextItem) initOrPlayWorkshopVideo(nextItem.id);
}

function toggleWorkshopMute() {
    if (!ytWorkshopPlayer || typeof ytWorkshopPlayer.isMuted !== 'function') return;
    const isMuted = ytWorkshopPlayer.isMuted();
    if (isMuted) {
        ytWorkshopPlayer.unMute();
        updateMuteButtonUI(false);
        const slider = document.getElementById('ws-volume-slider');
        if (slider && parseInt(slider.value, 10) === 0) {
            slider.value = 100;
            ytWorkshopPlayer.setVolume(100);
        }
    } else {
        ytWorkshopPlayer.mute();
        updateMuteButtonUI(true);
    }
}

function setWorkshopVolume(val) {
    if (!ytWorkshopPlayer || typeof ytWorkshopPlayer.setVolume !== 'function') return;
    const vol = parseInt(val, 10);
    ytWorkshopPlayer.setVolume(vol);
    if (vol === 0) {
        ytWorkshopPlayer.mute();
        updateMuteButtonUI(true);
    } else {
        if (ytWorkshopPlayer.isMuted()) ytWorkshopPlayer.unMute();
        updateMuteButtonUI(false);
    }
}

function updateMuteButtonUI(isMuted) {
    const btn = document.getElementById('ws-mute-btn');
    if (!btn) return;
    if (isMuted) {
        btn.innerHTML = '<i class="fas fa-volume-xmark"></i>';
    } else {
        btn.innerHTML = '<i class="fas fa-volume-high"></i>';
    }
}

function toggleSpeedMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('ws-speed-menu');
    if (menu) menu.classList.toggle('show');
}

function setWorkshopSpeed(rate) {
    if (ytWorkshopPlayer && typeof ytWorkshopPlayer.setPlaybackRate === 'function') {
        ytWorkshopPlayer.setPlaybackRate(rate);
    }
    const btn = document.getElementById('ws-speed-btn');
    if (btn) btn.textContent = rate + 'x';

    const opts = document.querySelectorAll('.ws-speed-opt');
    opts.forEach(function(opt) {
        if (opt.textContent.trim() === rate + 'x') {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });

    const menu = document.getElementById('ws-speed-menu');
    if (menu) menu.classList.remove('show');
}

function toggleWorkshopFullscreen() {
    const wrapper = document.getElementById('workshop-player-wrapper');
    const btn = document.getElementById('ws-fullscreen-btn');
    if (!wrapper) return;

    if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) {
            wrapper.requestFullscreen();
        } else if (wrapper.webkitRequestFullscreen) {
            wrapper.webkitRequestFullscreen();
        }
        if (btn) btn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        if (btn) btn.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

document.addEventListener('fullscreenchange', function() {
    const btn = document.getElementById('ws-fullscreen-btn');
    if (!btn) return;
    if (document.fullscreenElement) {
        btn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        btn.innerHTML = '<i class="fas fa-expand"></i>';
    }
});

function toggleWorkshopPip() {
    if ('documentPictureInPicture' in window) {
        window.documentPictureInPicture.requestWindow({ width: 360, height: 640 })
            .then(function(pipWin) {
                const wrapper = document.getElementById('workshop-player-wrapper');
                if (wrapper) pipWin.document.body.appendChild(wrapper);
                pipWin.addEventListener('unload', function() {
                    const modal = document.getElementById('workshop-modal');
                    if (modal && wrapper) modal.appendChild(wrapper);
                });
            })
            .catch(function(e) {
                console.log('PiP error:', e);
            });
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return m + ':' + (remS < 10 ? '0' : '') + remS;
}

function startWorkshopProgressTracker() {
    stopWorkshopProgressTracker();
    const scrubberInput = document.getElementById('ws-scrubber-input');
    const progressBar = document.getElementById('ws-progress-bar');
    const timeDisplay = document.getElementById('ws-time-display');

    if (scrubberInput) {
        scrubberInput.oninput = function() {
            if (!ytWorkshopPlayer || typeof ytWorkshopPlayer.getDuration !== 'function') return;
            const duration = ytWorkshopPlayer.getDuration() || 0;
            const targetTime = (parseFloat(this.value) / 100) * duration;
            ytWorkshopPlayer.seekTo(targetTime, true);
        };
    }

    workshopProgressTimer = setInterval(function() {
        if (!ytWorkshopPlayer || typeof ytWorkshopPlayer.getCurrentTime !== 'function') return;
        const cur = ytWorkshopPlayer.getCurrentTime() || 0;
        const dur = ytWorkshopPlayer.getDuration() || 0;

        if (dur > 0) {
            const pct = (cur / dur) * 100;
            if (progressBar) progressBar.style.width = pct + '%';
            if (scrubberInput && !scrubberInput.matches(':active')) scrubberInput.value = pct;
            if (timeDisplay) timeDisplay.textContent = formatTime(cur) + ' / ' + formatTime(dur);
        }
    }, 250);
}

function stopWorkshopProgressTracker() {
    if (workshopProgressTimer) {
        clearInterval(workshopProgressTimer);
        workshopProgressTimer = null;
    }
}

function resetWorkshopUIState() {
    const playBtn = document.getElementById('ws-play-pause-btn');
    if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i>';
    const progressBar = document.getElementById('ws-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const scrubberInput = document.getElementById('ws-scrubber-input');
    if (scrubberInput) scrubberInput.value = 0;
    const timeDisplay = document.getElementById('ws-time-display');
    if (timeDisplay) timeDisplay.textContent = '0:00 / 0:00';
    const speedBtn = document.getElementById('ws-speed-btn');
    if (speedBtn) speedBtn.textContent = '1x';
    const speedOpts = document.querySelectorAll('.ws-speed-opt');
    speedOpts.forEach(function(opt) {
        opt.classList.toggle('active', opt.textContent.trim() === '1x');
    });

    // PiP feature detection
    const pipBtn = document.getElementById('ws-pip-btn');
    if (pipBtn) {
        pipBtn.style.display = ('documentPictureInPicture' in window) ? 'flex' : 'none';
    }
}

function initWorkshopControlsEvents() {
    removeWorkshopKeyboardHandler();

    workshopKeyboardHandler = function(e) {
        const modal = document.getElementById('workshop-modal');
        if (!modal || modal.style.display !== 'flex') return;

        if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            toggleWorkshopPlay();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (ytWorkshopPlayer && typeof ytWorkshopPlayer.getCurrentTime === 'function') {
                const cur = ytWorkshopPlayer.getCurrentTime();
                ytWorkshopPlayer.seekTo(Math.max(0, cur - 5), true);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (ytWorkshopPlayer && typeof ytWorkshopPlayer.getCurrentTime === 'function') {
                const cur = ytWorkshopPlayer.getCurrentTime();
                ytWorkshopPlayer.seekTo(cur + 5, true);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (ytWorkshopPlayer && typeof ytWorkshopPlayer.getVolume === 'function') {
                const vol = Math.min(100, ytWorkshopPlayer.getVolume() + 10);
                setWorkshopVolume(vol);
                const slider = document.getElementById('ws-volume-slider');
                if (slider) slider.value = vol;
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (ytWorkshopPlayer && typeof ytWorkshopPlayer.getVolume === 'function') {
                const vol = Math.max(0, ytWorkshopPlayer.getVolume() - 10);
                setWorkshopVolume(vol);
                const slider = document.getElementById('ws-volume-slider');
                if (slider) slider.value = vol;
            }
        } else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            toggleWorkshopMute();
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleWorkshopFullscreen();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeWorkshopModal();
        }
    };

    document.addEventListener('keydown', workshopKeyboardHandler);

    // Auto-hide controls when mouse is idle inside player
    const wrapper = document.getElementById('workshop-player-wrapper');
    if (wrapper) {
        wrapper.onmousemove = resetControlsInactivity;
        wrapper.ontouchstart = resetControlsInactivity;
    }

    // Close speed menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ws-speed-wrapper')) {
            const menu = document.getElementById('ws-speed-menu');
            if (menu) menu.classList.remove('show');
        }
    });
}

function removeWorkshopKeyboardHandler() {
    if (workshopKeyboardHandler) {
        document.removeEventListener('keydown', workshopKeyboardHandler);
        workshopKeyboardHandler = null;
    }
}

function resetControlsInactivity() {
    showWorkshopControls();
    if (workshopControlsTimer) clearTimeout(workshopControlsTimer);
    workshopControlsTimer = setTimeout(function() {
        if (ytWorkshopPlayer && typeof ytWorkshopPlayer.getPlayerState === 'function') {
            if (ytWorkshopPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                hideWorkshopControls();
            }
        }
    }, 2800);
}

function showWorkshopControls() {
    const controls = document.getElementById('workshop-controls');
    if (controls) controls.classList.remove('controls-hidden');
}

function hideWorkshopControls() {
    const controls = document.getElementById('workshop-controls');
    const menu = document.getElementById('ws-speed-menu');
    if (menu && menu.classList.contains('show')) return; // keep visible if speed menu is open
    if (controls) controls.classList.add('controls-hidden');
}

// Fallback loader if ever needed
function loadWorkShowcase() {
    loadWorkshopGallery();
}

// Global variables
let modalBgAudio = null;
let galleryInterval = null;

// Function to initialize or get the audio instance
function getAudioInstance() {
    if (!modalBgAudio) {
        modalBgAudio = new Audio('assets/audio/tech-bg.mp3');
        modalBgAudio.loop = true;
        modalBgAudio.volume = 0.4;
    }
    return modalBgAudio;
}

// Global Functions for Modals
function openModal(title, mediaSrc, desc, tags, displayType = 'youtube-link') {
    const modal = document.getElementById('project-modal');
    const modalVideoContainer = document.getElementById('modal-video-container');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    const modalYoutubeLink = document.getElementById('modal-youtube-link');
    
    if (!modal) return;

    // Get Audio instance
    const audio = getAudioInstance();
    audio.muted = false;

    let finalDesc = desc || 'Project details coming soon...';
    if (typeof desc === 'string' && desc.endsWith('-desc')) {
        const descEl = document.getElementById(desc);
        if (descEl) finalDesc = descEl.innerHTML;
    }
    
    if (modalVideoContainer) modalVideoContainer.innerHTML = '';
    const firstSrc = Array.isArray(mediaSrc) ? mediaSrc[0] : mediaSrc;
    
    if (displayType === 'local-video') {
        if (modalVideoContainer) {
            modalVideoContainer.innerHTML = `<video src="${firstSrc}" controls autoplay muted loop preload="metadata" playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 20px 20px 0 0;"></video>`;
            
            const video = modalVideoContainer.querySelector('video');
            if (video) {
                // Sync music ONLY with play/pause
                video.onplay = () => { audio.play().catch(e => console.log('Audio play failed')); };
                video.onpause = () => { audio.pause(); };
                
                // Allow sound controls; pause background audio if video is unmuted
                video.onvolumechange = () => {
                    if (!video.muted && video.volume > 0) {
                        audio.pause();
                    }
                };

                // Initial playback for local video
                audio.play().catch(e => {
                    document.addEventListener('click', () => audio.play(), { once: true });
                });
            }
        }
        if (modalYoutubeLink) modalYoutubeLink.style.display = 'none';
        
    } else if (displayType === 'image-gallery') {
        if (Array.isArray(mediaSrc) && mediaSrc.length > 0) {
            let galleryHTML = '<div class="gallery-slider" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; border-radius: 20px 20px 0 0; overflow: hidden;">';
            mediaSrc.forEach((src, idx) => {
                galleryHTML += `<img src="${src}" class="gallery-slide" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; opacity: ${idx === 0 ? 1 : 0}; transition: opacity 0.8s ease;" data-index="${idx}">`;
            });
            if (mediaSrc.length > 1) {
                galleryHTML += `
                    <button class="gallery-prev" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); background: rgba(5, 5, 5, 0.7); border: 1px solid var(--primary-cyan); color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: all 0.3s ease;"><i class="fas fa-chevron-left"></i></button>
                    <button class="gallery-next" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); background: rgba(5, 5, 5, 0.7); border: 1px solid var(--primary-cyan); color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; z-index: 10; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: all 0.3s ease;"><i class="fas fa-chevron-right"></i></button>
                    <div class="gallery-dots" style="position: absolute; bottom: 15px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10;">
                        ${mediaSrc.map((_, i) => `<div class="gallery-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${i === 0 ? 'var(--primary-cyan)' : 'rgba(255,255,255,0.3)'}; transition: all 0.3s ease;"></div>`).join('')}
                    </div>
                `;
            }
            galleryHTML += '</div>';
            if (modalVideoContainer) modalVideoContainer.innerHTML = galleryHTML;
            
            if (mediaSrc.length > 1 && modalVideoContainer) {
                let currentSlideIdx = 0;
                const totalSlides = mediaSrc.length;
                const slides = modalVideoContainer.querySelectorAll('.gallery-slide');
                const dots = modalVideoContainer.querySelectorAll('.gallery-dot');
                const updateGallery = () => {
                    slides.forEach((s, i) => { s.style.opacity = i === currentSlideIdx ? '1' : '0'; });
                    dots.forEach((d, i) => { d.style.background = i === currentSlideIdx ? 'var(--primary-cyan)' : 'rgba(255,255,255,0.3)'; });
                };
                const nextSlide = () => { currentSlideIdx = (currentSlideIdx + 1) % totalSlides; updateGallery(); };
                const stopAutoScroll = () => { if (galleryInterval) { clearInterval(galleryInterval); galleryInterval = null; } };
                galleryInterval = setInterval(nextSlide, 4000);
                modalVideoContainer.querySelector('.gallery-prev').onclick = () => { stopAutoScroll(); currentSlideIdx = (currentSlideIdx - 1 + totalSlides) % totalSlides; updateGallery(); };
                modalVideoContainer.querySelector('.gallery-next').onclick = () => { stopAutoScroll(); nextSlide(); };
            }
        } else if (modalVideoContainer) {
            modalVideoContainer.innerHTML = `<img src="${firstSrc}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 20px 20px 0 0;">`;
        }
        // MUSIC REMOVED FOR PHOTOS AS REQUESTED
        audio.pause();
        
    } else {
        const videoId = extractYouTubeId(firstSrc);
        if (videoId && modalVideoContainer) {
            const thumbImg = document.createElement('img');
            thumbImg.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            thumbImg.style.position = 'absolute';
            thumbImg.style.top = '0'; thumbImg.style.left = '0'; thumbImg.style.width = '100%'; thumbImg.style.height = '100%'; thumbImg.style.objectFit = 'cover';
            modalVideoContainer.appendChild(thumbImg);
            
            if (displayType === 'youtube-embed') {
                const playOverlay = document.createElement('div');
                playOverlay.className = 'play-overlay';
                playOverlay.style.opacity = '1';
                playOverlay.innerHTML = '<div class="play-btn"><i class="fas fa-play" style="margin-left: 4px;"></i></div>';
                playOverlay.onclick = function() {
                    modalVideoContainer.innerHTML = `<iframe id="ytplayer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 20px 20px 0 0;" src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    audio.pause();
                };
                modalVideoContainer.appendChild(playOverlay);
            }
        }
        // YouTube modals often use their own sound or are link-only, keeping music off for simplicity
        audio.pause();
    }
    
    if (modalTitle) modalTitle.textContent = title;
    if (modalDesc) modalDesc.innerHTML = finalDesc;
    
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        const content = modal.querySelector('.modal-content');
        if (content) content.style.transform = 'translateY(0)';
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('project-modal');
    const modalVideoContainer = document.getElementById('modal-video-container');
    if (!modal) return;
    modal.style.opacity = '0';
    const content = modal.querySelector('.modal-content');
    if (content) content.style.transform = 'translateY(20px)';
    if (modalBgAudio) { modalBgAudio.pause(); modalBgAudio.currentTime = 0; }
    if (galleryInterval) { clearInterval(galleryInterval); galleryInterval = null; }
    setTimeout(() => {
        modal.style.display = 'none';
        if (modalVideoContainer) modalVideoContainer.innerHTML = '';
    }, 300);
}

function switchModalVideo(src) {
    const container = document.getElementById('modal-video-container');
    if (!container) return;
    const audio = getAudioInstance();
    if (audio) audio.pause();
    container.innerHTML = `<video src="${src}" controls autoplay playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 20px 20px 0 0;"></video>`;
    const modal = document.getElementById('project-modal');
    if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' });
}

function extractYouTubeId(url) {
    let videoId = '';
    if (url.includes('youtube.com/shorts/')) videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
    else if (url.includes('youtube.com/watch?v=')) videoId = url.split('v=')[1].split('&')[0];
    else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
    else if (url.includes('youtube.com/embed/')) videoId = url.split('youtube.com/embed/')[1].split('?')[0];
    return videoId;
}

function openCertModal(src) {
    const certModal = document.getElementById('cert-modal');
    const certImg = document.getElementById('cert-modal-img');
    if (!certModal || !certImg) return;
    certImg.src = src;
    certModal.style.display = 'flex';
    setTimeout(() => { certModal.style.opacity = '1'; certImg.style.transform = 'scale(1)'; }, 10);
}

function closeCertModal() {
    const certModal = document.getElementById('cert-modal');
    const certImg = document.getElementById('cert-modal-img');
    if (!certModal || !certImg) return;
    certModal.style.opacity = '0';
    certImg.style.transform = 'scale(0.9)';
    setTimeout(() => { certModal.style.display = 'none'; certImg.src = ''; }, 400);
}

function initCardSlideshows() {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
        const videoContainer = card.querySelector('.video-container');
        if (!videoContainer) return;
        const onClickAttr = videoContainer.getAttribute('onclick');
        if (!onClickAttr || !onClickAttr.includes("'image-gallery'")) return;
        const arrayMatch = onClickAttr.match(/\[(.*?)\]/);
        if (arrayMatch && arrayMatch[1]) {
            const images = arrayMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
            if (images.length > 1) {
                const img = card.querySelector('.video-container img');
                if (img) {
                    let currentIdx = 0;
                    setInterval(() => {
                        currentIdx = (currentIdx + 1) % images.length;
                        img.style.opacity = '0';
                        setTimeout(() => { img.src = images[currentIdx]; img.style.opacity = '1'; }, 800);
                    }, 5000);
                }
            }
        }
    });
}

const initReveal = () => {
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('active'); revealObserver.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    revealElements.forEach(el => revealObserver.observe(el));
};

const initNavbar = () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) {
            navbar.style.padding = '0.8rem 8%'; navbar.style.background = 'rgba(5, 5, 5, 0.95)'; navbar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        } else {
            navbar.style.padding = '1.2rem 8%'; navbar.style.background = 'rgba(5, 5, 5, 0.8)'; navbar.style.boxShadow = 'none';
        }
    });
};

const getTargetFromHash = (hashStr) => {
    if (!hashStr || hashStr === '#' || hashStr === '#!') return null;
    try {
        const id = decodeURIComponent(hashStr.replace(/^#/, ''));
        return document.getElementById(id) || document.querySelector(hashStr);
    } catch (e) {
        return null;
    }
};

const getNavOffset = () => {
    const navbar = document.querySelector('.navbar');
    return navbar ? navbar.offsetHeight : 85;
};

const scrollToSection = (target, updateHash = true, smooth = true) => {
    if (!target) return;
    const navOffset = getNavOffset();
    const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = Math.max(0, Math.round(elementPosition - navOffset - 10));

    window.scrollTo({
        top: offsetPosition,
        behavior: smooth ? 'smooth' : 'auto'
    });

    if (updateHash && target.id) {
        if (window.history && window.history.pushState) {
            window.history.pushState(null, '', '#' + target.id);
        } else {
            window.location.hash = target.id;
        }
    }
};

const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#' || href === '#!') return;
            const target = getTargetFromHash(href);
            if (target) {
                e.preventDefault();
                scrollToSection(target, true, true);
            }
        });
    });
};

const handleDirectHashNavigation = (smooth = false) => {
    if (!window.location.hash) return;
    const target = getTargetFromHash(window.location.hash);
    if (!target) return;

    scrollToSection(target, false, smooth);
};

window.addEventListener('hashchange', () => handleDirectHashNavigation(true));
window.addEventListener('load', () => {
    if (window.location.hash) {
        setTimeout(() => handleDirectHashNavigation(false), 60);
        setTimeout(() => handleDirectHashNavigation(false), 300);
    }
});

const initParallax = () => {
    document.addEventListener('mousemove', (e) => {
        const elements = document.querySelectorAll('.floating-element');
        const x = (window.innerWidth - e.pageX * 2) / 100;
        const y = (window.innerHeight - e.pageY * 2) / 100;
        elements.forEach((el, index) => {
            const speed = (index + 1) * 0.4;
            el.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    });
};

const initScrollSpy = () => {
    const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!navLinks.length) return;

    window.addEventListener('scroll', () => {
        const navOffset = getNavOffset() + 30;
        let current = '';

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            const target = getTargetFromHash(href);
            if (target) {
                const targetTop = target.getBoundingClientRect().top + window.pageYOffset;
                if (window.pageYOffset >= targetTop - navOffset) {
                    current = target.id;
                }
            }
        });

        if ((window.innerHeight + window.pageYOffset) >= (document.documentElement.scrollHeight - 60)) {
            const lastLink = navLinks[navLinks.length - 1];
            if (lastLink) {
                const lastTarget = getTargetFromHash(lastLink.getAttribute('href'));
                if (lastTarget) current = lastTarget.id;
            }
        }

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (current && link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
};

const initHeroSlideshow = () => {
    const slides = document.querySelectorAll('.hero-slide');
    if (slides.length === 0) return;
    let current = 0;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, 4000);
};

document.addEventListener('DOMContentLoaded', () => {
    initReveal(); initNavbar(); initSmoothScroll(); initParallax(); initScrollSpy(); initHeroSlideshow(); handleDirectHashNavigation();
    initCardSlideshows();
    loadWorkshopGallery();
    window.openModal = openModal; window.closeModal = closeModal;
    window.openCertModal = openCertModal; window.closeCertModal = closeCertModal;
});

window.openModal = openModal; window.closeModal = closeModal;
window.openCertModal = openCertModal; window.closeCertModal = closeCertModal;

window.openWorkshopModal = openWorkshopModal;
window.closeWorkshopModal = closeWorkshopModal;
window.toggleWorkshopPlay = toggleWorkshopPlay;
window.prevWorkshopVideo = prevWorkshopVideo;
window.nextWorkshopVideo = nextWorkshopVideo;
window.toggleWorkshopMute = toggleWorkshopMute;
window.setWorkshopVolume = setWorkshopVolume;
window.toggleSpeedMenu = toggleSpeedMenu;
window.setWorkshopSpeed = setWorkshopSpeed;
window.toggleWorkshopFullscreen = toggleWorkshopFullscreen;
window.toggleWorkshopPip = toggleWorkshopPip;
window.renderWorkshopGallery = renderWorkshopGallery;
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
