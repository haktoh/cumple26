/* ==========================================================
   CONFIGURACIÓN PRINCIPAL
   Edita estos valores para personalizar la experiencia
========================================================== */
const CONFIG = {
    // La combinación secreta para los sliders
    targetBass: 25,
    targetMid: 80,
    targetTreble: 45,

    // Datos de las entradas (Aquí pones los de VALENCIA)
    concertName: "MACACO - FUTURO ANCESTRAL TOUR",
    concertDate: "20 DE NOVIEMBRE, 2026", 
    concertLocation: "SALA MOON, VALENCIA", 

    // Rutas de las imágenes (Solo fotos, sin texto)
    ticketImage1: "macaco1.jpg", 
    ticketImage2: "macaco2.jpg",

    // Mensaje final personalizado aclarando lo de Fever
    finalMessage: "No soy muy fan de Macaco, pero soy fan tuyo ¡Nos vamos de concierto! ❤️",

    // URL de la canción
    audioUrl: "Lenguas de Signos.mp3"
};

/* ==========================================================
   VARIABLES GLOBALES & ESTADOS
========================================================== */
let audioCtx;
let analyser;
let noiseGain, songGain;
let filterNode, noiseSource, songSource;
let animationId;
let isAudioInitialized = false;

const bgAudio = new Audio(CONFIG.audioUrl);
bgAudio.loop = true;
bgAudio.crossOrigin = "anonymous";

let isWon = false;
let isDragging = false;
let currentSlider = null;

// Valores iniciales de los sliders (desordenados intencionadamente)
let values = {
    bass: 80,
    mid: 20,
    treble: 90
};

// Elementos del DOM
const screens = {
    intro: document.getElementById('screen-intro'),
    tuning: document.getElementById('screen-tuning'),
    reveal: document.getElementById('screen-reveal'),
    tickets: document.getElementById('screen-tickets')
};

/* ==========================================================
   INICIALIZACIÓN DEL JUEGO Y AUDIO
========================================================== */
document.getElementById('btn-start').addEventListener('click', async () => {
    switchScreen('intro', 'tuning');
    await initAudio();
    initVisualizer();
});

async function initAudio() {
    if (isAudioInitialized) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        
        // 1. Elemento de la Canción (muy bajo y ahogado)
        songSource = audioCtx.createMediaElementSource(bgAudio);
        
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 100; // Totalmente ininteligible

        songGain = audioCtx.createGain();
        songGain.gain.value = 0.05; // Volumen al 5%
        
        // 2. Generador de Ruido Estático (Alto)
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
        noiseGain.gain.value = 1.8;

        // Conectar rutas al destino final
        songSource.connect(filterNode).connect(songGain).connect(analyser);
        noiseSource.connect(noiseGain).connect(analyser);
        analyser.connect(audioCtx.destination);

        bgAudio.play().catch(e => console.log("Error reproduciendo audio:", e));
        noiseSource.start();

        isAudioInitialized = true;
        checkProximity();

    } catch (e) {
        console.warn("Web Audio API no soportado.", e);
    }
}

