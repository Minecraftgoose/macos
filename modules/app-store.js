// ========== 应用商店与动态安装（完整修复）==========
const INSTALLED_APPS_KEY = 'installedApps';
const INSTALLED_APPS_CONFIG_KEY = 'installedAppsConfig';
let availableApps = {};

const BUILTIN_APPS = [
    'finder', 'safari', 'calendar', 'photos', 'settings',
    'weather', 'yd', 'about', 'quest', 'xn', 'text', 'appstore'
];

function getCurrentInstalledIds() {
    return Object.keys(window.appConfig).filter(id => !BUILTIN_APPS.includes(id));
}

function saveInstalledApps() {
    localStorage.setItem(INSTALLED_APPS_KEY, JSON.stringify(getCurrentInstalledIds()));
}

function loadInstalledAppIds() {
    const stored = localStorage.getItem(INSTALLED_APPS_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveInstalledAppConfig(appId, config) {
    let allConfigs = JSON.parse(localStorage.getItem(INSTALLED_APPS_CONFIG_KEY) || '{}');
    allConfigs[appId] = config;
    localStorage.setItem(INSTALLED_APPS_CONFIG_KEY, JSON.stringify(allConfigs));
}

function removeInstalledAppConfig(appId) {
    let allConfigs = JSON.parse(localStorage.getItem(INSTALLED_APPS_CONFIG_KEY) || '{}');
    delete allConfigs[appId];
    localStorage.setItem(INSTALLED_APPS_CONFIG_KEY, JSON.stringify(allConfigs));
}

function loadAllInstalledAppConfigs() {
    return JSON.parse(localStorage.getItem(INSTALLED_APPS_CONFIG_KEY) || '{}');
}

function getFaviconUrlFromUrl(url) {
    if (!url) return null;
    try {
        const domain = new URL(url).hostname;
        return `https://favicon.im/${domain}`;
    } catch(e) { return null; }
}

function notifyAppStoreWindows() {
    const installedList = getCurrentInstalledIds();
    document.querySelectorAll('iframe').forEach(iframe => {
        try {
            if (iframe.contentWindow && iframe.src && iframe.src.includes('appstore.html')) {
                iframe.contentWindow.postMessage({
                    type: 'appStore',
                    action: 'installedList',
                    apps: installedList
                }, '*');
            }
        } catch(e) { /* 跨域忽略 */ }
    });
}

function addDesktopIcon(appId) {
    const app = window.appConfig[appId];
    if (!app) return;
    const desktopIcons = document.querySelector('.desktop-icons');
    if (!desktopIcons) return;
    if (desktopIcons.querySelector(`.desktop-icon[data-app="${appId}"]`)) return;

    let iconHtml = '';
    if (app.favicon) {
        iconHtml = `<img src="${app.favicon}" alt="${app.title}" style="width:50px;height:50px;object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><i class="${app.iconClass || 'fas fa-globe'}" style="display:none; font-size:50px; color:${app.iconColor || '#007aff'};"></i>`;
    } else {
        iconHtml = `<i class="${app.iconClass || 'fas fa-globe'}" style="font-size:50px; color:${app.iconColor || '#007aff'};"></i>`;
    }

    const newIcon = document.createElement('div');
    newIcon.className = 'desktop-icon';
    newIcon.setAttribute('data-app', appId);
    newIcon.setAttribute('data-type', 'app');
    newIcon.setAttribute('data-name', app.title);
    newIcon.innerHTML = `<div class="icon-container">${iconHtml}</div><span>${app.title}</span>`;

    newIcon.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (window.openApp) window.openApp(appId);
    });
    let lastTap = 0;
    newIcon.addEventListener('touchstart', (e) => {
        const t = Date.now();
        if (t - lastTap < 300) { window.openApp && window.openApp(appId); lastTap = 0; }
        else lastTap = t;
    });

    desktopIcons.appendChild(newIcon);
}

