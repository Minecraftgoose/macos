// 灵动岛
class DynamicIsland {
    constructor() {
        this.container = null;
        this.content = null;
        this.currentMode = 'idle';
        this.isExpanded = false;
        this.currentCardSize = 'small';
        this._currentData = {};
        this._modeTimeout = null;
        this.init();
    }
    init() {
        if (document.getElementById('dynamic-island')) return;
        this.container = document.createElement('div');
        this.container.id = 'dynamic-island';
        this.container.className = 'dynamic-island';
        this.container.innerHTML = '<div class="island-content"></div>';
        document.body.appendChild(this.container);
        this.content = this.container.querySelector('.island-content');
        this.container.addEventListener('click', (e) => this.handleClick(e));
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
        this.setMode('idle');
        this.listenAppMessages();
    }
    setMode(mode, data = {}) {
        this.currentMode = mode;
        let defaultCardSize = (mode === 'progress') ? 'large' : 'small';
        this._currentData = { cardSize: defaultCardSize, ...data };
        this.render();
        if (mode !== 'idle') {
            this.expand();
            if (mode === 'notify' && this._currentData.duration) {
                if (this._modeTimeout) clearTimeout(this._modeTimeout);
                this._modeTimeout = setTimeout(() => this.idle(), this._currentData.duration);
            }
        } else {
            this.collapse();
        }
    }
    render() {
        const mode = this.currentMode;
        const d = this._currentData;
        if (mode === 'idle') {
            // 空闲状态：只留背景光效，无脉冲点，无文字
            this.content.innerHTML = `<div class="island-idle"></div>`;
            return;
        }
        let compactHtml = '';
        let leftHtml = '', centerHtml = '', rightHtml = '';
        if (mode === 'notify') {
            compactHtml = `<div class="island-compact"><i class="fa-solid ${d.icon || 'fa-bell'}" style="color:${d.iconColor || '#007aff'}"></i><span>${d.title || '通知'}</span></div>`;
            leftHtml = `<div class="island-left"><div class="island-notification-icon" style="background:${d.iconColor || '#007aff'}"><i class="fa-solid ${d.icon || 'fa-bell'}" style="color:#fff;"></i></div></div>`;
            centerHtml = `<div class="island-center"><div class="island-title">${d.title || '通知'}</div>${d.subtitle ? `<div class="island-subtitle">${d.subtitle}</div>` : ''}</div>`;
            rightHtml = `<div class="island-right"><button class="island-btn island-btn-close" onclick="dynamicIsland.idle()"><i class="fa-solid fa-xmark"></i></button></div>`;
        } else if (mode === 'status') {
            compactHtml = `<div class="island-compact"><i class="fa-solid ${d.icon || 'fa-circle'}" style="color:${d.iconColor || '#34c759'}"></i><span>${d.title || '状态'}</span></div>`;
            leftHtml = `<div class="island-left"><div class="island-notification-icon" style="background:${d.iconColor || '#34c759'}"><i class="fa-solid ${d.icon || 'fa-circle'}" style="color:#fff;"></i></div></div>`;
            centerHtml = `<div class="island-center"><div class="island-title">${d.title || '状态'}</div>${d.subtitle ? `<div class="island-subtitle">${d.subtitle}</div>` : ''}</div>`;
            rightHtml = `<div class="island-right"></div>`;
        } else if (mode === 'progress') {
            const progress = Math.min(100, Math.max(0, d.progress || 0));
            compactHtml = `<div class="island-compact"><i class="fa-solid ${d.icon || 'fa-spinner'}" style="color:${d.iconColor || '#007aff'}"></i><span>${d.title || '加载中...'}</span></div>`;
            leftHtml = `<div class="island-left"><div class="island-notification-icon" style="background:${d.iconColor || '#007aff'}"><i class="fa-solid ${d.icon || 'fa-spinner'}" style="color:#fff;"></i></div></div>`;
            centerHtml = `<div class="island-center">
                            <div class="island-title">${d.title || '处理中...'}</div>
                            <div class="island-progress-track"><div class="island-progress-fill" style="width:${progress}%"></div></div>
                            ${d.progressText ? `<div class="island-subtitle">${d.progressText}</div>` : ''}
                          </div>`;
            rightHtml = `<div class="island-right"></div>`;
        }
        this.content.innerHTML = compactHtml + leftHtml + centerHtml + rightHtml;
    }
    notify(opts) { this.setMode('notify', opts); }
    status(opts) { this.setMode('status', opts); }
    progress(opts) { this.setMode('progress', opts); }
    setProgress(value, text) {
        if (typeof value === 'object' && value !== null) {
            text = value.text !== undefined ? value.text : text;
            value = value.value !== undefined ? value.value : 0;
        }
        value = Math.min(100, Math.max(0, Number(value) || 0));
        if (this.currentMode === 'progress') {
            this._currentData.progress = value;
            if (text !== undefined) this._currentData.progressText = text;
            this.render();
        }
    }
    idle() { this.setMode('idle'); }
    expand() {
        this.container.classList.remove('expanded-small', 'expanded-large');
        this.container.classList.add(`expanded-${this._currentData.cardSize}`);
        this.isExpanded = true;
    }
    collapse() {
        this.container.classList.remove('expanded-small', 'expanded-large');
        this.isExpanded = false;
    }
    handleClick(e) {
        if (e.target.closest('.island-btn')) return;
        if (this.currentMode !== 'idle') {
            this.isExpanded ? this.collapse() : this.expand();
        }
    }
    handleOutsideClick(e) {
        if (!this.container.contains(e.target) && this.isExpanded) this.collapse();
    }
    listenAppMessages() {
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'island') {
                const { action, payload } = e.data;
                if (this[action]) {
                    if (action === 'setProgress' && payload && typeof payload === 'object') {
                        this.setProgress(payload.value, payload.text);
                    } else if (['notify', 'status', 'progress'].includes(action)) {
                        this[action](payload || {});
                    } else {
                        this[action](payload);
                    }
                }
            }
        });
    }
}
window.dynamicIsland = new DynamicIsland();