// siri.js
(function(){
    'use strict';
    
    let isProcessing = false;
    let chatHistory = [];
    const MAX_HISTORY = 20;
    
    const POLLINATIONS_API_KEY = 'sk_TOxWNstVMtFQPaUUYzF8bNXXiQ3IXinL';
    const POLLINATIONS_ENDPOINT = 'https://gen.pollinations.ai/v1/chat/completions';
    
    const ZHIPU_API_KEY = '9e541b61d67d4326a5408c3a7be3e22a.T8xvDySFI9bYykxI';
    const ZHIPU_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    const AGENT_MODEL = 'glm-4-flash';
    
    let agentModeEnabled = false;
    
    let siriPanel = document.getElementById('siri-panel');
    let siriTrigger = document.getElementById('siri-trigger');
    let siriInput = document.getElementById('siri-panel-input');
    let chatContainer = document.getElementById('siri-chat-container');
    
    // ========== 动态获取可用应用列表 ==========
    function getAvailableApps() {
        const apps = new Set();
        // 从 Dock 中收集
        document.querySelectorAll('.dock-item[data-app]').forEach(el => {
            const app = el.getAttribute('data-app');
            if (app) apps.add(app);
        });
        // 从桌面图标收集
        document.querySelectorAll('.desktop-icon[data-app]').forEach(el => {
            const app = el.getAttribute('data-app');
            if (app) apps.add(app);
        });
        return Array.from(apps);
    }
    
    // ========== 俏皮活泼的 System Prompt ==========
    const AGENT_SYSTEM_PROMPT = `你是 Siri，macOS 内置的智能助手。你性格活泼、有趣，但始终专业。你的回答要简短、亲切。

**说话风格**：
- 像好朋友一样自然，偶尔用“哇”、“嘿”、“好啦”、“搞定”等轻快的词。
- 多使用感叹号增加活力。
- 避免机械描述，不说“已打开访达”，而说“访达已经准备好啦！”

**函数调用规则**：
- 用户要求操作时，调用对应的函数（一次一个）。
- 函数执行后会告诉你结果，你需要据此生成自然回复。
- 禁止输出类似 "openApp(finder)" 的文字。

**可用函数**：
openApp, closeWindow, minimizeWindow, restoreWindow, setDarkMode, setBrightness, setVolume, lockScreen, sleep, showNotification, showProgress, updateProgress, showStatus, hideIsland, searchWeb

开始帮助用户。`;
    
    const NORMAL_SYSTEM_PROMPT = `你是 Siri，苹果智能助手。用简洁、友好、略带俏皮的中文回答。避免markdown。`;
    
    // ========== 定义 tools（去掉 openApp 的 enum 硬编码） ==========
    const AGENT_TOOLS = [
        { type: 'function', function: { name: 'openApp', description: '打开应用，应用名称请使用英文小写，例如 finder, safari, calendar, settings, weather, yd, about, quest, text 等', parameters: { type: 'object', properties: { appName: { type: 'string', description: '应用名称（英文小写）' } }, required: ['appName'] } } },
        { type: 'function', function: { name: 'closeWindow', description: '关闭窗口', parameters: { type: 'object', properties: { appName: { type: 'string' } } } } },
        { type: 'function', function: { name: 'minimizeWindow', description: '最小化窗口', parameters: { type: 'object', properties: { appName: { type: 'string' } } } } },
        { type: 'function', function: { name: 'restoreWindow', description: '恢复窗口', parameters: { type: 'object', properties: { appName: { type: 'string' } }, required: ['appName'] } } },
        { type: 'function', function: { name: 'setDarkMode', description: '深色模式', parameters: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } } },
        { type: 'function', function: { name: 'setBrightness', description: '亮度', parameters: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } } },
        { type: 'function', function: { name: 'setVolume', description: '音量', parameters: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] } } },
        { type: 'function', function: { name: 'lockScreen', description: '锁屏', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'sleep', description: '睡眠', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'showNotification', description: '显示临时通知', parameters: { type: 'object', properties: { title: { type: 'string' }, message: { type: 'string' } }, required: ['title'] } } },
        { type: 'function', function: { name: 'showProgress', description: '显示进度条', parameters: { type: 'object', properties: { title: { type: 'string' }, subtitle: { type: 'string' }, progress: { type: 'number' } }, required: ['title'] } } },
        { type: 'function', function: { name: 'updateProgress', description: '更新进度', parameters: { type: 'object', properties: { value: { type: 'number' }, text: { type: 'string' } }, required: ['value'] } } },
        { type: 'function', function: { name: 'showStatus', description: '显示持续状态', parameters: { type: 'object', properties: { title: { type: 'string' }, subtitle: { type: 'string' } }, required: ['title'] } } },
        { type: 'function', function: { name: 'hideIsland', description: '隐藏灵动岛内容', parameters: { type: 'object', properties: {} } } },
    ];
    
    // ========== 辅助函数 ==========
    function updatePanelPosition() {
        if (!siriTrigger || !siriPanel) return;
        const rect = siriTrigger.getBoundingClientRect();
        siriPanel.style.top = `${rect.bottom + 6}px`;
    }
    
    function addMessage(text, isUser = false, isTemp = false) {
        if (!chatContainer) return null;
        const bubble = document.createElement('div');
        bubble.className = isUser ? 'user-bubble' : 'siri-bubble';
        if (isTemp) bubble.classList.add('thinking');
        if (isTemp) {
            bubble.innerHTML = text + '<span class="thinking-dots"><span></span><span></span><span></span></span>';
        } else {
            bubble.textContent = text;
        }
        chatContainer.appendChild(bubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        if (!isTemp && !isUser) {
            chatHistory.push({ role: 'assistant', content: text });
            while (chatHistory.length > MAX_HISTORY) chatHistory.shift();
        }
        if (isUser) {
            chatHistory.push({ role: 'user', content: text });
            while (chatHistory.length > MAX_HISTORY) chatHistory.shift();
        }
        return bubble;
    }
    
    function clearChatHistory() {
        if (chatContainer) chatContainer.innerHTML = '';
        chatHistory = [];
    }
    
    function showIslandNotification(title, subtitle) {
        if (window.dynamicIsland && window.dynamicIsland.notify) {
            window.dynamicIsland.notify({ title: title, subtitle: subtitle || '', duration: 2000 });
        } else {
            console.warn('dynamicIsland not available');
        }
    }
    
    // 执行函数调用（支持动态应用列表）
    async function executeFunctionCall(funcName, args) {
        console.log(`[Agent] 执行 ${funcName}`, args);
        try {
            switch (funcName) {
                case 'openApp': {
                    let appName = args.appName;
                    if (!appName && typeof args === 'string') appName = args;
                    if (!appName) return '未指定应用名称';
                    appName = appName.toLowerCase();
                    const availableApps = getAvailableApps();
                    if (!availableApps.includes(appName)) {
                        return `未知应用: ${appName}。可用的应用有: ${availableApps.join(', ')}`;
                    }
                    if (window.openApp) window.openApp(appName);
                    return `打开了${appName}`;
                }
                case 'closeWindow': {
                    if (args.appName) {
                        const wins = window.windows?.filter(w => w.app === args.appName);
                        wins?.forEach(w => window.closeWindow?.(w));
                        return `关闭了${args.appName}的窗口`;
                    } else if (window.activeWindow) {
                        window.closeWindow?.(window.activeWindow);
                        return `关闭了当前窗口`;
                    }
                    return `没有可关闭的窗口`;
                }
                case 'minimizeWindow': {
                    if (args.appName) {
                        const wins = window.windows?.filter(w => w.app === args.appName);
                        wins?.forEach(w => window.minimizeWindow?.(w));
                        return `最小化了${args.appName}的窗口`;
                    } else if (window.activeWindow) {
                        window.minimizeWindow?.(window.activeWindow);
                        return `最小化了当前窗口`;
                    }
                    return `没有可最小化的窗口`;
                }
                case 'restoreWindow': {
                    if (args.appName) {
                        const wins = window.windows?.filter(w => w.app === args.appName && w.minimized);
                        wins?.forEach(w => window.restoreWindow?.(w));
                        return `恢复了${args.appName}的窗口`;
                    }
                    return `请指定应用名称`;
                }
                case 'setDarkMode': {
                    const enabled = args.enabled === true || args.enabled === 'true';
                    document.body.classList.toggle('dark-mode', enabled);
                    if (window.updateCCDarkMode) window.updateCCDarkMode(enabled);
                    return `已将主题设为${enabled ? '深色模式' : '浅色模式'}`;
                }
                case 'setBrightness': {
                    let val = parseFloat(args.value);
                    if (isNaN(val)) return '无效的亮度值';
                    val = Math.min(1, Math.max(0.3, val));
                    const desktop = document.querySelector('.desktop');
                    if (desktop) desktop.style.filter = `brightness(${val})`;
                    const cc = document.getElementById('control-center');
                    if (cc) cc.style.filter = `brightness(${Math.max(0.65, val)})`;
                    const slider = document.querySelector('.brightness-slider');
                    if (slider) slider.value = val;
                    return `亮度调整为${Math.round(val * 100)}%`;
                }
                case 'setVolume': {
                    let val = parseFloat(args.value);
                    if (isNaN(val)) return '无效的音量值';
                    val = Math.min(1, Math.max(0, val));
                    const slider = document.querySelector('.volume-slider');
                    if (slider) {
                        slider.value = val;
                        slider.dispatchEvent(new Event('input'));
                        return `音量调整为${Math.round(val * 100)}%`;
                    }
                    return `无法调节音量`;
                }
                case 'lockScreen': {
                    alert('屏幕已锁定');
                    return `屏幕已锁定`;
                }
                case 'sleep': {
                    alert('睡眠模式');
                    return `已进入睡眠模式`;
                }
                case 'showNotification': {
                    if (window.dynamicIsland && window.dynamicIsland.notify) {
                        window.dynamicIsland.notify({ title: args.title, subtitle: args.message || '', duration: 3000 });
                    }
                    return `显示了通知: ${args.title}`;
                }
                case 'showProgress': {
                    if (window.dynamicIsland && window.dynamicIsland.progress) {
                        window.dynamicIsland.progress({
                            title: args.title,
                            subtitle: args.subtitle || '处理中...',
                            progress: args.progress || 0,
                            progressText: `${args.progress || 0}%`
                        });
                    }
                    return `显示了进度条: ${args.title}`;
                }
                case 'updateProgress': {
                    if (window.dynamicIsland && window.dynamicIsland.setProgress) {
                        window.dynamicIsland.setProgress(args.value, args.text || `${args.value}%`);
                    }
                    return `进度更新到${args.value}%`;
                }
                case 'showStatus': {
                    if (window.dynamicIsland && window.dynamicIsland.status) {
                        window.dynamicIsland.status({ title: args.title, subtitle: args.subtitle || '' });
                    }
                    return `显示了状态: ${args.title}`;
                }
                case 'hideIsland': {
                    if (window.dynamicIsland && window.dynamicIsland.idle) {
                        window.dynamicIsland.idle();
                    }
                    return `灵动岛已恢复空闲`;
                }
                case 'searchWeb': {
                    if (window.openApp) {
                        window.openApp('safari');
                        setTimeout(() => {
                            const safariWin = window.windows?.find(w => w.app === 'safari' && !w.minimized);
                            if (safariWin) {
                                const iframe = safariWin.dom.querySelector('iframe');
                                if (iframe && iframe.contentWindow) {
                                    iframe.contentWindow.postMessage({ type: 'search', query: args.query }, '*');
                                }
                            }
                        }, 1000);
                    }
                    return `正在搜索: ${args.query}`;
                }
                default:
                    return `未知函数: ${funcName}`;
            }
        } catch (err) {
            console.error(`执行 ${funcName} 失败:`, err);
            return `执行失败: ${err.message}`;
        }
    }
    
    // 带重试的工具调用
    async function executeToolCallWithRetry(toolCall, retries = 2) {
        const funcName = toolCall.function.name;
        let args = {};
        try {
            args = JSON.parse(toolCall.function.arguments);
        } catch(e) {
            console.error('参数解析失败:', toolCall.function.arguments, e);
            return { success: false, error: '参数格式错误', funcName };
        }
        for (let i = 0; i <= retries; i++) {
            try {
                const result = await executeFunctionCall(funcName, args);
                return { success: true, result, funcName };
            } catch(err) {
                console.warn(`执行 ${funcName} 失败，重试 ${i}/${retries}`, err);
                if (i === retries) return { success: false, error: err.message, funcName };
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    
    // 生成自然回复
    async function generateNaturalReply(userMessage, toolResults) {
        if (!toolResults) return "搞定啦！";
        const shortResult = toolResults.length > 300 ? toolResults.slice(0, 300) + '…' : toolResults;
        const messages = [
            { role: "system", content: AGENT_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
            { role: "assistant", content: `[执行结果] ${shortResult}` },
            { role: "user", content: "请根据上面的执行结果，生成一句自然、俏皮、简短的回复告诉用户。直接回复，不要加引号或额外标记。" }
        ];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);
            const response = await fetch(ZHIPU_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${ZHIPU_API_KEY}`
                },
                body: JSON.stringify({
                    model: AGENT_MODEL,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 80
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) return `搞定啦！${shortResult}`;
            const data = await response.json();
            let reply = data.choices?.[0]?.message?.content?.trim() || `搞定啦！${shortResult}`;
            return reply.replace(/^["']|["']$/g, '');
        } catch (error) {
            console.error('生成自然回复失败:', error);
            return `搞定啦！${shortResult}`;
        }
    }
    
    // Agent 模式 API（支持多轮工具调用）
    async function fetchAgentResponse(userMessage) {
        const messages = [
            { role: "system", content: AGENT_SYSTEM_PROMPT },
            ...chatHistory.slice(-MAX_HISTORY),
            { role: "user", content: userMessage }
        ];
    
        let finalTextReply = null;
        let round = 0;
        const MAX_ROUNDS = 5;
        const toolResultsHistory = [];
        const thinkingBubble = addMessage("Agent 思考中...", false, true);
    
        while (round < MAX_ROUNDS && finalTextReply === null) {
            round++;
            console.log(`[Agent] 第 ${round} 轮调用`);
    
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 25000);
                const response = await fetch(ZHIPU_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${ZHIPU_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: AGENT_MODEL,
                        messages: messages,
                        tools: AGENT_TOOLS,
                        tool_choice: 'auto',
                        temperature: 0.1
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
    
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
                const data = await response.json();
                const assistantMsg = data.choices[0].message;
                console.log(`[Agent 第${round}轮]`, assistantMsg);
    
                if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
                    messages.push(assistantMsg);
                    const toolCallPromises = assistantMsg.tool_calls.map(tc => executeToolCallWithRetry(tc));
                    const execResults = await Promise.all(toolCallPromises);
                    const toolMessages = [];
                    for (let idx = 0; idx < assistantMsg.tool_calls.length; idx++) {
                        const tc = assistantMsg.tool_calls[idx];
                        const exec = execResults[idx];
                        const resultText = exec.success ? exec.result : `❌ 失败: ${exec.error}`;
                        toolResultsHistory.push({ tool: tc.function.name, result: resultText, success: exec.success });
                        toolMessages.push({
                            role: "tool",
                            tool_call_id: tc.id,
                            content: resultText
                        });
                    }
                    messages.push(...toolMessages);
                    if (thinkingBubble) {
                        const stepsDone = toolResultsHistory.map(h => `${h.tool}: ${h.success ? '✓' : '✗'}`).join(', ');
                        thinkingBubble.innerHTML = `执行中 (${stepsDone})<span class="thinking-dots"><span></span><span></span><span></span></span>`;
                    }
                    continue;
                }
                
                if (assistantMsg.content && assistantMsg.content.trim()) {
                    finalTextReply = assistantMsg.content.trim();
                    if (finalTextReply.match(/(openApp|closeWindow|setDarkMode)\s*\(/)) {
                        finalTextReply = "收到指令，马上处理！";
                    }
                    break;
                }
                
                if (!assistantMsg.content) {
                    finalTextReply = "好像出了点小问题，请再试一次~";
                    break;
                }
            } catch (err) {
                console.error(`Agent 第${round}轮请求失败:`, err);
                finalTextReply = "网络出了点问题，等会儿再试试吧。";
                break;
            }
        }
    
        if (thinkingBubble) thinkingBubble.remove();
        if (!finalTextReply) finalTextReply = "任务执行完毕！";
    
        if (toolResultsHistory.length > 0) {
            const enhancedReply = await generateNaturalReply(userMessage, 
                toolResultsHistory.map(h => `${h.tool}: ${h.result}`).join('；')
            );
            return enhancedReply;
        }
        return finalTextReply;
    }
    
    // 普通模式 API
    async function fetchAIResponse(userMessage) {
        const messages = [
            { role: "system", content: NORMAL_SYSTEM_PROMPT },
            ...chatHistory.slice(-MAX_HISTORY),
            { role: "user", content: userMessage }
        ];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);
            const response = await fetch(POLLINATIONS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${POLLINATIONS_API_KEY}` },
                body: JSON.stringify({ model: "openai-fast", messages, stream: false, temperature: 0.7 }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "抱歉，我没有理解。";
        } catch (error) {
            console.error('Pollinations error:', error);
            return "网络连接失败，请稍后重试。";
        }
    }
    
    // 本地批量指令处理
    async function handleLocalBatchCommand(text) {
        const lowerText = text.toLowerCase();
        if (/(打开|启动)\s*(所有|全部|每一个)\s*(应用|程序|软件)/.test(lowerText) ||
            /所有应用/.test(lowerText) ||
            /全部打开/.test(lowerText)) {
            addMessage(text, true);
            const apps = getAvailableApps();
            const results = [];
            for (const app of apps) {
                const result = await executeFunctionCall('openApp', { appName: app });
                results.push(result);
                await new Promise(r => setTimeout(r, 2000));
            }
            const combinedResult = results.join('；');
            const naturalReply = await generateNaturalReply(text, combinedResult);
            addMessage(naturalReply, false);
            return true;
        }
        if (/(关闭|最小化)\s*所有\s*窗口/.test(lowerText)) {
            addMessage(text, true);
            const wins = window.windows || [];
            const results = [];
            for (const win of wins) {
                if (window.closeWindow) {
                    window.closeWindow(win);
                    results.push(`关闭了${win.app}窗口`);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            const combined = results.join('；') || "没有打开的窗口";
            const naturalReply = await generateNaturalReply(text, combined);
            addMessage(naturalReply, false);
            return true;
        }
        return false;
    }
    
    // 用户输入处理
    async function handleUserInput(text) {
        if (!text.trim() || isProcessing) return;
        const trimmed = text.trim();
        
        if (trimmed === 'agent') {
            if (!agentModeEnabled) {
                agentModeEnabled = true;
                addMessage(text, true);
                addMessage("嘿！Agent 模式已开启。我现在可以帮你操作电脑和灵动岛啦！试试说“打开所有应用”或者“调高亮度”吧！", false);
                showIslandNotification("Agent 模式", "已开启");
            } else {
                addMessage(text, true);
                addMessage("Agent 模式已经是开启状态啦，不用重复开哦。", false);
            }
            if (siriInput) siriInput.value = '';
            return;
        }
        
        if (/^关闭\s*agent$/i.test(trimmed) || trimmed === '关闭 Agent') {
            if (agentModeEnabled) {
                agentModeEnabled = false;
                addMessage(text, true);
                addMessage("Agent 模式已关闭，我变回普通 Siri 啦。", false);
                showIslandNotification("Agent 模式", "已关闭");
            } else {
                addMessage(text, true);
                addMessage("Agent 模式本来就未开启哟。", false);
            }
            if (siriInput) siriInput.value = '';
            return;
        }
        
        const handled = await handleLocalBatchCommand(trimmed);
        if (handled) {
            if (siriInput) siriInput.value = '';
            return;
        }
        
        isProcessing = true;
        if (siriInput) siriInput.disabled = true;
        addMessage(text, true);
        siriInput.value = '';
        const thinkingBubble = addMessage("思考中", false, true);
        
        try {
            let aiReply;
            if (agentModeEnabled) {
                aiReply = await fetchAgentResponse(text);
            } else {
                aiReply = await fetchAIResponse(text);
            }
            thinkingBubble.remove();
            addMessage(aiReply, false);
        } catch (err) {
            console.error(err);
            thinkingBubble.remove();
            addMessage("哎呀，出错了，请检查网络后重试。", false);
        } finally {
            isProcessing = false;
            if (siriInput) siriInput.disabled = false;
            siriInput.focus();
        }
    }
    
    // 面板控制（保留对话历史）
    function openSiri() {
        if (!siriPanel) return;
        if (siriPanel.classList.contains('active')) return;
        if (chatContainer.children.length === 0 && chatHistory.length === 0) {
            const welcome = agentModeEnabled 
                ? "嘿嘿，Agent 模式已开！试试说“打开所有应用”或者“显示进度条”～" 
                : "有什么可以帮您的？";
            addMessage(welcome, false);
        }
        updatePanelPosition();
        siriPanel.classList.add('active');
        if (siriInput) {
            siriInput.disabled = false;
            siriInput.value = '';
            siriInput.focus();
        }
        window.addEventListener('scroll', updatePanelPosition, true);
        window.addEventListener('resize', updatePanelPosition);
    }
    
    function closeSiri() {
        if (!siriPanel) return;
        if (!siriPanel.classList.contains('active')) return;
        siriPanel.classList.remove('active');
        if (siriInput) siriInput.disabled = false;
        window.removeEventListener('scroll', updatePanelPosition, true);
        window.removeEventListener('resize', updatePanelPosition);
    }
    
    function toggleSiri() {
        if (siriPanel.classList.contains('active')) closeSiri();
        else openSiri();
    }
    
    function onInputKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isProcessing && siriInput.value.trim()) {
                handleUserInput(siriInput.value);
            }
        }
    }
    
    function onGlobalKeydown(e) {
        if ((e.metaKey || e.ctrlKey) && e.code === 'Space') {
            e.preventDefault();
            toggleSiri();
        }
        if (e.code === 'Escape' && siriPanel?.classList.contains('active')) {
            e.preventDefault();
            closeSiri();
        }
    }
    
    function init() {
        console.log('Siri 初始化');
        siriPanel = document.getElementById('siri-panel');
        siriTrigger = document.getElementById('siri-trigger');
        siriInput = document.getElementById('siri-panel-input');
        chatContainer = document.getElementById('siri-chat-container');
        if (!siriPanel || !siriTrigger) {
            console.error('缺少必要元素');
            return;
        }
        siriTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSiri();
        });
        document.addEventListener('keydown', onGlobalKeydown);
        if (siriInput) siriInput.addEventListener('keypress', onInputKeyPress);
        siriPanel.classList.remove('active');
        console.log('Siri 就绪，可用应用:', getAvailableApps());
    }
    
    window.Siri = { open: openSiri, close: closeSiri, toggle: toggleSiri, isOpen: () => siriPanel?.classList.contains('active') };
    
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();