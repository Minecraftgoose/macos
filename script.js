// ========== script.js - 完整版（今日壁纸 + 3秒开机） ==========
// 依赖顺序：utils, drag-resize, window-core, app-store, message

// 应用配置（内置应用）
const appConfig = {
    finder:   { title: "访达", src: "apps/finder.html", defaultW: 650, defaultH: 450, iconClass: "fas fa-folder", iconColor: "#007aff" },
    safari:   { title: "Safari", src: "apps/safari.html", defaultW: 700, defaultH: 480, iconClass: "fas fa-compass", iconColor: "#007aff" },
    calendar: { title: "日历", src: "apps/calendar.html", defaultW: 600, defaultH: 450, iconClass: "fas fa-calendar-alt", iconColor: "#ff3b30" },
    photos:   { title: "照片", src: "apps/photos.html", defaultW: 700, defaultH: 500, iconClass: "fas fa-images", iconColor: "#ff9500" },
    settings: { title: "设置", src: "apps/settings.html", defaultW: 600, defaultH: 450, iconClass: "fas fa-cog", iconColor: "#8e8e93" },
    weather:  { title: "天气", src: "apps/weather.html", defaultW: 700, defaultH: 480, iconClass: "fas fa-cloud-sun", iconColor: "#30d158" },
    yd:       { title: "有道", src: "https://youdao.com/", defaultW: 650, defaultH: 450, iconClass: "fas fa-language", iconColor: "#30d158" },
    about:    { title: "关于本机", src: "apps/about.html", defaultW: 500, defaultH: 400, iconClass: "fas fa-info-circle", iconColor: "#007aff" },
    quest:    { title: "待办", src: "apps/quest.html", defaultW: 500, defaultH: 400, iconClass: "fas fa-check-square", iconColor: "#ff9500" },
    xn:       { title: "小宁AI", src: "apps/xn.html", defaultW: 500, defaultH: 400, iconClass: "fas fa-robot", iconColor: "#007aff" },
    text:     { title: "测试", src: "apps/text.html", defaultW: 500, defaultH: 400, iconClass: "fas fa-file-alt", iconColor: "#007aff" },
    appstore: { title: "App Store", src: "apps/appstore.html", defaultW: 550, defaultH: 400, iconClass: "fas fa-store", iconColor: "#007aff" }
};
window.appConfig = appConfig;

// ========== 今日壁纸函数（每天一张，带缓存破坏） ==========
function setRandomWallpaper() {
    const desktop = document.querySelector('.desktop');
    if (!desktop) return;
    const t = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    // 改为今日壁纸（不带 rand_）
    const wallUrl = `https://bing.img.run/1920x1080.php?t=${t}`;
    desktop.style.backgroundImage = `url('${wallUrl}')`;
}

// 开机动画（3秒）
async function startBootAnimation() {
    const bootScreen = document.getElementById('boot-screen');
    if (!bootScreen) return;
    await new Promise(r => setTimeout(r, 3000));
    bootScreen.classList.add('hide-boot');
    setTimeout(() => bootScreen.style.display = 'none', 1500);
}

