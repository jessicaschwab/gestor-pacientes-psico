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
let pacienteActualEnFicha = null;

// DOM Elements
const calendarDaysEl = document.getElementById('calendar-days');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const appointmentsListEl = document.getElementById('appointments-list');
const selectedDateTextEl = document.getElementById('selected-date-text');
const newPatientBtn = document.getElementById('new-patient-btn');
const newAppointmentBtn = document.getElementById('new-appointment-btn');

// Modales
const patientModal = document.getElementById('patient-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelPatientBtn = document.getElementById('cancel-patient-btn');
const newPatientForm = document.getElementById('new-patient-form');
const appointmentModal = document.getElementById('appointment-modal');
const closeApptModalBtn = document.getElementById('close-appt-modal-btn');
const cancelApptBtn = document.getElementById('cancel-appt-btn');
const newAppointmentForm = document.getElementById('new-appointment-form');

// Gestión / Directorio
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

// 🔒 CONTROL DE SEGURIDAD Y SESIÓN CON GOOGLE
async function verificarSesion() {
   const { data: { session } } = await supabaseClient.auth.getSession();
    
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const unauthorizedCard = document.getElementById('unauthorized-message');
    const googleBtnWrapper = document.getElementById('google-btn-wrapper');
    const deniedEmailSpan = document.getElementById('denied-email');

    const emailsAutorizados = [
        'profesoraschwabjessica@gmail.com'
    ];

    if (session) {
        const userEmail = session.user?.email?.toLowerCase();

        // 🛑 SI NO ESTÁ AUTORIZADO
        if (!emailsAutorizados.includes(userEmail)) {
            // Cierra la sesión activa en el background
            await supabaseClient.auth.signOut();

            // Muestra la tarjeta con el aviso y oculta el botón viejo trabado
            if (deniedEmailSpan) deniedEmailSpan.textContent = userEmail;
            if (unauthorizedCard) unauthorizedCard.style.display = 'block';
            if (googleBtnWrapper) googleBtnWrapper.style.display = 'none';

            if (loginContainer) loginContainer.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
            return;
        }

        // 🟢 SI ESTÁ AUTORIZADO
        if (unauthorizedCard) unauthorizedCard.style.display = 'none';
        if (googleBtnWrapper) googleBtnWrapper.style.display = 'block';
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';

        await cargarDatos();
    } else {
        if (unauthorizedCard) unauthorizedCard.style.display = 'none';
        if (googleBtnWrapper) googleBtnWrapper.style.display = 'block';
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }
}
// Función para destrabar el botón y probar de nuevo
async function limpiarYReintentar() {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    
    // Oculta la alerta y vuelve a mostrar el botón de Google
    document.getElementById('unauthorized-message').style.display = 'none';
    document.getElementById('google-btn-wrapper').style.display = 'block';
}
// 3. Función global para iniciar sesión con Google
async function iniciarSesionGoogle() {
    console.log("Iniciando login con Google...");
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error('Error en autenticación:', err.message);
        alert('Error al iniciar sesión: ' + err.message);
    }
}

// Hacemos que la función sea accesible globalmente para el onclick del HTML
window.iniciarSesionGoogle = iniciarSesionGoogle;

