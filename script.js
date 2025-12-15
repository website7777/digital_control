// PC Control Frontend - JavaScript v2.0 (Cloud Edition)
// Работает через внешний сервер

// Конфигурация
let config = {
    serverUrl: localStorage.getItem('serverUrl') || '',
    token: localStorage.getItem('token') || '',
    username: localStorage.getItem('username') || '',
    selectedPcId: localStorage.getItem('selectedPcId') || ''
};

let confirmCallback = null;
let pcList = [];

// Нормализация URL (убираем trailing slash)
function normalizeUrl(url) {
    return url.replace(/\/+$/, '');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // Проверяем, авторизован ли пользователь
    if (!config.token || !config.serverUrl) {
        showLoginModal();
    } else {
        hideLoginModal();
        updateUserInfo();
        loadPCList();
    }
    
    // Заполняем сохраненный URL сервера
    const savedServer = localStorage.getItem('serverUrl') || '';
    document.getElementById('login-server').value = savedServer;
    document.getElementById('register-server').value = savedServer;
    document.getElementById('server-url').value = savedServer;
}

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            showSection(section);
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // PC selector
    document.getElementById('pc-selector').addEventListener('change', handlePCSelect);
    
    // Remote Desktop buttons
    const startBtn = document.getElementById('start-stream');
    const stopBtn = document.getElementById('stop-stream');
    const snapshotBtn = document.getElementById('snapshot-btn');
    
    if (startBtn) startBtn.addEventListener('click', startScreenStream);
    if (stopBtn) stopBtn.addEventListener('click', stopScreenStream);
    if (snapshotBtn) snapshotBtn.addEventListener('click', takeSnapshot);
    
    // Интервал стриминга
    const fpsSelect = document.getElementById('fps-select');
    if (fpsSelect) {
        fpsSelect.addEventListener('change', (e) => {
            const interval = parseInt(e.target.value) * 1000;
            if (streamInterval) {
                clearInterval(streamInterval);
                streamInterval = setInterval(updateScreen, interval);
            }
        });
    }
    
    // Стрелки прокрутки
    setupScrollArrows();
    
    // Canvas events
    const canvas = document.getElementById('screen-canvas');
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleCanvasRightClick);
    canvas.addEventListener('wheel', handleCanvasScroll);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
}

// ========== СТРЕЛКИ ПРОКРУТКИ ==========

let scrollIntervalId = null;
let isScrolling = false;

function setupScrollArrows() {
    // Увеличенные значения прокрутки (как 3 оборота колёсика)
    const arrows = {
        'scroll-up': { action: 'scroll', amount: 15 },
        'scroll-down': { action: 'scroll', amount: -15 },
        'scroll-left': { action: 'scroll_horizontal', amount: 15 },
        'scroll-right': { action: 'scroll_horizontal', amount: -15 }
    };
    
    Object.entries(arrows).forEach(([id, data]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        // Одиночный клик - одна прокрутка
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!config.selectedPcId) return;
            sendCommand('mouse', data);
        });
    });
}

// ========== АВТОРИЗАЦИЯ ==========

function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
}

function hideLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
}

function showLoginTab() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('modal-title').textContent = 'Вход в систему';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="login"]').classList.add('active');
}

