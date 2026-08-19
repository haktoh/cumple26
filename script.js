/* ==========================================================
   CONFIGURACIÓN PRINCIPAL
   Edita estos valores para personalizar la experiencia
========================================================== */
const CONFIG = {
    // La combinación secreta para los sliders (valores del 0 al 100)
    targetBass: 25,
    targetMid: 80,
    targetTreble: 45,

    // Datos de las entradas
    concertName: "MACACO - VUELÁBAMOS TOUR",
    concertDate: "15 DE OCTUBRE, 2026",
    concertLocation: "WIZINK CENTER, MADRID",

    // URLs de las imágenes de las entradas (pueden ser rutas locales './assets/img1.jpg' o URLs)
    ticketImage1: "https://images.unsplash.com/photo-1540039155732-67ee6c764a7c?auto=format&fit=crop&w=400&q=80",
    ticketImage2: "https://images.unsplash.com/photo-1470229722913-7c090be5c5a0?auto=format&fit=crop&w=400&q=80",

    // Mensaje final personalizado
    finalMessage: "Nos vamos a ver a Macaco ❤️",

    // URL de la canción "Lenguas de Signos" de Macaco. 
    // IMPORTANTE: Por temas de copyright, sube el archivo mp3 a tu servidor (ej: './assets/macaco.mp3')
    // Si está vacío, usará un acorde celestial de victoria generado con código.
    songUrl: "" 
};

/* ==========================================================
   VARIABLES GLOBALES & ESTADOS
========================================================== */
let audioCtx;
let analyser;
let noiseGain, synthGain, masterGain;
let noiseFilter;
let animationId;

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
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; // Volumen general moderado
        masterGain.connect(audioCtx.destination);

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        masterGain.connect(analyser);

        // 1. Generador de Ruido (Interferencia)
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        
        noiseGain = audioCtx.createGain();
        whiteNoise.connect(noiseFilter).connect(noiseGain).connect(masterGain);
        whiteNoise.start();

        // 2. Generador de la "Señal" oculta (Sintetizador puro)
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 329.63; // Nota E4 bonita

        synthGain = audioCtx.createGain();
        synthGain.gain.value = 0; // Oculta al principio
        osc.connect(synthGain).connect(masterGain);
        osc.start();

        // Aplicamos los valores iniciales
        updateAudioEngine();

    } catch (e) {
        console.warn("Web Audio API no soportado, fallback visual activado.", e);
    }
}

