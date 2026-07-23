// ========== 拖拽与缩放 ==========
let dragState = {
    active: false, target: null, startX: 0, startY: 0, startLeft: 0, startTop: 0
};
let resizeState = {
    active: false, target: null, direction: '', startX: 0, startY: 0,
    startWidth: 0, startHeight: 0, startLeft: 0, startTop: 0
};

function onGlobalMove(clientX, clientY) {
    if (dragState.active && dragState.target) {
        const dx = clientX - dragState.startX;
        const dy = clientY - dragState.startY;
        let newLeft = dragState.startLeft + dx;
        let newTop = dragState.startTop + dy;
        const bounded = applyDragBoundaries(dragState.target, newLeft, newTop);
        dragState.target.style.left = bounded.newLeft + 'px';
        dragState.target.style.top = bounded.newTop + 'px';
    }
    if (resizeState.active && resizeState.target) {
        const dx = clientX - resizeState.startX;
        const dy = clientY - resizeState.startY;
        let newWidth = resizeState.startWidth;
        let newHeight = resizeState.startHeight;
        let newLeft = resizeState.startLeft;
        let newTop = resizeState.startTop;
        const dir = resizeState.direction;
        if (dir.includes('e')) newWidth = resizeState.startWidth + dx;
        if (dir.includes('w')) {
            newWidth = resizeState.startWidth - dx;
            newLeft = resizeState.startLeft + (resizeState.startWidth - newWidth);
        }
        if (dir.includes('s')) newHeight = resizeState.startHeight + dy;
        if (dir.includes('n')) {
            newHeight = resizeState.startHeight - dy;
            newTop = resizeState.startTop + (resizeState.startHeight - newHeight);
        }
        const bounded = applyResizeBoundaries(resizeState.target, newLeft, newTop, newWidth, newHeight);
        resizeState.target.style.left = bounded.left + 'px';
        resizeState.target.style.top = bounded.top + 'px';
        resizeState.target.style.width = bounded.width + 'px';
        resizeState.target.style.height = bounded.height + 'px';
        if (resizeState.target.__winObj) notifyResizeThrottled(resizeState.target.__winObj);
    }
}

function onGlobalUp() {
    if (dragState.active) {
        dragState.active = false;
        if (dragState.target && window.AnimationManager) window.AnimationManager.animateDragEnd(dragState.target);
        else if (dragState.target) dragState.target.classList.remove('window-dragging');
        dragState.target = null;
    }
    if (resizeState.active) {
        const win = resizeState.target;
        resizeState.active = false;
        if (win && window.AnimationManager) window.AnimationManager.animateResizeEnd(win);
        else if (win) win.classList.remove('window-resizing');
        if (win && win.__winObj) notifyResize(win.__winObj);
        resizeState.target = null;
    }
}

function bindGlobalDragResizeListeners() {
    if (window.globalListenersBound) return;
    window.addEventListener('mousemove', (e) => onGlobalMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onGlobalUp);
    window.addEventListener('touchmove', (e) => {
        if (dragState.active || resizeState.active) {
            e.preventDefault();
            const coords = e.touches[0];
            onGlobalMove(coords.clientX, coords.clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onGlobalUp);
    window.addEventListener('touchcancel', onGlobalUp);
    window.globalListenersBound = true;
}