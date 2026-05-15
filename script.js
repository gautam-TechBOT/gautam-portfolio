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
    if (modalYoutubeLink) modalYoutubeLink.style.display = 'inline-flex';

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
                
                // Keep video volume at 0 permanently
                video.volume = 0;
                video.onvolumechange = () => { video.volume = 0; };

                // Initial playback for local video
                audio.play().catch(e => {
                    document.addEventListener('click', () => audio.play(), { once: true });
                });
            }
        }
        if (modalYoutubeLink) modalYoutubeLink.style.display = 'none';
        
    } else if (displayType === 'image-gallery') {
        if (modalYoutubeLink) modalYoutubeLink.style.display = 'none';
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
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (!navbar) return;

    if (navToggle && navLinks) {
        navToggle.onclick = () => {
            navLinks.classList.toggle('active');
            const icon = navToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.replace('fa-bars', 'fa-times');
            } else {
                icon.classList.replace('fa-times', 'fa-bars');
            }
        };

        // Close menu when link is clicked
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.onclick = () => {
                navLinks.classList.remove('active');
                const icon = navToggle.querySelector('i');
                icon.classList.replace('fa-times', 'fa-bars');
            };
        });
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 80) {
            navbar.style.padding = '0.8rem 8%'; navbar.style.background = 'rgba(5, 5, 5, 0.95)'; navbar.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            if (window.innerWidth <= 992) navbar.style.padding = '1rem 5%';
        } else {
            navbar.style.padding = '1.2rem 8%'; navbar.style.background = 'rgba(5, 5, 5, 0.8)'; navbar.style.boxShadow = 'none';
            if (window.innerWidth <= 992) navbar.style.padding = '1rem 5%';
        }
    });
};

const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });
};

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
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-links a');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute('id') || (section.classList.contains('hero') ? 'about' : '');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (current && link.getAttribute('href') === `#${current}`) link.classList.add('active');
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

const initResumeLoading = () => {
    const resumePreview = document.querySelector('.resume-preview');
    const iframe = resumePreview ? resumePreview.querySelector('iframe') : null;
    if (iframe) {
        iframe.onload = () => {
            resumePreview.classList.add('loaded');
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initReveal(); initNavbar(); initSmoothScroll(); initParallax(); initScrollSpy(); initHeroSlideshow();
    initCardSlideshows(); initResumeLoading();
    window.openModal = openModal; window.closeModal = closeModal;
    window.openCertModal = openCertModal; window.closeCertModal = closeCertModal;
});

window.openModal = openModal; window.closeModal = closeModal;
window.openCertModal = openCertModal; window.closeCertModal = closeCertModal;
