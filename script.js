/* ==========================================================
   CONFIGURACIÓN PRINCIPAL
   Edita estos valores para personalizar la experiencia
========================================================== */
const CONFIG = {
    // La combinación secreta para los sliders (valores del 0 al 100)
    targetBass: 25,
    targetMid: 80,
    targetTreble: 45,

    // Datos de las entradas (que se mostrarán en la tarjeta dorada)
    concertName: "MACACO - VUELÁBAMOS TOUR",
    concertDate: "15 DE OCTUBRE, 2026",
    concertLocation: "WIZINK CENTER, MADRID",

    // URLs de las imágenes de las entradas (usa tus JPG de Canva aquí)
    ticketImage1: "entrada1.jpg", 
    ticketImage2: "entrada2.jpg",

    // Mensaje final personalizado (aclarando que las reales las tienes tú)
    finalMessage: "Nota: Las entradas oficiales están a buen recaudo en mi app de Fever. ¡Nos vamos de concierto! ❤️",

    // URL de la canción "Lenguas de Signos"
    audioUrl: "Lenguas de Signos.mp3"
};

/* ==========================================================
   VARIABLES GLOBALES
========================================================== */
let gameState = 'INTRO'; // INTRO, TUNING, FOUND, REVEAL, TICKETS

// Valores iniciales de los sliders
let currentValues = {
    bass: 50,
    mid: 50,
    treble: 50
};

// Variables de Web Audio API
let audioCtx;
let analyser;
let bufferLength;
let dataArray;
let songSource;
let filterNode;
let noiseSource;
let noiseGain;
let isAudioInitialized = false;

// Elementos del DOM
const screens = {
    intro: document.getElementById('screen-intro'),
    tuning: document.getElementById('screen-tuning'),
    reveal: document.getElementById('screen-reveal'),
    tickets: document.getElementById('screen-tickets')
};

const canvas = document.getElementById('oscilloscope');
const canvasCtx = canvas.getContext('2d');

/* ==========================================================
   INICIALIZACIÓN
========================================================== */
document.getElementById('btn-start').addEventListener('click', () => {
    initAudio();
    switchScreen('intro', 'tuning');
    gameState = 'TUNING';
    resizeCanvas();
    drawWaveform();
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
    // Ajustar el canvas al contenedor
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

/* ==========================================================
   NUEVA LÓGICA DE AUDIO: SINTONIZANDO LA RADIO
========================================================== */
const bgAudio = new Audio(CONFIG.audioUrl);
bgAudio.loop = true; // Suena en bucle mientras juega
bgAudio.crossOrigin = "anonymous";

function initAudio() {
    if (isAudioInitialized) return;
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
        console.warn("Web Audio API no soportada en este navegador.");
        return;
    }

    audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // 1. Conectar la canción
    songSource = audioCtx.createMediaElementSource(bgAudio);
    
    // 2. Crear un filtro pasabajos (Efecto debajo del agua/radio ahogada)
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 300; // Empieza súper distorsionado
    
    // 3. Crear Ruido Blanco (Estática de radio)
    const bufferSize = audioCtx.sampleRate * 2; 
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    
    noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.5; // Ruido bastante alto al principio

    // Conectar el grafo de audio: Canción -> Filtro -> Analizador
    songSource.connect(filterNode);
    filterNode.connect(analyser);
    
    // Conectar el Ruido -> Gain -> Analizador
    noiseSource.connect(noiseGain);
    noiseGain.connect(analyser);
    
    analyser.connect(audioCtx.destination);
    
    // Reproducir
    bgAudio.play().catch(e => console.log("Error reproduciendo audio:", e));
    noiseSource.start();
    
    isAudioInitialized = true;
    updateAudioNode();
}

function updateAudioNode() {
    if (!isAudioInitialized || gameState !== 'TUNING') return;

    // Calcular el error: Distancia entre dónde están los sliders y dónde deberían estar
    const eBass = Math.abs(currentValues.bass - CONFIG.targetBass);
    const eMid = Math.abs(currentValues.mid - CONFIG.targetMid);
    const eTreble = Math.abs(currentValues.treble - CONFIG.targetTreble);
    
    // Error máximo posible es 300 (100 por slider). Lo pasamos a porcentaje (0 a 1).
    let globalError = (eBass + eMid + eTreble) / 300;
    
    // Condición de victoria: si está a menos de un 5% de error
    if (globalError < 0.05) {
        handleWin();
        return;
    }

    // MAPEO DE MAGIA:
    // Filtro se va abriendo de 300Hz (mal) hasta 20000Hz (sonido limpio) logarítmicamente
    const minFreq = 300;
    const maxFreq = 20000;
    const newFreq = minFreq + (maxFreq - minFreq) * (1 - Math.pow(globalError, 0.5));
    filterNode.frequency.setTargetAtTime(newFreq, audioCtx.currentTime, 0.1);
    
    // El ruido de estática va bajando progresivamente a 0
    noiseGain.gain.setTargetAtTime(globalError * 0.4, audioCtx.currentTime, 0.1);

    // Haptic feedback (Vibra un poquito si se acerca mucho a la solución)
    if (globalError < 0.20 && navigator.vibrate) {
        if(Math.random() > 0.8) navigator.vibrate(10);
    }
}

/* ==========================================================
   LÓGICA DE SLIDERS (TOUCH/POINTER)
========================================================== */
const sliders = document.querySelectorAll('.slider');

sliders.forEach(slider => {
    const thumb = slider.querySelector('.slider-thumb');
    const track = slider.querySelector('.slider-track');
    const id = slider.id.replace('slider-', ''); // bass, mid, treble
    
    let isDragging = false;

    const updateSlider = (clientY) => {
        const rect = track.getBoundingClientRect();
        // Calculamos la posición invertida (100 arriba, 0 abajo)
        let percent = 100 - (((clientY - rect.top) / rect.height) * 100);
        
        // Mantener dentro del límite 0-100
        percent = Math.max(0, Math.min(100, percent));
        
        currentValues[id] = percent;
        thumb.style.bottom = `${percent}%`;
        
        updateAudioNode();
    };

    // Inicializar visualmente en 50%
    thumb.style.bottom = '50%';

    slider.addEventListener('pointerdown', (e) => {
        if (gameState !== 'TUNING') return;
        isDragging = true;
        slider.setPointerCapture(e.pointerId);
        updateSlider(e.clientY);
    });

    slider.addEventListener('pointermove', (e) => {
        if (!isDragging || gameState !== 'TUNING') return;
        updateSlider(e.clientY);
    });

    slider.addEventListener('pointerup', (e) => {
        isDragging = false;
        slider.releasePointerCapture(e.pointerId);
    });

    slider.addEventListener('pointercancel', () => {
        isDragging = false;
    });
});

/* ==========================================================
   OSCILOSCOPIO (WAVEFORM VISUAL)
========================================================== */
function drawWaveform() {
    if (gameState === 'TUNING' || gameState === 'FOUND') {
        requestAnimationFrame(drawWaveform);
    }

    const width = canvas.width;
    const height = canvas.height;

    // Limpiar canvas
    canvasCtx.clearRect(0, 0, width, height);

    if (!isAudioInitialized) {
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(0, 255, 157, 0.3)';
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, height / 2);
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
        return;
    }

    // Dibujar datos reales del audio
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.lineWidth = 3;
    
    // Color brillante según proximidad
    const eBass = Math.abs(currentValues.bass - CONFIG.targetBass);
    const eMid = Math.abs(currentValues.mid - CONFIG.targetMid);
    const eTreble = Math.abs(currentValues.treble - CONFIG.targetTreble);
    let globalError = (eBass + eMid + eTreble) / 300;
    
    const alpha = Math.max(0.3, 1 - globalError);
    canvasCtx.strokeStyle = `rgba(0, 255, 157, ${alpha})`;
    canvasCtx.shadowBlur = alpha * 15;
    canvasCtx.shadowColor = '#00FF9D';

    canvasCtx.beginPath();
    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; 
        const y = v * height / 2;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
    }

    canvasCtx.lineTo(width, height / 2);
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0; // Reset
}

