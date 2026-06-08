// 🚨 CONFIGURACIÓN DE SUPABASE 🚨
const SUPABASE_URL = 'https://ybxvwshjvfstzzoylwqv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_KOW6MUhE4I6X6i6po3gRUQ_TvfWVyCL';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const supabaseService = {
    turnos: {
        getByDate: async (dateStr) => {
            const { data, error } = await supabaseClient
                .from('turnos')
                .select(`
                    *,
                    pacientes (*)
                `)
                .eq('fecha', dateStr)
                .order('hora', { ascending: true });
                
            if (error) {
                console.error("Error al obtener turnos:", error);
                return [];
            }
            
            return data.map(t => ({
                ...t,
                paciente: Array.isArray(t.pacientes) ? t.pacientes[0] : t.pacientes || { nombre: 'Paciente Desconocido' }
            }));
        },
        getAll: async () => {
            const { data, error } = await supabaseClient
                .from('turnos')
                .select('fecha');
            if (error) return [];
            return data || [];
        }
    },
    pacientes: {
        getAll: async () => {
            const { data, error } = await supabaseClient
                .from('pacientes')
                .select('*')
                .order('nombre', { ascending: true });
            if (error) return [];
            return data || [];
        },
        getProfile: async (pacienteId) => {
            // Obtenemos todos los registros clínicos ordenados por fecha de sesión decreciente
            const { data, error } = await supabaseClient
                .from('historial_clinico')
                .select('*')
                .eq('paciente_id', pacienteId)
                .order('fecha_sesion', { ascending: false });
            if (error) return [];
            return data || [];
        }
    }
};

// UI State
let currentDate = new Date();
let selectedDate = new Date();
let allAppointments = [];
let todosLosPacientes = [];

// DOM Elements originales
const calendarDaysEl = document.getElementById('calendar-days');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const appointmentsListEl = document.getElementById('appointments-list');
const selectedDateTextEl = document.getElementById('selected-date-text');
const newPatientBtn = document.getElementById('new-patient-btn');
const newAppointmentBtn = document.getElementById('new-appointment-btn');

