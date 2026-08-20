/* ==========================================================
   CONFIGURACIÓN PRINCIPAL
========================================================== */
const CONFIG = {
    // La combinación secreta para los sliders
    targetBass: 25,
    targetMid: 80,
    targetTreble: 45,

    // Datos de las entradas
    concertName: "MACACO - FUTURO ANCESTRAL TOUR",
    concertDate: "20 DE NOVIEMBRE, 2026", 
    concertLocation: "SALA MOON, VALENCIA", 

    // Rutas de las imágenes (Solo fotos, sin texto)
    ticketImage1: "macaco1.jpg", 
    ticketImage2: "macaco2.jpg",

    // Mensaje final personalizado
    finalMessage: "No soy muy fan de Macaco, pero soy fan tuyo. ¡Nos vamos de concierto! ❤️",

    // URL de la canción
    audioUrl: "Lenguas de Signos.mp3"
};

/* ==========================================================
   VARIABLES GLOBALES
========================================================== */
let audioCtx;
let songGain, noiseGainAudio, filterNode;
let songSource, noiseSource;
let animationId;
let isAudioInitialized = false;
let isWon = false;
let time = 0; // Para animar las ondas

const bgAudio = new Audio(CONFIG.audioUrl);
bgAudio.loop = true;
bgAudio.crossOrigin = "anonymous";

let isDragging = false;
let currentSlider = null;

// Valores iniciales
let values = { bass: 80, mid: 20, treble: 90 };

const screens = {
    intro: document.getElementById('screen-intro'),
    tuning: document.getElementById('screen-tuning'),
    reveal: document.getElementById('screen-reveal'),
    tickets: document.getElementById('screen-tickets')
};

/* ==========================================================
   INICIALIZACIÓN DEL AUDIO Y EL JUEGO
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
        
        // 1. LA CANCIÓN (Empieza con filtro bajo, se irá abriendo)
        songSource = audioCtx.createMediaElementSource(bgAudio);
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 100; // Súper ahogado inicial
        
        songGain = audioCtx.createGain();
        songGain.gain.value = 0.05; // Volumen muy bajo inicial
        
        songSource.connect(filterNode).connect(songGain).connect(audioCtx.destination);
        
        // 2. EL RUIDO DE ESTÁTICA
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        
        noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        noiseGainAudio = audioCtx.createGain();
        noiseGainAudio.gain.value = 1.5;
        noiseSource.connect(noiseGainAudio).connect(audioCtx.destination);

        bgAudio.play().catch(e => console.log("Error de audio:", e));
        noiseSource.start();

        isAudioInitialized = true;
        checkProximity();
    } catch (e) {
        console.warn("Web Audio API no soportado.", e);
    }
}

/* ==========================================================
   OSCILOSCOPIO VISUAL (LAS 3 ONDAS)
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
    function draw() {
        // SI GANA: DIBUJAMOS LA LÍNEA RECTA PERFECTA EN EL CENTRO
        if (isWon) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#00FF9D'; // Verde brillante
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00FF9D';
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            return; // Se detiene la animación y queda 100% congelada
        }

        animationId = requestAnimationFrame(draw);
        time += 0.05;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0; // Sin brillo hasta que sea perfecta

        // Calculamos cuánto de "mal" está cada palanca individualmente (de 0 a 1)
        const errB = Math.min(1.0, Math.abs(values.bass - CONFIG.targetBass) / 80);
        const errM = Math.min(1.0, Math.abs(values.mid - CONFIG.targetMid) / 80);
        const errT = Math.min(1.0, Math.abs(values.treble - CONFIG.targetTreble) / 80);

        const points = 80;
        const sliceWidth = canvas.width / points;

        function drawWave(error, freq, speed, offset, color) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            let x = 0;
            
            for(let i = 0; i <= points; i++) {
                const staticNoise = (Math.random() * 0.6 - 0.3) * error;
                const wave = Math.sin((i * freq) + (time * speed) + offset);
                
                // Mientras menor sea el error, más plano es el yOffset
                const yOffset = (wave + staticNoise) * error * (canvas.height / 2.5);
                const y = (canvas.height / 2) + yOffset;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                
                x += sliceWidth;
            }
            ctx.stroke();
        }

        // 3 Ondas para las 3 palancas
        drawWave(errB, 0.05, 1.2, 0, 'rgba(0, 255, 157, 0.8)');
        drawWave(errM, 0.15, 2.0, 10, 'rgba(0, 255, 157, 0.5)');
        drawWave(errT, 0.40, 3.5, 20, 'rgba(0, 255, 157, 0.3)');
    }
    draw();
}

/* ==========================================================
   CONTROL TÁCTIL DE LOS SLIDERS
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

Object.keys(tracks).forEach(key => updateSliderUI(tracks[key], values[key]));

/* ==========================================================
   LÓGICA DE PROXIMIDAD PROGRESIVA AUDIO/VISUAL
========================================================== */
function checkProximity() {
    const errB = Math.abs(values.bass - CONFIG.targetBass);
    const errM = Math.abs(values.mid - CONFIG.targetMid);
    const errT = Math.abs(values.treble - CONFIG.targetTreble);
    
    const totalError = errB + errM + errT;
    
    // VICTORIA: Las ondas ya son casi perfectamente planas
    if (totalError < 15 && !isWon) {
        triggerWinSequence();
        return;
    } 

    if (!isWon) {
        // errorRatio: 1 = Muy lejos (Caos total) -> 0 = Muy cerca (Casi plano)
        let errorRatio = Math.max(0, Math.min(1.0, totalError / 260));
        
        // Brillo visual
        document.documentElement.style.setProperty('--ui-glow', 1 - errorRatio);

        // Haptic sutil al acercarse
        if (navigator.vibrate && totalError < 30 && totalError % 5 < 1) navigator.vibrate(15);
        
        updateAudioEngine(errorRatio);
    }
}

