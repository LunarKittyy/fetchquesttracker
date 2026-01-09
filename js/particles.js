/**
 * Particle System & Celebration Effects Module
 * Visual effects for quest completion celebrations
 */

import { $ } from './utils.js';
import { state } from './state.js';

// DOM Elements
let elements = {
    particlesCanvas: null,
    celebrationOverlay: null,
    soundTick: null,
    soundComplete: null,
    soundFanfare: null
};

// Particle system state
let particleCtx = null;
let particles = [];
let animationsPaused = false;

/**
 * Initialize particle elements
 * Call this once DOM is ready
 */
export function initParticleElements() {
    elements = {
        particlesCanvas: $('#particles-canvas'),
    };
}

/**
 * Initialize the particle system
 */
export function initParticles() {
    const canvas = elements.particlesCanvas;
    if (!canvas) return;

    particleCtx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    requestAnimationFrame(updateParticles);
}

/**
 * Resize canvas to match window size
 */
export function resizeCanvas() {
    const canvas = elements.particlesCanvas;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

/**
 * Create particles at a position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} [count=30] - Number of particles
 * @param {string} [type='burst'] - Type: 'burst' or 'confetti'
 */
export function createParticles(x, y, count = 30, type = 'burst') {
    const colors = ['#ffd666', '#e8b84a', '#4ecdb4', '#5cb572', '#ffffff'];

    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const velocity = type === 'burst' ? 3 + Math.random() * 5 : 1 + Math.random() * 2;
        const size = type === 'burst' ? 3 + Math.random() * 4 : 2 + Math.random() * 3;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - (type === 'confetti' ? 2 : 0),
            size,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 1,
            decay: 0.015 + Math.random() * 0.01,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    }
}

/**
 * Update and render particles (animation frame)
 */
function updateParticles() {
    if (!particleCtx) return;

    const canvas = elements.particlesCanvas;
    particleCtx.clearRect(0, 0, canvas.width, canvas.height);

    particles = particles.filter(p => p.life > 0);

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life -= p.decay;
        p.rotation += p.rotationSpeed;

        particleCtx.save();
        particleCtx.translate(p.x, p.y);
        particleCtx.rotate(p.rotation);
        particleCtx.globalAlpha = p.life;
        particleCtx.fillStyle = p.color;
        particleCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        particleCtx.restore();
    });

    requestAnimationFrame(updateParticles);
}

/**
 * Celebrate completion with particles and effects
 * @param {HTMLElement} element - The element to celebrate
 * @param {string} [type='item'] - Type: 'item' or 'quest'
 */
export function celebrate(element, type = 'item') {
    // Get element position for particles
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Add celebrating class for CSS animations
    element.classList.add('celebrating');
    setTimeout(() => element.classList.remove('celebrating'), 600);

    // Particles
    createParticles(x, y, type === 'quest' ? 50 : 25, 'burst');

    // Screen effects for quest completion
    if (type === 'quest') {
        document.body.classList.add('shake');
        if (elements.celebrationOverlay) {
            elements.celebrationOverlay.classList.add('active');
        }
        setTimeout(() => {
            document.body.classList.remove('shake');
            if (elements.celebrationOverlay) {
                elements.celebrationOverlay.classList.remove('active');
            }
        }, 600);
    }
}


/**
 * Pause animations (for window blur)
 */
export function pauseAnimations() {
    animationsPaused = true;
}

/**
 * Resume animations (for window focus)
 */
export function resumeAnimations() {
    animationsPaused = false;
}

/**
 * Check if animations are paused
 * @returns {boolean}
 */
export function isAnimationsPaused() {
    return animationsPaused;
}
