// ========== 跨窗口消息处理 ==========
window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;
    if (data.type === 'closeWindow') {
        const win = windows.find(w => w.dom.querySelector('iframe') === e.source.frameElement);
        if (win) closeWindow(win);
    } else if (data.type === 'toggleDarkMode') {
        document.body.classList.toggle('dark-mode', data.enabled);
        if (window.updateCCDarkMode) window.updateCCDarkMode(data.enabled);
        windows.filter(w => w.app === 'settings').forEach(win => {
            const iframe = win.dom.querySelector('iframe');
            if (iframe && iframe.contentWindow && iframe.contentWindow !== e.source)
                iframe.contentWindow.postMessage({ type: 'syncDarkMode', enabled: data.enabled }, '*');
        });
        windows.filter(w => w.app === 'about').forEach(win => {
            const iframe = win.dom.querySelector('iframe');
            if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'darkMode', enabled: data.enabled }, '*');
        });
    } else if (data.type === 'showDesktopIcons') {
        const iconsDiv = document.querySelector('.desktop-icons');
        if (iconsDiv) iconsDiv.style.display = data.visible ? 'grid' : 'none';
    } else if (data.type === 'appStore') {
        const { action, payload } = data;
        if (action === 'registerApps') {
            if (window.AppStore?.registerCatalog) window.AppStore.registerCatalog(payload);
            if (e.source) e.source.postMessage({ type: 'appStore', action: 'installedList', apps: window.AppStore?.getInstalledIds() || [] }, '*');
        } else if (action === 'install') {
            if (window.AppStore?.install) window.AppStore.install(payload);
            if (e.source) e.source.postMessage({ type: 'appStore', action: 'installedList', apps: window.AppStore?.getInstalledIds() || [] }, '*');
        } else if (action === 'uninstall') {
            if (window.AppStore?.uninstall) window.AppStore.uninstall(payload);
            if (e.source) e.source.postMessage({ type: 'appStore', action: 'installedList', apps: window.AppStore?.getInstalledIds() || [] }, '*');
        } else if (action === 'openApp') {
            if (window.openApp) window.openApp(payload);
        } else if (action === 'getInstalledApps') {
            if (e.source) e.source.postMessage({ type: 'appStore', action: 'installedList', apps: window.AppStore?.getInstalledIds() || [] }, '*');
        } else if (action === 'installCustomApp') {
            if (window.AppStore?.installCustomApp) {
                window.AppStore.installCustomApp(payload).then(result => {
                    if (e.source) e.source.postMessage({ type: 'appStore', action: 'customAppInstalled', success: true, data: result }, '*');
                }).catch(err => {
                    if (e.source) e.source.postMessage({ type: 'appStore', action: 'customAppInstalled', success: false, error: err.message }, '*');
                });
            }
        }
    } else if (data.type === 'getDarkMode') {
        if (e.source) e.source.postMessage({ type: 'darkMode', enabled: document.body.classList.contains('dark-mode') }, '*');
    }
});
