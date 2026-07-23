// ========== 窗口核心操作（无需修改，保持原样） ==========
let windows = [];
window.windows = windows;
let nextWindowId = 1;
let highestZ = 1000;
let activeWindow = null;

function focusWindow(winObj) {
    highestZ++;
    winObj.dom.style.zIndex = highestZ;
    winObj.zIndex = highestZ;
    activeWindow = winObj;
    window.dispatchEvent(new CustomEvent('windowFocused', { detail: { appName: winObj.app, windowId: winObj.id } }));
    syncDarkModeToWindow(winObj);
    if (window.AnimationManager) {
        const state = window.AnimationManager.getWindowState(winObj.dom);
        if (state === 'open' || state === 'unknown') window.AnimationManager.animateWindowFocus(winObj.dom).catch(() => {});
    }
}

async function closeWindow(winObj) {
    const dom = winObj.dom;
    if (dom.classList.contains('window-closing')) return;
    dom.classList.add('window-closing');
    if (window.AnimationManager) {
        await window.AnimationManager.animateWindowClose(dom);
    } else {
        dom.style.transition = 'all 0.8s cubic-bezier(0.4, 0.0, 1.0, 1.0)';
        dom.style.opacity = '0';
        dom.style.transform = 'scale(0.85)';
        await new Promise(r => setTimeout(r, 800));
    }
    dom.remove();
    windows = windows.filter(w => w.id !== winObj.id);
    updateBadge(winObj.app);
    window.dispatchEvent(new CustomEvent('appClosed', { detail: { appName: winObj.app, windowId: winObj.id } }));
    if (activeWindow === winObj) {
        activeWindow = windows.length > 0 ? windows[windows.length - 1] : null;
        if (activeWindow) focusWindow(activeWindow);
    }
}

