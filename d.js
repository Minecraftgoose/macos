// ========== d.js - 平滑直驱版（无弹跳） ==========
const AnimationManager = {
    // 动画配置
    config: {
        // 缓动函数 - 全部改为平滑/减速，去掉 spring
        easing: {
            standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
            decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
            accelerate: 'cubic-bezier(0.4, 0.0, 1.0, 1.0)',
            // spring 替换为 smooth
            spring: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',   // 平滑，无弹跳
            smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
        },
        // 持续时间（保持原样，可微调）
        duration: {
            instant: 100,
            fast: 300,
            normal: 600,
            slow: 1000,
            slower: 1200,
            slowest: 1500,
            boot: 1500,
            genie: 1200
        },
        gpu: {
            transform: 'translateZ(0)',
            backface: 'hidden',
            perspective: '1000px'
        }
    },

    state: {
        activeAnimations: new Map(),
        isAnimating: false,
        windowStates: new Map(),
        lastAnimationTime: 0
    },

    init() {
        this.createOverlay();
        this.setupGlobalListeners();
        console.log('macOS动画系统v3.0 · 平滑直驱');
    },

    createOverlay() {
        if (document.getElementById('animation-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'animation-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            background: transparent;
            cursor: default;
            display: none;
            touch-action: none;
            pointer-events: auto;
        `;
        document.body.appendChild(overlay);
        return overlay;
    },

    showOverlay(cursorStyle = 'default') {
        const overlay = document.getElementById('animation-overlay');
        if (overlay) {
            overlay.style.cursor = cursorStyle;
            overlay.style.display = 'block';
            this.state.isAnimating = true;
        }
    },

    hideOverlay() {
        const overlay = document.getElementById('animation-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            this.state.isAnimating = false;
        }
    },

    async nextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    },

    async waitFrames(count = 2) {
        for (let i = 0; i < count; i++) {
            await this.nextFrame();
        }
    },

    async waitForAnimation(element, timeout = null) {
        if (!element) return;
        const duration = timeout || this.config.duration.slower;
        return new Promise((resolve) => {
            let resolved = false;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                element.removeEventListener('transitionend', onEnd);
                element.removeEventListener('animationend', onEnd);
                element.removeEventListener('animationcancel', onCancel);
                clearTimeout(safetyTimeout);
                resolve();
            };
            const onEnd = (e) => {
                if (e.target === element) cleanup();
            };
            const onCancel = () => cleanup();
            const safetyTimeout = setTimeout(cleanup, duration + 200);
            element.addEventListener('transitionend', onEnd);
            element.addEventListener('animationend', onEnd);
            element.addEventListener('animationcancel', onCancel);
        });
    },

    async applyAnimation(element, animationClass, duration = null) {
        if (!element) return;
        const animId = `${element.id || 'unknown'}-${animationClass}-${Date.now()}`;
        if (this.state.activeAnimations.has(element)) {
            await this.cancelAnimation(element);
        }
        this.state.activeAnimations.set(element, animId);
        return new Promise(async (resolve) => {
            let resolved = false;
            const timeoutDuration = duration || this.config.duration.slower;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                element.classList.remove(animationClass);
                element.removeEventListener('animationend', onEnd);
                element.removeEventListener('animationcancel', onCancel);
                clearTimeout(safetyTimeout);
                if (this.state.activeAnimations.get(element) === animId) {
                    this.state.activeAnimations.delete(element);
                }
                resolve();
            };
            const onEnd = (e) => {
                if (e.target === element) cleanup();
            };
            const onCancel = () => cleanup();
            element.addEventListener('animationend', onEnd, { once: false });
            element.addEventListener('animationcancel', onCancel, { once: true });
            const safetyTimeout = setTimeout(cleanup, timeoutDuration + 300);
            element.offsetHeight;
            element.classList.add(animationClass);
        });
    },

    async cancelAnimation(element) {
        if (!element) return;
        const activeAnim = this.state.activeAnimations.get(element);
        if (activeAnim) {
            const classes = Array.from(element.classList);
            const animClasses = classes.filter(c => c.startsWith('anim-'));
            animClasses.forEach(c => element.classList.remove(c));
            this.state.activeAnimations.delete(element);
            await this.nextFrame();
        }
    },

    setTransition(element, properties = 'all', duration = null, easing = null) {
        if (!element) return;
        const dur = (duration || this.config.duration.slower) + 'ms';
        const ease = easing || this.config.easing.smooth;  // 默认平滑
        if (Array.isArray(properties)) {
            const transitions = properties.map(prop => `${prop} ${dur} ${ease}`);
            element.style.transition = transitions.join(', ');
        } else {
            element.style.transition = `${properties} ${dur} ${ease}`;
        }
        element.style.willChange = Array.isArray(properties) 
            ? properties.join(', ') 
            : properties;
    },

    clearTransition(element) {
        if (!element) return;
        element.style.transition = '';
        element.style.willChange = '';
    },

    // ========== 窗口打开（平滑，无弹跳） ==========
    async animateWindowOpen(windowElement) {
        if (!windowElement) return;
        const winId = windowElement.id || 'window-' + Date.now();
        if (this.state.windowStates.get(winId) === 'opening') return;
        this.state.windowStates.set(winId, 'opening');

        const appName = windowElement.dataset.app;
        const dockItem = appName ? document.querySelector(`.dock-item[data-app="${appName}"]`) : null;
        const dur = this.config.duration.slower;
        const ease = this.config.easing.decelerate;   // 减速进入，无弹跳

        const origTransition = windowElement.style.transition;
        const origWillChange = windowElement.style.willChange;

        this.showOverlay();

        if (dockItem) {
            const dr = dockItem.getBoundingClientRect();
            const targetL = parseInt(windowElement.style.left) || 0;
            const targetT = parseInt(windowElement.style.top) || 0;
            const targetW = parseInt(windowElement.style.width) || 600;
            const targetH = parseInt(windowElement.style.height) || 400;
            const winCX = targetL + targetW / 2;
            const winCY = targetT + targetH / 2;
            const dockCX = dr.left + dr.width / 2;
            const dockCY = dr.top + dr.height / 2;
            const offX = dockCX - winCX;
            const offY = dockCY - winCY;

            windowElement.style.transition = 'none';
            windowElement.style.transform = `translate(${offX}px, ${offY}px) scale(0.05)`;
            windowElement.style.opacity = '0';
            void windowElement.offsetHeight;

            windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'transform, opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.transform = 'translate(0, 0) scale(1)';
                    windowElement.style.opacity = '1';
                });
            });
        } else {
            windowElement.style.transition = 'none';
            windowElement.style.transform = 'scale(0.85) translateY(60px)';
            windowElement.style.opacity = '0';
            void windowElement.offsetHeight;

            windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'transform, opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.transform = 'scale(1) translateY(0)';
                    windowElement.style.opacity = '1';
                });
            });
        }

        await new Promise(r => setTimeout(r, dur + 50));

        windowElement.style.transition = 'none';
        windowElement.style.transform = '';
        windowElement.style.opacity = '';
        windowElement.style.willChange = origWillChange;
        void windowElement.offsetHeight;
        windowElement.style.transition = origTransition;

        this.hideOverlay();
        this.state.windowStates.set(winId, 'open');
        this.notifyWindowResize(windowElement);
    },

    // ========== 窗口关闭（平滑加速，无弹跳） ==========
    async animateWindowClose(windowElement) {
        if (!windowElement) return;
        const winId = windowElement.id || 'unknown';
        this.state.windowStates.set(winId, 'closing');

        const dur = this.config.duration.fast;
        const ease = this.config.easing.accelerate;
        const origTransition = windowElement.style.transition;
        const origWillChange = windowElement.style.willChange;

        this.showOverlay();

        windowElement.style.transition = 'none';
        void windowElement.offsetHeight;

        windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}, filter ${dur}ms ${ease}`;
        windowElement.style.willChange = 'transform, opacity, filter';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                windowElement.style.transform = 'scale(0.85)';
                windowElement.style.opacity = '0';
                windowElement.style.filter = 'blur(12px)';
            });
        });

        await new Promise(r => setTimeout(r, dur + 50));

        windowElement.style.transition = 'none';
        windowElement.style.transform = '';
        windowElement.style.opacity = '';
        windowElement.style.filter = '';
        windowElement.style.willChange = origWillChange;
        void windowElement.offsetHeight;
        windowElement.style.transition = origTransition;

        this.hideOverlay();
        this.state.windowStates.delete(winId);
    },

    // ========== 最小化（平滑缩放+位移，无弹跳） ==========
    async animateWindowMinimize(windowElement, dockRect, windowRect) {
        if (!windowElement) return;
        const winId = windowElement.id || 'unknown';
        this.state.windowStates.set(winId, 'minimizing');

        const appName = windowElement.dataset.app;
        const dockItem = appName ? document.querySelector(`.dock-item[data-app="${appName}"]`) : null;
        let dr = dockRect;
        if (!dr && dockItem) dr = dockItem.getBoundingClientRect();
        let wr = windowRect;
        if (!wr) wr = windowElement.getBoundingClientRect();

        const dur = this.config.duration.genie;
        const ease = this.config.easing.accelerate;   // 加速缩小
        const origTransition = windowElement.style.transition;
        const origWillChange = windowElement.style.willChange;

        this.showOverlay();

        if (dr && wr) {
            const dockCX = dr.left + dr.width / 2;
            const dockCY = dr.top + dr.height / 2;
            const winCX = wr.left + wr.width / 2;
            const winCY = wr.top + wr.height / 2;
            const offX = dockCX - winCX;
            const offY = dockCY - winCY;

            windowElement.style.transition = 'none';
            void windowElement.offsetHeight;

            windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'transform, opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.transform = `translate(${offX}px, ${offY}px) scale(0.05)`;
                    windowElement.style.opacity = '0';
                });
            });
        } else {
            windowElement.style.transition = 'none';
            void windowElement.offsetHeight;

            windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'transform, opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.transform = 'scale(0.3)';
                    windowElement.style.opacity = '0';
                });
            });
        }

        await new Promise(r => setTimeout(r, dur + 50));

        windowElement.style.transition = 'none';
        windowElement.style.transform = '';
        windowElement.style.opacity = '';
        windowElement.style.willChange = origWillChange;
        windowElement.style.display = 'none';
        void windowElement.offsetHeight;
        windowElement.style.transition = origTransition;

        this.hideOverlay();
        this.state.windowStates.set(winId, 'minimized');
    },

    // ========== 恢复（平滑放大+位移，无弹跳） ==========
    async animateWindowRestore(windowElement, dockRect, originalRect) {
        if (!windowElement || !originalRect) return;
        const winId = windowElement.id || 'unknown';
        this.state.windowStates.set(winId, 'restoring');

        const appName = windowElement.dataset.app;
        const dockItem = appName ? document.querySelector(`.dock-item[data-app="${appName}"]`) : null;
        let dr = dockRect;
        if (!dr && dockItem) dr = dockItem.getBoundingClientRect();

        const dur = this.config.duration.genie;
        const ease = this.config.easing.decelerate;   // 减速恢复
        const origTransition = windowElement.style.transition;
        const origWillChange = windowElement.style.willChange;

        windowElement.style.left = originalRect.left + 'px';
        windowElement.style.top = originalRect.top + 'px';
        windowElement.style.width = originalRect.width + 'px';
        windowElement.style.height = originalRect.height + 'px';
        windowElement.style.display = 'flex';

        const winCX = originalRect.left + originalRect.width / 2;
        const winCY = originalRect.top + originalRect.height / 2;

        this.showOverlay();

        if (dr) {
            const dockCX = dr.left + dr.width / 2;
            const dockCY = dr.top + dr.height / 2;
            const offX = dockCX - winCX;
            const offY = dockCY - winCY;

            windowElement.style.transition = 'none';
            windowElement.style.transform = `translate(${offX}px, ${offY}px) scale(0.05)`;
            windowElement.style.opacity = '0';
            void windowElement.offsetHeight;

            windowElement.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'transform, opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.transform = 'translate(0, 0) scale(1)';
                    windowElement.style.opacity = '1';
                });
            });
        } else {
            windowElement.style.transition = 'none';
            windowElement.style.opacity = '0';
            void windowElement.offsetHeight;

            windowElement.style.transition = `opacity ${dur}ms ${ease}`;
            windowElement.style.willChange = 'opacity';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    windowElement.style.opacity = '1';
                });
            });
        }

        await new Promise(r => setTimeout(r, dur + 50));

        windowElement.style.transition = 'none';
        windowElement.style.transform = '';
        windowElement.style.opacity = '';
        windowElement.style.willChange = origWillChange;
        void windowElement.offsetHeight;
        windowElement.style.transition = origTransition;

        this.hideOverlay();
        this.state.windowStates.set(winId, 'open');
        this.notifyWindowResize(windowElement);
    },

    // ========== 全屏切换（平滑，无弹跳） ==========
    async animateWindowFullscreen(windowElement, isFullscreen, targetRect) {
        if (!windowElement || !targetRect) return;
        const winId = windowElement.id || 'unknown';
        this.state.windowStates.set(winId, isFullscreen ? 'fullscreening' : 'exiting-fullscreen');

        const dur = this.config.duration.slow;
        const ease = this.config.easing.standard;   // 标准缓动，无弹跳
        const origTransition = windowElement.style.transition;
        const origWillChange = windowElement.style.willChange;

        this.showOverlay();

        windowElement.style.transition = `width ${dur}ms ${ease}, height ${dur}ms ${ease}, left ${dur}ms ${ease}, top ${dur}ms ${ease}`;
        windowElement.style.willChange = 'width, height, left, top';

        void windowElement.offsetHeight;

        windowElement.style.left = targetRect.left + 'px';
        windowElement.style.top = targetRect.top + 'px';
        windowElement.style.width = targetRect.width + 'px';
        windowElement.style.height = targetRect.height + 'px';

        await new Promise(r => setTimeout(r, dur + 50));

        windowElement.style.transition = 'none';
        windowElement.style.willChange = origWillChange;
        void windowElement.offsetHeight;
        windowElement.style.transition = origTransition;

        this.hideOverlay();
        this.state.windowStates.set(winId, isFullscreen ? 'fullscreen' : 'open');
        this.notifyWindowResize(windowElement);
    },

    // ========== 窗口聚焦（平滑阴影过渡，无弹跳） ==========
    async animateWindowFocus(windowElement) {
        if (!windowElement) return;
        windowElement.classList.remove('anim-window-focus');
        await this.nextFrame();
        await this.applyAnimation(windowElement, 'anim-window-focus', this.config.duration.slowest);
    },

    // ========== Dock 弹跳（改为平滑缩放，无弹跳） ==========
    async animateDockBounce(dockItem) {
        if (!dockItem) return;
        // 改为平滑放大再缩回（无弹跳）
        dockItem.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1.0)';
        dockItem.style.transform = 'scale(1.15)';
        await new Promise(r => setTimeout(r, 300));
        dockItem.style.transform = 'scale(1)';
        await new Promise(r => setTimeout(r, 400));
        dockItem.style.transition = '';
    },

    async animateDockItemAppear(dockItem, delay = 0) {
        if (!dockItem) return;
        dockItem.style.opacity = '0';
        await this.nextFrame();
        setTimeout(async () => {
            await this.applyAnimation(dockItem, 'anim-dock-item-pop', this.config.duration.slow);
        }, delay);
    },

    async animateDesktopIconsStagger() {
        const icons = document.querySelectorAll('.desktop-icon');
        icons.forEach((icon, index) => {
            setTimeout(async () => {
                await this.applyAnimation(icon, 'anim-icon-fade-in', this.config.duration.slow);
            }, index * 100);
        });
    },

    async animateControlCenterShow(controlCenter) {
        if (!controlCenter) return;
        controlCenter.style.opacity = '0';
        await this.nextFrame();
        await this.applyAnimation(controlCenter, 'anim-control-center', this.config.duration.slower);
        const modules = controlCenter.querySelectorAll('.cc-module');
        modules.forEach((mod, index) => {
            setTimeout(() => {
                this.applyAnimation(mod, 'anim-module-stagger', this.config.duration.normal);
            }, index * 80);
        });
    },

    async animateContextMenu(menu) {
        if (!menu) return;
        menu.style.opacity = '0';
        await this.nextFrame();
        await this.applyAnimation(menu, 'anim-context-menu', this.config.duration.slow);
    },

    async animateDragStart(windowElement) {
        if (!windowElement) return;
        windowElement.classList.add('window-dragging');
        await this.applyAnimation(windowElement, 'anim-drag-lift', 300);
    },

    animateDragEnd(windowElement) {
        if (!windowElement) return;
        windowElement.classList.remove('window-dragging');
        windowElement.style.transform = '';
        windowElement.style.boxShadow = '';
    },

    animateResizeStart(windowElement) {
        if (!windowElement) return;
        windowElement.classList.add('window-resizing');
    },

    animateResizeEnd(windowElement) {
        if (!windowElement) return;
        windowElement.classList.remove('window-resizing');
        this.notifyWindowResize(windowElement);
    },

    async startBootSequence(bootScreen, progressBar, onComplete) {
        if (!bootScreen) return;
        const logo = bootScreen.querySelector('.boot-logo');
        if (logo) {
            logo.classList.add('anim-logo-pulse');
        }
        let progress = 0;
        const updateInterval = 50;
        const totalTime = this.config.duration.boot;
        const increment = 100 / (totalTime / updateInterval);
        const progressInterval = setInterval(() => {
            progress += increment + (Math.random() * 2 - 1);
            progress = Math.min(progress, 100);
            if (progressBar) {
                progressBar.style.width = progress + '%';
            }
            if (progress >= 100) {
                clearInterval(progressInterval);
                setTimeout(() => {
                    bootScreen.classList.add('hide-boot');
                    setTimeout(() => {
                        bootScreen.style.display = 'none';
                        if (onComplete) onComplete();
                    }, 800);
                }, 300);
            }
        }, updateInterval);
        setTimeout(() => {
            clearInterval(progressInterval);
            if (progressBar) progressBar.style.width = '100%';
            bootScreen.classList.add('hide-boot');
            setTimeout(() => {
                bootScreen.style.display = 'none';
                if (onComplete) onComplete();
            }, 800);
        }, totalTime + 1000);
    },

    notifyWindowResize(windowElement) {
        const iframe = windowElement.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const rect = windowElement.querySelector('.window-content')?.getBoundingClientRect();
            if (rect) {
                iframe.contentWindow.postMessage({
                    type: 'resize',
                    width: rect.width,
                    height: rect.height
                }, '*');
            }
        }
    },

    setupGlobalListeners() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery.matches) {
            document.body.classList.add('reduce-motion');
        }
        mediaQuery.addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('reduce-motion');
            } else {
                document.body.classList.remove('reduce-motion');
            }
        });
    },

    getWindowState(windowElement) {
        if (!windowElement) return null;
        return this.state.windowStates.get(windowElement.id) || 'unknown';
    },

    isAnimating(windowElement) {
        if (windowElement) {
            return this.state.activeAnimations.has(windowElement);
        }
        return this.state.isAnimating;
    }
};

// 初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AnimationManager.init());
} else {
    AnimationManager.init();
}

window.AnimationManager = AnimationManager;
window.macOSAnimation = AnimationManager;