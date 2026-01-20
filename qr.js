// Используем предоставленный пример для инициализации сканирования
window.addEventListener('load', function () {
    let selectedDeviceId;
    if (!window.ZXing) {
        console.error('ZXing library not loaded');
        return;
    }
    const codeReader = new ZXing.BrowserMultiFormatReader()
    console.log('ZXing code reader initialized')
    
    codeReader.listVideoInputDevices()
      .then((videoInputDevices) => {
        // Получаем список камер и используем первую доступную
        selectedDeviceId = videoInputDevices[0]?.deviceId;
        
        // Если есть хотя бы одна камера, используем первую
        if (videoInputDevices.length >= 1) {
          selectedDeviceId = videoInputDevices[0].deviceId;
        }
        
        // Обработчик кнопки старта сканирования
        const scanButton = document.getElementById('scanButton');
        if (scanButton) scanButton.addEventListener('click', () => {
          // Показываем видео элемент
          const videoElement = document.getElementById('video');
          if (videoElement) {
            videoElement.style.display = 'block';
            // Запускаем сканирование с обновленным элементом video
            codeReader.decodeFromVideoDevice(selectedDeviceId, videoElement, (result, err) => {
              if (result) {
                console.log(result)
                const resultElement = document.getElementById('result');
                if (resultElement) resultElement.textContent = result.text
              }
              
              if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err)
                const resultElement = document.getElementById('result');
                if (resultElement) resultElement.textContent = err
              }
            })
            console.log(`Started continuous decode from camera with id ${selectedDeviceId}`)
          }
        })
        
        // Обработчик кнопки сброса не требуется, так как кнопка отсутствует в HTML
      })
      .catch((err) => {
        console.error(err)
      })
})