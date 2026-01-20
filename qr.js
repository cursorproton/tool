document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultDiv = document.getElementById('result');
    
    // Инициализация ZXing
    let codeReader = null;
    let scanning = false;
    let stream = null;
    let zxingInitialized = false;
    
    // Устанавливаем атрибут willReadFrequently для повышения производительности
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Проверяем поддержку getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resultDiv.textContent = 'Ваш браузер не поддерживает доступ к камере';
        return;
    }

    // Инициализация ZXing
    function initZXing() {
        if (typeof ZXing === 'undefined') {
            console.error('Библиотека ZXing не загружена');
            resultDiv.innerHTML = `
                <div style="padding: 5px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
                    <strong>Ошибка загрузки библиотек сканирования</strong><br>
                    Библиотека ZXing не найдена. Проверьте, правильно ли подключен файл zxing.min.js.<br><br>
                    <button onclick="location.reload()" style="background-color: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Повторить попытку
                    </button>
                </div>
            `;
            return false;
        }
        
        try {
            // Используем BrowserMultiFormatReader для поддержки всех типов штрихкодов
            const { BrowserMultiFormatReader } = ZXing;
            codeReader = new BrowserMultiFormatReader();
            zxingInitialized = true;
            return true;
        } catch (error) {
            console.error('Ошибка инициализации ZXing:', error);
            resultDiv.innerHTML = `
                <div style="padding: 5px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
                    <strong>Ошибка инициализации сканера:</strong><br>
                    ${error.message}<br><br>
                    <button onclick="location.reload()" style="background-color: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Повторить попытку
                    </button>
                </div>
            `;
            return false;
        }
    }

    // Проверяем статус подключения к интернету
    window.addEventListener('offline', () => {
        console.log('Приложение перешло в автономный режим');
        showOfflineNotification();
        
        // Проверяем, что Service Worker контролирует страницу
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            console.log('Service Worker активен и обеспечивает автономную работу');
        } else {
            console.warn('Service Worker не контролирует страницу - возможны проблемы с автономной работой');
        }
    });

    window.addEventListener('online', () => {
        console.log('Приложение восстановило подключение к интернету');
        hideOfflineNotification();
    });
    
    // Проверяем статус подключения при загрузке страницы
    setTimeout(() => {
        if (!navigator.onLine) {
            showOfflineNotification();
        } else {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(() => {
                    console.log('Service Worker готов к работе');
                }).catch(error => {
                    console.error('Service Worker не готов:', error);
                });
            }
        }
    }, 1000);
    
    // Обработчик изменения видимости страницы
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(() => {
                if (!navigator.onLine) {
                    showOfflineNotification();
                } else {
                    hideOfflineNotification();
                }
            }, 500);
        }
    });

    function showOfflineNotification() {
        const existingNotification = document.getElementById('offline-notification');
        if (existingNotification) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.id = 'offline-notification';
        notification.innerHTML = `
            <div style="padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; color: #856404; margin-top: 10px;">
                <strong>Работа в автономном режиме</strong><br>
            </div>
        `;
        document.querySelector('.container').appendChild(notification);
    }

    function hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.remove();
        }
    }

    scanButton.addEventListener('click', () => {
        if (scanning) {
            stopScanning();
        } else {
            startScanning();
        }
    });

    function startScanning() {
        // Инициализируем ZXing если еще не инициализирован
        if (!zxingInitialized && !initZXing()) {
            return;
        }

        video.style.display = 'block';
        scanButton.textContent = 'Остановить сканирование';
        
        // Запрашиваем доступ к камере
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(mediaStream => {
                stream = mediaStream;
                video.srcObject = stream;
                video.setAttribute("playsinline", true);
                video.play();
                
                scanning = true;
                
                // Начинаем сканирование с помощью ZXing
                scanWithZXing();
            })
            .catch(err => {
                console.error("Ошибка доступа к камере: ", err);
                resultDiv.innerHTML = `
                    <div style="padding: 5px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
                        <strong>Ошибка доступа к камере:</strong><br>
                        ${err.message}<br><br>
                        <button onclick="location.reload()" style="background-color: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            Повторить попытку
                        </button>
                    </div>
                `;
                video.style.display = 'none';
            });
    }

    function stopScanning() {
        scanning = false;
        
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        
        video.style.display = 'none';
        scanButton.textContent = 'Сканировать';
    }
    
    function scanWithZXing() {
        if (!scanning || !codeReader) return;

        // Используем ZXing для сканирования видео
        codeReader.decodeFromVideoDevice(null, video, (result, err) => {
            if (result) {
                // Код успешно распознан
                const codeData = result.getText().trim();
                const codeFormat = result.getBarcodeFormat().toString();

                if (codeData !== '') {
                    // Проверяем, не встречался ли уже такой код
                    const existingResults = Array.from(resultDiv.children);
                    const isDuplicate = existingResults.some(child => child.textContent.includes(codeData));

                    if (!isDuplicate) {
                        // Создаем элемент для нового кода
                        const newResultElement = document.createElement('div');
                        newResultElement.style.padding = '5px';
                        newResultElement.style.backgroundColor = '#d4edda';
                        newResultElement.style.border = '1px solid #c3e6cb';
                        newResultElement.style.borderRadius = '5px';
                        newResultElement.style.color = '#155724';
                        newResultElement.style.marginBottom = '10px';
                        newResultElement.innerHTML = `
                            [${codeFormat}] ${codeData}
                        `;
                        
                        // Добавляем новый результат
                        resultDiv.appendChild(newResultElement);
                        
                        // Автоматически прокручиваем к последнему элементу
                        newResultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                    }
                }
            }
            
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error('Ошибка ZXing:', err);
            }
            
            // Продолжаем сканирование если все еще активно
            if (scanning) {
                setTimeout(() => scanWithZXing(), 500); // Сканируем каждые 500мс
            }
        });
    }
});