function removeDesktopIcon(appId) {
    const icon = document.querySelector(`.desktop-icon[data-app="${appId}"]`);
    if (icon) icon.remove();
}

function registerAvailableApps(catalog) {
    availableApps = catalog;
    console.log('[AppStore] 已注册应用目录:', Object.keys(availableApps));
}

// ========== 安装函数（增加即时反馈） ==========
async function installApp(appId) {
    console.log('[AppStore] 尝试安装:', appId, '当前目录:', Object.keys(availableApps));
    
    const appInfo = availableApps[appId];
    if (!appInfo) {
        const msg = `未找到应用: ${appId}`;
        console.warn(msg);
        window.dynamicIsland?.notify({ title: '安装失败', subtitle: msg, duration: 2000 });
        return false;
    }
    
    if (window.appConfig[appId]) {
        window.dynamicIsland?.notify({ title: appInfo.name, subtitle: '已经安装过了', duration: 1500 });
        return false;
    }

    // 开始安装通知
    window.dynamicIsland?.notify({ 
        title: `开始安装 ${appInfo.name}`, 
        subtitle: '正在准备...', 
        duration: 1500 
    });

    // 显示进度
    window.dynamicIsland?.progress({
        title: `正在下载 ${appInfo.name}`,
        subtitle: '0%',
        progress: 0,
        progressText: '0%'
    });

    const totalSteps = 20;
    for (let i = 1; i <= totalSteps; i++) {
        await new Promise(r => setTimeout(r, 80));
        const percent = Math.min(100, Math.round((i / totalSteps) * 100));
        window.dynamicIsland?.setProgress(percent, `${percent}%`);
    }

    const favicon = getFaviconUrlFromUrl(appInfo.url);
    const fullConfig = {
        title: appInfo.name,
        src: appInfo.url,
        defaultW: appInfo.defaultW || 800,
        defaultH: appInfo.defaultH || 600,
        isRemote: true,
        favicon: favicon,
        iconClass: appInfo.icon || 'fas fa-globe',
        iconColor: appInfo.iconColor || '#007aff'
    };
    window.appConfig[appId] = fullConfig;
    addDesktopIcon(appId);
    saveInstalledAppConfig(appId, fullConfig);
    saveInstalledApps();
    notifyAppStoreWindows();

    window.dynamicIsland?.setProgress(100, '完成');
    await new Promise(r => setTimeout(r, 600));
    window.dynamicIsland?.idle();
    window.dynamicIsland?.notify({ title: appInfo.name, subtitle: '已添加到桌面', duration: 2000 });
    
    console.log('[AppStore] 安装完成:', appId);
    return true;
}

function uninstallApp(appId) {
    if (BUILTIN_APPS.includes(appId)) {
        window.dynamicIsland?.notify({ title: '系统应用', subtitle: '不能卸载内置应用', duration: 1500 });
        return false;
    }

    const app = window.appConfig[appId];
    if (!app) {
        window.dynamicIsland?.notify({ title: '卸载失败', subtitle: '应用不存在', duration: 1500 });
        return false;
    }

    (window.windows || []).filter(w => w.app === appId).forEach(win => {
        if (typeof closeWindow === 'function') closeWindow(win);
    });

    delete window.appConfig[appId];
    removeDesktopIcon(appId);
    removeInstalledAppConfig(appId);
    saveInstalledApps();
    notifyAppStoreWindows();

    window.dynamicIsland?.notify({ title: app.title, subtitle: '已移除', duration: 1500 });
    return true;
}

function ensureAppStoreAvailable() {
    if (!window.appConfig) window.appConfig = {};
    const appStoreSrc = '../apps/appstore.html';
    if (!window.appConfig.appstore) {
        window.appConfig.appstore = {
            title: 'App Store',
            src: appStoreSrc,
            defaultW: 900,
            defaultH: 700,
            iconClass: 'fas fa-app-store',
            iconColor: '#007aff',
            favicon: null
        };
    }
    if (!document.querySelector(`.desktop-icon[data-app="appstore"]`)) {
        addDesktopIcon('appstore');
    }
}