// 菜单栏初始化
function initMenuBar() {
    const aboutMenuItem = document.querySelector('.menu-item .submenu ul li:first-child a');
    if (aboutMenuItem && aboutMenuItem.textContent.includes('关于本机')) {
        aboutMenuItem.addEventListener('click', (e) => { e.preventDefault(); openApp('about'); });
    }
    const prefsMenuItem = document.getElementById('menu-settings');
    if (prefsMenuItem) {
        prefsMenuItem.addEventListener('click', (e) => { e.preventDefault(); openApp('settings'); });
    }
    document.querySelectorAll('.menu-item').forEach(menu => {
        const title = menu.querySelector('.menu-title');
        if (title && title.textContent === '文件') {
            const submenuItems = menu.querySelectorAll('.submenu li a');
            submenuItems.forEach(sub => {
                if (sub.textContent.includes('新建访达窗口')) sub.addEventListener('click', (e) => { e.preventDefault(); openApp('finder'); });
                if (sub.textContent.includes('新建文件夹')) sub.addEventListener('click', (e) => { e.preventDefault(); alert('新建文件夹（演示）'); });
                if (sub.textContent.includes('关闭')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow) closeWindow(activeWindow);
                        else alert('没有活动窗口');
                    });
                }
            });
        }
        if (title && title.textContent === '窗口') {
            const submenuItems = menu.querySelectorAll('.submenu li a');
            submenuItems.forEach(sub => {
                if (sub.textContent.includes('最小化')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow && !activeWindow.minimized) minimizeWindow(activeWindow);
                    });
                }
                if (sub.textContent.includes('缩放')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow) toggleFullscreen(activeWindow);
                    });
                }
            });
        }
    });
    const helpSearch = document.querySelector('.menu-item:last-child .submenu li a');
    if (helpSearch && helpSearch.textContent.includes('macOS 帮助')) {
        helpSearch.addEventListener('click', (e) => {
            e.preventDefault();
            openApp('about');
            setTimeout(() => {
                const aboutWin = windows.find(w => w.app === 'about' && !w.minimized);
                if (aboutWin) {
                    const iframe = aboutWin.dom.querySelector('iframe');
                    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'switchTab', tab: 'software' }, '*');
                }
            }, 500);
        });
    }

    // 三击 Apple logo 清理
    (function() {
        const appleLogo = document.querySelector('.menu-item:first-child .menu-title');
        if (!appleLogo) return;
        let clickCount = 0, clickTimer = null;
        appleLogo.addEventListener('click', (e) => {
            e.stopPropagation();
            clickCount++;
            if (clickCount === 1) {
                clickTimer = setTimeout(() => { clickCount = 0; }, 800);
            } else if (clickCount === 3) {
                clearTimeout(clickTimer);
                clickCount = 0;
                if (window.windows && Array.isArray(window.windows)) {
                    [...window.windows].forEach(win => { try { closeWindow(win); } catch(e) {} });
                }
                if (window.DockManager && window.DockManager.runningApps) {
                    window.DockManager.runningApps.forEach((state, appName) => {
                        if (state.dockItem && state.dockItem.parentNode) state.dockItem.remove();
                    });
                    window.DockManager.runningApps.clear();
                    window.DockManager.updatePlaceholder();
                }
                window.dynamicIsland?.notify({ title: '开发者模式', subtitle: '已强制清理所有窗口和动态Dock', duration: 2000 });
            }
        });
    })();
}

// 桌面图标初始化
function initDesktopIcons() {
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        if (icon.getAttribute('data-dock-bound') === 'true') return;
        const app = icon.getAttribute('data-app');
        if (app && app !== 'trash') {
            icon.setAttribute('data-dock-bound', 'true');
            icon.addEventListener('dblclick', () => openApp(app));
            let lastTap = 0;
            icon.addEventListener('touchstart', (e) => {
                const now = Date.now();
                if (now - lastTap < 300) { openApp(app); lastTap = 0; }
                else lastTap = now;
            });
        }
    });
}

// 更新时间
function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeElement = document.getElementById('current-time');
    if (timeElement) timeElement.textContent = timeStr;
}

// DOM 加载完成初始化
document.addEventListener('DOMContentLoaded', async () => {
    let attempts = 0;
    while (!window.AnimationManager && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (window.AnimationManager) console.log('AnimationManager 已加载');
    else console.warn('AnimationManager 未加载');

    bindGlobalDragResizeListeners();
    await startBootAnimation();
    setRandomWallpaper();   // 设置今日壁纸
    updateTime();
    setInterval(updateTime, 60000);
    initMenuBar();
    initDesktopIcons();

    console.log('macOS 网页版 v1.0.2');
});

// ========== 挂载全局 API ==========
setTimeout(() => {
    if (typeof window.enhancedOpenApp === 'function') {
        window.openApp = window.enhancedOpenApp;
        console.log('[script.js] openApp :', window.openApp.name);
    } else if (window.AppStore && window.AppStore.enhancedOpenApp) {
        window.openApp = window.AppStore.enhancedOpenApp;
        console.log('[script.js] openApp 已绑定为 AppStore');
    } else {
        console.warn('[script.js] 未找到');
    }
}, 0);

window.macOS = { openApp: () => window.openApp, windows, activeWindow, version: '3.0-fixed' };
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.restoreWindow = restoreWindow;
window.installApp = (appId) => window.AppStore?.install(appId);
window.uninstallApp = (appId) => window.AppStore?.uninstall(appId);
window.appConfig = appConfig;

window.addEventListener('islandRestoreWindow', (e) => {
    const appName = e.detail?.appName;
    if (!appName) return;
    const win = windows.find(w => w.app === appName && w.minimized);
    if (win && typeof restoreWindow === 'function') restoreWindow(win);
});

window.DynamicIslandAPI = {
    notify: (opts) => window.dynamicIsland?.notify(opts),
    status: (opts) => window.dynamicIsland?.status(opts),
    progress: (opts) => window.dynamicIsland?.progress(opts),
    setProgress: (value, text) => window.dynamicIsland?.setProgress(value, text),
    idle: () => window.dynamicIsland?.idle(),
    show: (mode, duration) => window.dynamicIsland?.notify({ title: mode || '提示', duration: duration || 3000 }),
    hide: () => window.dynamicIsland?.idle()
};