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
let time = 0; 

const bgAudio = new Audio(CONFIG.audioUrl);
bgAudio.loop = true;
bgAudio.crossOrigin = "anonymous";

let isDragging = false;
let currentSlider = null;

// Valores iniciales (desordenados)
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
        
        // 1. LA CANCIÓN (Muuuuy oculta al principio)
        songSource = audioCtx.createMediaElementSource(bgAudio);
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 50; // Filtro extremo: solo pasa un zumbido grave
        
        songGain = audioCtx.createGain();
        songGain.gain.value = 0.01; // Volumen casi al 0%
        
        songSource.connect(filterNode).connect(songGain).connect(audioCtx.destination);
        
        // 2. EL RUIDO DE ESTÁTICA (Fuerte para tapar)
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        
        noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        noiseGainAudio = audioCtx.createGain();
        noiseGainAudio.gain.value = 1.8;
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
   OSCILOSCOPIO VISUAL (UNA SOLA ONDA QUE SE APLANA)
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
        // SI GANA: LÍNEA TOTALMENTE PLANA
        if (isWon) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#00FF9D'; // Verde brillante
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00FF9D';
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2); // "-----------------"
            ctx.stroke();
            return; // Detenemos la animación
        }

        animationId = requestAnimationFrame(draw);
        time += 0.1;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;

        // Calculamos el error global sumando las 3 palancas
        const errB = Math.abs(values.bass - CONFIG.targetBass);
        const errM = Math.abs(values.mid - CONFIG.targetMid);
        const errT = Math.abs(values.treble - CONFIG.targetTreble);
        
        // normalizamos el error de 0.0 (perfecto) a 1.0 (lejos)
        let errorRatio = Math.max(0, Math.min(1.0, (errB + errM + errT) / 220));

        // Dibujamos LA ÚNICA línea
        ctx.strokeStyle = `rgba(0, 255, 157, ${1 - (errorRatio * 0.5)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        const points = 120; // Detalle de la línea
        const sliceWidth = canvas.width / points;
        let x = 0;

        for(let i = 0; i <= points; i++) {
            // Mezcla de onda curva (para que sea bonita) y ruido de picos
            const baseWave = Math.sin((i * 0.1) + time);
            const staticNoise = (Math.random() * 2 - 1);
            
            // LA MAGIA ESTÁ AQUÍ: La altura de los picos se multiplica por el error.
            // Si el error es 0, toda la ecuación da 0, lo que hace una línea recta.
            const waveAmplitude = (baseWave * 0.3) + (staticNoise * 0.7);
            const yOffset = waveAmplitude * errorRatio * (canvas.height / 1.8);
            
            const y = (canvas.height / 2) + yOffset;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            
            x += sliceWidth;
        }
        ctx.stroke();
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
    
    // VICTORIA: La onda ya es una línea plana "------"
    if (totalError < 15 && !isWon) {
        triggerWinSequence();
        return;
    } 

    if (!isWon) {
        // errorRatio: 1 = Muy lejos -> 0 = Casi plano
        let errorRatio = Math.max(0, Math.min(1.0, totalError / 220));
        
        // El brillo verde de la interfaz sube al acercarse
        document.documentElement.style.setProperty('--ui-glow', 1 - errorRatio);

        // Haptic sutil al acercarse
        if (navigator.vibrate && totalError < 30 && totalError % 5 < 1) navigator.vibrate(15);
        
        updateAudioEngine(errorRatio);
    }
}

function updateAudioEngine(errorRatio) {
    if (!audioCtx || !isAudioInitialized) return;
    const time = audioCtx.currentTime;
    
    // Nivel de puntería: 0 (lejos) a 1 (perfecto)
    const accuracy = 1 - errorRatio;

    // 1. EL RUIDO: Va bajando, pero siempre tapa a la canción hasta el final
    if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0.3 + (1.5 * errorRatio), time, 0.1);

    // 2. EL SECRETO MUSICAL (FILTRO EXPONENCIAL):
    // Al usar Math.pow(accuracy, 4), el filtro se queda en números bajísimos (100-300Hz) 
    // la inmensa mayor parte del tiempo. Es imposible saber qué canción es.
    // Solo cuando la puntería (accuracy) supera el 80-90% se abre de golpe dejando oír la melodía.
    const newFreq = 50 + (8000 * Math.pow(accuracy, 4));
    if(filterNode) filterNode.frequency.setTargetAtTime(newFreq, time, 0.1);

    // 3. EL VOLUMEN DE LA CANCIÓN:
    // Pasa igual, se mantiene bajísimo y solo sube significativamente al final del todo.
    let songVol = 0.01 + (0.99 * Math.pow(accuracy, 3));
    if(songGain) songGain.gain.setTargetAtTime(songVol, time, 0.1);
}

/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    if (audioCtx) {
        const time = audioCtx.currentTime;
        
        // 1. Silenciamos la estática al instante
        if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0, time, 0.05);

        // 2. MÚSICA 100% NÍTIDA Y AL MÁXIMO
        if(songGain) songGain.gain.setTargetAtTime(1.0, time, 0.05);
        if(filterNode) filterNode.frequency.setTargetAtTime(20000, time, 0.05); // Abre toda la canción
    }

    // Vibración de victoria
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);

    document.getElementById('screen-tuning').classList.add('flash-effect');

    // Esperamos 1.5 segundos para que vea la onda perfectamente plana y brillar antes de cambiar de pantalla
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