function restoreInstalledAppsFromStorage() {
    const allConfigs = loadAllInstalledAppConfigs();
    for (const [appId, config] of Object.entries(allConfigs)) {
        if (!window.appConfig[appId]) {
            window.appConfig[appId] = { ...config };
            if (!window.appConfig[appId].iconClass) window.appConfig[appId].iconClass = 'fas fa-globe';
            if (!window.appConfig[appId].iconColor) window.appConfig[appId].iconColor = '#007aff';
            addDesktopIcon(appId);
        }
    }
    saveInstalledApps();
    notifyAppStoreWindows();
}

// ---------- 并发锁 ----------
const pendingOpenApps = new Set();

async function enhancedOpenApp(appName, options = {}) {
    if (pendingOpenApps.has(appName)) {
        console.log(`[AppStore] ${appName} 正在打开中，忽略重复请求`);
        return null;
    }
    pendingOpenApps.add(appName);

    try {
        if (window.windows) {
            window.windows = window.windows.filter(win => win && win.dom && document.body.contains(win.dom));
        }
        if (appName === 'appstore') ensureAppStoreAvailable();

        const existing = window.windows?.find(w => w.app === appName && !w.minimized);
        if (existing) {
            focusWindow(existing);
            window.dispatchEvent(new CustomEvent('appOpened', {
                detail: { appName: appName, windowId: existing.id }
            }));
            return existing;
        }
        const min = window.windows?.find(w => w.app === appName && w.minimized);
        if (min) {
            restoreWindow(min);
            focusWindow(min);
            window.dispatchEvent(new CustomEvent('appOpened', {
                detail: { appName: appName, windowId: min.id }
            }));
            return min;
        }

        const app = window.appConfig?.[appName];
        if (!app) {
            console.warn(`[AppStore] 未找到应用配置: ${appName}`);
            return null;
        }

        // 确保 Dock 图标已存在（非固定应用）
        if (window.DockManager && typeof window.DockManager.ensureAppIcon === 'function') {
            window.DockManager.ensureAppIcon(appName);
        }

        const offset = (window.windows?.length || 0) * 30;
        const left = options.left ?? (100 + offset);
        const top = options.top ?? (60 + offset);
        const width = options.width ?? (app.defaultW || 800);
        const height = options.height ?? (app.defaultH || 600);

        const winObj = await createWindow(appName, left, top, width, height);
        if (winObj) {
            if (window.windows) window.windows.push(winObj);
            updateBadge(appName);
            focusWindow(winObj);
            window.dispatchEvent(new CustomEvent('appOpened', {
                detail: { appName: appName, windowId: winObj.id }
            }));
            if (window.DockManager) {
                window.DockManager.registerWindow?.(appName, winObj.id);
            }
        }
        return winObj;
    } finally {
        pendingOpenApps.delete(appName);
    }
}

