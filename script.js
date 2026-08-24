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
   OSCILOSCOPIO VISUAL (CON EASING FLUIDO)
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
    let currentVisualError = 1.0; // Usamos esto para suavizar la animación

    function draw() {
        animationId = requestAnimationFrame(draw);
        time += 0.08;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;

        // Calculamos el error matemático real
        const errB = Math.abs(values.bass - CONFIG.targetBass);
        const errM = Math.abs(values.mid - CONFIG.targetMid);
        const errT = Math.abs(values.treble - CONFIG.targetTreble);
        const totalError = errB + errM + errT;
        
        // El objetivo visual: 0 si ha ganado, si no, proporcional
        let targetErrorRatio = isWon ? 0 : Math.max(0, Math.min(1.0, totalError / 150));

        // LA MAGIA DE LA FLUIDEZ: Interpolación (Easing)
        // La línea nunca da saltos bruscos, persigue el objetivo suavemente
        currentVisualError += (targetErrorRatio - currentVisualError) * 0.08;

        // Ajustes estéticos progresivos (Color, grosor y brillo)
        ctx.strokeStyle = `rgba(0, 255, 157, ${1 - (currentVisualError * 0.4)})`;
        ctx.lineWidth = 2 + (2 * (1 - currentVisualError)); // Engorda al final
        
        // Brillo que explota exponencialmente cuando se aplana
        ctx.shadowBlur = Math.pow(1 - currentVisualError, 4) * 20; 
        ctx.shadowColor = '#00FF9D';

        ctx.beginPath();
        const points = 120;
        const sliceWidth = canvas.width / points;
        let x = 0;

        for(let i = 0; i <= points; i++) {
            const baseWave = Math.sin((i * 0.1) + time);
            const staticNoise = (Math.random() * 2 - 1);
            
            // Transición matemática: Pasa de ser ruido puro a onda suave y fluida
            const waveAmplitude = (staticNoise * currentVisualError) + (baseWave * (1 - currentVisualError) * 0.5);
            
            // Se va reduciendo la altura hasta quedar plana en el centro
            const yOffset = waveAmplitude * currentVisualError * (canvas.height / 1.5);
            
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
    
    // VICTORIA: Tolerancia para ganar (margen de 15 sobre 300)
    if (totalError < 4 && !isWon) {
        triggerWinSequence();
        return;
    } 

    if (!isWon) {
        let errorRatio = Math.max(0, Math.min(1.0, totalError / 220));
        
        document.documentElement.style.setProperty('--ui-glow', 1 - errorRatio);

        if (navigator.vibrate && totalError < 30 && totalError % 5 < 1) navigator.vibrate(45);
        
        updateAudioEngine(errorRatio);
    }
}

function updateAudioEngine(errorRatio) {
    if (!audioCtx || !isAudioInitialized) return;
    const time = audioCtx.currentTime;
    
    // 1. La estática sube o baja, pero nunca desaparece del todo hasta ganar
    if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0.3 + (1.5 * errorRatio), time, 0.1);

    // 2. Mantenemos el filtro súper cerrado por precaución
    if(filterNode) filterNode.frequency.setTargetAtTime(50, time, 0.1);

    // 3. LA CLAVE: El volumen de la canción se queda a 0. ¡Cero spoilers!
    if(songGain) songGain.gain.setTargetAtTime(0, time, 0.1);
}


