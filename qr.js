// Используем предоставленный пример для инициализации сканирования
window.addEventListener('load', function () {
    let selectedDeviceId;
    const codeReader = new ZXing.BrowserMultiFormatReader()
    console.log('ZXing code reader initialized')
    
    codeReader.listVideoInputDevices()
      .then((videoInputDevices) => {
        const sourceSelect = document.getElementById('sourceSelect')
        selectedDeviceId = videoInputDevices[0].deviceId
        
        // Добавляем выпадающий список с камерами если есть более одной камеры
        if (videoInputDevices.length >= 1 && sourceSelect) {
          videoInputDevices.forEach((element) => {
            const sourceOption = document.createElement('option')
            sourceOption.text = element.label
            sourceOption.value = element.deviceId
            sourceSelect.appendChild(sourceOption)
          })
          
          sourceSelect.onchange = () => {
            selectedDeviceId = sourceSelect.value;
          };
          
          const sourceSelectPanel = document.getElementById('sourceSelectPanel')
          if (sourceSelectPanel) sourceSelectPanel.style.display = 'block'
        }
        
        // Обработчик кнопки старта сканирования
        const startButton = document.getElementById('startButton');
        if (startButton) startButton.addEventListener('click', () => {
          codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
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
        })
        
        // Обработчик кнопки сброса
        const resetButton = document.getElementById('resetButton');
        if (resetButton) resetButton.addEventListener('click', () => {
          codeReader.reset()
          const resultElement = document.getElementById('result');
          if (resultElement) resultElement.textContent = '';
          console.log('Reset.')
        })
      })
      .catch((err) => {
        console.error(err)
      })
})