// ---------- 自定义应用安装 ----------
async function installCustomAppFromStore(appData) {
    const { name, type, content, iconUrl: providedIconUrl, id: customId } = appData;
    const appId = customId || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    window.dynamicIsland?.progress({
        title: `正在安装 ${name}`,
        subtitle: '0%',
        progress: 0,
        progressText: '0%'
    });

    let progressInterval;
    if (window.dynamicIsland) {
        let prog = 0;
        progressInterval = setInterval(() => {
            prog = Math.min(90, prog + 5);
            window.dynamicIsland.setProgress(prog, `${prog}%`);
        }, 100);
    }

    try {
        let finalHtml;
        if (type === 'url') {
            finalHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${name}</title>
<style>body{margin:0;height:100vh;overflow:hidden;}iframe{width:100%;height:100%;border:none;}</style>
</head>
<body>
<iframe src="${content}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation"></iframe>
<script>(function(){var d=document,s=d.createElement('style');s.textContent='[id*="sv-powered"],[class*="sv-powered"],#sv-powered-by,.sv-powered-by{display:none!important;height:0!important;opacity:0!important}';d.head.appendChild(s);var r=function(){var q=d.querySelectorAll('[id*="sv-powered"],[class*="sv-powered"]');for(var i=0;i<q.length;i++)q[i].remove();};r();new MutationObserver(function(){r();}).observe(d.body||d.documentElement,{childList:true,subtree:true});setTimeout(function(){s.remove();},3500);})();<\/script>
</body>
</html>`;
        } else {
            const shield = `<script>(function(){var d=document,s=d.createElement('style');s.textContent='[id*="sv-powered"],[class*="sv-powered"],#sv-powered-by,.sv-powered-by{display:none!important;height:0!important;opacity:0!important}';d.head.appendChild(s);var r=function(){var q=d.querySelectorAll('[id*="sv-powered"],[class*="sv-powered"]');for(var i=0;i<q.length;i++)q[i].remove();};r();new MutationObserver(function(){r();}).observe(d.body||d.documentElement,{childList:true,subtree:true});setTimeout(function(){s.remove();},3500);})();<\/script>`;
            const idx = content.lastIndexOf('</body>');
            finalHtml = idx !== -1 ? content.slice(0, idx) + shield + content.slice(idx) : content + shield;
        }

        const res = await fetch('https://freekit.dev/api/v1/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: finalHtml })
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') throw new Error(data.message || '创建失败');

        const siteUrl = data.data.url;
        const deleteToken = data.data.deleteToken;

        if (progressInterval) clearInterval(progressInterval);
        window.dynamicIsland?.setProgress(100, '完成');
        await new Promise(r => setTimeout(r, 500));
        window.dynamicIsland?.idle();
        window.dynamicIsland?.notify({ title: name, subtitle: '已添加至桌面', duration: 2000 });

        const favicon = providedIconUrl || getFaviconUrlFromUrl(siteUrl);
        window.appConfig[appId] = {
            title: name,
            src: siteUrl,
            defaultW: 800,
            defaultH: 600,
            isRemote: true,
            favicon: favicon,
            iconClass: favicon ? null : 'fas fa-globe',
            iconColor: '#007aff',
            deleteToken: deleteToken
        };
        addDesktopIcon(appId);
        saveInstalledAppConfig(appId, window.appConfig[appId]);
        saveInstalledApps();
        notifyAppStoreWindows();

        return { siteUrl, deleteToken, appId };
    } catch (err) {
        if (progressInterval) clearInterval(progressInterval);
        window.dynamicIsland?.idle();
        window.dynamicIsland?.notify({ title: '安装失败', subtitle: err.message, duration: 3000 });
        throw err;
    }
}

// ---------- 挂载全局 ----------
function setupGlobalAppFunctions() {
    window.enhancedOpenApp = enhancedOpenApp;
    if (typeof window.openApp !== 'function' || window.openApp.name !== 'enhancedOpenApp') {
        window.openApp = enhancedOpenApp;
    }
}

window.AppStore = {
    install: installApp,
    uninstall: uninstallApp,
    getInstalledIds: getCurrentInstalledIds,
    registerCatalog: registerAvailableApps,
    ensureBuiltinApps: ensureAppStoreAvailable,
    installCustomApp: installCustomAppFromStore,
    enhancedOpenApp: enhancedOpenApp
};

// 初始化
(function initAppStore() {
    ensureAppStoreAvailable();
    setupGlobalAppFunctions();
    restoreInstalledAppsFromStorage();
    window.addEventListener('load', () => {
        restoreInstalledAppsFromStorage();
        notifyAppStoreWindows();
    });
    console.log('[AppStore] 已初始化（修复版）');
})();