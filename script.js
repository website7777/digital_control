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
    
    if (startBtn) startBtn.addEventListener('click', startScreenStream);
    if (stopBtn) stopBtn.addEventListener('click', stopScreenStream);
    
    // Canvas events
    const canvas = document.getElementById('screen-canvas');
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleCanvasRightClick);
    canvas.addEventListener('wheel', handleCanvasScroll);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchend', handleTouchEnd);
    
    // Keyboard events
    document.addEventListener('keydown', handleKeyDown);
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
    
    updateStreamStatus('Транслируется');
    
    // Запускаем получение экрана
    streamInterval = setInterval(updateScreen, 500);
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

function handleCanvasClick(event) {
    if (!isStreaming) return;
    
    const rect = screenCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    sendCommand('mouse', { action: 'click', x, y });
}

function handleCanvasRightClick(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    const rect = screenCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    sendCommand('mouse', { action: 'right_click', x, y });
}

function handleCanvasScroll(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    const amount = event.deltaY > 0 ? -3 : 3;
    sendCommand('mouse', { action: 'scroll', amount });
}

function handleTouchStart(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    touchStartTime = Date.now();
    const touch = event.touches[0];
    const rect = screenCanvas.getBoundingClientRect();
    touchStartPos.x = (touch.clientX - rect.left) / rect.width;
    touchStartPos.y = (touch.clientY - rect.top) / rect.height;
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!isStreaming) return;
    
    const touchDuration = Date.now() - touchStartTime;
    
    if (touchDuration < 300) {
        sendCommand('mouse', { action: 'click', x: touchStartPos.x, y: touchStartPos.y });
    } else if (touchDuration > 800) {
        sendCommand('mouse', { action: 'right_click', x: touchStartPos.x, y: touchStartPos.y });
    }
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
        'system': 'Система',
        'applications': 'Приложения',
        'terminal': 'Терминал',
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