/* ==========================================================
   ESTADOS DEL JUEGO Y TRANSICIONES
========================================================== */
function handleWin() {
    gameState = 'FOUND';
    
    // Apagar el ruido de estática por completo
    if (noiseGain) {
        noiseGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
    }
    // Quitar el filtro pasabajos (la canción suena al 100% limpia)
    if (filterNode) {
        filterNode.frequency.setTargetAtTime(20000, audioCtx.currentTime, 0.5);
    }
    
    // Vibración de victoria prolongada
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 500]);
    }

    // Flash blanco tipo película
    const tuningScreen = document.getElementById('screen-tuning');
    tuningScreen.classList.add('flash-effect');

    setTimeout(() => {
        switchScreen('tuning', 'reveal');
        startRevealSequence();
    }, 1000);
}

function startRevealSequence() {
    gameState = 'REVEAL';
    const step1 = document.getElementById('reveal-step-1');
    const step2 = document.getElementById('reveal-step-2');
    const step3 = document.getElementById('reveal-step-3');

    // Muestra "SEÑAL ENCONTRADA"
    step1.classList.remove('hidden');

    setTimeout(() => {
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    }, 2500);

    // Muestra "Creo que esta señal nos lleva a algún sitio..."
    setTimeout(() => {
        step2.classList.add('hidden');
        step3.classList.remove('hidden');
    }, 5500);
}

/* ==========================================================
   PANTALLA FINAL: ENTRADAS
========================================================== */
document.getElementById('btn-show-tickets').addEventListener('click', () => {
    gameState = 'TICKETS';
    
    document.querySelectorAll('.t-name').forEach(el => el.textContent = CONFIG.concertName);
    document.querySelectorAll('.t-date').forEach(el => el.textContent = CONFIG.concertDate);
    document.querySelectorAll('.t-loc').forEach(el => el.textContent = CONFIG.concertLocation);
    
    document.getElementById('t-img-1').style.backgroundImage = `url('${CONFIG.ticketImage1}')`;
    document.getElementById('t-img-2').style.backgroundImage = `url('${CONFIG.ticketImage2}')`;
    document.getElementById('final-msg').textContent = CONFIG.finalMessage;

    switchScreen('reveal', 'tickets');
});

/* ==========================================================
   UTILIDAD DE TRANSICIÓN
========================================================== */
function switchScreen(hideId, showId) {
    screens[hideId].classList.remove('active');
    setTimeout(() => {
        screens[showId].classList.add('active');
    }, 600);
}
