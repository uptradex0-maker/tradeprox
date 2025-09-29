// Mobile-specific fixes and enhancements

// Prevent zoom on double tap
document.addEventListener('touchstart', function(event) {
    if (event.touches.length > 1) {
        event.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Viewport height fix for mobile browsers
function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Set initial viewport height
setViewportHeight();

// Update on resize and orientation change
window.addEventListener('resize', setViewportHeight);
window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
});

// Enhanced chart initialization for mobile - Immediate execution
if (window.innerWidth <= 768) {
    // Pre-optimize chart container before DOM ready
    const preOptimizeChart = () => {
        const chartContainer = document.getElementById('tradingChart');
        if (chartContainer) {
            chartContainer.style.width = '100%';
            chartContainer.style.height = '100%';
            chartContainer.style.minHeight = '280px';
            chartContainer.style.position = 'relative';
            chartContainer.style.overflow = 'hidden';
            chartContainer.style.background = 'linear-gradient(135deg, #0a0e1a 0%, #1a1d29 100%)';
            chartContainer.style.display = 'block';
        }
    };
    
    // Try immediate optimization
    preOptimizeChart();
    
    // Also run on DOM ready as fallback
    document.addEventListener('DOMContentLoaded', function() {
        preOptimizeChart();
        
        // Immediate chart resize
        if (window.chart && window.chart.resize) {
            window.chart.resize();
        }
        
        // Optimize other elements
        const tradingPanel = document.querySelector('.trading-panel');
        if (tradingPanel) {
            tradingPanel.style.transform = 'translateZ(0)';
        }
        
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.webkitOverflowScrolling = 'touch';
            sidebar.style.scrollBehavior = 'smooth';
        }
    });
}

// Touch-friendly asset selection
function enhanceMobileAssetSelection() {
    const assetItems = document.querySelectorAll('.asset-item');
    assetItems.forEach(item => {
        item.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        }, { passive: true });
        
        item.addEventListener('touchend', function() {
            this.style.transform = '';
        }, { passive: true });
    });
}

// Enhanced mobile trading buttons
function enhanceMobileTradingButtons() {
    const tradeButtons = document.querySelectorAll('.trade-btn');
    tradeButtons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
            // Haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }, { passive: true });
        
        button.addEventListener('touchend', function() {
            this.style.transform = '';
        }, { passive: true });
    });
}

// Initialize mobile enhancements
document.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) {
        enhanceMobileAssetSelection();
        enhanceMobileTradingButtons();
        
        // Add mobile-specific CSS classes
        document.body.classList.add('mobile-optimized');
        
        // Optimize scroll performance
        document.addEventListener('touchmove', function(e) {
            if (e.target.closest('.sidebar') || e.target.closest('.trading-panel')) {
                // Allow scrolling in these areas
                return;
            }
            // Prevent default for other areas to improve performance
            e.preventDefault();
        }, { passive: false });
    }
});

// Chart resize observer for mobile
if (window.ResizeObserver) {
    const chartContainer = document.getElementById('tradingChart');
    if (chartContainer) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (window.chart && window.chart.resize) {
                    setTimeout(() => {
                        window.chart.resize();
                    }, 100);
                }
            }
        });
        
        resizeObserver.observe(chartContainer);
    }
}

// Mobile-specific error handling
window.addEventListener('error', function(e) {
    if (window.innerWidth <= 768) {
        console.log('Mobile error:', e.error);
        // Could implement mobile-specific error reporting here
    }
});

// Performance optimization for mobile
if (window.innerWidth <= 768) {
    // Reduce animation frequency on mobile
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let frameCount = 0;
    
    window.requestAnimationFrame = function(callback) {
        frameCount++;
        if (frameCount % 2 === 0) { // Reduce to 30fps on mobile
            return originalRequestAnimationFrame(callback);
        } else {
            return setTimeout(callback, 16);
        }
    };
}

// Export functions for global use
window.mobileUtils = {
    setViewportHeight,
    enhanceMobileAssetSelection,
    enhanceMobileTradingButtons
};