async function minimizeWindow(winObj) {
    window.dispatchEvent(new CustomEvent('windowMinimized', { detail: { appName: winObj.app, windowId: winObj.id } }));
    if (winObj.minimized || winObj.isMinimizing) return;
    winObj.isMinimizing = true;
    const win = winObj.dom;
    const rect = win.getBoundingClientRect();
    winObj.originalRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    const dockItem = document.querySelector(`.dock-item[data-app="${winObj.app}"]`);
    if (!dockItem) {
        win.style.display = 'none';
        winObj.minimized = true;
        winObj.isMinimizing = false;
        updateBadge(winObj.app);
        return;
    }
    const dockRect = dockItem.getBoundingClientRect();
    if (window.AnimationManager) {
        await window.AnimationManager.animateWindowMinimize(win, dockRect, rect);
    } else {
        const translateX = (dockRect.left + dockRect.width/2) - (rect.left + rect.width/2);
        const translateY = (dockRect.top + dockRect.height/2) - (rect.top + rect.height/2);
        win.style.transition = 'all 1.2s cubic-bezier(0.4, 0.0, 1.0, 1.0)';
        win.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.1)`;
        win.style.opacity = '0';
        await new Promise(r => setTimeout(r, 1200));
        win.style.display = 'none';
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
    }
    winObj.minimized = true;
    winObj.isMinimizing = false;
    updateBadge(winObj.app);
    if (activeWindow === winObj) {
        const nextWindow = windows.find(w => !w.minimized && w.id !== winObj.id);
        if (nextWindow) focusWindow(nextWindow);
    }
}

async function restoreWindow(winObj) {
    if (winObj.minimized !== true || winObj.isRestoring) return;
    winObj.isRestoring = true;
    const win = winObj.dom;
    let orig = winObj.originalRect;
    if (!orig) {
        orig = {
            left: parseInt(win.style.left) || 100,
            top: parseInt(win.style.top) || 100,
            width: win.offsetWidth || 600,
            height: win.offsetHeight || 400
        };
        winObj.originalRect = orig;
    }
    const dockItem = document.querySelector(`.dock-item[data-app="${winObj.app}"]`);
    if (!dockItem) {
        win.style.display = 'flex';
        winObj.minimized = false;
        winObj.isRestoring = false;
        updateBadge(winObj.app);
        focusWindow(winObj);
        return;
    }
    const dockRect = dockItem.getBoundingClientRect();
    if (window.AnimationManager) {
        await window.AnimationManager.animateWindowRestore(win, dockRect, orig);
    } else {
        win.style.left = `${orig.left}px`;
        win.style.top = `${orig.top}px`;
        win.style.width = `${orig.width}px`;
        win.style.height = `${orig.height}px`;
        win.style.display = 'flex';
        win.style.transition = 'all 1.2s cubic-bezier(0.0, 0.0, 0.2, 1)';
        win.style.opacity = '0';
        win.style.transform = 'scale(0.1)';
        await new Promise(r => setTimeout(r, 50));
        win.style.opacity = '1';
        win.style.transform = 'scale(1)';
        await new Promise(r => setTimeout(r, 1200));
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
    }
    winObj.minimized = false;
    winObj.isRestoring = false;
    updateBadge(winObj.app);
    notifyResize(winObj);
    focusWindow(winObj);
}

async function toggleFullscreen(winObj) {
    const win = winObj.dom;
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();
    if (winObj.isFullscreenTransitioning) return;
    winObj.isFullscreenTransitioning = true;
    if (!winObj.isFullscreen) {
        winObj.originalRect = {
            left: parseInt(win.style.left) || 0,
            top: parseInt(win.style.top) || 0,
            width: win.offsetWidth,
            height: win.offsetHeight
        };
        const targetRect = { left: 0, top: menuH, width: window.innerWidth, height: window.innerHeight - menuH - dockH };
        if (window.AnimationManager) {
            await window.AnimationManager.animateWindowFullscreen(win, true, targetRect);
        } else {
            win.style.transition = 'all 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            win.style.left = '0px';
            win.style.top = `${menuH}px`;
            win.style.width = '100%';
            win.style.height = `calc(100% - ${menuH + dockH}px)`;
            await new Promise(r => setTimeout(r, 1000));
        }
        winObj.isFullscreen = true;
    } else {
        const o = winObj.originalRect;
        if (window.AnimationManager) {
            await window.AnimationManager.animateWindowFullscreen(win, false, o);
        } else {
            win.style.transition = 'all 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            win.style.left = `${o.left}px`;
            win.style.top = `${o.top}px`;
            win.style.width = `${o.width}px`;
            win.style.height = `${o.height}px`;
            await new Promise(r => setTimeout(r, 1000));
        }
        winObj.isFullscreen = false;
    }
    win.style.transition = '';
    winObj.isFullscreenTransitioning = false;
    notifyResize(winObj);
}

async function createWindow(appName, left, top, width, height) {
    const app = window.appConfig[appName];
    if (!app) return null;
    const winId = nextWindowId++;
    const winDiv = document.createElement('div');
    winDiv.className = 'window gpu-accelerated';
    winDiv.id = `window-${winId}`;
    winDiv.dataset.app = appName;
    winDiv.style.left = `${left}px`;
    winDiv.style.top = `${top}px`;
    winDiv.style.width = `${width}px`;
    winDiv.style.height = `${height}px`;
    winDiv.style.zIndex = ++highestZ;

    winDiv.innerHTML = `
        <div class="window-header">
            <div class="window-controls">
                <button class="window-close" title="关闭"></button>
                <button class="window-minimize" title="最小化"></button>
                <button class="window-maximize" title="全屏"></button>
            </div>
            <div class="window-title">${app.title}</div>
        </div>
        <div class="window-content">
            <iframe src="${app.src}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation"></iframe>
        </div>
        <div class="resize-handle resize-nw" data-dir="nw"></div>
        <div class="resize-handle resize-ne" data-dir="ne"></div>
        <div class="resize-handle resize-sw" data-dir="sw"></div>
        <div class="resize-handle resize-se" data-dir="se"></div>
        <div class="resize-handle resize-n" data-dir="n"></div>
        <div class="resize-handle resize-s" data-dir="s"></div>
        <div class="resize-handle resize-w" data-dir="w"></div>
        <div class="resize-handle resize-e" data-dir="e"></div>
    `;

    document.body.appendChild(winDiv);

    const winObj = {
        id: winId, app: appName, dom: winDiv, minimized: false, zIndex: highestZ,
        isFullscreen: false, originalRect: null, isMinimizing: false,
        isRestoring: false, isFullscreenTransitioning: false
    };
    winDiv.__winObj = winObj;

    winDiv.querySelector('.window-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(winObj); });
    winDiv.querySelector('.window-minimize').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(winObj); });
    winDiv.querySelector('.window-maximize').addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(winObj); });

    const header = winDiv.querySelector('.window-header');
    const startDrag = async (clientX, clientY) => {
        if (winObj.isFullscreen) await toggleFullscreen(winObj);
        dragState.active = true;
        dragState.target = winDiv;
        dragState.startX = clientX;
        dragState.startY = clientY;
        dragState.startLeft = parseInt(winDiv.style.left) || 0;
        dragState.startTop = parseInt(winDiv.style.top) || 0;
        focusWindow(winObj);
        if (window.AnimationManager) await window.AnimationManager.animateDragStart(winDiv);
        else winDiv.classList.add('window-dragging');
    };
    const startResize = (clientX, clientY, dir) => {
        if (winObj.isFullscreen) toggleFullscreen(winObj);
        resizeState.active = true;
        resizeState.target = winDiv;
        resizeState.direction = dir;
        resizeState.startX = clientX;
        resizeState.startY = clientY;
        resizeState.startWidth = winDiv.offsetWidth;
        resizeState.startHeight = winDiv.offsetHeight;
        resizeState.startLeft = parseInt(winDiv.style.left) || 0;
        resizeState.startTop = parseInt(winDiv.style.top) || 0;
        focusWindow(winObj);
        if (window.AnimationManager) window.AnimationManager.animateResizeStart(winDiv);
        else winDiv.classList.add('window-resizing');
    };

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-controls')) return;
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });
    header.addEventListener('touchstart', (e) => {
        if (e.target.closest('.window-controls')) return;
        e.preventDefault();
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    const handles = winDiv.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        const dir = handle.getAttribute('data-dir');
        if (!dir) return;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(e.clientX, e.clientY, dir);
        });
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const touch = e.touches[0];
            startResize(touch.clientX, touch.clientY, dir);
        }, { passive: false });
    });

    winDiv.addEventListener('mousedown', () => focusWindow(winObj));
    winDiv.addEventListener('touchstart', () => focusWindow(winObj), { passive: true });

    const iframe = winDiv.querySelector('iframe');
    iframe.addEventListener('load', () => {
        notifyResize(winObj);
        syncDarkModeToWindow(winObj);
    });

    if (window.AnimationManager) {
        await window.AnimationManager.animateWindowOpen(winDiv);
    } else {
        winDiv.style.opacity = '0';
        winDiv.style.transform = 'scale(0.88) translateY(40px)';
        winDiv.style.filter = 'blur(12px)';
        requestAnimationFrame(() => {
            winDiv.style.transition = 'all 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            winDiv.style.opacity = '1';
            winDiv.style.transform = 'scale(1) translateY(0)';
            winDiv.style.filter = 'blur(0)';
            setTimeout(() => {
                winDiv.style.transition = '';
                notifyResize(winObj);
            }, 1200);
        });
    }
    return winObj;
}

function updateBadge(app) {
    const hasWin = windows.some(w => w.app === app && !w.minimized);
    const badge = document.querySelector(`.dock-item[data-app="${app}"] .badge`);
    if (badge) {
        badge.classList.toggle('active', hasWin);
        if (hasWin) {
            badge.classList.add('anim-badge-appear');
            setTimeout(() => badge.classList.remove('anim-badge-appear'), 800);
        }
    }
}