/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
/* ==========================================================
   SECUENCIA FINAL Y REVELACIÓN
========================================================== */
function triggerWinSequence() {
    isWon = true;

    if (audioCtx) {
        const time = audioCtx.currentTime;
        
        // Silenciamos la estática de golpe
        if(noiseGainAudio) noiseGainAudio.gain.setTargetAtTime(0, time, 0.05);

        // AQUÍ ENTRA LA CANCIÓN CON TODA SU CALIDAD
        if(songGain) songGain.gain.setTargetAtTime(1.0, time, 0.05);
        if(filterNode) filterNode.frequency.setTargetAtTime(20000, time, 0.05); 
    }

    // Vibración elegante: un toque corto y uno más largo
    if (navigator.vibrate) navigator.vibrate([150, 100, 300]);

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
   PANTALLA DE ENTRADAS (CASCADA CON ORDEN EXACTO)
========================================================== */
document.getElementById('btn-show-tickets').addEventListener('click', () => {
    const tImg1 = document.getElementById('t-img-1');
    const tImg2 = document.getElementById('t-img-2');
    
    // 1. Truco anti-parpadeo para las fotos
    if(tImg1) {
        tImg1.style.transition = 'none';
        tImg1.style.opacity = '0';
        tImg1.style.backgroundImage = `url('${CONFIG.ticketImage1}')`;
        void tImg1.offsetWidth; 
        tImg1.style.transition = 'opacity 2s ease-in-out'; 
    }
    if(tImg2) {
        tImg2.style.transition = 'none';
        tImg2.style.opacity = '0';
        tImg2.style.backgroundImage = `url('${CONFIG.ticketImage2}')`;
        void tImg2.offsetWidth; 
        tImg2.style.transition = 'opacity 2s ease-in-out';
    }
    
    // 2. Vaciamos los textos y preparamos la misma línea dividida en dos "spans"
    const names = document.querySelectorAll('.t-name');
    const dates = document.querySelectorAll('.t-date');
    const locs = document.querySelectorAll('.t-loc');
    const finalMsg = document.getElementById('final-msg') || document.querySelector('.final-message');
    
    // Preparamos el terreno para escribir de derecha a izquierda en la misma línea
    names.forEach(el => el.innerHTML = '<span class="artist-text"></span><span class="tour-text"></span>');
    dates.forEach(el => el.textContent = '');
    locs.forEach(el => el.textContent = '');
    if(finalMsg) finalMsg.textContent = '';

    // 3. Separamos los textos
    const splitName = CONFIG.concertName.split(' - ');
    const artistText = splitName[0] + ' - '; // "MACACO - "
    const tourText = splitName[1];           // "FUTURO ANCESTRAL TOUR"

    // 4. Transición de pantalla
    switchScreen('reveal', 'tickets');

    // Función de máquina de escribir
    function typeWriter(elements, text, speed, callback) {
        let i = 0;
        function type() {
            if (i < text.length) {
                elements.forEach(el => el.textContent += text.charAt(i));
                i++;
                setTimeout(type, speed);
            } else if (callback) {
                setTimeout(callback, 400); 
            }
        }
        type();
    }

    // 5. EL ORDEN EXACTO QUE HAS PEDIDO
    setTimeout(() => {
        // PASO 1: La fecha
        typeWriter(dates, CONFIG.concertDate, 50, () => {
            // PASO 2: El lugar
            typeWriter(locs, CONFIG.concertLocation, 50, () => {
                // PASO 3: Título del concierto (Derecha)
                const tourSpans = document.querySelectorAll('.tour-text');
                typeWriter(tourSpans, tourText, 60, () => {
                    // PASO 4: Artista (Se inyecta a la izquierda empujando el texto)
                    const artistSpans = document.querySelectorAll('.artist-text');
                    typeWriter(artistSpans, artistText, 80, () => {
                        // PASO 5: La foto de las entradas
                        if(tImg1) tImg1.style.opacity = '1';
                        if(tImg2) tImg2.style.opacity = '1';
                        
                        // PASO 6: El texto de abajo
                        setTimeout(() => {
                            if(finalMsg) typeWriter([finalMsg], CONFIG.finalMessage, 60);
                        }, 1500); // Pausa de 1.5s para que vea las fotos antes del mensaje
                    });
                });
            });
        });
    }, 800); 
});

function switchScreen(hideId, showId) {
    if(screens[hideId]) screens[hideId].classList.remove('active');
    setTimeout(() => {
        if(screens[showId]) screens[showId].classList.add('active');
    }, 600);
}