// Modales originales
const patientModal = document.getElementById('patient-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelPatientBtn = document.getElementById('cancel-patient-btn');
const newPatientForm = document.getElementById('new-patient-form');
const appointmentModal = document.getElementById('appointment-modal');
const closeApptModalBtn = document.getElementById('close-appt-modal-btn');
const cancelApptBtn = document.getElementById('cancel-appt-btn');
const newAppointmentForm = document.getElementById('new-appointment-form');
const pacienteSelect = document.getElementById('paciente_id');

// NUEVOS ELEMENTOS DE GESTIÓN
const printDayBtn = document.getElementById('print-day-btn');
const patientsListModal = document.getElementById('patients-list-modal');
const closePatientsListBtn = document.getElementById('close-patients-list-btn');
const searchPatientInput = document.getElementById('search-patient-input');
const patientsDirectoryContainer = document.getElementById('patients-directory-container');

const patientProfileModal = document.getElementById('patient-profile-modal');
const closeProfileBtn = document.getElementById('close-profile-btn');
const profileName = document.getElementById('profile-name');
const profileMeta = document.getElementById('profile-meta');
const profileHistoryContainer = document.getElementById('profile-history-container');

async function init() {
    // Navegación Calendario
    prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    // Cierres básicos de modales
    closeModalBtn.addEventListener('click', () => patientModal.classList.add('hidden'));
    cancelPatientBtn.addEventListener('click', () => patientModal.classList.add('hidden'));
    closeApptModalBtn.addEventListener('click', () => appointmentModal.classList.add('hidden'));
    cancelApptBtn.addEventListener('click', () => appointmentModal.classList.add('hidden'));
    closePatientsListBtn.addEventListener('click', () => patientsListModal.classList.add('hidden'));
    closeProfileBtn.addEventListener('click', () => patientProfileModal.classList.add('hidden'));

    // 🖨️ Función de Impresión Filtrada por Día
    printDayBtn.addEventListener('click', () => {
        window.print();
    });

    // Abrir Modal de Registrar Paciente
    newPatientBtn.addEventListener('click', () => {
        patientModal.classList.remove('hidden');
    });

    // Abrir Modal de Agendar Turno (Carga la lista desplegable)
   // 🟢 Abrir Modal de Agendar Turno y cargar el buscador predictivo
    newAppointmentBtn.addEventListener('click', async () => {
        appointmentModal.classList.remove('hidden');
        
        const datalist = document.getElementById('lista-pacientes-pred');
        const inputBuscar = document.getElementById('paciente_buscar');
        const inputIdReal = document.getElementById('paciente_id_real');
        
        inputBuscar.value = '';
        inputIdReal.value = '';
        datalist.innerHTML = '';

        const pacientes = await supabaseService.pacientes.getAll();
        
        // Llenamos el Datalist para que Chrome filtre mientras escribes
        pacientes.forEach(p => {
            const option = document.createElement('option');
            option.value = p.nombre; // Lo que el usuario ve y escribe
            option.dataset.id = p.id; // Guardamos el ID de Supabase en secreto
            datalist.appendChild(option);
        });

        // Evento para capturar cuándo el usuario elige una opción válida
        inputBuscar.addEventListener('input', () => {
            const val = inputBuscar.value;
            const options = datalist.options;
            let encontrado = false;

            for (let i = 0; i < options.length; i++) {
                if (options[i].value === val) {
                    inputIdReal.value = options[i].dataset.id; // Seteamos el ID correcto
                    encontrado = true;
                    break;
                }
            }
            if (!encontrado) inputIdReal.value = ''; // Si escribe cualquier cosa, invalida
        });
    });

    // 🟢 Botón de Alta Rápida dentro del turno: Abre el modal de pacientes encima del otro
    document.getElementById('fast-new-patient-btn').addEventListener('click', () => {
        patientModal.classList.remove('hidden');
        // El modal de paciente se abrirá encima del de turnos automáticamente por el orden de capas
    });

    // 👤 Crear botón flotante en la interfaz para ver el Directorio General de Pacientes
    const headerProfile = document.querySelector('.user-profile');
    headerProfile.style.cursor = 'pointer';
    headerProfile.title = 'Ver Directorio de Pacientes';
    headerProfile.addEventListener('click', abrirDirectorioPacientes);

    // Buscador interactivo de pacientes (filtra mientras escribes)
    searchPatientInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtrados = todosLosPacientes.filter(p => 
            p.nombre.toLowerCase().includes(query) || 
            (p.telefono && p.telefono.includes(query))
        );
        renderDirectoryRows(filtrados);
    });

    // Submit: Registrar Paciente
    newPatientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(newPatientForm);
        const nuevoPaciente = {
            nombre: formData.get('nombre'),
            telefono: formData.get('telefono'),
            fecha_nacimiento: formData.get('fecha_nacimiento'),
            fecha_inicio_tratamiento: formData.get('fecha_inicio')
        };
        const submitBtn = newPatientForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const { error } = await supabaseClient.from('pacientes').insert([nuevoPaciente]);
            if (error) throw error;
            patientModal.classList.add('hidden');
            newPatientForm.reset();
            await cargarDatos();
            alert('¡Paciente guardado con éxito!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Submit: Guardar Turno e Historial en Paralelo
    newAppointmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(newAppointmentForm);
        const dateStr = selectedDate.toISOString().split('T')[0]; 
        
        // 🟢 Tomamos el ID real que nuestro buscador capturó en secreto
        const idPacienteRaw = document.getElementById('paciente_id_real').value;
        
        if (!idPacienteRaw) {
            alert('Por favor, seleccione un paciente válido de la lista o regístrelo si es nuevo.');
            return;
        }

        const idPaciente = parseInt(idPacienteRaw, 10);
        
        const nuevoTurno = { paciente_id: idPaciente, fecha: dateStr, hora: formData.get('hora') };
        const nuevoHistorial = {
            paciente_id: idPaciente,
            fecha_sesion: dateStr,
            motivo_sesion: formData.get('motivo'),
            notas: 'Turno agendado desde el panel principal.'
        };
        
        const submitBtn = newAppointmentForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const [resTurno, resHistorial] = await Promise.all([
                supabaseClient.from('turnos').insert([nuevoTurno]),
                supabaseClient.from('historial_clinico').insert([nuevoHistorial])
            ]);
            if (resTurno.error) throw resTurno.error;
            if (resHistorial.error) throw resHistorial.error;

            appointmentModal.classList.add('hidden');
            newAppointmentForm.reset();
            await cargarDatos();
            alert('¡Turno agendado con éxito!');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    await cargarDatos();
}

async function cargarDatos() {
    try {
        allAppointments = await supabaseService.turnos.getAll();
        todosLosPacientes = await supabaseService.pacientes.getAll();
    } catch (err) {
        console.error("Error al cargar datos:", err);
    }
    renderCalendar();
    selectDate(selectedDate);
}

