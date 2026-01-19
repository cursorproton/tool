document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const resultDiv = document.getElementById('result');
    const ctx = canvas.getContext('2d');

    let scanning = false;
    let stream = null;
    let qrCount = 0; // Переменная для отслеживания количества найденных QR-кодов

    // Проверяем поддержку getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resultDiv.textContent = 'Ваш браузер не поддерживает доступ к камере';
        return;
    }

    // Проверяем, загрузилась ли библиотека jsQR
    if (typeof jsQR === 'undefined') {
        console.error('Библиотека jsQR не загружена');
        resultDiv.innerHTML = `
            <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
                <strong>Ошибка загрузки библиотеки сканирования</strong><br>
                Приложение работает в автономном режиме. Функция сканирования QR-кодов недоступна без предварительного подключения к интернету.<br><br>
                <button onclick="location.reload()" style="background-color: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Попробовать снова
                </button>
            </div>
        `;
        return;
    }

    // Проверяем статус подключения к интернету
    window.addEventListener('offline', () => {
        // Приложение может продолжать работать в автономном режиме
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
        // Приложение восстановило подключение
        console.log('Приложение восстановило подключение к интернету');
        hideOfflineNotification();
    });
    
    // Проверяем статус подключения при загрузке страницы
    // Добавляем небольшую задержку, чтобы service worker успел активироваться
    setTimeout(() => {
        if (!navigator.onLine) {
            showOfflineNotification();
        } else {
            // Проверяем, что Service Worker зарегистрирован и активен
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
            // При возвращении на страницу проверяем статус подключения
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
        // Показываем уведомление об автономном режиме
        const notification = document.createElement('div');
        notification.id = 'offline-notification';
        notification.innerHTML = `
            <div style="padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; color: #856404; margin-top: 10px;">
                <strong>Работа в автономном режиме</strong><br>
                Приложение работает без подключения к интернету.
            </div>
        `;
        document.querySelector('.container').appendChild(notification);
    }

    function hideOfflineNotification() {
        // Скрываем уведомление об автономном режиме
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.remove();
        }
    }

    scanButton.addEventListener('click', () => {
        if (scanning) {
            // Останавливаем сканирование
            stopScanning();
        } else {
            // Начинаем сканирование
            startScanning();
        }
    });

    function startScanning() {
        // Не очищаем результаты при начале сканирования, чтобы сохранить предыдущие результаты
        video.style.display = 'block';
        scanButton.textContent = 'Остановить сканирование';
        
        // Запрашиваем доступ к камере
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(mediaStream => {
                stream = mediaStream;
                video.srcObject = stream;
                video.setAttribute("playsinline", true); // требуется для iOS Safari
                video.play();
                
                scanning = true;
                
                // Начинаем сканирование
                requestAnimationFrame(scan);
            })
            .catch(err => {
                console.error("Ошибка доступа к камере: ", err);
                resultDiv.innerHTML = `
                    <div style="padding: 15px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
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

    function scan() {
        if (!scanning) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Устанавливаем размеры canvas равными размерам видео
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Рисуем текущий кадр видео на canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные изображения с canvas
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Пытаемся декодировать QR-код
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code) {
                // QR-код найден
                // Проверяем, содержится ли уже такой текст в результате
                const existingResults = resultDiv.querySelectorAll('div');
                let alreadyExists = false;
                
                for (let i = 0; i < existingResults.length; i++) {
                    // Извлекаем текст из существующего элемента (без номера)
                    // Разбиваем текст по первому точке и пробелу, чтобы получить текст после номера
                    const textContent = existingResults[i].textContent.trim();
                    const dotIndex = textContent.indexOf('.');
                    if (dotIndex !== -1) {
                        const existingText = textContent.substring(dotIndex + 2).trim(); // +2 для точки и пробела
                        if (existingText === code.data) {
                            alreadyExists = true;
                            break;
                        }
                    }
                }
                
                // Если текст не существует, добавляем его
                if (!alreadyExists) {
                    // Увеличиваем счетчик найденных QR-кодов
                    qrCount++;
                    
                    // Создаем элемент для нового QR-кода и добавляем его к существующим результатам
                    const newResultElement = document.createElement('div');
                    newResultElement.style.padding = '15px';
                    newResultElement.style.backgroundColor = '#d4edda';
                    newResultElement.style.border = '1px solid #c3e6cb';
                    newResultElement.style.borderRadius = '5px';
                    newResultElement.style.color = '#155724';
                    newResultElement.style.marginBottom = '10px';
                    newResultElement.innerHTML = `
                        ${qrCount}. ${code.data}
                    `;
                    
                    // Добавляем новый результат в начало (сверху) уже существующих
                    if(resultDiv.firstChild) {
                        resultDiv.insertBefore(newResultElement, resultDiv.firstChild);
                    } else {
                        resultDiv.appendChild(newResultElement);
                    }
                }
                
                // Продолжаем сканирование, не останавливая его
                // Добавляем небольшую задержку, чтобы избежать множественных чтений одного и того же QR-кода
                setTimeout(() => {
                    requestAnimationFrame(scan);
                }, 1000);
                return;
            }
        }
        
        // Продолжаем сканирование
        requestAnimationFrame(scan);
    }
    
    // Проверяем статус подключения при загрузке страницы
    // Добавляем небольшую задержку, чтобы service worker успел активироваться
    setTimeout(() => {
        if (!navigator.onLine) {
            showOfflineNotification();
        }
    }, 1000);
});