function showRegisterTab() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('modal-title').textContent = 'Регистрация';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="register"]').classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    
    const serverUrl = document.getElementById('login-server').value.trim();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!serverUrl || !username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    showNotification('Вход...', 'info');
    
    // Нормализуем URL
    const normalizedUrl = normalizeUrl(serverUrl);
    
    try {
        const response = await fetch(`${normalizedUrl}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            config.serverUrl = normalizedUrl;
            config.token = data.token;
            config.username = data.username;
            
            localStorage.setItem('serverUrl', normalizedUrl);
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            
            hideLoginModal();
            updateUserInfo();
            loadPCList();
            showNotification(`Добро пожаловать, ${data.username}!`, 'success');
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification(`Ошибка подключения: ${error.message}`, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const serverUrl = document.getElementById('register-server').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    
    if (!serverUrl || !username || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (password !== password2) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    showNotification('Регистрация...', 'info');
    
    // Нормализуем URL
    const normalizedUrl = normalizeUrl(serverUrl);
    
    try {
        const response = await fetch(`${normalizedUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            config.serverUrl = normalizedUrl;
            config.token = data.token;
            config.username = data.username;
            
            localStorage.setItem('serverUrl', normalizedUrl);
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            
            hideLoginModal();
            updateUserInfo();
            showNotification(`Регистрация успешна! Добро пожаловать, ${data.username}!`, 'success');
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification(`Ошибка подключения: ${error.message}`, 'error');
    }
}

function handleLogout() {
    config.token = '';
    config.username = '';
    config.selectedPcId = '';
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('selectedPcId');
    
    stopScreenStream();
    showLoginModal();
    updateConnectionStatus(false);
    showNotification('Вы вышли из системы', 'info');
}

function updateUserInfo() {
    const userInfo = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('username-display');
    
    if (config.username) {
        userInfo.style.display = 'block';
        usernameDisplay.textContent = `👤 ${config.username}`;
    } else {
        userInfo.style.display = 'none';
    }
}

// ========== УПРАВЛЕНИЕ ПК ==========

async function loadPCList() {
    if (!config.token) return;
    
    try {
        const response = await fetch(`${config.serverUrl}/pc/list?token=${config.token}`);
        const data = await response.json();
        
        if (data.success) {
            pcList = data.pcs || [];
            updatePCSelector();
            updatePCListView();
            
            // Восстанавливаем выбранный ПК
            if (config.selectedPcId) {
                const pc = pcList.find(p => p.pc_id === config.selectedPcId);
                if (pc) {
                    document.getElementById('pc-selector').value = config.selectedPcId;
                    updateConnectionStatus(pc.status === 'online');
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки списка ПК:', error);
    }
}

function updatePCSelector() {
    const selector = document.getElementById('pc-selector');
    selector.innerHTML = '<option value="">Выберите ПК...</option>';
    
    pcList.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.pc_id;
        option.textContent = `${pc.pc_name} (${pc.status === 'online' ? '🟢' : '🔴'})`;
        selector.appendChild(option);
    });
}

function updatePCListView() {
    const listDiv = document.getElementById('pc-list');
    
    if (pcList.length === 0) {
        listDiv.innerHTML = '<p>Нет зарегистрированных ПК. Запустите pc_client.py на вашем ПК.</p>';
        return;
    }
    
    let html = '<table class="pc-table"><tr><th>Имя</th><th>Статус</th><th>Последняя активность</th></tr>';
    
    pcList.forEach(pc => {
        const statusIcon = pc.status === 'online' ? '🟢 Онлайн' : '🔴 Оффлайн';
        const lastSeen = pc.last_seen ? new Date(pc.last_seen).toLocaleString('ru-RU') : '-';
        html += `<tr>
            <td>${pc.pc_name || pc.pc_id}</td>
            <td>${statusIcon}</td>
            <td>${lastSeen}</td>
        </tr>`;
    });
    
    html += '</table>';
    listDiv.innerHTML = html;
}

function handlePCSelect(e) {
    const pcId = e.target.value;
    config.selectedPcId = pcId;
    localStorage.setItem('selectedPcId', pcId);
    
    if (pcId) {
        const pc = pcList.find(p => p.pc_id === pcId);
        if (pc) {
            updateConnectionStatus(pc.status === 'online');
            showNotification(`Выбран ПК: ${pc.pc_name}`, 'success');
        }
    } else {
        updateConnectionStatus(false);
    }
    
    // Останавливаем стриминг при смене ПК
    stopScreenStream();
}

function updateConnectionStatus(online) {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');

    if (online) {
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
        statusText.textContent = 'Подключено';
    } else {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
        statusText.textContent = 'Не подключено';
    }
}

// ========== API КОМАНДЫ ==========

async function sendCommand(commandType, commandData = {}) {
    if (!config.token || !config.selectedPcId) {
        showNotification('Выберите ПК для управления', 'error');
        return null;
    }
    
    try {
        const response = await fetch(`${config.serverUrl}/pc/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: config.token,
                pc_id: config.selectedPcId,
                command_type: commandType,
                command_data: commandData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Ждем результат
            return await waitForResult(data.command_id);
        } else {
            showNotification(data.error || 'Ошибка отправки команды', 'error');
            return null;
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');
        return null;
    }
}

async function waitForResult(commandId, maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
        try {
            const response = await fetch(
                `${config.serverUrl}/pc/result?token=${config.token}&pc_id=${config.selectedPcId}&command_id=${commandId}`
            );
            const data = await response.json();
            
            if (data.success && data.data && data.data.result) {
                return data.data.result;
            }
        } catch (error) {
            console.error('Error waiting for result:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    showNotification('Время ожидания ответа истекло', 'error');
    return null;
}

// ========== ФУНКЦИИ УПРАВЛЕНИЯ ==========

async function loadSystemInfo() {
    showNotification('Загрузка информации о системе...', 'info');
    const data = await sendCommand('system_info');

    if (data && data.status === 'success') {
        const info = data.info.replace(/\n/g, '<br>');
        document.getElementById('system-info').innerHTML = `<pre>${info}</pre>`;
        document.getElementById('system-details').innerHTML = `<pre>${info}</pre>`;
        showNotification('Информация о системе загружена', 'success');
    }
}

async function shutdownPC() {
    showConfirm(
        'Выключение ПК',
        'Вы уверены, что хотите выключить ПК?',
        async () => {
            const delay = parseInt(document.getElementById('shutdown-delay').value) || 0;
            const data = await sendCommand('shutdown', { delay });
            
            if (data && data.status === 'success') {
                showNotification(data.message, 'success');
            }
        }
    );
}

async function restartPC() {
    showConfirm(
        'Перезагрузка ПК',
        'Вы уверены, что хотите перезагрузить ПК?',
        async () => {
            const delay = parseInt(document.getElementById('shutdown-delay').value) || 0;
            const data = await sendCommand('restart', { delay });
            
            if (data && data.status === 'success') {
                showNotification(data.message, 'success');
            }
        }
    );
}

async function cancelShutdown() {
    const data = await sendCommand('cancel_shutdown');
    
    if (data && data.status === 'success') {
        showNotification(data.message, 'success');
    }
}

async function loadProcesses() {
    showNotification('Загрузка списка процессов...', 'info');
    const data = await sendCommand('list_processes');

    if (data && data.status === 'success') {
        const processList = data.processes.join('\n');
        document.getElementById('processes-list').innerHTML = `<pre>${processList}</pre>`;
        document.getElementById('apps-list').innerHTML = `<pre>${processList}</pre>`;
        showNotification('Список процессов обновлен', 'success');
    }
}

async function runApp(appName) {
    const data = await sendCommand('run_app', { name: appName });
    
    if (data && data.status === 'success') {
        showNotification(data.message, 'success');
    }
}

async function runCustomApp() {
    const appName = document.getElementById('app-name').value.trim();
    
    if (!appName) {
        showNotification('Пожалуйста, введите имя приложения', 'error');
        return;
    }

    const data = await sendCommand('run_app', { name: appName });
    
    if (data && data.status === 'success') {
        document.getElementById('app-name').value = '';
        showNotification(data.message, 'success');
    }
}

async function killProcess() {
    const processName = document.getElementById('process-name').value.trim();
    
    if (!processName) {
        showNotification('Пожалуйста, введите имя процесса', 'error');
        return;
    }

    showConfirm(
        'Завершить процесс',
        `Завершить процесс "${processName}"?`,
        async () => {
            const data = await sendCommand('kill_process', { name: processName });
            
            if (data && data.status === 'success') {
                document.getElementById('process-name').value = '';
                showNotification(data.message, 'success');
            }
        }
    );
}

async function executeCommand() {
    const command = document.getElementById('command-input').value.trim();
    
    if (!command) {
        showNotification('Пожалуйста, введите команду', 'error');
        return;
    }

    const output = document.getElementById('command-output');
    output.innerHTML = '<div class="spinner"></div> Выполнение команды...';

    const data = await sendCommand('execute_command', { command });
    
    if (data && data.status === 'success') {
        output.textContent = data.output || 'Команда выполнена. Нет вывода.';
        showNotification('Команда выполнена', 'success');
    } else {
        output.innerHTML = data?.message || 'Ошибка выполнения';
    }
}

function clearTerminal() {
    document.getElementById('command-output').textContent = '';
    document.getElementById('command-input').value = '';
}

async function loadLogs() {
    showNotification('Загрузка логов...', 'info');
    const data = await sendCommand('get_logs', { limit: 50 });

    if (data && data.status === 'success' && data.logs.length > 0) {
        const logsList = document.getElementById('logs-list');
        logsList.innerHTML = data.logs
            .reverse()
            .map(log => `
                <div class="log-entry">
                    <span class="log-timestamp">${new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                    <span class="log-action">${log.action}</span>
                    <span class="log-status ${log.status}">${log.status}</span>
                    <br>
                    <small>${log.details || log.command}</small>
                </div>
            `)
            .join('');
        showNotification('Логи загружены', 'success');
    } else {
        document.getElementById('logs-list').innerHTML = '<p>Логи отсутствуют</p>';
    }
}

async function clearLogs() {
    showConfirm(
        'Очистить логи',
        'Вы уверены, что хотите очистить все логи?',
        async () => {
            const data = await sendCommand('clear_logs');
            
            if (data && data.status === 'success') {
                document.getElementById('logs-list').innerHTML = '<p>Логи очищены</p>';
                showNotification(data.message, 'success');
            }
        }
    );
}

function saveSettings() {
    const serverUrl = document.getElementById('server-url').value.trim();

    if (serverUrl) {
        config.serverUrl = serverUrl;
        localStorage.setItem('serverUrl', serverUrl);
    }

    showNotification('Настройки сохранены', 'success');
}

// ========== REMOTE DESKTOP ==========

let isStreaming = false;
let streamInterval = null;
let screenCanvas = null;
let screenCtx = null;
let screenInfo = { width: 0, height: 0 };
let frameCount = 0;
let fpsUpdateTime = Date.now();
let actualFps = 0;

async function startScreenStream() {
    if (isStreaming) return;
    if (!config.selectedPcId) {
        showNotification('Выберите ПК для просмотра', 'error');
        return;
    }
    
    screenCanvas = document.getElementById('screen-canvas');
    screenCtx = screenCanvas.getContext('2d');
    
    // Отправляем команду на ПК начать стриминг
    const result = await sendCommand('start_stream');
    if (!result || result.status !== 'success') {
        showNotification('Не удалось запустить стриминг', 'error');
        return;
    }
    
    isStreaming = true;
    document.getElementById('start-stream').style.display = 'none';
    document.getElementById('stop-stream').style.display = 'inline-block';
    document.getElementById('screen-loading').style.display = 'none';
    
    updateStreamStatus('Транслируется (облачный режим)');
    
    // Получаем интервал из селектора
    const fpsSelect = document.getElementById('fps-select');
    const interval = fpsSelect ? parseInt(fpsSelect.value) * 1000 : 3000;
    
    // Запускаем получение экрана с выбранным интервалом
    streamInterval = setInterval(updateScreen, interval);
    
    // Первый кадр сразу
    updateScreen();
}

// Одиночный снимок экрана (быстрее чем стриминг)
async function takeSnapshot() {
    if (!config.selectedPcId) {
        showNotification('Выберите ПК', 'error');
        return;
    }
    
    const btn = document.getElementById('snapshot-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Загрузка...';
    
    try {
        // Инициализация canvas если нужно
        if (!screenCanvas) {
            screenCanvas = document.getElementById('screen-canvas');
            screenCtx = screenCanvas.getContext('2d');
        }
        
        document.getElementById('screen-loading').style.display = 'none';
        
        const response = await fetch(
            `${config.serverUrl}/pc/screen?token=${config.token}&pc_id=${config.selectedPcId}`,
            { timeout: 15000 }
        );
        const data = await response.json();
        
        if (data.success && data.image) {
            const img = new Image();
            img.onload = () => {
                screenCanvas.width = img.width;
                screenCanvas.height = img.height;
                screenCtx.drawImage(img, 0, 0);
                updateStreamStatus('Снимок получен');
            };
            img.src = 'data:image/jpeg;base64,' + data.image;
            showNotification('Снимок получен', 'success');
        } else {
            showNotification('Нет изображения', 'error');
            document.getElementById('screen-loading').style.display = 'flex';
        }
    } catch (error) {
        console.error('Snapshot error:', error);
        showNotification('Ошибка получения снимка', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '📷 Снимок';
    }
}

async function stopScreenStream() {
    if (!isStreaming) return;
    
    isStreaming = false;
    
    if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
    }
    
    // Отправляем команду на ПК остановить стриминг
    if (config.selectedPcId) {
        sendCommand('stop_stream');
    }
    
    document.getElementById('start-stream').style.display = 'inline-block';
    document.getElementById('stop-stream').style.display = 'none';
    document.getElementById('screen-loading').style.display = 'flex';
    
    updateStreamStatus('');
    
    if (screenCtx) {
        screenCtx.clearRect(0, 0, screenCanvas.width, screenCanvas.height);
    }
}

async function updateScreen() {
    if (!isStreaming) return;
    
    const startTime = performance.now();
    
    try {
        const response = await fetch(
            `${config.serverUrl}/pc/screen?token=${config.token}&pc_id=${config.selectedPcId}`
        );
        const data = await response.json();
        
        if (data.success && data.image) {
            const img = new Image();
            img.onload = () => {
                if (screenCanvas.width !== data.width || screenCanvas.height !== data.height) {
                    screenCanvas.width = data.width;
                    screenCanvas.height = data.height;
                    screenInfo.width = data.width;
                    screenInfo.height = data.height;
                    updateScreenResolution();
                }
                
                screenCtx.drawImage(img, 0, 0, data.width, data.height);
                
                // FPS counter
                frameCount++;
                const now = Date.now();
                if (now - fpsUpdateTime >= 1000) {
                    actualFps = frameCount;
                    frameCount = 0;
                    fpsUpdateTime = now;
                    updateStreamFps();
                }
                
                const latency = performance.now() - startTime;
                updateStreamLatency(latency);
            };
            img.src = 'data:image/jpeg;base64,' + data.image;
        }
    } catch (error) {
        console.error('Ошибка обновления экрана:', error);
    }
}

// Mouse/Touch handlers
let touchStartTime = 0;
let touchStartPos = { x: 0, y: 0 };
let lastClickTime = 0;
let lastWheelScrollTime = 0;

function handleCanvasClick(event) {
    if (!isStreaming) return;
    
    // Throttle клики (не чаще 500ms)
    const now = Date.now();
    if (now - lastClickTime < 500) return;
    lastClickTime = now;
    
    const rect = screenCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    sendCommand('mouse', { action: 'click', x, y });
}

function handleCanvasRightClick(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    // Throttle клики
    const now = Date.now();
    if (now - lastClickTime < 500) return;
    lastClickTime = now;
    
    const rect = screenCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    sendCommand('mouse', { action: 'right_click', x, y });
}

function handleCanvasScroll(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    // Throttle прокрутки колёсиком (не чаще 150ms)
    const now = Date.now();
    if (now - lastWheelScrollTime < 150) return;
    lastWheelScrollTime = now;
    
    // Увеличенная прокрутка: -10/+10 вместо -3/+3
    const amount = event.deltaY > 0 ? -10 : 10;
    sendCommand('mouse', { action: 'scroll', amount });
}

function handleTouchStart(event) {
    event.preventDefault();
    if (!isStreaming && !screenCanvas) return;
    
    touchStartTime = Date.now();
    const touch = event.touches[0];
    const rect = screenCanvas.getBoundingClientRect();
    touchStartPos.x = touch.clientX;
    touchStartPos.y = touch.clientY;
    touchStartPos.relX = (touch.clientX - rect.left) / rect.width;
    touchStartPos.relY = (touch.clientY - rect.top) / rect.height;
    touchStartPos.lastY = touch.clientY;
    touchStartPos.isScrolling = false;
}

// Обработка свайпа для прокрутки
let scrollAccumulator = 0;
const SCROLL_THRESHOLD = 50; // Минимальное расстояние для прокрутки
let lastScrollTime = 0;
const SCROLL_THROTTLE = 200; // Минимальный интервал между командами прокрутки (ms)

function handleTouchMove(event) {
    event.preventDefault();
    if (!isStreaming && !screenCanvas) return;
    
    const touch = event.touches[0];
    const deltaY = touchStartPos.lastY - touch.clientY;
    
    // Накапливаем движение
    scrollAccumulator += deltaY;
    
    const now = Date.now();
    
    // Если накопили достаточно И прошло достаточно времени
    if (Math.abs(scrollAccumulator) >= SCROLL_THRESHOLD && (now - lastScrollTime) >= SCROLL_THROTTLE) {
        // Увеличенная прокрутка: -10/+10 вместо -3/+3
        const scrollAmount = scrollAccumulator > 0 ? -10 : 10; // Инвертируем для естественной прокрутки
        sendCommand('mouse', { action: 'scroll', amount: scrollAmount });
        scrollAccumulator = 0;
        lastScrollTime = now;
        touchStartPos.isScrolling = true;
    }
    
    touchStartPos.lastY = touch.clientY;
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!isStreaming && !screenCanvas) return;
    
    const touchDuration = Date.now() - touchStartTime;
    
    // Если был свайп - не делаем клик
    if (touchStartPos.isScrolling) {
        scrollAccumulator = 0;
        return;
    }
    
    // Проверяем throttle для кликов (не чаще 500ms)
    const now = Date.now();
    if (now - lastClickTime < 500) {
        return;
    }
    lastClickTime = now;
    
    // Короткое нажатие - клик
    if (touchDuration < 300) {
        sendCommand('mouse', { action: 'click', x: touchStartPos.relX, y: touchStartPos.relY });
    } 
    // Длинное нажатие - правый клик
    else if (touchDuration > 800) {
        sendCommand('mouse', { action: 'right_click', x: touchStartPos.relX, y: touchStartPos.relY });
    }
    
    scrollAccumulator = 0;
}

function handleKeyDown(event) {
    const desktopSection = document.getElementById('desktop');
    if (!isStreaming || !desktopSection.classList.contains('active')) return;
    
    event.preventDefault();
    sendCommand('keyboard', { action: 'press', key: event.key });
}

function updateStreamStatus(text) {
    document.getElementById('stream-status').textContent = text;
}

function updateScreenResolution() {
    document.getElementById('screen-resolution').textContent = 
        `Разрешение: ${screenInfo.width}x${screenInfo.height}`;
}

function updateStreamFps() {
    document.getElementById('stream-fps').textContent = `FPS: ${actualFps}`;
}

function updateStreamLatency(ms) {
    document.getElementById('stream-latency').textContent = `Задержка: ${Math.round(ms)}ms`;
}

// ========== UI HELPERS ==========

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
    }

    const titles = {
        'desktop': 'Удаленный рабочий стол',
        'dashboard': 'Главная',
        'clipboard': 'Буфер обмена',
        'voice': 'Голосовое управление',
        'ai': 'AI Ассистент',
        'media': 'Медиа / Громкость',
        'system': 'Система',
        'applications': 'Приложения',
        'terminal': 'Терминал',
        'keyboard': 'Горячие клавиши',
        'browser': 'Браузер',
        'logs': 'Логи',
        'settings': 'Настройки'
    };
    document.getElementById('page-title').textContent = titles[sectionId] || 'Главная';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showConfirm(title, message, callback) {
    confirmCallback = callback;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('active');
}

function confirmAction() {
    closeConfirmModal();
    if (confirmCallback) {
        confirmCallback();
        confirmCallback = null;
    }
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

// Auto-refresh PC list every 15 seconds
setInterval(() => {
    if (config.token) {
        loadPCList();
    }
}, 15000);

// ========== CLIPBOARD SYNC FUNCTIONS ==========

async function sendClipboardText() {
    const text = document.getElementById('clipboard-text').value.trim();
    if (!text) {
        showNotification('Введите текст для отправки', 'error');
        return;
    }
    
    showNotification('Отправка текста...', 'info');
    const data = await sendCommand('clipboard_set', { content: text, type: 'text' });
    
    if (data && data.status === 'success') {
        showNotification('Текст отправлен в буфер обмена ПК', 'success');
        document.getElementById('clipboard-text').value = '';
    }
}

async function getClipboardText() {
    showNotification('Получение текста из буфера...', 'info');
    const data = await sendCommand('clipboard_get', { type: 'text' });
    
    if (data && data.status === 'success') {
        const content = data.content || 'Буфер пуст';
        document.getElementById('clipboard-content').innerHTML = `<pre>${escapeHtml(content)}</pre>`;
        showNotification('Текст получен', 'success');
    }
}

async function getClipboardImage() {
    showNotification('Получение изображения...', 'info');
    const data = await sendCommand('clipboard_get', { type: 'image' });
    
    if (data && data.status === 'success' && data.image) {
        document.getElementById('clipboard-image').innerHTML = 
            `<img src="data:image/png;base64,${data.image}" style="max-width: 100%; border-radius: 8px;">`;
        showNotification('Изображение получено', 'success');
    } else {
        document.getElementById('clipboard-image').innerHTML = '<p>Нет изображения в буфере</p>';
    }
}

async function sendClipboardImage(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64 = e.target.result.split(',')[1];
        showNotification('Отправка изображения...', 'info');
        
        const data = await sendCommand('clipboard_set', { content: base64, type: 'image' });
        
        if (data && data.status === 'success') {
            showNotification('Изображение отправлено в буфер ПК', 'success');
        }
    };
    reader.readAsDataURL(file);
    input.value = '';
}

async function getClipboardHistory() {
    const data = await sendCommand('clipboard_history', { limit: 20 });
    
    if (data && data.status === 'success' && data.history) {
        const historyDiv = document.getElementById('clipboard-history');
        historyDiv.innerHTML = data.history.map(item => `
            <div class="log-entry">
                <span class="log-timestamp">${new Date(item.timestamp).toLocaleString('ru-RU')}</span>
                <span class="log-action">${item.type === 'image' ? '🖼️ Изображение' : '📝 Текст'}</span>
                <br><small>${item.preview || ''}</small>
            </div>
        `).join('');
    }
}

// ========== VOICE CONTROL FUNCTIONS ==========

async function startVoice() {
    const data = await sendCommand('voice_control', { action: 'start' });
    
    if (data && data.status === 'success') {
        updateVoiceStatus(true);
        showNotification('Голосовое управление включено', 'success');
    }
}

async function stopVoice() {
    const data = await sendCommand('voice_control', { action: 'stop' });
    
    if (data && data.status === 'success') {
        updateVoiceStatus(false);
        showNotification('Голосовое управление выключено', 'success');
    }
}

async function toggleVoice() {
    const data = await sendCommand('voice_control', { action: 'toggle' });
    
    if (data && data.status === 'success') {
        updateVoiceStatus(data.enabled);
        showNotification(`Голосовое управление ${data.enabled ? 'включено' : 'выключено'}`, 'success');
    }
}

function updateVoiceStatus(enabled) {
    const statusIcon = document.querySelector('#voice-status .status-icon');
    const statusText = document.getElementById('voice-status-text');
    
    if (enabled) {
        statusIcon.textContent = '🟢';
        statusText.textContent = 'Голос активен';
    } else {
        statusIcon.textContent = '🔴';
        statusText.textContent = 'Голос выключен';
    }
}

async function speakText() {
    const text = document.getElementById('tts-text').value.trim();
    if (!text) {
        showNotification('Введите текст для озвучки', 'error');
        return;
    }
    
    const data = await sendCommand('tts', { action: 'speak', text: text });
    
    if (data && data.status === 'success') {
        showNotification('Текст озвучивается на ПК', 'success');
    }
}

async function stopTTS() {
    const data = await sendCommand('tts', { action: 'stop' });
    
    if (data && data.status === 'success') {
        showNotification('Озвучка остановлена', 'success');
    }
}

async function sendVoiceCommand() {
    const command = document.getElementById('voice-command').value.trim();
    if (!command) {
        showNotification('Введите команду', 'error');
        return;
    }
    
    const data = await sendCommand('voice_command', { command: command });
    
    if (data && data.status === 'success') {
        showNotification('Команда выполнена', 'success');
        document.getElementById('voice-command').value = '';
    }
}

// ========== AI ASSISTANT FUNCTIONS ==========

async function askAI() {
    const question = document.getElementById('ai-question').value.trim();
    if (!question) {
        showNotification('Введите вопрос', 'error');
        return;
    }
    
    document.getElementById('ai-response').innerHTML = '<div class="spinner"></div> AI думает...';
    showNotification('Отправка запроса в AI...', 'info');
    
    const data = await sendCommand('openai_query', { question: question });
    
    if (data && data.status === 'success') {
        document.getElementById('ai-response').innerHTML = `<p>${escapeHtml(data.answer)}</p>`;
        showNotification('Ответ получен', 'success');
    } else {
        document.getElementById('ai-response').innerHTML = '<p>Ошибка получения ответа</p>';
    }
}

async function askAIWithClipboard() {
    const question = document.getElementById('ai-question').value.trim() || 'Проанализируй этот текст';
    
    document.getElementById('ai-response').innerHTML = '<div class="spinner"></div> AI думает...';
    showNotification('Получение текста из буфера и отправка в AI...', 'info');
    
    const data = await sendCommand('openai_query', { question: question, use_clipboard: true });
    
    if (data && data.status === 'success') {
        document.getElementById('ai-response').innerHTML = `<p>${escapeHtml(data.answer)}</p>`;
        showNotification('Ответ получен', 'success');
    } else {
        document.getElementById('ai-response').innerHTML = '<p>Ошибка получения ответа</p>';
    }
}

async function askAIVision() {
    const question = document.getElementById('vision-question').value.trim() || 'Что изображено на картинке?';
    
    document.getElementById('vision-response').innerHTML = '<div class="spinner"></div> AI анализирует изображение...';
    showNotification('Анализ изображения...', 'info');
    
    const data = await sendCommand('openai_vision', { question: question });
    
    if (data && data.status === 'success') {
        document.getElementById('vision-response').innerHTML = `<p>${escapeHtml(data.answer)}</p>`;
        showNotification('Анализ завершен', 'success');
    } else {
        document.getElementById('vision-response').innerHTML = '<p>Ошибка анализа изображения</p>';
    }
}

async function translateText() {
    const text = document.getElementById('translate-text').value.trim();
    const lang = document.getElementById('translate-lang').value;
    
    if (!text) {
        showNotification('Введите текст для перевода', 'error');
        return;
    }
    
    document.getElementById('translate-result').innerHTML = '<div class="spinner"></div> Перевод...';
    
    const data = await sendCommand('translate', { text: text, dest: lang });
    
    if (data && data.status === 'success') {
        document.getElementById('translate-result').innerHTML = `<p><strong>Перевод:</strong><br>${escapeHtml(data.translation)}</p>`;
        showNotification('Перевод выполнен', 'success');
    } else {
        document.getElementById('translate-result').innerHTML = '<p>Ошибка перевода</p>';
    }
}

async function translateFromClipboard() {
    const lang = document.getElementById('translate-lang').value;
    
    document.getElementById('translate-result').innerHTML = '<div class="spinner"></div> Получение и перевод...';
    
    const data = await sendCommand('translate', { use_clipboard: true, dest: lang });
    
    if (data && data.status === 'success') {
        document.getElementById('translate-text').value = data.original || '';
        document.getElementById('translate-result').innerHTML = `<p><strong>Перевод:</strong><br>${escapeHtml(data.translation)}</p>`;
        showNotification('Перевод выполнен', 'success');
    } else {
        document.getElementById('translate-result').innerHTML = '<p>Ошибка перевода</p>';
    }
}

// ========== MEDIA & VOLUME FUNCTIONS ==========

async function volumeUp() {
    const data = await sendCommand('volume', { action: 'up' });
    if (data && data.status === 'success') {
        showNotification('Громкость увеличена', 'success');
    }
}

async function volumeDown() {
    const data = await sendCommand('volume', { action: 'down' });
    if (data && data.status === 'success') {
        showNotification('Громкость уменьшена', 'success');
    }
}

async function volumeMute() {
    const data = await sendCommand('volume', { action: 'mute' });
    if (data && data.status === 'success') {
        showNotification('Звук переключен', 'success');
    }
}

async function pressSpace() {
    const data = await sendCommand('keyboard', { action: 'press', key: 'space' });
    if (data && data.status === 'success') {
        showNotification('Пробел нажат', 'success');
    }
}

async function pressEnter() {
    const data = await sendCommand('keyboard', { action: 'press', key: 'enter' });
    if (data && data.status === 'success') {
        showNotification('Enter нажат', 'success');
    }
}

async function takeScreenshot() {
    showNotification('Создание скриншота...', 'info');
    const data = await sendCommand('screenshot', { return_image: true });
    
    if (data && data.status === 'success') {
        if (data.image) {
            document.getElementById('screenshot-preview').innerHTML = 
                `<img src="data:image/png;base64,${data.image}" style="max-width: 100%; border-radius: 8px;">`;
        }
        showNotification('Скриншот создан', 'success');
    }
}

async function getLastScreenshot() {
    const data = await sendCommand('get_screenshot', {});
    
    if (data && data.status === 'success' && data.image) {
        document.getElementById('screenshot-preview').innerHTML = 
            `<img src="data:image/png;base64,${data.image}" style="max-width: 100%; border-radius: 8px;">`;
        showNotification('Скриншот получен', 'success');
    }
}

async function sleepPC() {
    showConfirm(
        'Спящий режим',
        'Перевести ПК в спящий режим?',
        async () => {
            const data = await sendCommand('sleep', {});
            if (data && data.status === 'success') {
                showNotification('ПК переходит в спящий режим', 'success');
            }
        }
    );
}

// ========== KEYBOARD SHORTCUTS FUNCTIONS ==========

async function sendKeys(keys) {
    // Разбиваем строку комбинации на массив клавиш
    const keysArray = keys.split('+').map(k => k.trim());
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: keysArray });
    if (data && data.status === 'success') {
        showNotification(`Отправлено: ${keys}`, 'success');
    }
}

async function winPlusDigit(digit) {
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: ['win', String(digit)] });
    if (data && data.status === 'success') {
        showNotification(`Win+${digit} выполнено`, 'success');
    }
}

async function sendCustomKeys() {
    const keys = document.getElementById('custom-keys').value.trim();
    if (!keys) {
        showNotification('Введите комбинацию клавиш', 'error');
        return;
    }
    
    const keysArray = keys.split('+').map(k => k.trim());
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: keysArray });
    if (data && data.status === 'success') {
        showNotification(`Отправлено: ${keys}`, 'success');
        document.getElementById('custom-keys').value = '';
    }
}

// ========== BROWSER CONTROL FUNCTIONS ==========

async function newBrowserTab() {
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: ['ctrl', 't'] });
    if (data && data.status === 'success') {
        showNotification('Новая вкладка открыта', 'success');
    }
}

async function closeBrowserTab() {
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: ['ctrl', 'w'] });
    if (data && data.status === 'success') {
        showNotification('Вкладка закрыта', 'success');
    }
}

async function closeCurrentWindow() {
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: ['alt', 'f4'] });
    if (data && data.status === 'success') {
        showNotification('Окно закрыто', 'success');
    }
}

async function openTabByNumber(num) {
    const data = await sendCommand('keyboard', { action: 'hotkey', keys: ['ctrl', String(num)] });
    if (data && data.status === 'success') {
        showNotification(`Открыта вкладка ${num}`, 'success');
    }
}

async function googleSearch() {
    const query = document.getElementById('google-search').value.trim();
    if (!query) {
        showNotification('Введите поисковый запрос', 'error');
        return;
    }
    
    const data = await sendCommand('google_search', { query: query });
    if (data && data.status === 'success') {
        showNotification('Поиск выполнен', 'success');
        document.getElementById('google-search').value = '';
    }
}

async function openYoutube() {
    const data = await sendCommand('open_youtube', {});
    if (data && data.status === 'success') {
        showNotification('YouTube открыт', 'success');
    }
}

// ========== HELPER FUNCTIONS ==========

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
