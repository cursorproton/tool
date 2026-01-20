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

    // Проверяем, загрузились ли библиотеки
    if (typeof ZXing === 'undefined' || typeof jsQR === 'undefined') {
        console.error('Одна из библиотек сканирования не загружена');
        resultDiv.innerHTML = `
            <div style="padding: 5px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24;">
                <strong>Ошибка загрузки библиотек сканирования</strong><br>
                Приложение работает в автономном режиме. Функция сканирования штрихкодов недоступна без предварительного подключения к интернету.<br><br>
                <button onclick="location.reload()" style="background-color: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    Попробовать снова
                </button>
            </div>
        `;
        return;
    }
    
    // Инициализируем ZXing reader для распознавания различных типов штрихкодов
    const hints = new Map();
    // Указываем, какие форматы штрихкодов мы хотим распознавать (кроме QR-кода, который будет обрабатываться jsQR)
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.DATA_MATRIX,
        ZXing.BarcodeFormat.AZTEC,
        ZXing.BarcodeFormat.PDF_417,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.CODE_128,
        ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.CODABAR
    ]);
    
    // Добавляем дополнительные параметры для улучшения распознавания
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    hints.set(ZXing.DecodeHintType.PURE_BARCODE, false);
    
    const barcodeReader = new ZXing.BrowserMultiFormatReader(hints);

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
        // Проверяем, существует ли уже уведомление об автономном режиме
        const existingNotification = document.getElementById('offline-notification');
        if (existingNotification) {
            // Если уведомление уже существует, не создаем новое
            return;
        }
        
        // Показываем уведомление об автономном режиме
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
            
            // Сначала пробуем декодировать QR-код с помощью jsQR
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
                    // Увеличиваем счетчик найденных штрихкодов
                    qrCount++;
                    
                    // Создаем элемент для нового QR-кода и добавляем его к существующим результатам
                    const newResultElement = document.createElement('div');
                    newResultElement.style.padding = '5px';
                    newResultElement.style.backgroundColor = '#d4edda';
                    newResultElement.style.border = '1px solid #c3e6cb';
                    newResultElement.style.borderRadius = '5px';
                    newResultElement.style.color = '#155724';
                    newResultElement.style.marginBottom = '10px';
                    newResultElement.innerHTML = `
                        ${qrCount}. [QR_CODE] ${code.data}
                    `;
                    
                    // Добавляем новый результат в конец (вниз) уже существующих
                    resultDiv.appendChild(newResultElement);
                    
                    // Автоматически прокручиваем к последнему элементу
                    newResultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
                
                // Продолжаем сканирование, не останавливая его
                // Добавляем небольшую задержку, чтобы избежать множественных чтений одного и того же штрихкода
                setTimeout(() => {
                    requestAnimationFrame(scan);
                }, 1000);
                return;
            }
            
            // Если QR-код не найден, пробуем декодировать другие типы штрихкодов с помощью ZXing
            try {
                const result = barcodeReader.decode(undefined, imageData);
                
                if (result) {
                    // Штрихкод найден
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
                            if (existingText === result.getText()) {
                                alreadyExists = true;
                                break;
                            }
                        }
                    }
                    
                    // Если текст не существует, добавляем его
                    if (!alreadyExists) {
                        // Увеличиваем счетчик найденных штрихкодов
                        qrCount++;
                        
                        // Создаем элемент для нового штрихкода и добавляем его к существующим результатам
                        const newResultElement = document.createElement('div');
                        newResultElement.style.padding = '5px';
                        newResultElement.style.backgroundColor = '#d4edda';
                        newResultElement.style.border = '1px solid #c3e6cb';
                        newResultElement.style.borderRadius = '5px';
                        newResultElement.style.color = '#155724';
                        newResultElement.style.marginBottom = '10px';
                        newResultElement.innerHTML = `
                            ${qrCount}. [${result.getBarcodeFormat()}] ${result.getText()}
                        `;
                        
                        // Добавляем новый результат в конец (вниз) уже существующих
                        resultDiv.appendChild(newResultElement);
                        
                        // Автоматически прокручиваем к последнему элементу
                        newResultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                    }
                }
                
                // Продолжаем сканирование, не останавливая его
                // Добавляем небольшую задержку, чтобы избежать множественных чтений одного и того же штрихкода
                setTimeout(() => {
                    requestAnimationFrame(scan);
                }, 1000);
                return;
            } catch (error) {
                // Ошибка декодирования, продолжаем сканирование
                //console.log('Штрихкод не найден на этом кадре:', error.message);
            }
        }
        
        // Продолжаем сканирование
        requestAnimationFrame(scan);
    }
    
    // Проверяем статус подключения при загрузке страницы
    // Добавляем небольшую задержку, чтобы service worker успел активироваться
    // Удаляем дублирующий вызов, так как проверка уже происходит в другом месте
});