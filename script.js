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
let audioCtx, analyser;
let songGain, noiseGainAudio, noiseGainVisual, filterNode;
let songSource, noiseSource, synthOsc;
let animationId;
let isAudioInitialized = false;
let isWon = false;

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
        
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        
        // 1. LA CANCIÓN (Va a los altavoces, súper ahogada)
        songSource = audioCtx.createMediaElementSource(bgAudio);
        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 100; // Totalmente ininteligible
        
        songGain = audioCtx.createGain();
        songGain.gain.value = 0.1;
        
        songSource.connect(filterNode).connect(songGain).connect(audioCtx.destination);
        
        // 2. EL RUIDO DE ESTÁTICA
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
        
        noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Ruido para los altavoces (Fuerte)
        noiseGainAudio = audioCtx.createGain();
        noiseGainAudio.gain.value = 1.5;
        noiseSource.connect(noiseGainAudio).connect(audioCtx.destination);

        // Ruido para la pantalla (Visual)
        noiseGainVisual = audioCtx.createGain();
        noiseGainVisual.gain.value = 1.0;
        noiseSource.connect(noiseGainVisual).connect(analyser);

        // 3. LA ONDA SINTÉTICA (Truco: Solo va a la pantalla para que se "alinee" visualmente)
        synthOsc = audioCtx.createOscillator();
        synthOsc.type = 'sine';
        synthOsc.frequency.value = 86; // <-- CAMBIA EL 150 POR 86
        synthOsc.connect(analyser);
        synthOsc.start();

        bgAudio.play().catch(e => console.log("Error de audio:", e));
        noiseSource.start();

        isAudioInitialized = true;
        checkProximity();
    } catch (e) {
        console.warn("Web Audio API no soportado.", e);
    }
}

/* ==========================================================
   OSCILOSCOPIO VISUAL
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
       if (isWon) return; // ¡AÑADE ESTA LÍNEA AQUÍ! Congela la onda al ganar.
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
   LÓGICA DE PROXIMIDAD Y VICTORIA (Restaurado a la original)
========================================================== */
function checkProximity() {
    const errB = Math.abs(values.bass - CONFIG.targetBass);
    const errM = Math.abs(values.mid - CONFIG.targetMid);
    const errT = Math.abs(values.treble - CONFIG.targetTreble);
    
    const totalError = errB + errM + errT; // Máximo posible = 300
    
    // VICTORIA: Nivel de dificultad exacto de tu IA original (< 15 puntos de error total)
    if (totalError < 15 && !isWon) {
        triggerWinSequence();
        return;
    } 

    if (!isWon) {
        //let errorRatio = Math.min(totalError / 150, 1.0); // 0.0 (cerca) a 1.0 (lejos)
       let errorRatio = totalError / 260; 
       errorRatio = Math.max(0, Math.min(1.0, errorRatio)); 
        
        // Brillo de la interfaz
        document.documentElement.style.setProperty('--ui-glow', 1 - errorRatio);

        // Haptic sutil al acercarse
        if (navigator.vibrate && totalError < 30 && totalError % 5 < 1) navigator.vibrate(15);
        
        updateAudioEngine(errorRatio);
    }
}

function updateAudioEngine(errorRatio) {
    if (!audioCtx || !isAudioInitialized) return;
    const time = audioCtx.currentTime;
    
    // 1. Estática visual: Baja a 0 al acercarse. Así la onda se "alinea" perfecta.
    if(noiseGainVisual) noiseGainVisual.gain.setTargetAtTime(errorRatio, time, 0.1);

    // 2. Estática auditiva: Siempre se oye ruido en los altavoces hasta que gana.
    let nVolAudio = 0.5 + errorRatio; 
    if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(nVolAudio, time, 0.1);

    // 3. Filtro de Canción: NUNCA pasa de 400Hz. Es imposible saber qué canción es.
    const newFreq = 100 + (300 * Math.pow(1 - errorRatio, 2));
    if(filterNode) filterNode.frequency.setTargetAtTime(newFreq, time, 0.1);

    // 4. Volumen de canción: Sube un poco pero se mantiene de fondo.
    let songVol = 0.1 + (0.4 * (1 - errorRatio));
    if(songGain) songGain.gain.setTargetAtTime(songVol, time, 0.1);
}

/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    if (audioCtx) {
        const time = audioCtx.currentTime;
        // Apagamos los ruidos y la onda falsa
        if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0, time, 0.1);
        if(noiseGainVisual) noiseGainVisual.gain.setTargetAtTime(0, time, 0.1);
        if(synthOsc) synthOsc.disconnect(); 

        // Liberamos la canción real en HD
        if(songGain) songGain.gain.setTargetAtTime(1.0, time, 0.1);
        if(filterNode) filterNode.frequency.setTargetAtTime(20000, time, 0.1);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);

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

function switchScreen(hideId, showId) {
    if(screens[hideId]) screens[hideId].classList.remove('active');
    setTimeout(() => {
        if(screens[showId]) screens[showId].classList.add('active');
    }, 600);
}