function updateAudioEngine(errorRatio) {
    if (!audioCtx || !isAudioInitialized) return;
    const time = audioCtx.currentTime;
    
    // Nivel de acierto: 0 (lejos) a 1 (perfecto)
    const accuracy = 1 - errorRatio;

    // 1. EL RUIDO: Va desapareciendo progresivamente conforme se aplanan las ondas
    if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(1.5 * errorRatio, time, 0.1);

    // 2. LA CLARIDAD (FILTRO): Se abre poco a poco, dejando escuchar la voz y agudos
    // Empieza en 100Hz y sube con una curva matemática hasta 8000Hz (muy nítido)
    const newFreq = 100 + (8000 * Math.pow(accuracy, 2));
    if(filterNode) filterNode.frequency.setTargetAtTime(newFreq, time, 0.1);

    // 3. EL VOLUMEN: Sube progresivamente del 5% al 100%
    let songVol = 0.05 + (0.95 * accuracy);
    if(songGain) songGain.gain.setTargetAtTime(songVol, time, 0.1);
}

/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    if (audioCtx) {
        const time = audioCtx.currentTime;
        
        // 1. Apagamos el poco ruido que quede de golpe
        if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0, time, 0.05);

        // 2. MÚSICA 100% NÍTIDA Y AL MÁXIMO (Quita el filtro del todo)
        if(songGain) songGain.gain.setTargetAtTime(1.0, time, 0.05);
        if(filterNode) filterNode.frequency.setTargetAtTime(20000, time, 0.05);
    }

    // Vibración de victoria
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);

    document.getElementById('screen-tuning').classList.add('flash-effect');

    setTimeout(() => {
        switchScreen('tuning', 'reveal');
        runCinematicReveal();
    }, 1500); 
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

function switchScreen(hideId, showId) {
    if(screens[hideId]) screens[hideId].classList.remove('active');
    setTimeout(() => {
        if(screens[showId]) screens[showId].classList.add('active');
    }, 600);
}