function renderCalendar() {
    calendarDaysEl.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    currentMonthEl.textContent = `${meses[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startingDay = firstDay.getDay();
    if (startingDay === 0) startingDay = 7;
    
    for (let i = 1; i < startingDay; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'day empty';
        calendarDaysEl.appendChild(emptyDiv);
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const selectedStr = selectedDate.toISOString().split('T')[0];

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const dayDate = new Date(year, month, i);
        const dateStr = dayDate.toISOString().split('T')[0];
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        
        if (dateStr === todayStr) dayDiv.classList.add('today');
        if (dateStr === selectedStr) dayDiv.classList.add('selected');
        
        const dayAppointments = allAppointments.filter(t => t.fecha === dateStr);
        if (dayAppointments.length > 0) {
            dayDiv.innerHTML = `<span class="day-number">${i}</span>
                <div class="appointments-indicator">
                    ${dayAppointments.map(() => '<div class="dot"></div>').join('')}
                </div>`;
        } else {
            dayDiv.innerHTML = `<span class="day-number">${i}</span>`;
        }
        
        dayDiv.addEventListener('click', () => {
            selectDate(dayDate);
            renderCalendar();
        });
        calendarDaysEl.appendChild(dayDiv);
    }
}

async function selectDate(date) {
    selectedDate = date;
    const dateStr = date.toISOString().split('T')[0];
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateTextEl.textContent = date.toLocaleDateString('es-ES', opciones);
    
    appointmentsListEl.innerHTML = '<div class="empty-state"><p>Cargando turnos...</p></div>';
    const turnos = await supabaseService.turnos.getByDate(dateStr);
    renderAppointments(turnos);
}

function renderAppointments(turnos) {
    appointmentsListEl.innerHTML = '';
    if (turnos.length === 0) {
        appointmentsListEl.innerHTML = `<div class="empty-state"><p>No hay turnos registrados para este día.</p></div>`;
        return;
    }
    
    turnos.forEach(turno => {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        card.style.cursor = 'pointer';
        card.title = 'Haga clic para ver la Ficha Médica del Paciente';
        card.innerHTML = `
            <div class="time-badge">${turno.hora}</div>
            <div class="patient-info">
                <h4>${turno.paciente.nombre}</h4>
                <p>📞 Tel: ${turno.paciente.telefono || 'Sin especificar'}</p>
            </div>
            <div class="status-indicator pending"></div>
        `;
        // Al hacer clic sobre cualquier tarjeta de turno, se abre su expediente clínico completo
        card.addEventListener('click', () => mostrarFichaPaciente(turno.paciente));
        appointmentsListEl.appendChild(card);
    });
}

// Lógica del Directorio General de Pacientes
function abrirDirectorioPacientes() {
    patientsListModal.classList.remove('hidden');
    searchPatientInput.value = '';
    renderDirectoryRows(todosLosPacientes);
}

function renderDirectoryRows(lista) {
    patientsDirectoryContainer.innerHTML = '';
    if (lista.length === 0) {
        patientsDirectoryContainer.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">No se encontraron pacientes.</p>';
        return;
    }
    lista.forEach(p => {
        const row = document.createElement('div');
        row.className = 'patient-directory-row';
        row.innerHTML = `
            <div>
                <strong style="color:var(--text-primary); dblock">${p.nombre}</strong>
                <span style="color:var(--text-muted); font-size:0.85rem; display:block">📞 ${p.telefono || 'Sin número'}</span>
            </div>
            <button class="primary-btn" style="padding:0.4rem 0.8rem; font-size:0.85rem;">🔍 Ver Ficha</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
            patientsListModal.classList.add('hidden');
            mostrarFichaPaciente(p);
        });
        patientsDirectoryContainer.appendChild(row);
    });
}

// Lógica de la Ficha Clínica del Paciente
async function mostrarFichaPaciente(paciente) {
    patientProfileModal.classList.remove('hidden');
    profileName.textContent = paciente.nombre;
    profileMeta.innerHTML = `<strong>Nacimiento:</strong> ${paciente.fecha_nacimiento || 'Sin especificar'} | <strong>Inicio:</strong> ${paciente.fecha_inicio_tratamiento || 'Sin especificar'}`;
    
    profileHistoryContainer.innerHTML = '<p style="color:var(--text-muted)">Buscando historial clínico...</p>';
    
    const historial = await supabaseService.pacientes.getProfile(paciente.id);
    profileHistoryContainer.innerHTML = '';
    
    if (historial.length === 0) {
        profileHistoryContainer.innerHTML = '<p style="color:var(--text-muted)">El paciente no registra motivos ni sesiones asentadas en su historial todavía.</p>';
        return;
    }
    
    historial.forEach(h => {
        const card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = `
            <em>📅 Sesión del día: ${h.fecha_sesion}</em>
            <p style="margin-bottom: 0.5rem;"><strong>Motivo de Consulta:</strong> ${h.motivo_sesion || 'Sin especificar'}</p>
            <p style="font-size:0.9rem; color:var(--text-secondary); font-style:italic"><strong>Notas:</strong> ${h.notes || h.notas || ''}</p>
        `;
        profileHistoryContainer.appendChild(card);
    });
}

// Ejecutar aplicación
init();