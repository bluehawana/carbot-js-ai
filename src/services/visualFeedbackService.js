const EventEmitter = require('events');

class VisualFeedbackService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            enableLED: options.enableLED ?? true,
            enableScreen: options.enableScreen ?? true,
            ledBrightness: options.ledBrightness || 255,
            animationSpeed: options.animationSpeed || 100,
            colors: {
                idle: '#00FF00',      // Green - ready
                listening: '#0080FF', // Blue - listening
                processing: '#FF8000', // Orange - processing
                speaking: '#FF0040',   // Red - speaking
                error: '#FF0000',      // Red - error
                muted: '#808080',      // Gray - muted
                ...options.colors
            },
            ...options
        };
        
        this.currentState = 'idle';
        this.animationFrame = null;
        this.pulseDirection = 1;
        this.pulseValue = 0;
        this.isAnimating = false;
        
        this.screenElement = null;
        this.ledController = null;
        
        this.initializeDisplay();
    }
    
    initializeDisplay() {
        if (this.options.enableScreen) {
            this.createScreenDisplay();
        }
        
        if (this.options.enableLED) {
            this.initializeLEDController();
        }
    }
    
    createScreenDisplay() {
        if (typeof document !== 'undefined') {
            this.screenElement = document.createElement('div');
            this.screenElement.id = 'carbot-visual-feedback';
            this.screenElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                border: 3px solid #333;
                background: ${this.options.colors.idle};
                box-shadow: 0 0 20px rgba(0,0,0,0.3);
                z-index: 10000;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                color: white;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            `;
            
            document.body.appendChild(this.screenElement);
        }
    }
    
    initializeLEDController() {
        this.ledController = {
            setColor: (color, brightness = this.options.ledBrightness) => {
                this.emit('ledChange', { color, brightness });
            },
            
            pulse: (color, speed = this.options.animationSpeed) => {
                this.emit('ledPulse', { color, speed });
            },
            
            breathe: (color, speed = this.options.animationSpeed) => {
                this.emit('ledBreathe', { color, speed });
            }
        };
    }
    
    setState(state, options = {}) {
        const previousState = this.currentState;
        this.currentState = state;
        
        this.emit('stateChange', {
            from: previousState,
            to: state,
            timestamp: Date.now()
        });
        
        this.updateVisualDisplay(state, options);
    }
    
    updateVisualDisplay(state, options = {}) {
        const color = this.options.colors[state] || this.options.colors.idle;
        const icon = this.getStateIcon(state);
        
        if (this.screenElement) {
            this.updateScreenDisplay(color, icon, state, options);
        }
        
        if (this.ledController) {
            this.updateLEDDisplay(color, state, options);
        }
    }
    
    updateScreenDisplay(color, icon, state, options) {
        this.screenElement.style.background = color;
        this.screenElement.textContent = icon;
        
        this.screenElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            this.screenElement.style.transform = 'scale(1)';
        }, 150);
        
        if (state === 'listening' || state === 'processing') {
            this.startScreenAnimation(state);
        } else {
            this.stopScreenAnimation();
        }
        
        if (options.message) {
            this.showMessage(options.message);
        }
    }
    
    updateLEDDisplay(color, state, options) {
        switch (state) {
            case 'listening':
                this.ledController.pulse(color, 300);
                break;
            case 'processing':
                this.ledController.breathe(color, 500);
                break;
            case 'speaking':
                this.ledController.pulse(color, 200);
                break;
            case 'error':
                this.ledController.pulse(color, 100);
                setTimeout(() => this.setState('idle'), 2000);
                break;
            default:
                this.ledController.setColor(color);
        }
    }
    
    getStateIcon(state) {
        const icons = {
            idle: '●',
            listening: '🎤',
            processing: '⚙️',
            speaking: '🔊',
            error: '⚠️',
            muted: '🔇'
        };
        
        return icons[state] || '●';
    }
    
    startScreenAnimation(type) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.pulseValue = 0;
        this.pulseDirection = 1;
        
        const animate = () => {
            if (!this.isAnimating) return;
            
            this.pulseValue += this.pulseDirection * 0.05;
            
            if (this.pulseValue >= 1) {
                this.pulseValue = 1;
                this.pulseDirection = -1;
            } else if (this.pulseValue <= 0) {
                this.pulseValue = 0;
                this.pulseDirection = 1;
            }
            
            if (this.screenElement) {
                const scale = 1 + (this.pulseValue * 0.2);
                const opacity = 0.7 + (this.pulseValue * 0.3);
                
                this.screenElement.style.transform = `scale(${scale})`;
                this.screenElement.style.opacity = opacity;
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stopScreenAnimation() {
        this.isAnimating = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        if (this.screenElement) {
            this.screenElement.style.transform = 'scale(1)';
            this.screenElement.style.opacity = '1';
        }
    }
    
    showMessage(message, duration = 3000) {
        if (!this.screenElement) return;
        
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            position: fixed;
            top: 90px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 20px;
            font-size: 14px;
            max-width: 300px;
            z-index: 10001;
            animation: fadeInOut ${duration}ms ease-in-out;
        `;
        
        messageElement.textContent = message;
        document.body.appendChild(messageElement);
        
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, duration);
    }
    
    showEnergyLevel(energy) {
        if (!this.screenElement) return;
        
        const energyBar = this.screenElement.querySelector('.energy-bar');
        if (!energyBar) {
            const bar = document.createElement('div');
            bar.className = 'energy-bar';
            bar.style.cssText = `
                position: absolute;
                bottom: -5px;
                left: 50%;
                transform: translateX(-50%);
                width: 80%;
                height: 4px;
                background: rgba(255,255,255,0.3);
                border-radius: 2px;
                overflow: hidden;
            `;
            
            const fill = document.createElement('div');
            fill.className = 'energy-fill';
            fill.style.cssText = `
                height: 100%;
                background: #00FF00;
                width: 0%;
                transition: width 0.1s ease;
            `;
            
            bar.appendChild(fill);
            this.screenElement.appendChild(bar);
        }
        
        const fill = this.screenElement.querySelector('.energy-fill');
        if (fill) {
            const percentage = Math.min(100, energy * 100);
            fill.style.width = `${percentage}%`;
            
            const hue = Math.max(0, 120 - (percentage * 1.2));
            fill.style.background = `hsl(${hue}, 100%, 50%)`;
        }
    }
    
    showWaveform(audioData) {
        if (!this.screenElement || !audioData) return;
        
        let canvas = this.screenElement.querySelector('canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = 54;
            canvas.height = 54;
            canvas.style.cssText = `
                position: absolute;
                top: 3px;
                left: 3px;
                border-radius: 50%;
                opacity: 0.7;
            `;
            this.screenElement.appendChild(canvas);
        }
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 20;
        
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < audioData.length; i += 8) {
            const angle = (i / audioData.length) * Math.PI * 2;
            const amplitude = Math.abs(audioData[i]) * radius;
            const x = centerX + Math.cos(angle) * (radius + amplitude);
            const y = centerY + Math.sin(angle) * (radius + amplitude);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.closePath();
        ctx.stroke();
    }
    
    destroy() {
        this.stopScreenAnimation();
        
        if (this.screenElement && this.screenElement.parentNode) {
            this.screenElement.parentNode.removeChild(this.screenElement);
        }
        
        this.removeAllListeners();
    }
}

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(10px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
}

module.exports = VisualFeedbackService;