// 4. Función de inicialización principal
async function init() {
    // Vinculación por evento click para Google Login
    const btnLoginGoogle = document.getElementById('btn-login-google');
    if (btnLoginGoogle) {
        btnLoginGoogle.onclick = iniciarSesionGoogle;
    }

    // Evento Cerrar Sesión
    const btnLogout = document.getElementById('btn-logout') || document.getElementById('logout-btn');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.reload();
        });
    }

    // Navegación Calendario
    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });

    // Cierres de modales
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => patientModal.classList.add('hidden'));
    if (cancelPatientBtn) cancelPatientBtn.addEventListener('click', () => patientModal.classList.add('hidden'));
    if (closeApptModalBtn) closeApptModalBtn.addEventListener('click', () => appointmentModal.classList.add('hidden'));
    if (cancelApptBtn) cancelApptBtn.addEventListener('click', () => appointmentModal.classList.add('hidden'));
    if (closePatientsListBtn) closePatientsListBtn.addEventListener('click', () => patientsListModal.classList.add('hidden'));
    if (closeProfileBtn) closeProfileBtn.addEventListener('click', () => patientProfileModal.classList.add('hidden'));

    // Impresión
    if (printDayBtn) printDayBtn.addEventListener('click', () => { window.print(); });

    // Abrir Modal Nuevo Paciente
    if (newPatientBtn) {
        newPatientBtn.addEventListener('click', () => {
            patientModal.classList.remove('hidden');
        });
    }

    // Abrir Modal Agendar Turno
    if (newAppointmentBtn) {
        newAppointmentBtn.addEventListener('click', async () => {
            appointmentModal.classList.remove('hidden');
            
            const datalist = document.getElementById('lista-pacientes-pred');
            const inputBuscar = document.getElementById('paciente_buscar');
            const inputIdReal = document.getElementById('paciente_id_real');
            
            inputBuscar.value = '';
            inputIdReal.value = '';
            datalist.innerHTML = '';

            const pacientes = await supabaseService.pacientes.getAll();
            
            pacientes.forEach(p => {
                const option = document.createElement('option');
                const infoTelefono = p.telefono ? ` (Tel: ${p.telefono})` : ' (Sin teléfono)';
                option.value = `${p.nombre}${infoTelefono}`;
                option.dataset.id = p.id;
                datalist.appendChild(option);
            });

            inputBuscar.addEventListener('input', () => {
                const val = inputBuscar.value;
                const options = datalist.options;
                let encontrado = false;

                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === val) {
                        inputIdReal.value = options[i].dataset.id;
                        encontrado = true;
                        break;
                    }
                }
                if (!encontrado) inputIdReal.value = '';
            });
        });
    }

    // Alta rápida de paciente desde modal de agendar turno
    const fastNewPatientBtn = document.getElementById('fast-new-patient-btn');
    if (fastNewPatientBtn) {
        fastNewPatientBtn.addEventListener('click', () => {
            patientModal.classList.remove('hidden');
        });
    }

    // 👥 Abrir Directorio General de Pacientes
    const openPatientsBtn = document.getElementById('open-patients-btn');
    if (openPatientsBtn) {
        openPatientsBtn.addEventListener('click', abrirDirectorioPacientes);
    }

    // Buscador interactivo de pacientes
    if (searchPatientInput) {
        searchPatientInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtrados = todosLosPacientes.filter(p => 
                p.nombre.toLowerCase().includes(query) || 
                (p.telefono && p.telefono.includes(query)) ||
                (p.dni && p.dni.includes(query))
            );
            renderDirectoryRows(filtrados);
        });
    }

    // 📝 Guardar anotaciones de la sesión
    const saveNoteBtn = document.getElementById('save-session-note-btn');
    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', async () => {
            const notesInput = document.getElementById('session-notes-input');
            const notaTexto = notesInput.value.trim();
            
            if (!notaTexto) {
                alert('Por favor, escribe alguna anotación antes de guardar.');
                return;
            }

            if (!pacienteActualEnFicha) return;

            const hoyStr = new Date().toISOString().split('T')[0];
            saveNoteBtn.disabled = true;
            saveNoteBtn.textContent = 'Guardando anotación...';

            const nuevoHistorial = {
                paciente_id: pacienteActualEnFicha.id,
                fecha_sesion: hoyStr,
                motivo_sesion: 'Evolución / Seguimiento de sesión',
                notas: notaTexto
            };

            try {
                const { error } = await supabaseClient
                    .from('historial_clinico')
                    .insert([nuevoHistorial]);

                if (error) throw error;

                notesInput.value = '';
                alert('¡Anotación de la sesión guardada correctamente!');
                await refrescarHistorialClinicoVisual(pacienteActualEnFicha.id);

            } catch (err) {
                console.error('Error al guardar nota clínica:', err);
                alert('No se pudo guardar la anotación: ' + err.message);
            } finally {
                saveNoteBtn.disabled = false;
                saveNoteBtn.textContent = '💾 Guardar Notas de la Sesión';
            }
        });
    }

    // ➕ Submit: Registrar Nuevo Paciente
    if (newPatientForm) {
        newPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(newPatientForm);
            
            const formatearNombre = (str) => {
                return str.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            };

            const nombreIngresado = formatearNombre(formData.get('nombre'));
            const dniIngresado = formData.get('dni') ? formData.get('dni').trim() : '';
            const telefonoIngresado = formData.get('telefono') ? formData.get('telefono').trim() : '';

            const submitBtn = newPatientForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Verificando duplicados...';

            let pacienteDuplicado = false;
            let motivoDuplicado = '';

            for (let i = 0; i < todosLosPacientes.length; i++) {
                const p = todosLosPacientes[i];
                if (dniIngresado && p.dni && p.dni.trim() === dniIngresado) {
                    pacienteDuplicado = true;
                    motivoDuplicado = `Ya existe un paciente registrado con el DNI N° ${dniIngresado} (${p.nombre}).`;
                    break;
                }
            }

            if (pacienteDuplicado) {
                alert(`🚫 Registro Cancelado: ${motivoDuplicado}`);
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return; 
            }

            const nuevoPaciente = {
                nombre: nombreIngresado,
                dni: dniIngresado,
                telefono: telefonoIngresado,
                fecha_nacimiento: formData.get('fecha_nacimiento'),
                fecha_inicio_tratamiento: formData.get('fecha_inicio')
            };

            submitBtn.textContent = 'Guardando...';

            try {
                const { error } = await supabaseClient.from('pacientes').insert([nuevoPaciente]);
                if (error) throw error;
                
                patientModal.classList.add('hidden');
                newPatientForm.reset();
                
                await cargarDatos();
                alert('¡Paciente registrado con éxito!');
            } catch (err) {
                alert('Error al guardar el paciente: ' + err.message);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // ⏰ Submit: Nuevo Turno
    if (newAppointmentForm) {
        newAppointmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(newAppointmentForm);
            const dateStr = selectedDate.toISOString().split('T')[0]; 
            
            const numeroDiaSemana = selectedDate.getDay();
            if (numeroDiaSemana === 0 || numeroDiaSemana === 6) {
                alert('🚫 No es posible agendar turnos los fines de semana. Sábados y domingos el consultorio permanece cerrado.');
                return;
            }

            const idPacienteRaw = document.getElementById('paciente_id_real').value;
            if (!idPacienteRaw) {
                alert('Por favor, seleccione un paciente válido de la lista o regístrelo si es nuevo.');
                return;
            }

            const idPaciente = parseInt(idPacienteRaw, 10);
            const horaNueva = formData.get('hora');

            const submitBtn = newAppointmentForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Validando horario...';

            try {
                const turnosDelDia = await supabaseService.turnos.getByDate(dateStr);
                
                const [hNueva, mNueva] = horaNueva.split(':').map(Number);
                const minutosNuevoTurno = hNueva * 60 + mNueva;

                let horarioOcupado = false;
                let turnoConflictivo = null;

                for (let i = 0; i < turnosDelDia.length; i++) {
                    const [hExistente, mExistente] = turnosDelDia[i].hora.split(':').map(Number);
                    const minutosExistente = hExistente * 60 + mExistente;

                    if (Math.abs(minutosNuevoTurno - minutosExistente) < 60) {
                        horarioOcupado = true;
                        turnoConflictivo = turnosDelDia[i];
                        break;
                    }
                }

                if (horarioOcupado) {
                    alert(`⚠️ ¡Conflicto de Horario! Ya existe un turno asignado a las ${turnoConflictivo.hora.substring(0,5)} para el paciente ${turnoConflictivo.paciente.nombre}. Como los turnos duran 1 hora, elija un horario disponible.`);
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    return;
                }
                
                const nuevoTurno = {
                    paciente_id: idPaciente, 
                    fecha: dateStr,
                    hora: horaNueva
                };

                const nuevoHistorial = {
                    paciente_id: idPaciente,
                    fecha_sesion: dateStr,
                    motivo_sesion: formData.get('motivo'),
                    notas: `Turno agendado para las ${horaNueva}.`
                };

                const [resTurno, resHistorial] = await Promise.all([
                    supabaseClient.from('turnos').insert([nuevoTurno]),
                    supabaseClient.from('historial_clinico').insert([nuevoHistorial])
                ]);
                
                if (resTurno.error) throw resTurno.error;
                if (resHistorial.error) throw resHistorial.error;

                appointmentModal.classList.add('hidden');
                newAppointmentForm.reset();
                await cargarDatos();
                alert('¡Turno agendado e Historial Clínico iniciado con éxito!');

            } catch (error) {
                console.error('Error al procesar el turno:', error);
                alert('Hubo un problema: ' + (error.message || 'Error en la verificación de datos.'));
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Evaluar estado de login de entrada
    await verificarSesion();
} // 👈 AQUÍ CIERRA INIT CORRECTAMENTE AL FINAL DE TODO

// 5. Arrancar la app cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}