/* ==========================================================
   LÓGICA DEL OSCILOSCOPIO
========================================================== */
const canvas = document.getElementById('oscilloscope');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    if(canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initVisualizer() {
    if(!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00FF9D';
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (canvas.height / 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }
    draw();
}

/* ==========================================================
   CONTROL DE SLIDERS (TÁCTIL)
========================================================== */
const tracks = {
    bass: document.getElementById('slider-bass'),
    mid: document.getElementById('slider-mid'),
    treble: document.getElementById('slider-treble')
};

Object.keys(tracks).forEach(key => {
    const track = tracks[key];
    if(!track) return;
    
    track.addEventListener('pointerdown', (e) => {
        if(isWon) return;
        isDragging = true;
        currentSlider = key;
        track.setPointerCapture(e.pointerId);
        handleMove(e, track, key);
    });

    track.addEventListener('pointermove', (e) => {
        if (!isDragging || currentSlider !== key) return;
        handleMove(e, track, key);
    });

    track.addEventListener('pointerup', (e) => {
        isDragging = false;
        currentSlider = null;
        track.releasePointerCapture(e.pointerId);
    });
});

function handleMove(e, track, key) {
    const rect = track.getBoundingClientRect();
    let y = e.clientY - rect.top;
    let percent = 100 - ((y / rect.height) * 100);
    percent = Math.max(0, Math.min(100, percent));
    
    values[key] = percent;
    updateSliderUI(track, percent);
    checkProximity();
}

function updateSliderUI(track, percent) {
    const thumb = track.querySelector('.slider-thumb');
    const fill = track.querySelector('.slider-fill');
    if(thumb) thumb.style.bottom = `${percent}%`;
    if(fill) fill.style.height = `${percent}%`;
}

// Inicializar UI de sliders
Object.keys(tracks).forEach(key => {
    if(tracks[key]) updateSliderUI(tracks[key], values[key]);
});

/* ==========================================================
   LÓGICA DE PROXIMIDAD (SINTONIZACIÓN)
========================================================== */
function checkProximity() {
    const errB = Math.abs(values.bass - CONFIG.targetBass);
    const errM = Math.abs(values.mid - CONFIG.targetMid);
    const errT = Math.abs(values.treble - CONFIG.targetTreble);
    
    const totalError = errB + errM + errT;
    let normalizedError = Math.min(totalError / 120, 1.0);

    const glowIntensity = 1 - normalizedError;
    document.documentElement.style.setProperty('--ui-glow', glowIntensity);

    // Haptic sutil si roza el valor correcto
    if (navigator.vibrate && totalError < 40 && totalError % 10 < 2 && !isWon) {
        navigator.vibrate(20);
    }

    if (totalError < 12 && !isWon) {
        triggerWinSequence();
    } else if (!isWon) {
        updateAudioEngine(normalizedError);
    }
}

function updateAudioEngine(normalizedError) {
    if (!audioCtx || !isAudioInitialized) return;
    const time = audioCtx.currentTime;
    
    // 1. Volumen de la canción: Curva exponencial. Solo sube drásticamente al final
    let songVol = 1.0 - normalizedError;
    songVol = Math.max(0.01, Math.pow(songVol, 2));
    if(songGain) songGain.gain.setTargetAtTime(songVol, time, 0.1);

    // 2. Ruido Estático: Va bajando
    let nVol = normalizedError * 1.8;
    if(noiseGain) noiseGain.gain.setTargetAtTime(nVol, time, 0.1);

    // 3. Claridad del Filtro: Pow(3) para que la voz no se entienda hasta estar muy cerca
    const minFreq = 100;
    const maxFreq = 20000;
    const freqProgress = Math.max(0, 1 - normalizedError);
    const newFreq = minFreq + (maxFreq - minFreq) * Math.pow(freqProgress, 3);
    if(filterNode) filterNode.frequency.setTargetAtTime(newFreq, time, 0.1);
}

/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    // Canción a tope de volumen y calidad, y 0 ruido
    if (audioCtx) {
        const time = audioCtx.currentTime;
        if(songGain) songGain.gain.setTargetAtTime(1.0, time, 0.1);
        if(noiseGain) noiseGain.gain.setTargetAtTime(0, time, 0.1);
        if(filterNode) filterNode.frequency.setTargetAtTime(20000, time, 0.1);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);

    // Disparar flash blanco y cambiar de pantalla
    document.getElementById('screen-tuning').classList.add('flash-effect');

    setTimeout(() => {
        switchScreen('tuning', 'reveal');
        runCinematicReveal();
    }, 1000); 
}

function runCinematicReveal() {
    const step1 = document.getElementById('reveal-step-1');
    const step2 = document.getElementById('reveal-step-2');
    const step3 = document.getElementById('reveal-step-3');

    setTimeout(() => {
        if(step1) step1.classList.add('hidden');
        if(step2) step2.classList.remove('hidden');
    }, 2500);

    setTimeout(() => {
        if(step2) step2.classList.add('hidden');
        if(step3) step3.classList.remove('hidden');
    }, 5500);
}

/* ==========================================================
   PANTALLA DE ENTRADAS
========================================================== */
document.getElementById('btn-show-tickets').addEventListener('click', () => {
    document.querySelectorAll('.t-name').forEach(el => el.textContent = CONFIG.concertName);
    document.querySelectorAll('.t-date').forEach(el => el.textContent = CONFIG.concertDate);
    document.querySelectorAll('.t-loc').forEach(el => el.textContent = CONFIG.concertLocation);
    
    const tImg1 = document.getElementById('t-img-1');
    const tImg2 = document.getElementById('t-img-2');
    if(tImg1) tImg1.style.backgroundImage = `url('${CONFIG.ticketImage1}')`;
    if(tImg2) tImg2.style.backgroundImage = `url('${CONFIG.ticketImage2}')`;
    
    const finalMsg = document.getElementById('final-msg') || document.querySelector('.final-message');
    if(finalMsg) finalMsg.textContent = CONFIG.finalMessage;

    switchScreen('reveal', 'tickets');
});

/* ==========================================================
   UTILIDADES
========================================================== */
function switchScreen(hideId, showId) {
    if(screens[hideId]) screens[hideId].classList.remove('active');
    setTimeout(() => {
        if(screens[showId]) screens[showId].classList.add('active');
    }, 600);
}