/* ==========================================================
   LÓGICA DEL OSCILOSCOPIO
========================================================== */
const canvas = document.getElementById('oscilloscope');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initVisualizer() {
    if(!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if(isWon) return; // Congelar visualización al ganar
        animationId = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        
        // El color depende de la proximidad (variable CSS interpretada aquí como verde claro)
        ctx.strokeStyle = '#00FF9D';
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (canvas.height / 2);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
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
    // Calcular porcentaje de abajo hacia arriba
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
    thumb.style.bottom = `${percent}%`;
    fill.style.height = `${percent}%`;
}

// Inicializar UI de sliders
Object.keys(tracks).forEach(key => updateSliderUI(tracks[key], values[key]));

/* ==========================================================
   LÓGICA DE PROXIMIDAD Y RESOLUCIÓN
========================================================== */
function checkProximity() {
    // Calculamos el error total (distancia a la combinación perfecta)
    const errB = Math.abs(values.bass - CONFIG.targetBass);
    const errM = Math.abs(values.mid - CONFIG.targetMid);
    const errT = Math.abs(values.treble - CONFIG.targetTreble);
    
    const totalError = errB + errM + errT;
    
    // Rango de error: max 300 (teórico). Normalizamos 0 (perfecto) a 1 (lejos)
    // Usamos 150 como límite donde el sonido ya es puro ruido
    let normalizedError = Math.min(totalError / 120, 1.0);

    // Actualizar variables CSS para el brillo de la interfaz
    const glowIntensity = 1 - normalizedError;
    document.documentElement.style.setProperty('--ui-glow', glowIntensity);

    // Vibración sutil si cruzamos un umbral de proximidad bueno
    if (navigator.vibrate && totalError < 40 && totalError % 10 < 2) {
        navigator.vibrate(20);
    }

    // Condición de victoria
    if (totalError < 12 && !isWon) {
        triggerWinSequence();
    } else if (!isWon) {
        updateAudioEngine(normalizedError);
    }
}

function updateAudioEngine(normalizedError) {
    if (!audioCtx) return;

    // Cuando el error es 1: Ruido a tope, señal oculta
    // Cuando el error es 0: Ruido 0, señal audible y limpia
    
    // Suavizamos las transiciones de audio
    const time = audioCtx.currentTime;
    
    if (noiseGain) {
        noiseGain.gain.setTargetAtTime(normalizedError * 0.8, time, 0.1);
        // El filtro de ruido se abre haciendo el ruido más molesto si estás lejos
        noiseFilter.frequency.setTargetAtTime(100 + (normalizedError * 3000), time, 0.1);
    }
    
    if (synthGain) {
        // La señal se hace más fuerte cuanto más cerca estás
        synthGain.gain.setTargetAtTime((1 - normalizedError) * 0.4, time, 0.1);
    }
}

/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    // 1. Silencio
    if (audioCtx) {
        const time = audioCtx.currentTime;
        masterGain.gain.setTargetAtTime(0, time, 0.05);
    }

    // Háptica fuerte de victoria
    if (navigator.vibrate) navigator.vibrate([50, 50, 100]);

    // 2. Pausa y Transición a Pantalla de Encontrada
    setTimeout(() => {
        playFinalAudio(); // Iniciar canción final (o tono backup)
        switchScreen('tuning', 'reveal');
        runCinematicReveal();
    }, 400);
}

function playFinalAudio() {
    if (CONFIG.songUrl) {
        // Reproducir canción elegida
        const finalAudio = new Audio(CONFIG.songUrl);
        finalAudio.volume = 0.8;
        finalAudio.play().catch(e => console.log("Error reproduciendo audio:", e));
    } else {
        // Fallback: Acorde de victoria sintético si no hay canción configurada
        if(audioCtx) {
            masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            [329.63, 415.30, 493.88].forEach((freq, i) => { // Acorde E Major
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.frequency.value = freq;
                osc.connect(g).connect(masterGain);
                g.gain.setValueAtTime(0, audioCtx.currentTime);
                g.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 1 + (i*0.2));
                osc.start();
            });
        }
    }
}

function runCinematicReveal() {
    const step1 = document.getElementById('reveal-step-1');
    const step2 = document.getElementById('reveal-step-2');
    const step3 = document.getElementById('reveal-step-3');

    // "SEÑAL ENCONTRADA" (Ya visible por defecto)
    setTimeout(() => {
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    }, 2500); // 2.5s después de aparecer

    // "Creo que esta señal..."
    setTimeout(() => {
        step2.classList.add('hidden');
        step3.classList.remove('hidden');
    }, 5500);
}

/* ==========================================================
   CONFIGURACIÓN DE ENTRADAS
========================================================== */
document.getElementById('btn-show-tickets').addEventListener('click', () => {
    // Rellenar datos desde la configuración
    document.querySelectorAll('.t-name').forEach(el => el.textContent = CONFIG.concertName);
    document.querySelectorAll('.t-date').forEach(el => el.textContent = CONFIG.concertDate);
    document.querySelectorAll('.t-loc').forEach(el => el.textContent = CONFIG.concertLocation);
    
    document.getElementById('t-img-1').style.backgroundImage = `url('${CONFIG.ticketImage1}')`;
    document.getElementById('t-img-2').style.backgroundImage = `url('${CONFIG.ticketImage2}')`;
    document.getElementById('final-msg').textContent = CONFIG.finalMessage;

    switchScreen('reveal', 'tickets');
});

/* ==========================================================
   UTILIDADES
========================================================== */
function switchScreen(hideId, showId) {
    screens[hideId].classList.remove('active');
    setTimeout(() => {
        screens[showId].classList.add('active');
    }, 600); // Esperar a mitad de la transición CSS
}