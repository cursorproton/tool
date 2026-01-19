// Глобальные переменные
let locationEnabled = false;
let longitude = 0;
let defaultLongitude = 0;
let positionWatcherID = 0;
let installPrompt = null;

// Константы состояний
const States = {
    Time: 'time',
    Settings: 'settings'
};



function loadSettings() {
    const le = localStorage.getItem('enableLocation');
    if (le !== null) {
        locationEnabled = le === 'true';
        if(locationEnabled) {
            $('#enableLocation').prop('checked', true);
        }
    }
    
    const dl = localStorage.getItem('defaultLongitude');
    if(dl !== null) {
        longitude = parseFloat(dl);
        defaultLongitude = parseFloat(dl);
    } else {
        longitude = 0;
        defaultLongitude = 0;
    }

    $('#defaultLongitude').val(longitude);
    
    applySettings();
}
function saveSettings() { 
    goToState(States.Time);
    locationEnabled = $('#enableLocation').is(':checked');
    defaultLongitude = $('#defaultLongitude').val();
    localStorage.setItem('enableLocation', locationEnabled);
    localStorage.setItem('defaultLongitude', defaultLongitude);



}

function applySettings() {
    if(locationEnabled) 
        startLocationUpdate();
    else
        stopLocationUpdate();
}

function main() {
    loadSettings();
    $('.settingsButton').on('click', function(){goToState(States.Settings)});
    $('.saveSettingsButton').on('click', saveSettings);
    $('.installButton').on('click', function(){
        if (installPrompt) {
            installPrompt.prompt();
            installPrompt.userChoice
              .then((choiceResult) => {
                $('.installUI').hide();
                installPrompt = null;
              });
        }
    });
}

function updateLongitude(position) { 
    longitude = position.coords.longitude;
    console.log('longitude:', longitude);
}

function stopLocationUpdate() {
    if(!positionWatcherID) {
        return;
    }
    navigator.geolocation.clearWatch(positionWatcherID);
    positionWatcherID = 0;
}
function startLocationUpdate() {
    if(positionWatcherID) {
        return;
    }
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(updateLongitude);
    }
}

function beforeInstall(e) {
    console.log('beforeInstallPrompt()');
    e.preventDefault();
    installPrompt = e;
    $('.installUI').show();
}


$(document).ready(main);

window.addEventListener('beforeinstallprompt', beforeInstall);

// Регистрация Service Worker
if('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('./sw.js')
             .then(function() {
                 console.log("Service Worker Registered");
             })
             .catch(function(error) {
                 console.log("Service Worker Registration Failed:", error);
             });
} else {
    console.log('serviceWorker not supported');
}
