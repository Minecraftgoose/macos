// ========== 辅助函数 ==========
function getMenuBarHeight() {
    const menuBar = document.querySelector('.menu-bar');
    return menuBar ? menuBar.offsetHeight : 28;
}

function getDockHeight() {
    const dockWrapper = document.querySelector('.dock-wrapper');
    if (!dockWrapper) return 78;
    return dockWrapper.getBoundingClientRect().height;
}

function applyDragBoundaries(winDiv, newLeft, newTop) {
    const winWidth = winDiv.offsetWidth;
    const winHeight = winDiv.offsetHeight;
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();
    const maxTop = window.innerHeight - winHeight - dockH;
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - winWidth));
    newTop = Math.max(menuH, Math.min(newTop, maxTop));
    return { newLeft, newTop };
}

function applyResizeBoundaries(winDiv, newLeft, newTop, newWidth, newHeight) {
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();
    const minWidth = parseFloat(getComputedStyle(winDiv).minWidth) || 450;
    const minHeight = parseFloat(getComputedStyle(winDiv).minHeight) || 350;
    let width = Math.max(minWidth, newWidth);
    let height = Math.max(minHeight, newHeight);
    let left = newLeft;
    let top = newTop;
    if (left + width > window.innerWidth) width = window.innerWidth - left;
    if (top + height > window.innerHeight - dockH) height = window.innerHeight - dockH - top;
    if (left < 0) { width += left; left = 0; }
    if (top < menuH) { height += top - menuH; top = menuH; }
    if (width < minWidth) width = minWidth;
    if (height < minHeight) height = minHeight;
    return { left, top, width, height };
}

let resizeFrame = null;
function notifyResize(winObj) {
    const iframe = winObj.dom.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        const rect = winObj.dom.querySelector('.window-content').getBoundingClientRect();
        iframe.contentWindow.postMessage({ type: 'resize', width: rect.width, height: rect.height }, '*');
    }
}
function notifyResizeThrottled(winObj) {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        notifyResize(winObj);
        resizeFrame = null;
    });
}

function syncDarkModeToWindow(winObj) {
    if (winObj.app === 'about') {
        const iframe = winObj.dom.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const isDark = document.body.classList.contains('dark-mode');
            iframe.contentWindow.postMessage({ type: 'darkMode', enabled: isDark }, '*');
        }
    }
}

function getWindowsByApp(app) {
    // ========== 关键修复 ==========
    // 先清理掉 DOM 已经被 remove() 的幽灵窗口，防止 closeWindow 同步失效时的兜底
    window.windows = (window.windows || []).filter(w => w.dom && document.body.contains(w.dom));
    // =============================
    return window.windows.filter(w => w.app === app);
}