// ==========================================
// SPA Navigation Logic
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const targetId = item.getAttribute('data-target');
        switchView(targetId);
    });
});

// ==========================================
// Toast Notification System
// ==========================================
function triggerNotification(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Icon based on type
    let icon = '<i class="fa-solid fa-bell" style="color: var(--accent-primary)"></i>';
    if(type === 'success') icon = '<i class="fa-solid fa-check-circle" style="color: var(--success)"></i>';
    if(type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--warning)"></i>';
    
    toast.innerHTML = `
        <div style="font-size: 1.5rem;">${icon}</div>
        <div>
            <h4 style="font-size: 0.875rem; font-weight: 600;">${title}</h4>
            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Browser Notification
    if (Notification.permission === "granted" && type !== 'info') {
        new Notification(title, { body: message, icon: 'logo.png' });
    }

    // Update Bell Badge if it's a real notification
    if (type !== 'info') {
        const badge = document.getElementById('notificationBadge');
        if(badge) badge.style.display = 'block';
    }
    
    // Auto remove after animation ends (4s delay + 0.3s fadeOut)
    setTimeout(() => {
        if(container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 4500);
}

function openNotificationCenter() {
    const badge = document.getElementById('notificationBadge');
    if(badge) badge.style.display = 'none';
    triggerNotification('Centro de Notificaciones', 'No tienes notificaciones pendientes.', 'info');
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

// ==========================================
// Supabase Integration
// ==========================================
const supabaseUrl = 'https://tbzfvulycbaiwlrewpxv.supabase.co';
const supabaseKey = 'sb_publishable_KRCLKUEu8d9EJgZzRmbBLg_hdk9IhFK';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// Realtime Notifications
// ==========================================
function setupRealtimeListeners() {
    const currentUser = localStorage.getItem('crm-logged-in');
    if (!currentUser) return;

    console.log('Setting up realtime listeners for:', currentUser);

    supabaseClient
        .channel('tareas-changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tareas' }, payload => {
            const newTask = payload.new;
            if (newTask.asignado_a === currentUser) {
                triggerNotification('Nueva Tarea Asignada', `Se te ha asignado: ${newTask.titulo}`, 'success');
                fetchTasks();
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tareas' }, payload => {
            const oldTask = payload.old;
            const newTask = payload.new;
            
            // If assignee changed to current user
            if (newTask.asignado_a === currentUser && oldTask.asignado_a !== currentUser) {
                triggerNotification('Tarea Reasignada', `Se te ha asignado la tarea: ${newTask.titulo}`, 'success');
                fetchTasks();
            }
            
            // If state changed on a task assigned to current user
            if (newTask.asignado_a === currentUser && newTask.estado !== oldTask.estado) {
                // Could notify about state changes too
            }
        })
        .subscribe();
}

// ==========================================
// Chat Realtime Logic
// ==========================================
async function fetchChatMessages() {
    const { data, error } = await supabaseClient
        .from('mensajes')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

    if (error) {
        console.error('Error fetching chat:', error);
        return;
    }

    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';

    data.forEach(msg => renderChatMessage(msg, false));
    container.scrollTop = container.scrollHeight;
}

function renderChatMessage(msg, shouldScroll = true) {
    const container = document.getElementById('chatMessages');
    const currentUser = localStorage.getItem('crm-logged-in');
    const isMe = msg.usuario === currentUser;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = isMe ? 'flex-end' : 'flex-start';
    div.style.width = '100%';
    
    const bubbleStyle = isMe 
        ? `background: var(--accent-primary); color: #1e293b; border-bottom-right-radius: 0.25rem;`
        : `background: var(--bg-panel-hover); color: var(--text-primary); border: 1px solid var(--border-color); border-bottom-left-radius: 0.25rem;`;

    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            ${!isMe ? `<span style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">${msg.usuario}</span>` : ''}
            <span style="font-size: 0.6rem; color: var(--text-secondary); opacity: 0.7;">${time}</span>
        </div>
        <div style="padding: 0.75rem 1rem; border-radius: 1rem; max-width: 80%; font-size: 0.9rem; line-height: 1.4; box-shadow: var(--shadow-sm); ${bubbleStyle}">
            ${msg.mensaje}
        </div>
    `;
    
    container.appendChild(div);
    if (shouldScroll) container.scrollTop = container.scrollHeight;
}

async function sendChatMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('chatInput');
    const mensaje = input.value.trim();
    const usuario = localStorage.getItem('crm-logged-in');

    if (!mensaje || !usuario) return;

    input.value = '';

    const { error } = await supabaseClient.from('mensajes').insert([{
        usuario: usuario,
        mensaje: mensaje
    }]);

    if (error) {
        console.error('Error sending message:', error);
        triggerNotification('Error', 'No se pudo enviar el mensaje', 'warning');
    }
}

function setupChatRealtime() {
    supabaseClient
        .channel('chat-global')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, payload => {
            renderChatMessage(payload.new);
        })
        .subscribe();
}

// ==========================================
// Weekly Report Logic
// ==========================================
let conversionChart = null;
let funnelChart = null;
let marketShareChart = null;
let closureChart = null;

const zoneMapping = {
    'QUERETARO': ['QUERETARO', 'QUERETARO MOVIL'],
    'GUADALAJARA': ['ZAPOPAN', 'GUADALAJARA MOVIL'],
    'PUEBLA': ['PUEBLA ANZURES', 'PUEBLA CHOLULA'],
    'MONTERREY': ['MONTERREY CENTRO', 'MONTERREY TERRANOVA', 'MONTERREY MOVIL'],
    'VERACRUZ': ['VERACRUZ'],
    'XALAPA': ['XALAPA 20 NOV', 'XALAPA ARAUCARIAS']
};

let manualOverrides = [];
let currentFullPeriod = '2026-05-W1';

function getCalendarWeeks(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    const weeks = [];
    
    // First day of the month
    const firstDayDate = new Date(year, month - 1, 1);
    const firstDayOfWeek = firstDayDate.getDay(); // 0 = Sunday, 1 = Monday, ...
    
    // Last day of the month
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    
    let currentStart = 1;
    // Week 1 ends on the first Saturday (day index 6)
    // Saturday is day: 1 + (6 - firstDayOfWeek)
    let currentEnd = 1 + (6 - firstDayOfWeek);
    if (currentEnd > lastDayOfMonth) {
        currentEnd = lastDayOfMonth;
    }
    
    weeks.push({ start: currentStart, end: currentEnd });
    
    // Remaining weeks
    while (currentEnd < lastDayOfMonth) {
        currentStart = currentEnd + 1;
        currentEnd = currentStart + 6;
        if (currentEnd > lastDayOfMonth) {
            currentEnd = lastDayOfMonth;
        }
        weeks.push({ start: currentStart, end: currentEnd });
    }
    
    return weeks;
}

function getWeekForDate(yearMonth, day) {
    const weeks = getCalendarWeeks(yearMonth);
    for (let i = 0; i < weeks.length; i++) {
        if (day >= weeks[i].start && day <= weeks[i].end) {
            return `W${i + 1}`;
        }
    }
    return 'W1';
}

function getWeekRange(yearMonth, week) {
    const [year, month] = yearMonth.split('-').map(Number);
    const pad = (n) => n.toString().padStart(2, '0');
    const formatDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

    const lastDayOfMonth = new Date(year, month, 0).getDate();

    if (week === 'MONTH') {
        return { start: formatDate(year, month, 1), end: formatDate(year, month, lastDayOfMonth) };
    }

    const weeks = getCalendarWeeks(yearMonth);
    const wIndex = parseInt(week.replace('W', '')) - 1;
    if (wIndex >= 0 && wIndex < weeks.length) {
        const wRange = weeks[wIndex];
        return {
            start: formatDate(year, month, wRange.start),
            end: formatDate(year, month, wRange.end)
        };
    }

    return { start: '1970-01-01', end: '1970-01-01' };
}

async function updateReportView() {
    const month = document.getElementById('selectMonth').value;
    const week = document.getElementById('selectWeek').value;
    currentFullPeriod = `${month}-${week}`;
    
    // Actualizar los labels de las semanas con fechas reales
    updateWeekLabels(month);
    
    const title = document.getElementById('manualEntryTitle');
    if (title) {
        const monthName = document.getElementById('selectMonth').selectedOptions[0].text;
        if (week === 'MONTH') {
            title.innerText = `Resumen Consolidado - ${monthName}`;
        } else {
            const range = getWeekRange(month, week);
            const formatLabel = (dateStr) => {
                const d = new Date(dateStr + 'T12:00:00');
                return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            };
            title.innerText = `Entrada de Datos Manuales - ${week.replace('W', 'Semana ')} (${formatLabel(range.start)} - ${formatLabel(range.end)})`;
        }
    }

    generateReport();
}

function updateWeekLabels(yearMonth) {
    const select = document.getElementById('selectWeek');
    if (!select) return;
    const currentVal = select.value;
    
    const formatLabel = (dateStr) => {
        if (dateStr === '1970-01-01') return 'N/A';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };
    
    const weeks = getCalendarWeeks(yearMonth);
    const numWeeks = weeks.length;
    
    for (let i = 1; i <= 6; i++) {
        const option = select.querySelector(`option[value="W${i}"]`);
        if (option) {
            const range = getWeekRange(yearMonth, `W${i}`);
            if (range.start === '1970-01-01') {
                option.textContent = `Semana ${i} (No aplica)`;
                option.disabled = true;
                option.style.display = 'none';
            } else {
                option.textContent = `Semana ${i} (${formatLabel(range.start)} - ${formatLabel(range.end)})`;
                option.disabled = false;
                option.style.display = '';
            }
        }
    }
    
    // Handle fallback value if selected one is disabled/hidden
    if (currentVal.startsWith('W')) {
        const valNum = parseInt(currentVal.replace('W', ''));
        if (valNum > numWeeks) {
            select.value = `W${numWeeks}`;
        } else {
            select.value = currentVal;
        }
    }
}

function updateWeekDropdown(selectId, yearMonth, includeAllOption = false) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentVal = select.value;
    const weeks = yearMonth && yearMonth !== 'all' ? getCalendarWeeks(yearMonth) : [];
    const numWeeks = yearMonth && yearMonth !== 'all' ? weeks.length : 6;
    
    const pad = (n) => n.toString().padStart(2, '0');
    const formatDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
    const formatLabel = (dateStr) => {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };
    
    for (let i = 1; i <= 6; i++) {
        const option = select.querySelector(`option[value="W${i}"]`);
        if (option) {
            if (yearMonth && yearMonth !== 'all') {
                if (i <= numWeeks) {
                    const [year, month] = yearMonth.split('-').map(Number);
                    const wRange = weeks[i - 1];
                    const startStr = formatDate(year, month, wRange.start);
                    const endStr = formatDate(year, month, wRange.end);
                    option.textContent = `Semana ${i} (${formatLabel(startStr)} - ${formatLabel(endStr)})`;
                    option.disabled = false;
                    option.style.display = '';
                } else {
                    option.textContent = `Semana ${i} (No aplica)`;
                    option.disabled = true;
                    option.style.display = 'none';
                }
            } else {
                option.textContent = `Semana ${i}`;
                option.disabled = false;
                option.style.display = '';
            }
        }
    }
    
    if (currentVal.startsWith('W')) {
        const valNum = parseInt(currentVal.replace('W', ''));
        if (valNum > numWeeks) {
            select.value = includeAllOption ? 'all' : 'W1';
        } else {
            select.value = currentVal;
        }
    }
}

async function fetchManualReportData() {
    const { data, error } = await supabaseClient.from('reporte_datos').select('*');
    if (error) {
        console.error('Error fetching manual overrides:', error);
        return [];
    }
    return data;
}

async function generateReport() {
    const month = currentFullPeriod.substring(0, 7);
    const week = currentFullPeriod.substring(8);
    const range = getWeekRange(month, week);
    
    // Fetch ALL data for the month if we are in Monthly view, otherwise just the week
    const { data: leads, error: lError } = await supabaseClient
        .from('leads')
        .select('*')
        .gte('created_at', range.start + 'T00:00:00')
        .lte('created_at', range.end + 'T23:59:59');

    const { data: dispersiones, error: dError } = await supabaseClient
        .from('dispersiones')
        .select('*')
        .gte('created_at', range.start + 'T00:00:00')
        .lte('created_at', range.end + 'T23:59:59');

    if (lError || dError) {
        console.error('Error fetching report data:', lError || dError);
        return;
    }

    manualOverrides = await fetchManualReportData();

    const reportData = {};
    Object.keys(zoneMapping).forEach(zone => {
        reportData[zone] = { leads: 0, viables: 0, citas: 0, dispersado: 0, disp_count: 0, presupuesto: 0, atendidas: 0 };
        
        if (week === 'MONTH') {
            // AGGREGATE MONTHLY: Sum of all calendar weeks
            const weeks = getCalendarWeeks(month);
            const weekList = weeks.map((_, idx) => `W${idx + 1}`);
            weekList.forEach(w => {
                const p = `${month}-${w}`;
                const wRange = getWeekRange(month, w);
                
                // Get manual overrides for this specific week
                const overrides = manualOverrides.filter(o => o.zona === zone && o.periodo === p);
                const getManual = (campo) => overrides.find(o => o.campo === campo)?.valor;

                // Budget and Atendidas are ALWAYS manual
                reportData[zone].presupuesto += getManual('budget') || 0;
                reportData[zone].atendidas += getManual('atendidas') || 0;

                // For the rest: Manual Overrides OR Real Data for that week
                const wLeads = leads.filter(l => l.sucursal && zoneMapping[zone].includes(l.sucursal) && l.created_at >= wRange.start && l.created_at <= wRange.end + 'T23:59:59');
                const wDisps = dispersiones.filter(d => d.sucursal && zoneMapping[zone].includes(d.sucursal) && d.created_at >= wRange.start && d.created_at <= wRange.end + 'T23:59:59');

                reportData[zone].leads += getManual('leads') ?? wLeads.length;
                reportData[zone].viables += getManual('viables') ?? wLeads.filter(l => ['DISPERSADO', 'EN PROCESO', 'CITA'].includes(l.etapa)).length;
                reportData[zone].citas += getManual('citas') ?? wLeads.filter(l => l.etapa === 'CITA').length;
                reportData[zone].disp_count += getManual('disp_count') ?? wDisps.length;
                reportData[zone].dispersado += getManual('dispersado') ?? wDisps.reduce((acc, d) => acc + (parseFloat(d.monto) || 0), 0);
            });
        } else {
            // SINGLE WEEK VIEW
            const overrides = manualOverrides.filter(o => o.zona === zone && o.periodo === currentFullPeriod);
            const getManual = (campo) => overrides.find(o => o.campo === campo)?.valor;

            const zLeads = leads.filter(l => l.sucursal && zoneMapping[zone].includes(l.sucursal));
            const zDisps = dispersiones.filter(d => d.sucursal && zoneMapping[zone].includes(d.sucursal));

            reportData[zone] = {
                presupuesto: getManual('budget') ?? 0,
                atendidas: getManual('atendidas') ?? 0,
                leads: getManual('leads') ?? zLeads.length,
                viables: getManual('viables') ?? zLeads.filter(l => ['DISPERSADO', 'EN PROCESO', 'CITA'].includes(l.etapa)).length,
                citas: getManual('citas') ?? zLeads.filter(l => l.etapa === 'CITA').length,
                disp_count: getManual('disp_count') ?? zDisps.length,
                dispersado: getManual('dispersado') ?? zDisps.reduce((acc, d) => acc + (parseFloat(d.monto) || 0), 0)
            };
        }
    });

    renderReportTable(reportData);
    updateReportCharts(reportData);
}

function renderReportTable(data) {
    const tbody = document.getElementById('reportTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentUser = localStorage.getItem('crm-logged-in');
    const week = currentFullPeriod.substring(8);
    const isReadOnly = currentUser === 'invitado' || week === 'MONTH';

    let totalPresupuesto = 0;
    let totalAtendidas = 0;
    let totalLeads = 0;
    let totalViables = 0;
    let totalCitas = 0;
    let totalDispCount = 0;
    let totalDispersado = 0;

    Object.entries(data).forEach(([zone, stats]) => {
        totalPresupuesto += Number(stats.presupuesto) || 0;
        totalAtendidas += Number(stats.atendidas) || 0;
        totalLeads += Number(stats.leads) || 0;
        totalViables += Number(stats.viables) || 0;
        totalCitas += Number(stats.citas) || 0;
        totalDispCount += Number(stats.disp_count) || 0;
        totalDispersado += Number(stats.dispersado) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium">${zone}</td>
            <td><input type="number" step="any" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 120px;" value="${stats.presupuesto}" onchange="saveManualReportData('${zone}', 'budget', this.value)"></td>
            <td><input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 80px;" value="${stats.atendidas}" onchange="saveManualReportData('${zone}', 'atendidas', this.value)"></td>
            <td><input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 60px; text-align: center;" value="${stats.leads}" onchange="saveManualReportData('${zone}', 'leads', this.value)"></td>
            <td><input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 60px; text-align: center;" value="${stats.viables}" onchange="saveManualReportData('${zone}', 'viables', this.value)"></td>
            <td><input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 60px; text-align: center;" value="${stats.citas}" onchange="saveManualReportData('${zone}', 'citas', this.value)"></td>
            <td><input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 60px; text-align: center;" value="${stats.disp_count}" onchange="saveManualReportData('${zone}', 'disp_count', this.value)"></td>
            <td><input type="number" step="any" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} style="padding: 0.25rem 0.5rem; width: 120px; text-align: right; color: var(--success); font-weight: 600;" value="${stats.dispersado}" onchange="saveManualReportData('${zone}', 'dispersado', this.value)"></td>
        `;
        tbody.appendChild(tr);
    });

    // Totals Row
    const trTotal = document.createElement('tr');
    trTotal.style.background = 'rgba(148, 163, 184, 0.15)';
    trTotal.style.fontWeight = 'bold';
    trTotal.style.borderTop = '2px solid var(--border-color)';
    trTotal.style.cursor = 'default';
    trTotal.style.pointerEvents = 'none';

    const formatCurr = (val) => '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatInt = (val) => val.toLocaleString('en-US');

    trTotal.innerHTML = `
        <td class="font-bold" style="color: var(--text-primary); font-weight: 700;">TOTAL</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: left; padding-left: 1.5rem;">${formatCurr(totalPresupuesto)}</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: left; padding-left: 1.5rem;">${formatInt(totalAtendidas)}</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: center;">${formatInt(totalLeads)}</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: center;">${formatInt(totalViables)}</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: center;">${formatInt(totalCitas)}</td>
        <td style="padding: 1rem; color: var(--text-primary); font-weight: 700; text-align: center;">${formatInt(totalDispCount)}</td>
        <td style="padding: 1rem; color: var(--success); font-weight: 700; text-align: right; padding-right: 1.5rem;">${formatCurr(totalDispersado)}</td>
    `;
    tbody.appendChild(trTotal);
}

async function saveManualReportData(zone, type, value) {
    const week = currentFullPeriod.substring(8);
    if (week === 'MONTH') return;

    const campo = type === 'budget' ? 'budget' : type;
    const val = parseFloat(value) || 0;

    const { error } = await supabaseClient
        .from('reporte_datos')
        .upsert({ zona: zone, campo: campo, valor: val, periodo: currentFullPeriod }, { onConflict: 'periodo,zona,campo' });

    if (error) {
        console.error('Error saving report data:', error);
        triggerNotification('Error', 'No se pudo guardar el dato permanentemente', 'warning');
    } else {
        generateReport(); // Refresh charts
    }
}

function updateReportCharts(data) {
    const zones = Object.keys(data);
    const leadsData = zones.map(z => data[z].leads);
    const viablesData = zones.map(z => data[z].viables);
    const budgetData = zones.map(z => data[z].presupuesto);
    const dispersadoData = zones.map(z => data[z].dispersado);

    // Color palette matching the CRM style
    const primaryColor = '#bdfb2f';
    const secondaryColor = '#94a3b8';
    const dangerColor = '#ef4444';
    const successColor = '#10b981';

    // Conversion Chart
    const ctxConv = document.getElementById('conversionChart');
    if (ctxConv) {
        if (conversionChart) conversionChart.destroy();
        conversionChart = new Chart(ctxConv, {
            type: 'bar',
            data: {
                labels: zones,
                datasets: [
                    { label: 'Leads Totales', data: leadsData, backgroundColor: secondaryColor, borderRadius: 4 },
                    { label: 'Leads Viables', data: viablesData, backgroundColor: primaryColor, borderRadius: 4 }
                ]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Funnel Chart
    const totalViables = Object.values(data).reduce((acc, curr) => acc + curr.viables, 0);
    const totalCitas = Object.values(data).reduce((acc, curr) => acc + curr.citas, 0);
    const totalDispersiones = Object.values(data).reduce((acc, curr) => acc + curr.disp_count, 0);

    const ctxFunnel = document.getElementById('funnelChart');
    if (ctxFunnel) {
        if (funnelChart) funnelChart.destroy();
        funnelChart = new Chart(ctxFunnel, {
            type: 'bar',
            data: {
                labels: ['Leads Viables', 'Citas Generadas', 'Dispersiones'],
                datasets: [{
                    label: 'Cantidad',
                    data: [totalViables, totalCitas, totalDispersiones],
                    backgroundColor: [primaryColor, '#3b82f6', successColor],
                    borderRadius: 8,
                    barThickness: 60
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                label += context.raw;
                                
                                if (context.dataIndex > 0) {
                                    const prevVal = context.dataset.data[context.dataIndex - 1];
                                    const percentage = prevVal > 0 ? ((context.raw / prevVal) * 100).toFixed(1) : 0;
                                    label += ` (${percentage}% conversión)`;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: secondaryColor } },
                    y: { grid: { display: false }, ticks: { color: secondaryColor } }
                }
            }
        });
    }

    // Market Share Chart (Donut)
    const ctxMarket = document.getElementById('marketShareChart');
    if (ctxMarket) {
        if (marketShareChart) marketShareChart.destroy();
        marketShareChart = new Chart(ctxMarket, {
            type: 'doughnut',
            data: {
                labels: zones,
                datasets: [{
                    data: dispersadoData,
                    backgroundColor: [primaryColor, '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: secondaryColor, font: { size: 10 } } }
                },
                cutout: '70%'
            }
        });
    }

    // Closure Effectiveness Chart (Stacked Bar)
    const ctxClosure = document.getElementById('closureEffectivenessChart');
    if (ctxClosure) {
        const atendidasData = zones.map(z => data[z].atendidas);
        const dispCountData = zones.map(z => data[z].disp_count);

        if (closureChart) closureChart.destroy();
        closureChart = new Chart(ctxClosure, {
            type: 'bar',
            data: {
                labels: zones,
                datasets: [
                    { label: 'Citas Atendidas', data: atendidasData, backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 4 },
                    { label: 'Dispersiones', data: dispCountData, backgroundColor: successColor, borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: secondaryColor } } },
                scales: {
                    x: { stacked: true, grid: { display: false }, ticks: { color: secondaryColor } },
                    y: { stacked: false, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: secondaryColor } }
                }
            }
        });
    }
}

function setupReportRealtime() {
    supabaseClient
        .channel('report-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reporte_datos' }, () => {
            generateReport();
            updateRegistroLeadsView();
        })
        .subscribe();
}

// ==========================================
// Registro de Leads Logic
// ==========================================
const sucursalesList = [
    "XALAPA 20 NOV", "XALAPA ARAUCARIAS", "VERACRUZ", "ZAPOPAN", 
    "MONTERREY CENTRO", "MONTERREY TERRANOVA", "MONTERREY MOVIL", 
    "PUEBLA ANZURES", "PUEBLA CHOLULA", "QUERETARO", "QUERETARO MOVIL", 
    "GUADALAJARA MOVIL"
];

async function updateRegistroLeadsView() {
    const month = document.getElementById('registroMonth').value;
    const { data, error } = await supabaseClient
        .from('reporte_datos')
        .select('*')
        .like('periodo', `${month}%`);

    if (error) {
        console.error('Error fetching registro leads:', error);
        return;
    }

    renderRegistroLeadsTable(data, month);
}

function renderRegistroLeadsTable(manualData, month) {
    const tbody = document.getElementById('registroLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const weeks = getCalendarWeeks(month);
    const numWeeks = weeks.length;

    // Render Table Header dynamically
    const thead = document.querySelector('#registroLeadsTable thead');
    if (thead) {
        let r1 = `<tr><th rowspan="2" style="border-bottom: 2px solid var(--border-color); min-width: 180px;">Sucursal</th>`;
        let r2 = `<tr>`;
        
        for (let w = 1; w <= numWeeks; w++) {
            const bgColor = w % 2 !== 0 ? 'rgba(189, 251, 47, 0.05)' : 'transparent';
            r1 += `<th colspan="2" style="text-align: center; border-bottom: 2px solid var(--border-color); background: ${bgColor};">Semana ${w}</th>`;
            r2 += `
                <th style="font-size: 0.65rem; text-align: center; background: ${bgColor};">Totales</th>
                <th style="font-size: 0.65rem; text-align: center; background: ${bgColor}; color: var(--accent-primary);">Viables</th>
            `;
        }
        
        r1 += `<th colspan="2" style="text-align: center; border-bottom: 2px solid var(--border-color); background: var(--bg-dark);">Total Mes</th></tr>`;
        r2 += `
            <th style="font-size: 0.65rem; text-align: center; background: var(--bg-dark);">Totales</th>
            <th style="font-size: 0.65rem; text-align: center; background: var(--bg-dark); color: var(--accent-primary);">Viables</th>
        </tr>`;
        
        thead.innerHTML = r1 + r2;
    }

    const currentUser = localStorage.getItem('crm-logged-in');
    const canal = document.getElementById('registroCanal').value;
    const isReadOnly = currentUser === 'invitado';

    // Accumulators for table totals
    let weekTotalsBrutos = Array(numWeeks).fill(0);
    let weekTotalsViables = Array(numWeeks).fill(0);
    let grandTotalMonthBrutos = 0;
    let grandTotalMonthViables = 0;

    sucursalesList.forEach(sucursal => {
        const tr = document.createElement('tr');
        
        // Sucursal Name
        let html = `<td class="font-medium" style="background: var(--bg-panel); position: sticky; left: 0; z-index: 5; border-right: 1px solid var(--border-color);">${sucursal}</td>`;
        
        let totalMonthBrutos = 0;
        let totalMonthViables = 0;

        // Weeks 1 to N
        for (let w = 1; w <= numWeeks; w++) {
            const periodo = `${month}-W${w}`;
            
            let brutos = 0, viables = 0;
            let campoBrutos = '', campoViables = '';
            
            const legacyBrutos = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'total_brutos')?.valor || 0;
            const legacyViables = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'total_viables')?.valor || 0;
            
            const googleBrutos = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'google_brutos')?.valor || 0;
            const googleViables = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'google_viables')?.valor || 0;

            const metaBrutos = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'meta_brutos')?.valor || 0;
            const metaViables = manualData.find(d => d.zona === sucursal && d.periodo === periodo && d.campo === 'meta_viables')?.valor || 0;

            if (canal === 'all') {
                brutos = legacyBrutos + googleBrutos + metaBrutos;
                viables = legacyViables + googleViables + metaViables;
                campoBrutos = 'total_brutos';
                campoViables = 'total_viables';
            } else if (canal === 'google') {
                brutos = googleBrutos;
                viables = googleViables;
                campoBrutos = 'google_brutos';
                campoViables = 'google_viables';
            } else if (canal === 'meta') {
                brutos = metaBrutos;
                viables = metaViables;
                campoBrutos = 'meta_brutos';
                campoViables = 'meta_viables';
            }
            
            totalMonthBrutos += brutos;
            totalMonthViables += viables;

            // Accumulate for column totals
            weekTotalsBrutos[w - 1] += brutos;
            weekTotalsViables[w - 1] += viables;

            const bgColor = w % 2 !== 0 ? 'rgba(189, 251, 47, 0.05)' : 'transparent';

            html += `
                <td style="background: ${bgColor}; padding: 0.5rem; text-align: center;">
                    <input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} 
                        style="width: 50px; padding: 0.25rem; text-align: center; font-size: 0.8rem;" 
                        value="${brutos}" onchange="saveRegistroLeadData('${sucursal}', '${campoBrutos}', this.value, '${periodo}')">
                </td>
                <td style="background: ${bgColor}; padding: 0.5rem; text-align: center;">
                    <input type="number" class="form-control" ${isReadOnly ? 'readonly disabled' : ''} 
                        style="width: 50px; padding: 0.25rem; text-align: center; font-size: 0.8rem; border-color: var(--accent-primary);" 
                        value="${viables}" onchange="saveRegistroLeadData('${sucursal}', '${campoViables}', this.value, '${periodo}')">
                </td>
            `;
        }

        // Totals Column
        html += `
            <td style="background: var(--bg-dark); font-weight: 700; text-align: center;">${totalMonthBrutos}</td>
            <td style="background: var(--bg-dark); font-weight: 700; text-align: center; color: var(--accent-primary);">${totalMonthViables}</td>
        `;

        grandTotalMonthBrutos += totalMonthBrutos;
        grandTotalMonthViables += totalMonthViables;

        tr.innerHTML = html;
        tbody.appendChild(tr);
    });

    // Render Totals Row
    const trTotals = document.createElement('tr');
    trTotals.style.borderTop = '2px solid var(--border-color)';
    
    let totalsHtml = `<td class="font-medium" style="background: var(--bg-panel); position: sticky; left: 0; z-index: 5; border-right: 1px solid var(--border-color); font-weight: 700; color: var(--text-primary);">TOTAL</td>`;
    
    for (let w = 1; w <= numWeeks; w++) {
        const bgColor = w % 2 !== 0 ? 'rgba(189, 251, 47, 0.05)' : 'transparent';
        totalsHtml += `
            <td style="background: ${bgColor}; padding: 0.5rem; text-align: center; font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">
                ${weekTotalsBrutos[w - 1]}
            </td>
            <td style="background: ${bgColor}; padding: 0.5rem; text-align: center; font-weight: 700; color: var(--success); font-size: 0.85rem;">
                ${weekTotalsViables[w - 1]}
            </td>
        `;
    }
    
    totalsHtml += `
        <td style="background: var(--bg-dark); font-weight: 800; text-align: center; font-size: 0.9rem; color: var(--text-primary);">${grandTotalMonthBrutos}</td>
        <td style="background: var(--bg-dark); font-weight: 800; text-align: center; font-size: 0.9rem; color: var(--success);">${grandTotalMonthViables}</td>
    `;
    
    trTotals.innerHTML = totalsHtml;
    tbody.appendChild(trTotals);
}

async function saveRegistroLeadData(sucursal, campo, value, periodo) {
    const val = parseInt(value) || 0;

    const { error } = await supabaseClient
        .from('reporte_datos')
        .upsert({ 
            zona: sucursal, 
            campo: campo, 
            valor: val, 
            periodo: periodo 
        }, { onConflict: 'periodo,zona,campo' });

    if (error) {
        console.error('Error saving registro data:', error);
        triggerNotification('Error', 'No se pudo guardar el dato', 'warning');
    } else {
        updateRegistroLeadsView(); // Refresh table totals
    }
}

async function fetchLeads() {
    const { data, error } = await supabaseClient.from('leads').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }
    window.cachedLeads = data;
    const tbody = document.getElementById('leadsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let leadsCount = 0;
    let procesoCount = 0;
    data.forEach(lead => {
        leadsCount++;
        
        if (lead.etapa === 'EN PROCESO' || lead.etapa === 'DISPERSADO') {
            procesoCount++;
        }
        
        let badgeClass = 'cita';
        if(lead.etapa === 'DISPERSADO') badgeClass = 'dispersado';
        if(lead.etapa === 'DETENIDO') badgeClass = 'detenido';
        if(lead.etapa === 'NO VIABLE/ RECHAZADO/ SIN INTERES') badgeClass = 'rechazado';
        if(lead.etapa === 'EN PROCESO') badgeClass = 'enproceso';
        if(lead.etapa === 'NO ASISTIO') badgeClass = 'noasistio';
        
        let shortObs = lead.observaciones || '';
        if(shortObs.length > 50) shortObs = shortObs.substring(0, 50) + "...";
        
        const dateStr = new Date(lead.created_at).toLocaleDateString('en-GB');
        
        const tr = document.createElement('tr');
        tr.dataset.id = lead.id;
        tr.onclick = () => openLeadPanel(
            lead.id, 
            lead.nombre || '', 
            lead.etapa || '', 
            lead.sucursal || '', 
            lead.vehiculo || '', 
            lead.numero || '', 
            lead.observaciones || '',
            lead.obs_encargado || '',
            lead.fecha_cita || ''
        );
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td class="font-medium">${lead.sucursal || ''}</td>
            <td>${lead.nombre || ''}</td>
            <td>${lead.vehiculo || ''}</td>
            <td><span class="badge ${badgeClass}">${lead.etapa || ''}</span></td>
            <td>${lead.numero || ''}</td>
            <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${lead.creado_por || '-'}</span></td>
            <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortObs}</td>
            <td style="color: #6366f1; font-weight: 500; font-style: italic;">${lead.obs_encargado || ''}</td>
        `;
        tbody.appendChild(tr);
    });
    
    const totalEl = document.getElementById('totalLeadsMetric');
    if(totalEl) totalEl.innerText = leadsCount;
    
    const conversionEl = document.getElementById('conversionRateMetric');
    if(conversionEl) {
        if (leadsCount > 0) {
            const percentage = Math.round((procesoCount / leadsCount) * 100);
            conversionEl.innerText = `${percentage}%`;
        } else {
            conversionEl.innerText = '0%';
        }
    }
    
    if (typeof applyGlobalFilter === 'function') applyGlobalFilter();
}

// ==========================================
// Slide-over Logic (Lead Details)
// ==========================================
let currentLeadId = null;

function openNewLeadPanel() {
    currentLeadId = null;
    document.getElementById('panelTitle').innerText = "Nuevo Lead";
    document.getElementById('panelLeadNameInput').value = "";
    document.getElementById('panelLeadStage').value = "CITA";
    document.getElementById('panelLeadSucursal').value = "";
    document.getElementById('panelLeadVehiculo').value = "";
    document.getElementById('panelLeadNumero').value = "";
    document.getElementById('panelLeadObs').value = "";
    document.getElementById('panelLeadObsEncargado').value = "";
    document.getElementById('panelLeadFechaCita').value = "";
    const btnDel = document.getElementById('btnDeleteLead');
    if(btnDel) btnDel.style.display = 'none';
    document.getElementById('leadPanel').classList.add('open');
}

function openLeadPanel(id, name, stage, sucursal, vehiculo, numero, obs, obsEncargado, fechaCita) {
    currentLeadId = id;
    document.getElementById('panelTitle').innerText = "Detalles del Lead";
    document.getElementById('panelLeadNameInput').value = name;
    document.getElementById('panelLeadStage').value = stage;
    document.getElementById('panelLeadSucursal').value = sucursal;
    document.getElementById('panelLeadVehiculo').value = vehiculo;
    document.getElementById('panelLeadNumero').value = numero;
    document.getElementById('panelLeadObs').value = obs;
    document.getElementById('panelLeadObsEncargado').value = obsEncargado || "";
    document.getElementById('panelLeadFechaCita').value = fechaCita || "";
    const btnDel = document.getElementById('btnDeleteLead');
    if(btnDel) btnDel.style.display = 'block';
    document.getElementById('leadPanel').classList.add('open');
}

function closeLeadPanel() {
    document.getElementById('leadPanel').classList.remove('open');
}

async function saveLead() {
    const name = document.getElementById('panelLeadNameInput').value;
    const stage = document.getElementById('panelLeadStage').value;
    const sucursal = document.getElementById('panelLeadSucursal').value;
    const vehiculo = document.getElementById('panelLeadVehiculo').value;
    const numero = document.getElementById('panelLeadNumero').value;
    const obs = document.getElementById('panelLeadObs').value;
    const fechaCita = document.getElementById('panelLeadFechaCita').value;

    if(!name) {
        triggerNotification('Error', 'El nombre del lead es obligatorio', 'warning');
        return;
    }

    const currentUser = localStorage.getItem('crm-logged-in') || 'Desconocido';

    const leadData = {
        nombre: name,
        etapa: stage,
        sucursal: sucursal,
        vehiculo: vehiculo,
        numero: numero,
        observaciones: obs,
        obs_encargado: document.getElementById('panelLeadObsEncargado').value,
        creado_por: currentUser,
        fecha_cita: fechaCita || null
    };

    if (currentLeadId) {
        const { error } = await supabaseClient.from('leads').update(leadData).eq('id', currentLeadId);
        if(!error) triggerNotification('Éxito', 'Lead actualizado correctamente', 'success');
        else triggerNotification('Error', 'No se pudo actualizar el lead', 'warning');
    } else {
        const { error } = await supabaseClient.from('leads').insert([leadData]);
        if(!error) triggerNotification('Éxito', 'Nuevo lead creado', 'success');
        else triggerNotification('Error', 'No se pudo crear el lead', 'warning');
    }
    
    await fetchLeads();
    closeLeadPanel();
}

async function deleteCurrentLead() {
    if (currentLeadId) {
        if(confirm("¿Seguro que deseas eliminar este lead? Esta acción no se puede deshacer.")) {
            const { error } = await supabaseClient.from('leads').delete().eq('id', currentLeadId);
            if (!error) {
                currentLeadId = null;
                triggerNotification('Eliminado', 'Lead eliminado correctamente', 'success');
                await fetchLeads();
                closeLeadPanel();
            } else {
                triggerNotification('Error', 'No se pudo eliminar', 'warning');
            }
        }
    }
}

// Simulated Business Logic for Notifications
let previousStage = "";
function simulateStageChange(selectElement) {
    const newStage = selectElement.value;
    const leadName = document.getElementById('panelLeadNameInput').value || 'Nuevo Lead';
    
    if(previousStage !== newStage) {
        triggerNotification(
            'Automatización Disparada', 
            `Notificación de Slack enviada al equipo: ${leadName} cambió a "${newStage}"`, 
            'success'
        );
        previousStage = newStage;
    }
}

// ==========================================
// Kanban Drag & Drop Logic
// ==========================================
function allowDrop(ev) {
    ev.preventDefault(); // Necessary to allow dropping
    // Visual feedback
    if(ev.target.classList.contains('kanban-cards')) {
        ev.target.style.background = "rgba(255,255,255,0.02)";
    }
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.target.style.opacity = "0.5";
}

function drop(ev) {
    ev.preventDefault();
    const data = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(data);
    draggedElement.style.opacity = "1";
    
    // Find the nearest .kanban-cards container
    let dropTarget = ev.target;
    while(dropTarget && !dropTarget.classList.contains('kanban-cards')) {
        dropTarget = dropTarget.parentElement;
    }
    
    if(dropTarget && dropTarget.classList.contains('kanban-cards')) {
        dropTarget.style.background = "transparent";
        dropTarget.appendChild(draggedElement);
        
        // Update column counts
        updateColumnCounts();
        
        // Determine new state based on column
        let newState = 'Pendiente';
        const colId = dropTarget.parentElement.id;
        if(colId === 'col-progress') newState = 'En Proceso';
        if(colId === 'col-review') newState = 'En Revisión';
        if(colId === 'col-completed') newState = 'Completado';
        
        // Update state in Supabase
        updateTaskState(data, newState);
        
        // Trigger notification if dropped in "Completado"
        if(colId === 'col-completed') {
            triggerNotification('Tarea Completada', 'El estado del proyecto se ha actualizado.', 'success');
        }
    }
}

async function updateTaskState(taskId, newState) {
    const { error } = await supabaseClient.from('tareas').update({ estado: newState }).eq('id', taskId);
    if(error) {
        console.error('Error updating task state:', error);
        triggerNotification('Error', 'No se pudo actualizar el estado de la tarea', 'warning');
    } else {
        await fetchTasks(); // Update dashboard metric
    }
}

// Reset background when leaving drop target
document.addEventListener('dragenter', (ev) => {
    if(ev.target.classList.contains('kanban-cards')) {
        ev.target.style.background = "rgba(255,255,255,0.02)";
    }
});
document.addEventListener('dragleave', (ev) => {
    if(ev.target.classList.contains('kanban-cards')) {
        ev.target.style.background = "transparent";
    }
});

function updateColumnCounts() {
    const columns = document.querySelectorAll('.kanban-column');
    columns.forEach(col => {
        const count = col.querySelectorAll('.kanban-card').length;
        col.querySelector('.column-count').innerText = count;
    });
}

// Global Event Listeners
document.addEventListener('keydown', (e) => {
    // CMD+K or CTRL+K for global search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-bar input').focus();
    }
    // Escape to close panel
    if(e.key === 'Escape') {
        closeLeadPanel();
        if(typeof closeDispersionPanel === 'function') closeDispersionPanel();
        if(typeof closeMediaViewer === 'function') closeMediaViewer();
        if(typeof closeTaskPanel === 'function') closeTaskPanel();
        if(typeof closeLlamadasPanel === 'function') closeLlamadasPanel();
    }
});

// ==========================================
// Slide-over Logic (Tareas)
// ==========================================
let currentTaskId = null;

async function fetchTasks() {
    const { data, error } = await supabaseClient.from('tareas').select('*');
    if (error) {
        console.error('Error fetching tasks:', error);
        triggerNotification('Error de Carga', error.message, 'warning');
        return;
    }
    window.cachedTasks = data;

    // Clear all columns
    document.querySelectorAll('.kanban-cards').forEach(col => col.innerHTML = '');
    
    let pendingCount = 0;

    data.forEach(task => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.id = task.id;
        card.ondragstart = drag;
        card.onclick = () => openTaskPanel(task);

        let priorityIcon = '<i class="fa-regular fa-clock"></i>';
        if ((task.prioridad || '').toLowerCase().includes('urgente')) {
            priorityIcon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger)"></i>';
        }

        const avatar = task.asignado_a ? `<div class="avatar" style="width: 24px; height: 24px; font-size: 0.6rem; background: var(--accent-primary); color: white;">${task.asignado_a.substring(0,2).toUpperCase()}</div>` : '';

        card.innerHTML = `
            <div class="card-title">${task.titulo}</div>
            <div class="card-meta">
                <span>${priorityIcon} ${task.prioridad || 'Normal'}</span>
                ${avatar}
            </div>
        `;

        let colId = 'col-pending';
        if(task.estado === 'En Proceso') colId = 'col-progress';
        if(task.estado === 'En Revisión') colId = 'col-review';
        if(task.estado === 'Completado') colId = 'col-completed';
        
        if(task.estado === 'Pendiente') pendingCount++;

        const col = document.querySelector(`#${colId} .kanban-cards`);
        if(col) col.appendChild(card);
    });

    updateColumnCounts();
    
    const metric = document.getElementById('pendingTasksMetric');
    if(metric) metric.innerText = pendingCount;
}

function openNewTaskPanel() {
    currentTaskId = null;
    document.getElementById('taskTitle').value = "";
    document.getElementById('taskAssignee').value = "";
    document.getElementById('taskMeta').value = "Normal";
    document.getElementById('btnDeleteTask').style.display = 'none';
    document.getElementById('taskPanel').classList.add('open');
}

function openTaskPanel(task) {
    currentTaskId = task.id;
    document.getElementById('taskTitle').value = task.titulo;
    document.getElementById('taskAssignee').value = task.asignado_a || "";
    document.getElementById('taskMeta').value = task.prioridad || "Normal";
    document.getElementById('btnDeleteTask').style.display = 'block';
    document.getElementById('taskPanel').classList.add('open');
}

function closeTaskPanel() {
    document.getElementById('taskPanel').classList.remove('open');
}

async function saveTask() {
    const title = document.getElementById('taskTitle').value;
    const assignee = document.getElementById('taskAssignee').value;
    const priority = document.getElementById('taskMeta').value;

    if(!title) {
        triggerNotification('Error', 'El título de la tarea es obligatorio', 'warning');
        return;
    }

    const taskData = {
        titulo: title,
        asignado_a: assignee,
        prioridad: priority
    };

    if (currentTaskId) {
        const { error } = await supabaseClient.from('tareas').update(taskData).eq('id', currentTaskId);
        if(!error) triggerNotification('Éxito', 'Tarea actualizada', 'success');
        else triggerNotification('Error', 'No se pudo actualizar la tarea', 'warning');
    } else {
        taskData.estado = 'Pendiente';
        const { error } = await supabaseClient.from('tareas').insert([taskData]);
        if(!error) triggerNotification('Éxito', 'Nueva tarea creada', 'success');
        else triggerNotification('Error', 'No se pudo crear la tarea', 'warning');
    }
    
    await fetchTasks();
    closeTaskPanel();
}

async function deleteCurrentTask() {
    if (currentTaskId && confirm('¿Estás seguro de eliminar esta tarea?')) {
        const { error } = await supabaseClient.from('tareas').delete().eq('id', currentTaskId);
        if(!error) {
            triggerNotification('Éxito', 'Tarea eliminada', 'success');
            await fetchTasks();
            closeTaskPanel();
        } else {
            triggerNotification('Error', 'No se pudo eliminar la tarea', 'warning');
        }
    }
}


// ==========================================
// Slide-over Logic (Dispersiones)
// ==========================================
function openNewDispersionPanel() {
    document.getElementById('dispCliente').value = "";
    document.getElementById('dispSucursal').value = "XALAPA 20 NOV";
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dispFecha').value = today;
    
    document.getElementById('dispMonto').value = "";
    document.getElementById('dispCalificador').value = "";
    document.getElementById('dispCloser').value = "";
    document.getElementById('dispObs').value = "";
    
    document.getElementById('dispersionPanel').classList.add('open');
}

function closeDispersionPanel() {
    document.getElementById('dispersionPanel').classList.remove('open');
}

async function fetchDispersiones() {
    const { data, error } = await supabaseClient.from('dispersiones').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching dispersiones:', error);
        return;
    }
    window.cachedDispersiones = data;
    const tbody = document.getElementById('dispersionesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    data.forEach(disp => {
        let badgeClass = '';
        if(disp.sucursal === 'XALAPA 20 NOV') badgeClass = 'branch-xalapa';
        if(disp.sucursal === 'XALAPA ARAUCARIAS') badgeClass = 'branch-xalapa-araucarias';
        if(disp.sucursal === 'VERACRUZ') badgeClass = 'branch-veracruz';
        if(disp.sucursal === 'ZAPOPAN') badgeClass = 'branch-zapopan';
        if(disp.sucursal === 'MONTERREY CENTRO') badgeClass = 'branch-mty-centro';
        if(disp.sucursal === 'MONTERREY TERRANOVA') badgeClass = 'branch-mty-terranova';
        if(disp.sucursal === 'MONTERREY MOVIL') badgeClass = 'branch-mty-movil';
        if(disp.sucursal === 'PUEBLA ANZURES') badgeClass = 'branch-puebla';
        if(disp.sucursal === 'PUEBLA CHOLULA') badgeClass = 'branch-puebla-cholula';
        if(disp.sucursal === 'QUERETARO') badgeClass = 'branch-queretaro';
        if(disp.sucursal === 'QUERETARO MOVIL') badgeClass = 'branch-qro-movil';
        if(disp.sucursal === 'GUADALAJARA MOVIL') badgeClass = 'branch-gdl-movil';
        
        let displayDate = disp.fecha;
        if (displayDate && displayDate.includes('-')) {
            const parts = displayDate.split('-');
            displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        
        const safeMonto = String(disp.monto).startsWith('$') ? disp.monto : '$' + Number(disp.monto).toLocaleString('en-US', {minimumFractionDigits: 2});
        
        const tr = document.createElement('tr');
        tr.dataset.id = disp.id;
        tr.innerHTML = `
            <td class="font-medium">${disp.cliente || ''}</td>
            <td><span class="badge ${badgeClass}">${disp.sucursal || ''}</span></td>
            <td>${displayDate || ''}</td>
            <td class="font-medium text-success">${safeMonto}</td>
            <td>${disp.calificador || ''}</td>
            <td>${disp.closer || ''}</td>
            <td>${disp.observaciones || ''}</td>
            <td><button onclick="event.stopPropagation(); deleteRow(this, 'Dispersión', '${disp.id}')" style="color: var(--danger); background: none; border: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
    
    if (typeof applyGlobalFilter === 'function') {
        applyGlobalFilter();
    } else {
        updateCloserSummary();
    }
}

async function saveDispersion() {
    const cliente = document.getElementById('dispCliente').value;
    const sucursal = document.getElementById('dispSucursal').value;
    let fecha = document.getElementById('dispFecha').value;
    const monto = document.getElementById('dispMonto').value;
    const calificador = document.getElementById('dispCalificador').value;
    const closer = document.getElementById('dispCloser').value;
    const obs = document.getElementById('dispObs').value;

    if(!cliente) {
        triggerNotification('Error', 'El nombre del cliente es obligatorio', 'warning');
        return;
    }

    const dispData = {
        cliente: cliente,
        sucursal: sucursal,
        fecha: fecha,
        monto: parseFloat(monto.replace(/[\$,]/g, '')) || 0,
        calificador: calificador,
        closer: closer,
        observaciones: obs
    };

    const { error } = await supabaseClient.from('dispersiones').insert([dispData]);
    if(!error) {
        triggerNotification('Éxito', 'Dispersión agregada correctamente', 'success');
        await fetchDispersiones();
        closeDispersionPanel();
    } else {
        triggerNotification('Error', 'No se pudo guardar la dispersión', 'warning');
    }
}

async function deleteRow(btn, type, id) {
    if(confirm(`¿Seguro que deseas eliminar esta ${type}?`)) {
        if (type === 'Dispersión' && id) {
            const { error } = await supabaseClient.from('dispersiones').delete().eq('id', id);
            if(!error) {
                triggerNotification('Eliminado', 'Dispersión eliminada correctamente', 'success');
                await fetchDispersiones();
            } else {
                triggerNotification('Error', 'No se pudo eliminar la dispersión', 'warning');
            }
        }
    }
}

// Inicializar datos al cargar (Se maneja al final del archivo)

// ==========================================
// Global Month Filter Logic
// ==========================================
function applyGlobalFilter() {
    const filter = document.getElementById('globalMonthFilter').value;
    
    // Update week filters dropdown options
    updateWeekDropdown('leadWeekFilter', filter, true);
    updateWeekDropdown('dispersionWeekFilter', filter, true);
    
    // Helper to check if a date string (DD/MM/YYYY or D/M/YYYY) matches the filter (YYYY-MM)
    const matchesFilter = (dateStr) => {
        if (filter === 'all') return true;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            return `${y}-${m}` === filter;
        }
        return false;
    };

    // Filter Dispersiones
    const dispTbody = document.querySelector('#dispersiones .data-table tbody');
    const weekFilter = document.getElementById('dispersionWeekFilter')?.value || 'all';
    
    if (dispTbody) {
        const rows = dispTbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                const dateStr = cells[2].innerText.trim();
                const matchesDate = matchesFilter(dateStr);
                
                let matchesWeek = true;
                if (weekFilter !== 'all') {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]);
                        const year = parseInt(parts[2]);
                        const rowYearMonth = `${year}-${month.toString().padStart(2, '0')}`;
                        const w = getWeekForDate(rowYearMonth, day);
                        
                        matchesWeek = (w === weekFilter);
                    } else {
                        matchesWeek = false;
                    }
                }
                
                row.style.display = (matchesDate && matchesWeek) ? '' : 'none';
            }
        });
        updateCloserSummary();
    }

    // Filter Leads
    const leadsTbody = document.querySelector('#leads .data-table tbody');
    const agentFilter = document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : 'all';
    const leadWeekFilter = document.getElementById('leadWeekFilter') ? document.getElementById('leadWeekFilter').value : 'all';
    const leadBranchFilter = document.getElementById('leadBranchFilter') ? document.getElementById('leadBranchFilter').value : 'all';

    if (leadsTbody) {
        const rows = leadsTbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 6) {
                const dateStr = cells[0].innerText.trim();
                const branchStr = cells[1].innerText.trim();
                const agentStr = cells[6].innerText.trim().toLowerCase();
                
                const matchesDate = matchesFilter(dateStr);
                const matchesAgent = (agentFilter === 'all' || agentStr === agentFilter.toLowerCase());
                
                let matchesWeek = true;
                if (leadWeekFilter !== 'all') {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]);
                        const year = parseInt(parts[2]);
                        const rowYearMonth = `${year}-${month.toString().padStart(2, '0')}`;
                        const w = getWeekForDate(rowYearMonth, day);
                        
                        matchesWeek = (w === leadWeekFilter);
                    } else {
                        matchesWeek = false;
                    }
                }
                
                const matchesBranch = (leadBranchFilter === 'all' || branchStr === leadBranchFilter);
                
                row.style.display = (matchesDate && matchesAgent && matchesWeek && matchesBranch) ? '' : 'none';
            }
        });
    }
    
    if (typeof updateDashboardCharts === 'function') updateDashboardCharts();
    if (typeof renderAsistenciasView === 'function') renderAsistenciasView();
    if (typeof renderDemeritosComercialesView === 'function') renderDemeritosComercialesView();
}

// Function to update Closer summaries
function updateCloserSummary() {
    const tbody = document.querySelector('#dispersiones .data-table tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    const closerTotals = {};
    const branchTotals = {};
    let totalGeneral = 0;
    
    rows.forEach(row => {
        if (row.style.display === 'none') return;
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            let branch = cells[1].innerText.trim() || 'Desconocida';
            let montoText = cells[3].innerText.replace(/[\$,]/g, '');
            let monto = parseFloat(montoText) || 0;
            let closer = cells[5].innerText.trim() || 'Sin Asignar';
    
            if (!closerTotals[closer]) closerTotals[closer] = 0;
            closerTotals[closer] += monto;
            
            if (!branchTotals[branch]) branchTotals[branch] = 0;
            branchTotals[branch] += monto;
            
            totalGeneral += monto;
        }
    });

    const container = document.getElementById('closerSummaryCards');
    if (!container) return;
    
    container.innerHTML = '';

    // Add General Total
    container.innerHTML += `
        <div style="flex: 1; min-width: 200px; background: var(--bg-panel); padding: 1.5rem; border-radius: 0.75rem; border-left: 4px solid var(--accent-primary);">
            <h3 style="color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase;">Total General</h3>
            <p style="font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; color: var(--text-primary);">$${totalGeneral.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>
    `;

    // Add Closers
    for (const [closer, total] of Object.entries(closerTotals)) {
        container.innerHTML += `
            <div style="flex: 1; min-width: 200px; background: var(--bg-panel); padding: 1.5rem; border-radius: 0.75rem;">
                <h3 style="color: var(--text-secondary); font-size: 0.875rem; text-transform: uppercase;">${closer}</h3>
                <p style="font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; color: var(--success);">$${total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
        `;
    }

    // Update the Dispersions Chart (by Branch)
    updateDispersionesChart(branchTotals);
}

// Function to update the Dispersions Chart (by Branch) with specific colors
function updateDispersionesChart(totalsMap) {
    const labels = Object.keys(totalsMap);
    const data = Object.values(totalsMap);

    // Color palette for branches
    const branchColors = {
        'XALAPA 20 NOV': '#6366f1',
        'XALAPA ARAUCARIAS': '#8b5cf6',
        'VERACRUZ': '#22c55e',
        'ZAPOPAN': '#eab308',
        'MONTERREY CENTRO': '#3b82f6',
        'MONTERREY TERRANOVA': '#0ea5e9',
        'MONTERREY MOVIL': '#06b6d4',
        'PUEBLA ANZURES': '#f97316',
        'PUEBLA CHOLULA': '#fb923c',
        'QUERETARO': '#ec4899',
        'QUERETARO MOVIL': '#f43f5e',
        'GUADALAJARA MOVIL': '#10b981'
    };

    const backgroundColors = labels.map(label => branchColors[label] || '#94a3b8');

    if (dispersionesChartInstance) {
        dispersionesChartInstance.data.labels = labels;
        dispersionesChartInstance.data.datasets[0].data = data;
        dispersionesChartInstance.data.datasets[0].backgroundColor = backgroundColors;
        dispersionesChartInstance.update();
    }

    if (dashboardDispersionesChartInstance) {
        dashboardDispersionesChartInstance.data.labels = labels;
        dashboardDispersionesChartInstance.data.datasets[0].data = data;
        dashboardDispersionesChartInstance.data.datasets[0].backgroundColor = backgroundColors;
        dashboardDispersionesChartInstance.update();
    }
}

// ==========================================
// Chart.js Initialization (Graphical Section)
let branchChartInstance = null;
let statusChartInstance = null;
let dispersionesChartInstance = null;
let dashboardDispersionesChartInstance = null;

// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    applyGlobalFilter();
    
    // Branch Chart (Bar)
    const ctxBranch = document.getElementById('branchChart');
    if (ctxBranch) {
        branchChartInstance = new Chart(ctxBranch, {
            type: 'bar',
            data: {
                labels: ['XALAPA', 'VERACRUZ', 'ZAPOPAN', 'MONTERREY', 'QUERETARO', 'GUADALAJARA', 'PUEBLA'],
                datasets: [
                    { label: 'CITA', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#a855f7', borderRadius: 2 },
                    { label: 'DISPERSADO', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#22c55e', borderRadius: 2 },
                    { label: 'EN PROCESO', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#3b82f6', borderRadius: 2 },
                    { label: 'DETENIDO', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#eab308', borderRadius: 2 },
                    { label: 'RECHAZADO', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#ef4444', borderRadius: 2 },
                    { label: 'NO ASISTIO', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#f97316', borderRadius: 2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { color: '#64748b', boxWidth: 12 } } },
                scales: { 
                    y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(128,128,128,0.2)' }, ticks: { color: '#64748b', stepSize: 1 } },
                    x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b', maxRotation: 45, minRotation: 45 } }
                }
            }
        });
    }

    // Status Chart (Doughnut)
    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus) {
        statusChartInstance = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['CITA', 'DISPERSADO', 'EN PROCESO', 'DETENIDO', 'RECHAZADO', 'NO ASISTIO'],
                datasets: [{
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#a855f7', // CITA
                        '#22c55e', // DISPERSADO
                        '#3b82f6', // EN PROCESO
                        '#eab308', // DETENIDO
                        '#ef4444', // RECHAZADO
                        '#f97316'  // NO ASISTIO
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                },
                cutout: '70%'
            }
        });
    }

    updateDashboardCharts();

    // Dispersions Chart (Bar) - Performance per Closer
    const getDispChartConfig = () => ({
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Monto Total ($)',
                data: [],
                backgroundColor: [],
                borderRadius: 4,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `Total: $${context.raw.toLocaleString('en-US')}`
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(128,128,128,0.1)' },
                    ticks: { 
                        color: '#64748b',
                        callback: (value) => '$' + value.toLocaleString()
                    }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: '#64748b' }
                }
            }
        }
    });

    const ctxDisp = document.getElementById('dispersionesChart');
    if (ctxDisp) {
        dispersionesChartInstance = new Chart(ctxDisp, getDispChartConfig());
    }

    const ctxDashDisp = document.getElementById('dashboardDispersionesChart');
    if (ctxDashDisp) {
        dashboardDispersionesChartInstance = new Chart(ctxDashDisp, getDispChartConfig());
    }
});

function updateDashboardCharts() {
    const rows = document.querySelectorAll('#leads table tbody tr');
    const branches = ['XALAPA', 'VERACRUZ', 'ZAPOPAN', 'MONTERREY', 'QUERETARO', 'GUADALAJARA', 'PUEBLA'];
    const statuses = ['CITA', 'DISPERSADO', 'EN PROCESO', 'DETENIDO', 'RECHAZADO', 'NO ASISTIO'];
    
    let dataBranch = statuses.map(() => branches.map(() => 0));
    let dataStatus = statuses.map(() => 0);
    let leadsCount = 0;
    
    rows.forEach(row => {
        if(row.style.display === 'none') return;
        
        leadsCount++;
        
        const branchCell = row.cells[1] ? row.cells[1].innerText.toUpperCase() : '';
        const statusCell = row.cells[4] ? row.cells[4].innerText.toUpperCase() : '';
        
        let statusIndex = -1;
        if(statusCell.includes('CITA')) statusIndex = 0;
        else if(statusCell.includes('DISPERSADO')) statusIndex = 1;
        else if(statusCell.includes('EN PROCESO')) statusIndex = 2;
        else if(statusCell.includes('DETENIDO')) statusIndex = 3;
        else if(statusCell.includes('RECHAZADO') || statusCell.includes('NO VIABLE')) statusIndex = 4;
        else if(statusCell.includes('NO ASISTIO')) statusIndex = 5;
        
        if (statusIndex !== -1) {
            dataStatus[statusIndex]++;
            
            let bIndex = -1;
            if(branchCell.includes('XALAPA')) bIndex = 0;
            else if(branchCell.includes('VERACRUZ')) bIndex = 1;
            else if(branchCell.includes('ZAPOPAN')) bIndex = 2;
            else if(branchCell.includes('MONTERREY') || branchCell.includes('MTY')) bIndex = 3;
            else if(branchCell.includes('QUERETARO') || branchCell.includes('QRO')) bIndex = 4;
            else if(branchCell.includes('GUADALAJARA') || branchCell.includes('GDL')) bIndex = 5;
            else if(branchCell.includes('PUEBLA')) bIndex = 6;
            
            if (bIndex !== -1) {
                dataBranch[statusIndex][bIndex]++;
            }
        }
    });
    
    const totalLeadsEl = document.getElementById('totalLeadsMetric');
    if(totalLeadsEl) totalLeadsEl.innerText = leadsCount;
    
    if (branchChartInstance) {
        for(let i=0; i<statuses.length; i++) {
            branchChartInstance.data.datasets[i].data = dataBranch[i];
        }
        branchChartInstance.update();
    }
    
    if (statusChartInstance) {
        statusChartInstance.data.datasets[0].data = dataStatus;
        statusChartInstance.update();
    }
}

// ==========================================
// File Upload Logic
// ==========================================
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const grid = document.getElementById('assetsGrid');
    
    Array.from(files).forEach(file => {
        // Determine icon based on file type
        let iconClass = 'fa-file-lines';
        if (file.type.startsWith('image/')) iconClass = 'fa-image';
        if (file.type.startsWith('video/')) iconClass = 'fa-video';
        if (file.type.includes('pdf')) iconClass = 'fa-file-pdf';
        
        // Format size
        let size = (file.size / 1024).toFixed(1) + ' KB';
        if (file.size > 1024 * 1024) {
            size = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        const fileUrl = URL.createObjectURL(file);
        
        let previewHtml = `<i class="fa-solid ${iconClass} text-2xl" style="color: var(--text-secondary)"></i>`;
        if (file.type.startsWith('image/')) {
            previewHtml = `<img src="${fileUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (file.type.startsWith('video/')) {
            previewHtml = `<video src="${fileUrl}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>`;
        }

        const card = document.createElement('div');
        card.style.cssText = 'background: var(--bg-panel); border-radius: 0.75rem; overflow: hidden; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;';
        card.onmouseover = () => card.style.transform = 'translateY(-2px)';
        card.onmouseout = () => card.style.transform = 'translateY(0)';
        card.onclick = () => openMediaViewer(fileUrl, file.type, file.name);

        card.innerHTML = `
            <div style="height: 120px; background: linear-gradient(45deg, #1e293b, #334155); display: flex; align-items: center; justify-content: center; position: relative;">
                ${previewHtml}
                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); opacity: 0; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                    <i class="fa-solid fa-expand text-white text-3xl"></i>
                </div>
            </div>
            <div style="padding: 1rem;">
                <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</h4>
                <p style="font-size: 0.75rem; color: var(--text-secondary);">Recién subido • ${size}</p>
            </div>
        `;
        grid.insertBefore(card, grid.firstChild);
    });

    triggerNotification('Archivos subidos', `Se han subido ${files.length} archivo(s) exitosamente.`, 'success');
    
    // Reset input
    event.target.value = '';
}

// ==========================================
// Media Viewer Logic
// ==========================================
function openMediaViewer(url, type, name) {
    const modal = document.getElementById('mediaViewerModal');
    const content = document.getElementById('mediaViewerContent');
    document.getElementById('mediaViewerTitle').innerText = name;
    
    content.innerHTML = ''; // clear previous
    
    if (type.startsWith('image/')) {
        content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 0.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">`;
    } else if (type.startsWith('video/')) {
        content.innerHTML = `<video src="${url}" controls style="max-width: 100%; max-height: 80vh; border-radius: 0.5rem; outline: none;"></video>`;
    } else if (type === 'application/pdf') {
        content.innerHTML = `<iframe src="${url}" style="width: 80vw; height: 80vh; border: none; border-radius: 0.5rem; background: white;"></iframe>`;
    } else {
        content.innerHTML = `<div style="text-align: center; color: white;">
            <i class="fa-solid fa-file-lines" style="font-size: 4rem; margin-bottom: 1rem; color: var(--text-secondary)"></i>
            <p>Vista previa no disponible para este formato.<br><a href="${url}" download="${name}" style="color: var(--accent-primary); text-decoration: underline; margin-top: 1rem; display: inline-block;">Descargar archivo</a></p>
        </div>`;
    }
    
    modal.style.display = 'flex';
    setTimeout(() => modal.style.opacity = '1', 10);
}

function closeMediaViewer() {
    const modal = document.getElementById('mediaViewerModal');
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('mediaViewerContent').innerHTML = ''; // clear memory
    }, 300);
}

// ==========================================
// Theme Toggle Logic
// ==========================================
function toggleTheme() {
    const root = document.documentElement;
    const btn = document.getElementById('themeToggleBtn');
    
    if (root.getAttribute('data-theme') === 'dark') {
        root.removeAttribute('data-theme');
        btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        localStorage.setItem('crm-theme', 'light');
    } else {
        root.setAttribute('data-theme', 'dark');
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        localStorage.setItem('crm-theme', 'dark');
    }
}

// ==========================================
// Global Search Logic
// ==========================================
function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearchInput');
    const resultsDropdown = document.getElementById('globalSearchResults');
    if (!searchInput || !resultsDropdown) return;

    searchInput.addEventListener('focus', showSearch);
    searchInput.addEventListener('input', performSearch);
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
            hideSearch();
        }
    });

    function showSearch() {
        if (searchInput.value.trim().length > 0) {
            resultsDropdown.style.display = 'block';
        }
    }

    function hideSearch() {
        resultsDropdown.style.display = 'none';
    }

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length === 0) {
            hideSearch();
            return;
        }

        resultsDropdown.innerHTML = '';
        resultsDropdown.style.display = 'block';

        let hasResults = false;

        // 1. Search Clients / Leads
        if (window.cachedLeads && window.cachedLeads.length > 0) {
            const matchedLeads = window.cachedLeads.filter(lead => 
                (lead.nombre || '').toLowerCase().includes(query) ||
                (lead.vehiculo || '').toLowerCase().includes(query) ||
                (lead.numero || '').toLowerCase().includes(query) ||
                (lead.sucursal || '').toLowerCase().includes(query) ||
                (lead.observaciones || '').toLowerCase().includes(query)
            ).slice(0, 5);

            if (matchedLeads.length > 0) {
                hasResults = true;
                const catHeader = document.createElement('div');
                catHeader.className = 'search-category';
                catHeader.innerText = 'Clientes (Leads)';
                resultsDropdown.appendChild(catHeader);

                matchedLeads.forEach(lead => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.onclick = () => {
                        hideSearch();
                        switchView('leads');
                        openLeadPanel(
                            lead.id, 
                            lead.nombre || '', 
                            lead.etapa || '', 
                            lead.sucursal || '', 
                            lead.vehiculo || '', 
                            lead.numero || '', 
                            lead.observaciones || '',
                            lead.obs_encargado || '',
                            lead.fecha_cita || ''
                        );
                    };

                    let badgeClass = 'cita';
                    if(lead.etapa === 'DISPERSADO') badgeClass = 'dispersado';
                    if(lead.etapa === 'DETENIDO') badgeClass = 'detenido';
                    if(lead.etapa === 'NO VIABLE/ RECHAZADO/ SIN INTERES') badgeClass = 'rechazado';
                    if(lead.etapa === 'EN PROCESO') badgeClass = 'enproceso';
                    if(lead.etapa === 'NO ASISTIO') badgeClass = 'noasistio';

                    item.innerHTML = `
                        <div>
                            <div class="search-item-title">${escapeHTML(lead.nombre)}</div>
                            <div class="search-item-subtitle">${escapeHTML(lead.vehiculo || 'Sin vehículo')} • ${escapeHTML(lead.sucursal)}</div>
                        </div>
                        <span class="search-item-badge badge ${badgeClass}">${escapeHTML(lead.etapa)}</span>
                    `;
                    resultsDropdown.appendChild(item);
                });
            }
        }

        // 2. Search Dispersiones
        if (window.cachedDispersiones && window.cachedDispersiones.length > 0) {
            const matchedDisp = window.cachedDispersiones.filter(disp => 
                (disp.cliente || '').toLowerCase().includes(query) ||
                (disp.sucursal || '').toLowerCase().includes(query) ||
                (disp.calificador || '').toLowerCase().includes(query) ||
                (disp.closer || '').toLowerCase().includes(query)
            ).slice(0, 5);

            if (matchedDisp.length > 0) {
                hasResults = true;
                const catHeader = document.createElement('div');
                catHeader.className = 'search-category';
                catHeader.innerText = 'Dispersiones';
                resultsDropdown.appendChild(catHeader);

                matchedDisp.forEach(disp => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.onclick = () => {
                        hideSearch();
                        switchView('dispersiones');
                        const row = document.querySelector(`#dispersionesTableBody tr[data-id="${disp.id}"]`);
                        if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            row.style.outline = '2px solid var(--accent-primary)';
                            row.style.outlineOffset = '-2px';
                            setTimeout(() => {
                                row.style.outline = '';
                                row.style.outlineOffset = '';
                            }, 2500);
                        }
                    };

                    item.innerHTML = `
                        <div>
                            <div class="search-item-title">${escapeHTML(disp.cliente)}</div>
                            <div class="search-item-subtitle">Closer: ${escapeHTML(disp.closer || 'Sin asignar')} • ${escapeHTML(disp.sucursal)}</div>
                        </div>
                        <span class="search-item-badge text-success font-medium" style="color: var(--success);">$${Number(disp.monto).toLocaleString('en-US')}</span>
                    `;
                    resultsDropdown.appendChild(item);
                });
            }
        }

        // 3. Search Tasks
        if (window.cachedTasks && window.cachedTasks.length > 0) {
            const matchedTasks = window.cachedTasks.filter(task => 
                (task.titulo || '').toLowerCase().includes(query) ||
                (task.descripcion || '').toLowerCase().includes(query) ||
                (task.asignado_a || '').toLowerCase().includes(query)
            ).slice(0, 5);

            if (matchedTasks.length > 0) {
                hasResults = true;
                const catHeader = document.createElement('div');
                catHeader.className = 'search-category';
                catHeader.innerText = 'Tareas';
                resultsDropdown.appendChild(catHeader);

                matchedTasks.forEach(task => {
                    const item = document.createElement('div');
                    item.className = 'search-item';
                    item.onclick = () => {
                        hideSearch();
                        switchView('kanban');
                        if (typeof openTaskPanel === 'function') {
                            openTaskPanel(task);
                        }
                    };

                    let badgeClass = 'cita';
                    if (task.columna === 'done') badgeClass = 'dispersado';
                    if (task.columna === 'progress') badgeClass = 'enproceso';

                    item.innerHTML = `
                        <div>
                            <div class="search-item-title">${escapeHTML(task.titulo)}</div>
                            <div class="search-item-subtitle">Asignado: ${escapeHTML(task.asignado_a || 'Sin asignar')}</div>
                        </div>
                        <span class="search-item-badge badge ${badgeClass}">${escapeHTML(task.columna.toUpperCase())}</span>
                    `;
                    resultsDropdown.appendChild(item);
                });
            }
        }

        if (!hasResults) {
            const noRes = document.createElement('div');
            noRes.className = 'no-results';
            noRes.innerText = 'No se encontraron resultados';
            resultsDropdown.appendChild(noRes);
        }
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Check saved theme on load
document.addEventListener('DOMContentLoaded', async () => {
    checkAuth();
    initGlobalSearch();

    const savedTheme = localStorage.getItem('crm-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    // Initialize data and listeners if already logged in
    if (localStorage.getItem('crm-logged-in')) {
        await fetchLeads();
        await fetchTasks();
        if(typeof fetchDispersiones === 'function') await fetchDispersiones();
        await fetchChatMessages();
        updateWeekLabels(document.getElementById('selectMonth')?.value || '2026-05');
        await generateReport();
        await updateRegistroLeadsView();
        if(typeof fetchLlamadas === 'function') await fetchLlamadas();
        setupRealtimeListeners();
        setupChatRealtime();
        setupReportRealtime();
        if(typeof setupLlamadasRealtime === 'function') setupLlamadasRealtime();
        requestNotificationPermission();
    }
});

// ==========================================
// Authentication Logic
// ==========================================
const allowedUsers = [
    { user: 'adminlr', pass: 'AdminLR123', initials: 'AD', panels: ['dashboard', 'leads', 'agendaManana', 'kanban', 'assets', 'dispersiones', 'chat', 'reportes', 'registroLeads', 'llamadas', 'demeritos', 'demeritosComerciales'] },
    { user: 'franco lozada', pass: 'Franco123', initials: 'FL', panels: ['dashboard', 'leads', 'agendaManana', 'kanban', 'assets', 'dispersiones', 'chat', 'registroLeads', 'llamadas', 'demeritos', 'demeritosComerciales'] },
    { user: 'fabiola mendoza', pass: 'Fabiola123', initials: 'FM', panels: ['dashboard', 'leads', 'agendaManana', 'kanban', 'assets', 'dispersiones', 'chat', 'registroLeads', 'llamadas'], readOnly: true },
    { user: 'fatima morales', pass: 'Fatima123', initials: 'FT', panels: ['kanban', 'leads', 'agendaManana', 'assets', 'chat'], readOnly: true },
    { user: 'marcela ramirez', pass: 'Marcela123', initials: 'MR', panels: ['dashboard', 'leads', 'agendaManana', 'kanban', 'assets', 'dispersiones', 'chat', 'registroLeads', 'llamadas', 'demeritos', 'demeritosComerciales'] },
    { user: 'martin orduña', pass: 'Martin123', initials: 'MO', panels: ['dashboard', 'leads', 'agendaManana', 'kanban', 'assets', 'dispersiones', 'chat', 'registroLeads', 'llamadas', 'demeritos', 'demeritosComerciales'] },
    { user: 'invitado', pass: 'invitado123', initials: 'IN', panels: ['dashboard', 'reportes'], readOnly: true },
    { user: 'daniel molano', pass: 'Daniel123', initials: 'DM', panels: ['dashboard', 'reportes', 'dispersiones', 'demeritosComerciales'] },
    { user: 'beto', pass: 'Beto123', initials: 'BE', panels: ['dashboard', 'leads', 'agendaManana', 'reportes', 'registroLeads', 'demeritos'] },
    { user: 'maggie', pass: 'Maggie123', initials: 'MA', panels: ['dashboard', 'leads', 'agendaManana', 'reportes', 'registroLeads', 'demeritos', 'dispersiones'] }
];

function isReadOnlyUser() {
    const session = localStorage.getItem('crm-logged-in');
    const u = allowedUsers.find(x => x.user === session);
    return u ? !!u.readOnly : false;
}

function switchView(targetId) {
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    navItems.forEach(nav => nav.classList.remove('active'));
    viewSections.forEach(section => section.classList.remove('active'));
    
    const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if(targetNav) targetNav.classList.add('active');
    
    const targetSection = document.getElementById(targetId);
    if(targetSection) targetSection.classList.add('active');
    
    // Forzar actualización visual/gráfica cuando la sección se vuelve visible
    setTimeout(() => {
        if (targetId === 'reportes') {
            generateReport();
        } else if (targetId === 'dispersiones') {
            if (typeof updateCloserSummary === 'function') updateCloserSummary();
        } else if (targetId === 'dashboard') {
            if (typeof updateDashboardCharts === 'function') updateDashboardCharts();
            if (typeof updateCloserSummary === 'function') updateCloserSummary();
        } else if (targetId === 'registroLeads') {
            if (typeof updateRegistroLeadsView === 'function') updateRegistroLeadsView();
        } else if (targetId === 'demeritos') {
            if (typeof renderAsistenciasView === 'function') renderAsistenciasView();
        } else if (targetId === 'demeritosComerciales') {
            if (typeof renderDemeritosComercialesView === 'function') renderDemeritosComercialesView();
        } else if (targetId === 'llamadas') {
            if (typeof fetchLlamadas === 'function') fetchLlamadas();
        } else if (targetId === 'agendaManana') {
            if (typeof renderAgendaManana === 'function') renderAgendaManana();
        }
    }, 50);
}

function applyPermissions(user) {
    document.getElementById('userAvatar').innerText = user.initials;
    
    // Hide all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.style.display = 'none';
    });
    
    // Show allowed
    user.panels.forEach(panel => {
        const nav = document.querySelector(`.nav-item[data-target="${panel}"]`);
        if(nav) nav.style.display = 'flex';
    });
    
    // Read-only logic
    let styleEl = document.getElementById('readonly-styles');
    if (user.readOnly) {
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'readonly-styles';
            styleEl.innerHTML = `
                button[onclick^="openNew"],
                button[onclick^="delete"],
                button[onclick^="save"],
                button[onclick="document.getElementById('assetUpload').click()"],
                button[type="submit"] { display: none !important; }
                tr[onclick] { cursor: not-allowed !important; opacity: 0.9; }
                .kanban-cards .kanban-card { cursor: not-allowed !important; opacity: 0.9; }
                .data-table td button { display: none !important; }
            `;
            document.head.appendChild(styleEl);
        }
    } else {
        if (styleEl) styleEl.remove();
    }
    
    // Switch to first allowed view
    if(user.panels.length > 0) {
        switchView(user.panels[0]);
    }
}

function checkAuth() {
    const session = localStorage.getItem('crm-logged-in');
    if (session) {
        document.getElementById('loginScreen').style.display = 'none';
        const currentUser = allowedUsers.find(u => u.user === session);
        if(currentUser) {
            applyPermissions(currentUser);
        }
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
    }
}

function attemptLogin() {
    const userVal = document.getElementById('loginUser').value.toLowerCase().trim();
    const passVal = document.getElementById('loginPass').value.trim();
    const errorEl = document.getElementById('loginError');
    
    const validUser = allowedUsers.find(u => u.user === userVal && u.pass === passVal);
    
    if (validUser) {
        localStorage.setItem('crm-logged-in', validUser.user);
        errorEl.style.display = 'none';
        
        const loginScreen = document.getElementById('loginScreen');
        loginScreen.style.opacity = '0';
        setTimeout(async () => {
            loginScreen.style.display = 'none';
            applyPermissions(validUser);
            
            // Cargar todos los datos de las vistas tras el login exitoso
            await fetchLeads();
            await fetchTasks();
            if(typeof fetchDispersiones === 'function') await fetchDispersiones();
            await fetchChatMessages();
            await generateReport();
            await updateRegistroLeadsView();
            if(typeof fetchLlamadas === 'function') await fetchLlamadas();
            
            // Inicializar realtime listeners
            setupRealtimeListeners();
            setupChatRealtime();
            if (typeof setupReportRealtime === 'function') setupReportRealtime();
            if (typeof setupLlamadasRealtime === 'function') setupLlamadasRealtime();
            requestNotificationPermission();
        }, 300);
        
        triggerNotification('Bienvenido', `Has iniciado sesión como ${validUser.user}`, 'success');
    } else {
        errorEl.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('crm-logged-in');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginScreen').style.opacity = '1';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    triggerNotification('Sesión Cerrada', 'Has salido del sistema.', 'warning');
}

// ==========================================
// Registro de Llamadas Logic (Supabase CRUD & Metrics)
// ==========================================
let currentLlamadaId = null;

function openNewLlamadaPanel() {
    currentLlamadaId = null;
    document.getElementById('llamadasPanelTitle').innerText = "Registrar Llamada";
    document.getElementById('llamadaIdInput').value = "";
    
    // Autoseleccionar usuario logueado por defecto si existe en la lista
    const loggedInUser = localStorage.getItem('crm-logged-in') || 'adminlr';
    const userSelect = document.getElementById('llamadaUsuarioInput');
    if (userSelect) {
        userSelect.value = loggedInUser;
    }
    
    document.getElementById('llamadaNumeroInput').value = "";
    document.getElementById('llamadaSucursalInput').value = "";
    document.getElementById('llamadaCitaInput').checked = false;
    document.getElementById('llamadaObsInput').value = "";
    
    const btnDel = document.getElementById('btnDeleteLlamada');
    if (btnDel) btnDel.style.display = 'none';
    
    document.getElementById('llamadasPanel').classList.add('open');
}

function openLlamadaPanel(call) {
    currentLlamadaId = call.id;
    document.getElementById('llamadasPanelTitle').innerText = "Editar Llamada";
    document.getElementById('llamadaIdInput').value = call.id;
    document.getElementById('llamadaUsuarioInput').value = call.usuario;
    document.getElementById('llamadaNumeroInput').value = call.numero;
    document.getElementById('llamadaSucursalInput').value = call.sucursal;
    document.getElementById('llamadaCitaInput').checked = call.cita_generada;
    document.getElementById('llamadaObsInput').value = call.observaciones || "";
    
    const btnDel = document.getElementById('btnDeleteLlamada');
    if (btnDel) btnDel.style.display = 'block';
    
    document.getElementById('llamadasPanel').classList.add('open');
}

function closeLlamadasPanel() {
    document.getElementById('llamadasPanel').classList.remove('open');
}

async function fetchLlamadas() {
    const filter = document.getElementById('llamadasDateFilter')?.value || 'today';
    
    const { data, error } = await supabaseClient
        .from('llamadas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching llamadas:', error);
        return;
    }
    
    let filteredData = data;
    const now = new Date();
    
    if (filter === 'today') {
        const todayStr = now.toLocaleDateString('en-GB'); // "DD/MM/YYYY"
        filteredData = data.filter(call => {
            const callDate = new Date(call.created_at);
            return callDate.toLocaleDateString('en-GB') === todayStr;
        });
    } else if (filter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        oneWeekAgo.setHours(0,0,0,0);
        filteredData = data.filter(call => {
            const callDate = new Date(call.created_at);
            return callDate >= oneWeekAgo;
        });
    }
    
    renderLlamadas(filteredData);
    updateLlamadasSummary(filteredData);
}

function renderLlamadas(data) {
    const tbody = document.getElementById('llamadasTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    data.forEach(call => {
        const tr = document.createElement('tr');
        tr.dataset.id = call.id;
        tr.onclick = () => openLlamadaPanel(call);

        const localDate = new Date(call.created_at).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const badgeClass = call.cita_generada ? 'badge dispersado' : 'badge rechazado';
        const badgeText = call.cita_generada ? 'SÍ' : 'NO';
        
        let shortObs = call.observaciones || '';
        if(shortObs.length > 50) shortObs = shortObs.substring(0, 50) + "...";

        tr.innerHTML = `
            <td>${localDate}</td>
            <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${call.usuario}</span></td>
            <td class="font-medium">${call.numero}</td>
            <td>${call.sucursal}</td>
            <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${call.observaciones || ''}">${shortObs}</td>
            <td><span class="${badgeClass}">${badgeText}</span></td>
            <td>
                <button onclick="event.stopPropagation(); deleteLlamada('${call.id}')" style="color: var(--danger); background: none; border: none; cursor: pointer; padding: 0.25rem;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateLlamadasSummary(calls) {
    const users = {
        'adminlr': { calls: 0, citas: 0, suffix: 'adminlr' },
        'franco': { calls: 0, citas: 0, suffix: 'franco' },
        'fabiola': { calls: 0, citas: 0, suffix: 'fabiola' },
        'marcela': { calls: 0, citas: 0, suffix: 'marcela' },
        'martin': { calls: 0, citas: 0, suffix: 'martin' }
    };

    calls.forEach(call => {
        const u = (call.usuario || '').toLowerCase().trim();
        if (u.includes('admin')) {
            users.adminlr.calls++;
            if (call.cita_generada) users.adminlr.citas++;
        } else if (u.includes('franco')) {
            users.franco.calls++;
            if (call.cita_generada) users.franco.citas++;
        } else if (u.includes('fabiola')) {
            users.fabiola.calls++;
            if (call.cita_generada) users.fabiola.citas++;
        } else if (u.includes('marcela')) {
            users.marcela.calls++;
            if (call.cita_generada) users.marcela.citas++;
        } else if (u.includes('martin')) {
            users.martin.calls++;
            if (call.cita_generada) users.martin.citas++;
        }
    });

    Object.keys(users).forEach(key => {
        const uData = users[key];
        const callsEl = document.getElementById(`callsCount-${uData.suffix}`);
        const citasEl = document.getElementById(`citasCount-${uData.suffix}`);
        const rateEl = document.getElementById(`conversionRate-${uData.suffix}`);
        const barEl = document.getElementById(`conversionBar-${uData.suffix}`);

        if (callsEl) callsEl.innerText = uData.calls;
        if (citasEl) citasEl.innerText = uData.citas;
        
        const rate = uData.calls > 0 ? Math.round((uData.citas / uData.calls) * 100) : 0;
        if (rateEl) rateEl.innerText = `Conversión: ${rate}%`;
        if (barEl) barEl.style.width = `${rate}%`;
    });
}

function applyLlamadasFilter() {
    fetchLlamadas();
}

async function saveLlamada() {
    const user = document.getElementById('llamadaUsuarioInput').value;
    const numero = document.getElementById('llamadaNumeroInput').value.trim();
    const sucursal = document.getElementById('llamadaSucursalInput').value;
    const citaGenerada = document.getElementById('llamadaCitaInput').checked;
    const obs = document.getElementById('llamadaObsInput').value.trim();

    if (!user || !numero || !sucursal) {
        triggerNotification('Error', 'Por favor completa todos los campos obligatorios', 'warning');
        return;
    }

    const callData = {
        usuario: user,
        numero: numero,
        sucursal: sucursal,
        cita_generada: citaGenerada,
        observaciones: obs
    };

    if (currentLlamadaId) {
        const { error } = await supabaseClient.from('llamadas').update(callData).eq('id', currentLlamadaId);
        if (!error) {
            triggerNotification('Éxito', 'Llamada actualizada correctamente', 'success');
        } else {
            console.error(error);
            triggerNotification('Error', 'No se pudo actualizar la llamada', 'warning');
        }
    } else {
        const { error } = await supabaseClient.from('llamadas').insert([callData]);
        if (!error) {
            triggerNotification('Éxito', 'Llamada registrada correctamente', 'success');
        } else {
            console.error(error);
            triggerNotification('Error', 'No se pudo registrar la llamada', 'warning');
        }
    }

    await fetchLlamadas();
    closeLlamadasPanel();
}

async function deleteCurrentLlamada() {
    if (currentLlamadaId && confirm('¿Estás seguro de que deseas eliminar esta llamada?')) {
        const { error } = await supabaseClient.from('llamadas').delete().eq('id', currentLlamadaId);
        if (!error) {
            triggerNotification('Éxito', 'Llamada eliminada', 'success');
            await fetchLlamadas();
            closeLlamadasPanel();
        } else {
            triggerNotification('Error', 'No se pudo eliminar la llamada', 'warning');
        }
    }
}

async function deleteLlamada(id) {
    if (confirm('¿Estás seguro de que deseas eliminar esta llamada?')) {
        const { error } = await supabaseClient.from('llamadas').delete().eq('id', id);
        if (!error) {
            triggerNotification('Éxito', 'Llamada eliminada', 'success');
            await fetchLlamadas();
        } else {
            triggerNotification('Error', 'No se pudo eliminar la llamada', 'warning');
        }
    }
}

function setupLlamadasRealtime() {
    supabaseClient
        .channel('llamadas-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, () => {
            fetchLlamadas();
        })
        .subscribe();
}

// ==========================================
// Excel Export (Reporte de Citas)
// ==========================================
async function exportLeadsToExcel() {
    const btn = document.getElementById('btnExportExcel');
    
    // Visual feedback
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    try {
        // Fetch all leads from Supabase
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Format data for Excel
        const rows = data.map(lead => ({
            'FECHA': new Date(lead.created_at).toLocaleDateString('en-GB'),
            'SUCURSAL': lead.sucursal || '',
            'NOMBRE': lead.nombre || '',
            'VEHÍCULO': lead.vehiculo || '',
            'ETAPA': lead.etapa || '',
            'NÚMERO': lead.numero || '',
            'AGENTE': lead.creado_por || '',
            'OBSERVACIONES': lead.observaciones || ''
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // Set column widths
        ws['!cols'] = [
            { wch: 12 },  // FECHA
            { wch: 22 },  // SUCURSAL
            { wch: 25 },  // NOMBRE
            { wch: 20 },  // VEHÍCULO
            { wch: 15 },  // ETAPA
            { wch: 15 },  // NÚMERO
            { wch: 18 },  // AGENTE
            { wch: 35 }   // OBSERVACIONES
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Reporte de Citas');

        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const fileName = `Reporte_Citas_${dateStr}.xlsx`;

        // Download
        XLSX.writeFile(wb, fileName);

        triggerNotification(
            'Excel Descargado',
            `${rows.length} leads exportados en "${fileName}"`,
            'success'
        );

    } catch (err) {
        console.error('[Excel Export] Error:', err);
        triggerNotification(
            'Error de Exportación',
            'No se pudo generar el archivo Excel.',
            'warning'
        );
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Exportar Excel';
        }
    }
}

// ==========================================
// Deméritos y Asistencias Logic
// ==========================================
async function renderDemeritosView() {
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const filterEl = document.getElementById('globalMonthFilter');
        const filterVal = filterEl ? filterEl.value : 'all';
        
        let filteredData = data;
        if (filterVal !== 'all') {
            filteredData = data.filter(lead => lead.created_at && lead.created_at.startsWith(filterVal));
        }

        const tbody = document.getElementById('demeritosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const citas = filteredData.filter(l => l.etapa === 'CITA');
        
        if(citas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay citas pendientes de evaluación para este mes.</td></tr>`;
        }

        citas.forEach(lead => {
            const tr = document.createElement('tr');
            const dDate = new Date(lead.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
            
            tr.innerHTML = `
                <td>${dDate}</td>
                <td>${lead.sucursal || ''}</td>
                <td class="font-medium">${lead.nombre || ''}</td>
                <td>${lead.vehiculo || ''}</td>
                <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${lead.creado_por || ''}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="background: var(--success); padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="updateAsistencia('${lead.id}', 'EN PROCESO')"><i class="fa-solid fa-check"></i> Sí Asistió</button>
                        <button class="btn btn-outline" style="border-color: var(--danger); color: var(--danger); padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="updateAsistencia('${lead.id}', 'NO ASISTIO')"><i class="fa-solid fa-xmark"></i> No Asistió</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // 2. Render Podium
        const podiumContainer = document.getElementById('demeritosPodium');
        if(!podiumContainer) return;
        
        const stats = {};
        filteredData.forEach(lead => {
            const agente = (lead.creado_por || '').toLowerCase().trim();
            if(!agente) return;
            if(!stats[agente]) stats[agente] = { asistidas: 0, noAsistidas: 0, total: 0 };
            
            if(['EN PROCESO', 'DISPERSADO', 'DETENIDO'].includes(lead.etapa)) {
                stats[agente].asistidas++;
                stats[agente].total++;
            } else if (lead.etapa === 'NO ASISTIO') {
                stats[agente].noAsistidas++;
                stats[agente].total++;
            }
        });

        const sortedAgents = Object.keys(stats).sort((a, b) => stats[b].asistidas - stats[a].asistidas).slice(0, 3);

        podiumContainer.innerHTML = '';
        const colors = ['#f59e0b', '#94a3b8', '#b45309']; // Oro, Plata, Bronce
        
        if(sortedAgents.length === 0) {
            podiumContainer.innerHTML = '<p style="color: var(--text-secondary); width: 100%;">Aún no hay datos suficientes para el podio.</p>';
        }

        sortedAgents.forEach((agente, index) => {
            const d = stats[agente];
            const div = document.createElement('div');
            div.style.cssText = `flex: 1; min-width: 200px; background: var(--bg-panel); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 1rem; position: relative; overflow: hidden;`;
            
            const ribbon = document.createElement('div');
            ribbon.style.cssText = `position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${colors[index] || 'var(--accent-primary)'};`;
            div.appendChild(ribbon);

            div.innerHTML += `
                <div style="width: 48px; height: 48px; border-radius: 50%; background: ${colors[index] || 'var(--accent-primary)'}20; color: ${colors[index] || 'var(--accent-primary)'}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                    #${index + 1}
                </div>
                <div style="flex: 1;">
                    <h3 style="color: var(--text-primary); font-size: 1rem; font-weight: 600; text-transform: capitalize; margin-bottom: 0.25rem;">${agente}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">Citas Asistidas: <strong style="color: var(--success)">${d.asistidas}</strong></p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">Deméritos: <strong style="color: var(--danger)">${d.noAsistidas}</strong></p>
                </div>
            `;
            podiumContainer.appendChild(div);
        });

    } catch (err) {
        console.error('Error renderDemeritosView:', err);
    }
}

async function updateAsistencia(leadId, nuevaEtapa) {
    if(!confirm(`¿Estás seguro de marcar esta cita como ${nuevaEtapa === 'EN PROCESO' ? 'SÍ ASISTIÓ' : 'NO ASISTIÓ'}?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({ etapa: nuevaEtapa, updated_at: new Date().toISOString() })
            .eq('id', leadId);

        if (error) throw error;
        
        triggerNotification('Evaluación guardada', 'La etapa del lead ha sido actualizada.', 'success');
        
        renderDemeritosView();
        if(typeof fetchLeads === 'function') fetchLeads();
        
    } catch(err) {
        console.error('Error updateAsistencia:', err);
        triggerNotification('Error', 'No se pudo guardar la evaluación.', 'danger');
    }
}

// ==========================================
// Módulo de Deméritos Comerciales (BI Dashboard)
// ==========================================
let demeritosData = [];
let categoriesData = [];
let activeDemeritosSubTab = 'bi';
let demeritoSortField = 'fecha';
let demeritoSortOrder = 'desc';
let currentDemeritoId = null;
let filteredDemeritos = [];
let demeritoStorageMode = 'supabase'; // 'supabase' or 'local'

// Gráficos del Módulo
let demeritoCharts = {
    sucursal: null,
    canal: null,
    tendencia: null,
    categoria: null,
    urgencia: null,
    responsables: null,
    diasSinIncidencias: null
};

// Categorías predeterminadas
const defaultCategories = [
    'Mala atención',
    'Seguimiento tardío',
    'Información incorrecta',
    'Error operativo',
    'Queja de cliente',
    'Incumplimiento de proceso',
    'Documentación incompleta',
    'Todo en orden',
    'Otro'
];

// Mock data realista para carga inicial (Abril, Mayo, Junio 2026)
const defaultDemeritos = [
    {
        id: 'mock-1',
        fecha: '2026-04-12',
        folio: 'DC-001',
        sucursal: 'XALAPA 20 NOV',
        canal: 'Redes',
        responsable: 'franco lozada',
        cliente: 'Carlos Mendoza',
        categoria: 'Seguimiento tardío',
        descripcion: 'El cliente reporta que tardaron más de 48 horas en responder su solicitud de cotización por WhatsApp, lo que causó molestia.',
        gravedad: 'Media',
        estatus: 'Cerrado',
        observaciones: 'Se habló con Franco para agilizar respuestas. Cliente atendido y conforme.',
        usuario_registra: 'adminlr',
        created_at: '2026-04-12T10:30:00.000Z'
    },
    {
        id: 'mock-2',
        fecha: '2026-04-25',
        folio: 'DC-002',
        sucursal: 'VERACRUZ',
        canal: 'Sucursal',
        responsable: 'fabiola mendoza',
        cliente: 'Ana Rodríguez',
        categoria: 'Mala atención',
        descripcion: 'Reclamación de mal trato en counter por parte del personal de recepción. El cliente se retiró molesto.',
        gravedad: 'Alta',
        estatus: 'Cerrado',
        observaciones: 'Se aplicó retroalimentación y se envió carta de disculpa al cliente con una cortesía.',
        usuario_registra: 'adminlr',
        created_at: '2026-04-25T14:45:00.000Z'
    },
    {
        id: 'mock-3',
        fecha: '2026-05-03',
        folio: 'DC-003',
        sucursal: 'MONTERREY CENTRO',
        canal: 'Externo',
        responsable: 'martin orduña',
        cliente: 'Roberto Gómez',
        categoria: 'Error operativo',
        descripcion: 'Captura incorrecta del año del vehículo en la solicitud de crédito, lo que retrasó la firma del contrato por 3 días.',
        gravedad: 'Crítica',
        estatus: 'Resuelto',
        observaciones: 'Se corrigió la captura en sistema y se agilizó la dispersión de fondos de inmediato.',
        usuario_registra: 'marcela ramirez',
        created_at: '2026-05-03T11:15:00.000Z'
    },
    {
        id: 'mock-4',
        fecha: '2026-05-10',
        folio: 'DC-004',
        sucursal: 'ZAPOPAN',
        canal: 'Sucursal Móvil',
        responsable: 'marcela ramirez',
        cliente: 'Sofia López',
        categoria: 'Documentación incompleta',
        descripcion: 'Faltó recabar la firma del cliente en el checklist de entrega física de la unidad.',
        gravedad: 'Baja',
        estatus: 'Cerrado',
        observaciones: 'Se recabó la firma digital en el portal del cliente al día siguiente.',
        usuario_registra: 'martin orduña',
        created_at: '2026-05-10T16:20:00.000Z'
    },
    {
        id: 'mock-5',
        fecha: '2026-05-18',
        folio: 'DC-005',
        sucursal: 'QUERETARO',
        canal: 'Redes',
        responsable: 'fatima morales',
        cliente: 'Luis Gutiérrez',
        categoria: 'Información incorrecta',
        descripcion: 'Se brindó información de enganche errónea por chat de Facebook. El cliente reclamó al llegar a sucursal.',
        gravedad: 'Media',
        estatus: 'Cerrado',
        observaciones: 'Se respetó la oferta del chat comercial para no perder el trato de venta.',
        usuario_registra: 'adminlr',
        created_at: '2026-05-18T09:00:00.000Z'
    },
    {
        id: 'mock-6',
        fecha: '2026-05-22',
        folio: 'DC-006',
        sucursal: 'XALAPA ARAUCARIAS',
        canal: 'Sucursal',
        responsable: 'franco lozada',
        cliente: '',
        categoria: 'Incumplimiento de proceso',
        descripcion: 'No se envió el reporte diario de llamadas y citas agendadas dentro del horario establecido.',
        gravedad: 'Alta',
        estatus: 'En revisión',
        observaciones: 'Bajo análisis del encargado comercial de zona para determinar reincidencia.',
        usuario_registra: 'adminlr',
        created_at: '2026-05-22T20:05:00.000Z'
    },
    {
        id: 'mock-7',
        fecha: '2026-05-30',
        folio: 'DC-007',
        sucursal: 'MONTERREY TERRANOVA',
        canal: 'Externo',
        responsable: 'marcela ramirez',
        cliente: 'Pedro Ramos',
        categoria: 'Queja de cliente',
        descripcion: 'Cliente molesto por recibir llamadas del call center fuera de horario hábil (10:00 PM).',
        gravedad: 'Alta',
        estatus: 'Resuelto',
        observaciones: 'Se dio de baja el número telefónico del marcador automático del turno nocturno.',
        usuario_registra: 'martin orduña',
        created_at: '2026-05-30T22:30:00.000Z'
    },
    {
        id: 'mock-8',
        fecha: '2026-06-02',
        folio: 'DC-008',
        sucursal: 'PUEBLA ANZURES',
        canal: 'Sucursal',
        responsable: 'martin orduña',
        cliente: 'Diana K.',
        categoria: 'Mala atención',
        descripcion: 'Discusión verbal subida de tono con un cliente en sala de espera por retraso en avalúo.',
        gravedad: 'Crítica',
        estatus: 'Pendiente',
        observaciones: 'Citados responsable y gerente comercial para determinar sanción administrativa.',
        usuario_registra: 'marcela ramirez',
        created_at: '2026-06-02T13:40:00.000Z'
    },
    {
        id: 'mock-9',
        fecha: '2026-06-05',
        folio: 'DC-009',
        sucursal: 'GUADALAJARA MOVIL',
        canal: 'Sucursal Móvil',
        responsable: 'franco lozada',
        cliente: 'Miguel Ortiz',
        categoria: 'Error operativo',
        descripcion: 'Retraso de más de 1 hora en la llegada del asesor móvil a la dirección del cliente sin avisar.',
        gravedad: 'Media',
        estatus: 'En revisión',
        observaciones: 'Se reprogramó la cita y se ofreció un bono de gasolina de cortesía.',
        usuario_registra: 'adminlr',
        created_at: '2026-06-05T12:00:00.000Z'
    },
    {
        id: 'mock-10',
        fecha: '2026-06-07',
        folio: 'DC-010',
        sucursal: 'QUERETARO MOVIL',
        canal: 'Redes',
        responsable: 'fatima morales',
        cliente: '',
        categoria: 'Seguimiento tardío',
        descripcion: 'Abandono de prospectos interesados de pauta publicitaria en Facebook sin contacto inicial por más de 36 horas.',
        gravedad: 'Baja',
        estatus: 'Pendiente',
        observaciones: 'Asignando leads de urgencia para mitigar pérdida de conversión.',
        usuario_registra: 'adminlr',
        created_at: '2026-06-07T08:50:00.000Z'
    },
    {
        id: 'mock-11',
        fecha: '2026-06-08',
        folio: 'DC-011',
        sucursal: 'PUEBLA CHOLULA',
        canal: 'Sucursal',
        responsable: 'fabiola mendoza',
        cliente: 'Raúl Torres',
        categoria: 'Documentación incompleta',
        descripcion: 'Expediente dispersado sin comprobante de domicilio digitalizado ni estado de cuenta verificado.',
        gravedad: 'Media',
        estatus: 'Pendiente',
        observaciones: 'Solicitado al agente que complete la documentación antes del cierre de mes.',
        usuario_registra: 'marcela ramirez',
        created_at: '2026-06-08T15:20:00.000Z'
    },
    {
        id: 'mock-12',
        fecha: '2026-06-09',
        folio: 'DC-012',
        sucursal: 'XALAPA 20 NOV',
        canal: 'Sucursal',
        responsable: 'martin orduña',
        cliente: 'Elena Torres',
        categoria: 'Información incorrecta',
        descripcion: 'Se le ofreció un simulador de financiamiento desactualizado con tasa no vigente.',
        gravedad: 'Alta',
        estatus: 'En revisión',
        observaciones: 'Revisando opciones financieras para poder igualar o compensar la tasa ofrecida.',
        usuario_registra: 'adminlr',
        created_at: '2026-06-09T11:10:00.000Z'
    }
];

// ==========================================
// 1. Inicialización y Carga de Datos Resiliente
// ==========================================
async function initDemeritosModule() {
    // Cargar Categorías
    await dbLoadCategories();
    // Cargar Deméritos
    await dbLoadDemeritos();
    
    // Poblar los elementos select del HTML con las categorías
    populateCategoriesSelects();
    
    // Aplicar filtros iniciales y renderizar
    applyDemeritosFilters();
    
    // Suscripción Realtime si estamos en Supabase
    if (demeritoStorageMode === 'supabase') {
        supabaseClient
            .channel('demeritos-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'demeritos_comerciales' }, () => {
                refreshDemeritosData();
            })
            .subscribe();
    }
}

async function dbLoadCategories() {
    try {
        if (demeritoStorageMode === 'supabase') {
            const { data, error } = await supabaseClient.from('demeritos_categorias').select('*').order('nombre');
            if (error) {
                // Si la tabla no existe (404/PGRST116), cambiamos a local
                if (error.status === 404 || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
                    console.warn('Tabla demeritos_categorias inexistente en Supabase. Cambiando a LocalStorage.');
                }
                loadCategoriesFromLocal();
            } else {
                categoriesData = data.map(c => c.nombre);
                if (categoriesData.length === 0) {
                    // Inicializar con las por defecto
                    for (const cat of defaultCategories) {
                        await supabaseClient.from('demeritos_categorias').insert([{ nombre: cat }]);
                    }
                    categoriesData = [...defaultCategories];
                }
            }
        } else {
            loadCategoriesFromLocal();
        }
    } catch (err) {
        console.error(err);
        loadCategoriesFromLocal();
    }
}

function loadCategoriesFromLocal() {
    const local = localStorage.getItem('crm-demeritos-categories');
    if (local) {
        categoriesData = JSON.parse(local);
    } else {
        categoriesData = [...defaultCategories];
        localStorage.setItem('crm-demeritos-categories', JSON.stringify(categoriesData));
    }
}

async function dbLoadDemeritos() {
    try {
        if (demeritoStorageMode === 'supabase') {
            const { data, error } = await supabaseClient.from('demeritos_comerciales').select('*').order('created_at', { ascending: false });
            if (error) {
                if (error.status === 404 || error.code === 'PGRST116' || error.message?.includes('does not exist')) {
                    demeritoStorageMode = 'local';
                }
                loadDemeritosFromLocal();
            } else {
                demeritosData = data || [];
                if (demeritosData.length === 0) {
                    // Inicializar con la mock data inicial
                    for (const item of defaultDemeritos) {
                        const { id, ...cleanItem } = item; // Quitar ID simulado para autogeneración en BD
                        await supabaseClient.from('demeritos_comerciales').insert([cleanItem]);
                    }
                    // Volver a leer
                    const { data: refetched } = await supabaseClient.from('demeritos_comerciales').select('*').order('created_at', { ascending: false });
                    demeritosData = refetched || [];
                }
            }
        } else {
            loadDemeritosFromLocal();
        }
    } catch (err) {
        console.error(err);
        loadDemeritosFromLocal();
    }
}

function loadDemeritosFromLocal() {
    const local = localStorage.getItem('crm-demeritos-data');
    if (local) {
        demeritosData = JSON.parse(local);
    } else {
        demeritosData = [...defaultDemeritos];
        localStorage.setItem('crm-demeritos-data', JSON.stringify(demeritosData));
    }
}

// Poblar los combos selectores con categorías del catálogo y responsables
function populateCategoriesSelects() {
    const formSelect = document.getElementById('demeritoCategoriaInput');
    const filterSelect = document.getElementById('filterDemCategoria');
    const respFilterSelect = document.getElementById('filterDemResponsable');
    
    if (formSelect) {
        formSelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría *</option>';
        categoriesData.forEach(c => {
            formSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">Todas</option>';
        categoriesData.forEach(c => {
            filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }

    if (respFilterSelect) {
        const uniqueResps = Array.from(new Set(demeritosData.map(d => d.responsable).filter(Boolean))).sort();
        respFilterSelect.innerHTML = '<option value="all">Todos</option>';
        uniqueResps.forEach(r => {
            respFilterSelect.innerHTML += `<option value="${r}">${r}</option>`;
        });
    }
}

// Actualizar datos
async function refreshDemeritosData() {
    await dbLoadCategories();
    await dbLoadDemeritos();
    populateCategoriesSelects();
    applyDemeritosFilters();
    triggerNotification('Datos Actualizados', 'La información de deméritos comerciales ha sido recargada.', 'info');
}

// ==========================================
// 2. Control de Pestañas (Sub-Tabs)
// ==========================================
// 2. Control de Vistas
// ==========================================

// Funciones puente requeridas por app.js cuando se hace click en la barra lateral
async function renderAsistenciasView() {
    await renderAsistenciasSubView();
}

async function renderDemeritosComercialesView() {
    await refreshDemeritosBIView();
}

// ==========================================
// 3. Renderizado del Dashboard BI
// ==========================================
async function refreshDemeritosBIView() {
    updateDemeritosKPIs(filteredDemeritos);
    renderDemeritosAlerts(filteredDemeritos);
    updateDemeritosCharts(filteredDemeritos);
    renderDemeritosHeatmap(filteredDemeritos);
    renderDemeritosListTable(filteredDemeritos);
}

// Carga de KPIs principales
function updateDemeritosKPIs(data) {
    const container = document.getElementById('demeritosKPIContainer');
    if (!container) return;
    
    // Cálculos
    const total = data.length;
    
    // Mes actual dinámico (ej. "2026-07")
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesActual = data.filter(d => d.fecha && d.fecha.startsWith(currentMonth)).length;
    
    // Pendientes / En revisión
    const pendientes = data.filter(d => ['Pendiente', 'En revisión'].includes(d.estatus)).length;
    
    // Resueltos / Cerrados
    const resueltos = data.filter(d => ['Resuelto', 'Cerrado'].includes(d.estatus)).length;
    
    // Sucursal con más incidencias
    const sucursalCounts = {};
    data.forEach(d => sucursalCounts[d.sucursal] = (sucursalCounts[d.sucursal] || 0) + 1);
    const topSucursal = Object.keys(sucursalCounts).sort((a,b) => sucursalCounts[b] - sucursalCounts[a])[0] || 'Ninguna';
    
    // Canal con más incidencias
    const canalCounts = {};
    data.forEach(d => canalCounts[d.canal] = (canalCounts[d.canal] || 0) + 1);
    const topCanal = Object.keys(canalCounts).sort((a,b) => canalCounts[b] - canalCounts[a])[0] || 'Ninguno';
    
    // Categoría más frecuente
    const catCounts = {};
    data.forEach(d => catCounts[d.categoria] = (catCounts[d.categoria] || 0) + 1);
    const topCat = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a])[0] || 'Ninguna';

    container.innerHTML = `
        <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-folder-open" style="color: var(--accent-primary)"></i> Total Registros</div>
            <div class="kpi-value">${total}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-calendar-day" style="color: var(--accent-primary)"></i> Mes Actual</div>
            <div class="kpi-value">${mesActual}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-spinner fa-spin" style="color: var(--warning)"></i> Pendientes</div>
            <div class="kpi-value" style="color: var(--warning)">${pendientes}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title"><i class="fa-solid fa-circle-check" style="color: var(--success)"></i> Resueltos</div>
            <div class="kpi-value" style="color: var(--success)">${resueltos}</div>
        </div>
        <div class="kpi-card" title="${topSucursal}">
            <div class="kpi-title"><i class="fa-solid fa-store" style="color: var(--danger)"></i> Sucursal Crítica</div>
            <div class="kpi-value" style="font-size: 0.95rem; line-height: 1.5; color: var(--danger)">${topSucursal}</div>
        </div>
        <div class="kpi-card" title="${topCanal}">
            <div class="kpi-title"><i class="fa-solid fa-share-nodes" style="color: var(--accent-primary)"></i> Canal Crítico</div>
            <div class="kpi-value" style="font-size: 0.95rem; line-height: 1.5;">${topCanal}</div>
        </div>
        <div class="kpi-card" title="${topCat}">
            <div class="kpi-title"><i class="fa-solid fa-tags" style="color: var(--accent-primary)"></i> Cat. Común</div>
            <div class="kpi-value" style="font-size: 0.95rem; line-height: 1.5; white-space: normal;">${topCat}</div>
        </div>
    `;
}

// Algoritmo de Alertas en Tiempo Real
function renderDemeritosAlerts(data) {
    const container = document.getElementById('demeritosAlertsContainer');
    if (!container) return;
    
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMonthName = mesesNombres[now.getMonth()];
    const alerts = [];
    
    // 1. Sucursal con > 3 deméritos en el mes actual
    const sucursalCounts = {};
    data.filter(d => d.fecha && d.fecha.startsWith(currentMonthStr)).forEach(d => {
        sucursalCounts[d.sucursal] = (sucursalCounts[d.sucursal] || 0) + 1;
    });
    Object.keys(sucursalCounts).forEach(s => {
        if (sucursalCounts[s] > 3) {
            alerts.push({
                type: 'critical',
                icon: 'fa-triangle-exclamation',
                text: `Alerta Sucursal: <strong>${s}</strong> supera el límite mensual con <strong>${sucursalCounts[s]}</strong> incidencias registradas en ${currentMonthName}.`
            });
        }
    });
    
    // 2. Deméritos críticos sin resolver
    const criticalUnresolved = data.filter(d => d.gravedad === 'Crítica' && ['Pendiente', 'En revisión'].includes(d.estatus));
    criticalUnresolved.forEach(d => {
        alerts.push({
            type: 'critical',
            icon: 'fa-circle-xmark',
            text: `Incidencia Crítica Abierta: El folio <strong>${d.folio}</strong> (${d.sucursal}) está en estatus "${d.estatus}" y requiere atención inmediata. Responsable: <strong>${d.responsable}</strong>.`
        });
    });
    
    // 3. Colaborador con > 2 incidencias en el mes actual
    const respCounts = {};
    data.filter(d => d.fecha && d.fecha.startsWith(currentMonthStr)).forEach(d => {
        if(d.responsable) respCounts[d.responsable] = (respCounts[d.responsable] || 0) + 1;
    });
    Object.keys(respCounts).forEach(r => {
        if (respCounts[r] > 2) {
            alerts.push({
                type: 'warning',
                icon: 'fa-user-ninja',
                text: `Alerta Colaborador: <strong>${r}</strong> acumula <strong>${respCounts[r]}</strong> incidencias en el mes en curso. Recomendable revisión de desempeño.`
            });
        }
    });
    
    // Renderizado
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="alert-card warning" style="border-left-color: var(--success); background: rgba(16, 185, 129, 0.08); color: var(--text-primary);">
                <i class="fa-solid fa-circle-check" style="color: var(--success);"></i>
                <span>No hay alertas activas en la operación comercial. Excelente desempeño general.</span>
            </div>
        `;
    } else {
        container.innerHTML = '';
        alerts.forEach(al => {
            const card = document.createElement('div');
            card.className = `alert-card ${al.type}`;
            card.innerHTML = `<i class="fa-solid ${al.icon}"></i> <span>${al.text}</span>`;
            container.appendChild(card);
        });
    }
}

// Tabla de Calor (Heatmap)
function renderDemeritosHeatmap(data) {
    const container = document.getElementById('demeritosHeatmapContainer');
    if (!container) return;
    
    const sucursales = [
        'XALAPA 20 NOV', 'XALAPA ARAUCARIAS', 'VERACRUZ', 'ZAPOPAN', 
        'MONTERREY CENTRO', 'MONTERREY TERRANOVA', 'MONTERREY MOVIL', 
        'QUERETARO', 'QUERETARO MOVIL', 'GUADALAJARA MOVIL', 
        'PUEBLA ANZURES', 'PUEBLA CHOLULA'
    ];
    
    const matrix = {};
    sucursales.forEach(s => {
        matrix[s] = { 'Baja': 0, 'Media': 0, 'Alta': 0, 'Crítica': 0, 'Total': 0 };
    });
    
    data.forEach(d => {
        if (matrix[d.sucursal] && matrix[d.sucursal][d.gravedad] !== undefined) {
            matrix[d.sucursal][d.gravedad]++;
            matrix[d.sucursal].Total++;
        }
    });
    
    let maxTotal = 1;
    sucursales.forEach(s => {
        if (matrix[s].Total > maxTotal) maxTotal = matrix[s].Total;
    });
    
    let html = `<table class="heatmap-table">
        <thead>
            <tr>
                <th style="text-align: left; padding-left: 0.75rem;">Sucursal</th>
                <th style="width: 15%;">Baja</th>
                <th style="width: 15%;">Media</th>
                <th style="width: 15%;">Alta</th>
                <th style="width: 15%;">Crítica</th>
                <th style="width: 15%; background-color: var(--bg-dark);">Total</th>
            </tr>
        </thead>
        <tbody>`;
        
    sucursales.forEach(s => {
        const row = matrix[s];
        const bgTotalOpacity = (row.Total / maxTotal) * 0.35; // max opacity 35%
        const bgTotalColor = row.Total > 0 ? `background-color: rgba(239, 68, 68, ${bgTotalOpacity});` : '';
        
        html += `<tr>
            <td class="branch-label">${s}</td>
            <td class="heatmap-cell" style="${row.Baja > 0 ? 'background-color: rgba(16, 185, 129, 0.15); color: var(--success);' : 'color: var(--text-secondary); opacity: 0.5;'}">${row.Baja}</td>
            <td class="heatmap-cell" style="${row.Media > 0 ? 'background-color: rgba(245, 158, 11, 0.15); color: var(--warning);' : 'color: var(--text-secondary); opacity: 0.5;'}">${row.Media}</td>
            <td class="heatmap-cell" style="${row.Alta > 0 ? 'background-color: rgba(239, 68, 68, 0.15); color: var(--danger);' : 'color: var(--text-secondary); opacity: 0.5;'}">${row.Alta}</td>
            <td class="heatmap-cell" style="${row.Crítica > 0 ? 'background-color: rgba(239, 68, 68, 0.3); color: var(--danger); text-shadow: 0 0 2px rgba(0,0,0,0.2); font-weight: 800;' : 'color: var(--text-secondary); opacity: 0.5;'}">${row.Crítica}</td>
            <td style="font-weight: bold; ${bgTotalColor}">${row.Total}</td>
        </tr>`;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// ==========================================
// 4. Renderizado de Gráficos (Chart.js)
// ==========================================
function updateDemeritosCharts(data) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const labelColor = '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    
    // Colores corporativos del CRM
    const primaryLime = '#bdfb2f';
    const secondarySlate = '#94a3b8';
    
    // --- 1. Gráfico Sucursales (Barras Verticales) ---
    const ctxSuc = document.getElementById('demeritosSucursalChart');
    if (ctxSuc) {
        const sucursales = ['XALAPA 20 NOV', 'XALAPA ARAUCARIAS', 'VERACRUZ', 'ZAPOPAN', 'MONTERREY CENTRO', 'MONTERREY TERRANOVA', 'MONTERREY MOVIL', 'QUERETARO', 'QUERETARO MOVIL', 'GUADALAJARA MOVIL', 'PUEBLA ANZURES', 'PUEBLA CHOLULA'];
        const counts = sucursales.map(s => data.filter(d => d.sucursal === s).length);
        
        if (demeritoCharts.sucursal) demeritoCharts.sucursal.destroy();
        demeritoCharts.sucursal = new Chart(ctxSuc, {
            type: 'bar',
            data: {
                labels: sucursales.map(s => s.replace('MONTERREY', 'MTY').replace('XALAPA', 'XAL').replace('PUEBLA', 'PUE').replace('QUERETARO', 'QRO')),
                datasets: [{
                    label: 'Incidencias',
                    data: counts,
                    backgroundColor: primaryLime,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, stepSize: 1 } },
                    x: { grid: { display: false }, ticks: { color: labelColor, maxRotation: 45, minRotation: 45, font: { size: 9 } } }
                }
            }
        });
    }

    // --- 2. Gráfico Canal (Pastel / Pie) ---
    const ctxCan = document.getElementById('demeritosCanalChart');
    if (ctxCan) {
        const canales = ['Redes', 'Sucursal', 'Externo', 'Sucursal Móvil'];
        const counts = canales.map(c => data.filter(d => d.canal === c).length);
        
        if (demeritoCharts.canal) demeritoCharts.canal.destroy();
        demeritoCharts.canal = new Chart(ctxCan, {
            type: 'pie',
            data: {
                labels: canales,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#6366f1', primaryLime, '#ec4899', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 10, font: { size: 10 } } }
                }
            }
        });
    }

    // --- 3. Gráfico Tendencia Mensual (Líneas) ---
    const ctxTen = document.getElementById('demeritosTendenciaChart');
    if (ctxTen) {
        const meses = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
        const labels = ['Abril 2026', 'Mayo 2026', 'Junio 2026', 'Julio 2026', 'Agosto 2026', 'Septiembre 2026', 'Octubre 2026', 'Noviembre 2026', 'Diciembre 2026'];
        const counts = meses.map(m => data.filter(d => d.fecha && d.fecha.startsWith(m)).length);
        
        if (demeritoCharts.tendencia) demeritoCharts.tendencia.destroy();
        demeritoCharts.tendencia = new Chart(ctxTen, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Incidencias',
                    data: counts,
                    borderColor: primaryLime,
                    backgroundColor: 'rgba(189, 251, 47, 0.1)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: primaryLime,
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, stepSize: 1 } },
                    x: { grid: { color: gridColor }, ticks: { color: labelColor } }
                }
            }
        });
    }

    // --- 4. Gráfico por Categoría (Barras Horizontales Ordenadas) ---
    const ctxCat = document.getElementById('demeritosCategoriaChart');
    if (ctxCat) {
        const catCounts = {};
        categoriesData.forEach(c => catCounts[c] = 0);
        data.forEach(d => {
            if (catCounts[d.categoria] !== undefined) catCounts[d.categoria]++;
            else catCounts['Otro'] = (catCounts['Otro'] || 0) + 1;
        });
        
        const sortedCats = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a]);
        const counts = sortedCats.map(c => catCounts[c]);
        
        if (demeritoCharts.categoria) demeritoCharts.categoria.destroy();
        demeritoCharts.categoria = new Chart(ctxCat, {
            type: 'bar',
            data: {
                labels: sortedCats,
                datasets: [{
                    data: counts,
                    backgroundColor: 'rgba(99, 102, 241, 0.85)',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, stepSize: 1 } },
                    y: { grid: { display: false }, ticks: { color: labelColor, font: { size: 9 } } }
                }
            }
        });
    }

    // --- 5. Urgencia (Dona / Doughnut) ---
    const ctxGrav = document.getElementById('demeritosUrgenciaChart');
    if (ctxGrav) {
        const gravedades = ['Baja', 'Media', 'Alta', 'Crítica'];
        const counts = gravedades.map(g => data.filter(d => d.gravedad === g).length);
        
        if (demeritoCharts.urgencia) demeritoCharts.urgencia.destroy();
        demeritoCharts.urgencia = new Chart(ctxGrav, {
            type: 'doughnut',
            data: {
                labels: gravedades,
                datasets: [{
                    data: counts,
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 10, font: { size: 10 } } }
                }
            }
        });
    }

    // --- 6. Top Responsables (Barras Verticales) ---
    const ctxResp = document.getElementById('demeritosResponsablesChart');
    if (ctxResp) {
        const respCounts = {};
        data.forEach(d => {
            if(d.responsable) respCounts[d.responsable] = (respCounts[d.responsable] || 0) + 1;
        });
        
        const sortedResps = Object.keys(respCounts).sort((a,b) => respCounts[b] - respCounts[a]).slice(0, 5);
        const counts = sortedResps.map(r => respCounts[r]);
        
        if (demeritoCharts.responsables) demeritoCharts.responsables.destroy();
        demeritoCharts.responsables = new Chart(ctxResp, {
            type: 'bar',
            data: {
                labels: sortedResps.map(r => r.split(' ')[0]), // Primer nombre para compactar
                datasets: [{
                    data: counts,
                    backgroundColor: '#fb923c',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, stepSize: 1 } },
                    x: { grid: { display: false }, ticks: { color: labelColor } }
                }
            }
        });
    }

    // --- 8. Días sin Incidencias por Sucursal (Barras Horizontales) ---
    const ctxDias = document.getElementById('demeritosDiasSinIncidenciasChart');
    if (ctxDias) {
        const sucursales = ['XALAPA 20 NOV', 'XALAPA ARAUCARIAS', 'VERACRUZ', 'ZAPOPAN', 'MONTERREY CENTRO', 'MONTERREY TERRANOVA', 'MONTERREY MOVIL', 'QUERETARO', 'QUERETARO MOVIL', 'GUADALAJARA MOVIL', 'PUEBLA ANZURES', 'PUEBLA CHOLULA'];
        const now = new Date();
        const diasSinIncidenciasData = sucursales.map(s => {
            const branchDemeritos = demeritosData.filter(d => d.sucursal === s && d.fecha);
            if (branchDemeritos.length === 0) return 30; // 30+ días
            const dates = branchDemeritos.map(d => new Date(d.fecha + 'T12:00:00'));
            const latestDate = new Date(Math.max(...dates));
            const diffTime = now - latestDate;
            const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            return diffDays;
        });

        if (demeritoCharts.diasSinIncidencias) demeritoCharts.diasSinIncidencias.destroy();
        demeritoCharts.diasSinIncidencias = new Chart(ctxDias, {
            type: 'bar',
            data: {
                labels: sucursales.map(s => s.replace('MONTERREY', 'MTY').replace('XALAPA', 'XAL').replace('PUEBLA', 'PUE').replace('QUERETARO', 'QRO')),
                datasets: [{
                    data: diasSinIncidenciasData,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor, stepSize: 5 } },
                    y: { grid: { display: false }, ticks: { color: labelColor, font: { size: 9 } } }
                }
            }
        });
    }
}

// ==========================================
// 5. Filtros Avanzados y Búsqueda Rápida
// ==========================================
function applyDemeritosFilters() {
    const fInicio = document.getElementById('filterDemFechaInicio')?.value;
    const fFin = document.getElementById('filterDemFechaFin')?.value;
    const sucursal = document.getElementById('filterDemSucursal')?.value || 'all';
    const canal = document.getElementById('filterDemCanal')?.value || 'all';
    const categoria = document.getElementById('filterDemCategoria')?.value || 'all';
    const responsable = document.getElementById('filterDemResponsable')?.value || 'all';
    const gravedad = document.getElementById('filterDemGravedad')?.value || 'all';
    const estatus = document.getElementById('filterDemEstatus')?.value || 'all';
    const search = document.getElementById('demeritosSearchInput')?.value?.toLowerCase()?.trim() || '';
    const globalMonth = document.getElementById('globalMonthFilter')?.value || 'all';
    
    filteredDemeritos = demeritosData.filter(d => {
        // Filtro de mes global
        if (globalMonth !== 'all') {
            if (!d.fecha || !d.fecha.startsWith(globalMonth)) return false;
        }

        // Filtro Fechas
        if (fInicio && d.fecha < fInicio) return false;
        if (fFin && d.fecha > fFin) return false;
        
        // Filtros directos
        if (sucursal !== 'all' && d.sucursal !== sucursal) return false;
        if (canal !== 'all' && d.canal !== canal) return false;
        if (categoria !== 'all' && d.categoria !== categoria) return false;
        if (responsable !== 'all' && d.responsable !== responsable) return false;
        if (gravedad !== 'all' && d.gravedad !== gravedad) return false;
        if (estatus !== 'all' && d.estatus !== estatus) return false;
        
        // Búsqueda rápida
        if (search) {
            const matchesSearch = 
                d.folio?.toLowerCase()?.includes(search) ||
                d.responsable?.toLowerCase()?.includes(search) ||
                d.cliente?.toLowerCase()?.includes(search) ||
                d.modelo_auto?.toLowerCase()?.includes(search) ||
                d.categoria?.toLowerCase()?.includes(search) ||
                d.descripcion?.toLowerCase()?.includes(search) ||
                d.observaciones?.toLowerCase()?.includes(search) ||
                d.sucursal?.toLowerCase()?.includes(search);
            if (!matchesSearch) return false;
        }
        
        return true;
    });
    
    // Aplicar Ordenamiento
    filteredDemeritos.sort((a, b) => {
        let valA = a[demeritoSortField] || '';
        let valB = b[demeritoSortField] || '';
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return demeritoSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return demeritoSortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    // Refrescar Visuals
    updateDemeritosKPIs(filteredDemeritos);
    renderDemeritosAlerts(filteredDemeritos);
    updateDemeritosCharts(filteredDemeritos);
    renderDemeritosHeatmap(filteredDemeritos);
    renderDemeritosListTable(filteredDemeritos);
}

function clearDemeritosFilters() {
    const fInicio = document.getElementById('filterDemFechaInicio');
    const fFin = document.getElementById('filterDemFechaFin');
    const sucursal = document.getElementById('filterDemSucursal');
    const canal = document.getElementById('filterDemCanal');
    const categoria = document.getElementById('filterDemCategoria');
    const responsable = document.getElementById('filterDemResponsable');
    const gravedad = document.getElementById('filterDemGravedad');
    const estatus = document.getElementById('filterDemEstatus');
    const search = document.getElementById('demeritosSearchInput');
    
    if (fInicio) fInicio.value = '';
    if (fFin) fFin.value = '';
    if (sucursal) sucursal.value = 'all';
    if (canal) canal.value = 'all';
    if (categoria) categoria.value = 'all';
    if (responsable) responsable.value = 'all';
    if (gravedad) gravedad.value = 'all';
    if (estatus) estatus.value = 'all';
    if (search) search.value = '';
    
    applyDemeritosFilters();
}

function sortDemeritos(field) {
    if (demeritoSortField === field) {
        demeritoSortOrder = demeritoSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        demeritoSortField = field;
        demeritoSortOrder = 'desc'; // Por defecto descendente
    }
    
    // Actualizar íconos
    const fields = ['fecha', 'folio', 'sucursal', 'canal', 'categoria', 'gravedad', 'estatus', 'responsable', 'usuario_registra'];
    fields.forEach(f => {
        const el = document.getElementById(`sort-icon-${f}`);
        if (el) {
            if (f === demeritoSortField) {
                el.innerHTML = demeritoSortOrder === 'asc' ? '<i class="fa-solid fa-sort-up" style="color: var(--accent-primary)"></i>' : '<i class="fa-solid fa-sort-down" style="color: var(--accent-primary)"></i>';
            } else {
                el.innerHTML = '<i class="fa-solid fa-sort"></i>';
            }
        }
    });
    
    applyDemeritosFilters();
}

// ==========================================
// 6. Tabla de Consulta
// ==========================================
function renderDemeritosListTable(data) {
    const tbody = document.getElementById('demeritosListTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No se encontraron deméritos con los filtros seleccionados.</td></tr>`;
        return;
    }
    
    data.forEach(d => {
        const tr = document.createElement('tr');
        tr.onclick = () => openDemeritoPanel(d);
        
        // Formatear Fecha
        let localDateStr = d.fecha || '';
        try {
            const parts = d.fecha.split('-');
            if(parts.length === 3) {
                localDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        } catch(e){}
        
        // Estatus Badge
        let badgeEstatus = 'badge enproceso';
        if (d.estatus === 'Pendiente') badgeEstatus = 'badge detenido';
        if (d.estatus === 'En revisión') badgeEstatus = 'badge noasistio';
        if (d.estatus === 'Resuelto') badgeEstatus = 'badge cita';
        if (d.estatus === 'Cerrado') badgeEstatus = 'badge dispersado';
        
        // Gravedad Badge
        let badgeGrav = 'badge enproceso';
        if (d.gravedad === 'Baja') badgeGrav = 'badge enproceso';
        if (d.gravedad === 'Media') badgeGrav = 'badge detenido';
        if (d.gravedad === 'Alta') badgeGrav = 'badge noasistio';
        if (d.gravedad === 'Crítica') badgeGrav = 'badge rechazado';
        
        tr.innerHTML = `
            <td>${localDateStr}</td>
            <td class="font-medium">${d.folio || ''}</td>
            <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${d.sucursal || ''}</span></td>
            <td>${d.canal || ''}</td>
            <td>${d.cliente || ''}</td>
            <td>${d.modelo_auto || ''}</td>
            <td>${d.categoria || ''}</td>
            <td><span class="${badgeGrav}">${d.gravedad || ''}</span></td>
            <td><span class="${badgeEstatus}">${d.estatus || ''}</span></td>
            <td class="font-medium" style="text-transform: capitalize;">${d.responsable || ''}</td>
            <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${d.usuario_registra || ''}</span></td>
            <td>
                <button onclick="event.stopPropagation(); deleteDemerito('${d.id}')" style="color: var(--danger); background: none; border: none; cursor: pointer; padding: 0.25rem;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 7. Modales y Formulario (Slide-over)
// ==========================================
function openNewDemeritoPanel() {
    currentDemeritoId = null;
    document.getElementById('demeritoPanelTitle').innerText = "Registrar Demérito";
    document.getElementById('demeritoIdInput').value = "";
    
    // Auto-generación del folio
    const nextNum = demeritosData.reduce((max, d) => {
        if(d.folio && d.folio.startsWith('DC-')) {
            const num = parseInt(d.folio.substring(3)) || 0;
            return num > max ? num : max;
        }
        return max;
    }, 0) + 1;
    const nextFolio = `DC-${String(nextNum).padStart(3, '0')}`;
    
    document.getElementById('demeritoFolioInput').value = nextFolio;
    
    // Configurar hoy por defecto
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset*60*1000));
    document.getElementById('demeritoFechaInput').value = localDate.toISOString().split('T')[0];
    
    document.getElementById('demeritoSucursalInput').value = "";
    document.getElementById('demeritoCanalInput').value = "";
    document.getElementById('demeritoResponsableInput').value = "";
    document.getElementById('demeritoClienteInput').value = "";
    document.getElementById('demeritoAutoInput').value = "";
    document.getElementById('demeritoCategoriaInput').value = "";
    document.getElementById('demeritoDescripcionInput').value = "";
    document.getElementById('demeritoGravedadInput').value = "Media";
    document.getElementById('demeritoEstatusInput').value = "Pendiente";
    document.getElementById('demeritoObservacionesInput').value = "";
    
    // Configurar el usuario activo que registra
    const loggedInUser = localStorage.getItem('crm-logged-in') || 'adminlr';
    document.getElementById('demeritoUsuarioRegistraInput').value = loggedInUser;
    
    const btnDel = document.getElementById('btnDeleteDemerito');
    if (btnDel) btnDel.style.display = 'none';
    
    document.getElementById('demeritoFormPanel').classList.add('open');
}

function openDemeritoPanel(d) {
    currentDemeritoId = d.id;
    document.getElementById('demeritoPanelTitle').innerText = "Editar Demérito";
    document.getElementById('demeritoIdInput').value = d.id;
    document.getElementById('demeritoFolioInput').value = d.folio;
    document.getElementById('demeritoFechaInput').value = d.fecha;
    document.getElementById('demeritoSucursalInput').value = d.sucursal;
    document.getElementById('demeritoCanalInput').value = d.canal;
    document.getElementById('demeritoResponsableInput').value = d.responsable;
    document.getElementById('demeritoClienteInput').value = d.cliente || "";
    document.getElementById('demeritoAutoInput').value = d.modelo_auto || "";
    document.getElementById('demeritoCategoriaInput').value = d.categoria;
    document.getElementById('demeritoDescripcionInput').value = d.descripcion || "";
    document.getElementById('demeritoGravedadInput').value = d.gravedad;
    document.getElementById('demeritoEstatusInput').value = d.estatus;
    document.getElementById('demeritoObservacionesInput').value = d.observaciones || "";
    document.getElementById('demeritoUsuarioRegistraInput').value = d.usuario_registra;
    
    const btnDel = document.getElementById('btnDeleteDemerito');
    if (btnDel) btnDel.style.display = 'block';
    
    document.getElementById('demeritoFormPanel').classList.add('open');
}

function closeDemeritoPanel() {
    document.getElementById('demeritoFormPanel').classList.remove('open');
}

async function saveDemerito() {
    const folio = document.getElementById('demeritoFolioInput').value;
    const fecha = document.getElementById('demeritoFechaInput').value;
    const sucursal = document.getElementById('demeritoSucursalInput').value;
    const canal = document.getElementById('demeritoCanalInput').value;
    const responsable = document.getElementById('demeritoResponsableInput').value;
    const cliente = document.getElementById('demeritoClienteInput').value.trim();
    const modelo_auto = document.getElementById('demeritoAutoInput').value.trim();
    const categoria = document.getElementById('demeritoCategoriaInput').value;
    const descripcion = document.getElementById('demeritoDescripcionInput').value.trim();
    const gravedad = document.getElementById('demeritoGravedadInput').value;
    const estatus = document.getElementById('demeritoEstatusInput').value;
    const observaciones = document.getElementById('demeritoObservacionesInput').value.trim();
    const usuarioRegistra = document.getElementById('demeritoUsuarioRegistraInput').value;
    
    const demData = {
        folio: folio,
        fecha: fecha || null,
        sucursal: sucursal || null,
        canal: canal || null,
        responsable: responsable || null,
        cliente: cliente || null,
        modelo_auto: modelo_auto || null,
        categoria: categoria || null,
        descripcion: descripcion || null,
        gravedad: gravedad || null,
        estatus: estatus || null,
        observaciones: observaciones || null,
        usuario_registra: usuarioRegistra || null
    };
    
    try {
        if (demeritoStorageMode === 'supabase') {
            if (currentDemeritoId) {
                const { error } = await supabaseClient.from('demeritos_comerciales').update(demData).eq('id', currentDemeritoId);
                if (error) throw error;
                triggerNotification('Éxito', 'Demérito actualizado correctamente', 'success');
            } else {
                const { error } = await supabaseClient.from('demeritos_comerciales').insert([demData]);
                if (error) throw error;
                triggerNotification('Éxito', 'Demérito registrado correctamente', 'success');
            }
        } else {
            // LocalStorage mode
            if (currentDemeritoId) {
                const index = demeritosData.findIndex(x => x.id === currentDemeritoId);
                if (index !== -1) {
                    demeritosData[index] = { ...demeritosData[index], ...demData };
                }
            } else {
                const newRecord = {
                    id: 'local-' + Date.now(),
                    ...demData,
                    created_at: new Date().toISOString()
                };
                demeritosData.unshift(newRecord);
            }
            localStorage.setItem('crm-demeritos-data', JSON.stringify(demeritosData));
            triggerNotification('Guardado Local', 'Demérito comercial guardado en el almacenamiento local.', 'success');
        }
        
        closeDemeritoPanel();
        await refreshDemeritosData();
        
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo guardar la información.', 'danger');
    }
}

async function deleteCurrentDemerito() {
    if (currentDemeritoId) {
        await deleteDemerito(currentDemeritoId);
        closeDemeritoPanel();
    }
}

async function deleteDemerito(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este demérito comercial?')) return;
    
    try {
        if (demeritoStorageMode === 'supabase') {
            const { error } = await supabaseClient.from('demeritos_comerciales').delete().eq('id', id);
            if (error) throw error;
            triggerNotification('Éxito', 'Demérito comercial eliminado', 'success');
        } else {
            demeritosData = demeritosData.filter(x => x.id !== id);
            localStorage.setItem('crm-demeritos-data', JSON.stringify(demeritosData));
            triggerNotification('Eliminado Local', 'Registro eliminado del almacenamiento local.', 'success');
        }
        
        await refreshDemeritosData();
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo eliminar el registro.', 'danger');
    }
}

// ==========================================
// 8. Control del Catálogo de Categorías
// ==========================================
function openCategoryCatalogPanel() {
    renderCategoryCatalogList();
    document.getElementById('categoriaCatalogPanel').classList.add('open');
}

function closeCategoryCatalogPanel() {
    document.getElementById('categoriaCatalogPanel').classList.remove('open');
}

function renderCategoryCatalogList() {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    categoriesData.forEach(cat => {
        const tr = document.createElement('tr');
        // No se permite eliminar las categorías base por defecto para asegurar coherencia
        const isDefault = defaultCategories.includes(cat);
        const actionHtml = isDefault 
            ? `<span style="font-size:0.7rem; color:var(--text-secondary); font-style:italic;">Sistema</span>`
            : `<button onclick="deleteCategory('${cat}')" style="color: var(--danger); background: none; border: none; cursor: pointer; padding: 0.25rem;">
                   <i class="fa-solid fa-trash-can"></i>
               </button>`;
               
        tr.innerHTML = `
            <td class="font-medium">${cat}</td>
            <td style="text-align: center;">${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function addNewCategory() {
    const input = document.getElementById('newCategoryInput');
    const name = input?.value?.trim();
    
    if (!name) return;
    
    if (categoriesData.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
        triggerNotification('Advertencia', 'Esta categoría ya existe.', 'warning');
        return;
    }
    
    try {
        if (demeritoStorageMode === 'supabase') {
            const { error } = await supabaseClient.from('demeritos_categorias').insert([{ nombre: name }]);
            if (error) throw error;
        } else {
            categoriesData.push(name);
            localStorage.setItem('crm-demeritos-categories', JSON.stringify(categoriesData));
        }
        
        if (input) input.value = '';
        triggerNotification('Éxito', 'Categoría agregada correctamente.', 'success');
        
        await dbLoadCategories();
        populateCategoriesSelects();
        renderCategoryCatalogList();
        
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo guardar la categoría.', 'danger');
    }
}

async function deleteCategory(category) {
    if (defaultCategories.includes(category)) {
        triggerNotification('Error', 'No se pueden eliminar las categorías base del sistema.', 'danger');
        return;
    }
    
    if (!confirm(`¿Estás seguro de que deseas eliminar la categoría "${category}"?`)) return;
    
    try {
        if (demeritoStorageMode === 'supabase') {
            const { error } = await supabaseClient.from('demeritos_categorias').delete().eq('nombre', category);
            if (error) throw error;
        } else {
            categoriesData = categoriesData.filter(c => c !== category);
            localStorage.setItem('crm-demeritos-categories', JSON.stringify(categoriesData));
        }
        
        triggerNotification('Éxito', 'Categoría eliminada.', 'success');
        
        await dbLoadCategories();
        populateCategoriesSelects();
        renderCategoryCatalogList();
        
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo eliminar la categoría.', 'danger');
    }
}

// ==========================================
// 9. Exportación a Excel y PDF
// ==========================================
function exportDemeritosToExcel() {
    const btn = document.getElementById('btnExportDemExcel');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }
    
    try {
        const rows = filteredDemeritos.map(d => ({
            'FECHA': d.fecha || '',
            'FOLIO': d.folio || '',
            'SUCURSAL': d.sucursal || '',
            'CANAL': d.canal || '',
            'CLIENTE': d.cliente || '',
            'AUTO': d.modelo_auto || '',
            'CATEGORÍA': d.categoria || '',
            'URGENCIA': d.gravedad || '',
            'ESTATUS': d.estatus || '',
            'RESPONSABLE': d.responsable || '',
            'DESCRIPCIÓN': d.descripcion || '',
            'REGISTRÓ': d.usuario_registra || '',
            'OBSERVACIONES': d.observaciones || ''
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        
        // Ajustar anchos
        ws['!cols'] = [
            { wch: 12 }, // FECHA
            { wch: 10 }, // FOLIO
            { wch: 22 }, // SUCURSAL
            { wch: 15 }, // CANAL
            { wch: 20 }, // CLIENTE
            { wch: 20 }, // AUTO
            { wch: 20 }, // CATEGORÍA
            { wch: 12 }, // URGENCIA
            { wch: 12 }, // ESTATUS
            { wch: 18 }, // RESPONSABLE
            { wch: 40 }, // DESCRIPCIÓN
            { wch: 15 }, // REGISTRÓ
            { wch: 30 }  // OBSERVACIONES
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Deméritos Comerciales');
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const fileName = `Reporte_Demeritos_${dateStr}.xlsx`;
        
        XLSX.writeFile(wb, fileName);
        
        triggerNotification('Excel Descargado', `${rows.length} deméritos exportados en "${fileName}"`, 'success');
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo exportar a Excel.', 'warning');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Excel';
        }
    }
}

async function exportDemeritosToPDF() {
    const btn = document.getElementById('btnExportDemPDF');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // A4 Horizontal
        
        // Configurar título ejecutivo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(22, 25, 37); // Azul Oscuro Corporativo
        doc.text("Reporte de Deméritos Comerciales", 14, 15);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        
        const filterState = [];
        const sucVal = document.getElementById('filterDemSucursal')?.value;
        if(sucVal && sucVal !== 'all') filterState.push(`Sucursal: ${sucVal}`);
        const gravVal = document.getElementById('filterDemGravedad')?.value;
        if(gravVal && gravVal !== 'all') filterState.push(`Urgencia: ${gravVal}`);
        const estVal = document.getElementById('filterDemEstatus')?.value;
        if(estVal && estVal !== 'all') filterState.push(`Estatus: ${estVal}`);
        
        const filterStr = filterState.length > 0 ? ` [Filtros: ${filterState.join(', ')}]` : '';
        
        doc.text(`Generado el: ${new Date().toLocaleString('es-MX')} por ${localStorage.getItem('crm-logged-in') || 'adminlr'}${filterStr}`, 14, 21);
        
        // Formatear filas
        const tableHeaders = [['Fecha', 'Folio', 'Sucursal', 'Canal', 'Cliente', 'Auto', 'Categoría', 'Urgencia', 'Estatus', 'Responsable', 'Registró']];
        const tableRows = filteredDemeritos.map(d => [
            d.fecha ? d.fecha.split('-').reverse().join('/') : '',
            d.folio || '',
            d.sucursal || '',
            d.canal || '',
            d.cliente || '',
            d.modelo_auto || '',
            d.categoria || '',
            d.gravedad || '',
            d.estatus || '',
            d.responsable || '',
            d.usuario_registra || ''
        ]);
        
        doc.autoTable({
            head: tableHeaders,
            body: tableRows,
            startY: 25,
            theme: 'striped',
            headStyles: { fillColor: [22, 25, 37], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            styles: { fontSize: 8.5, cellPadding: 2.5, font: 'helvetica' },
            margin: { left: 14, right: 14 }
        });
        
        const now = new Date();
        const dateStr = now.toISOString().slice(0,10);
        doc.save(`Reporte_Demeritos_${dateStr}.pdf`);
        
        triggerNotification('PDF Descargado', `Se exportaron ${filteredDemeritos.length} registros en formato PDF.`, 'success');
        
    } catch (err) {
        console.error(err);
        triggerNotification('Error', 'No se pudo exportar a PDF.', 'warning');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF';
        }
    }
}

// ==========================================
// 10. Asistencias de Citas (Sub-vista Anterior)
// ==========================================
async function renderAsistenciasSubView() {
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const filterEl = document.getElementById('globalMonthFilter');
        const filterVal = filterEl ? filterEl.value : 'all';
        
        let filteredData = data;
        if (filterVal !== 'all') {
            filteredData = data.filter(lead => lead.created_at && lead.created_at.startsWith(filterVal));
        }

        const tbody = document.getElementById('demeritosTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const citas = filteredData.filter(l => l.etapa === 'CITA');
        
        if(citas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay citas pendientes de evaluación para este mes.</td></tr>`;
        }

        citas.forEach(lead => {
            const tr = document.createElement('tr');
            const dDate = lead.created_at ? new Date(lead.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
            
            tr.innerHTML = `
                <td>${dDate}</td>
                <td>${lead.sucursal || ''}</td>
                <td class="font-medium">${lead.nombre || ''}</td>
                <td>${lead.vehiculo || ''}</td>
                <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${lead.creado_por || ''}</span></td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" style="background: var(--success); padding: 0.25rem 0.5rem; font-size: 0.8rem; color: white; display: flex; align-items: center; gap: 0.25rem;" onclick="updateAsistencia('${lead.id}', 'EN PROCESO')"><i class="fa-solid fa-check"></i> Sí Asistió</button>
                        <button class="btn btn-outline" style="border-color: var(--danger); color: var(--danger); padding: 0.25rem 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem;" onclick="updateAsistencia('${lead.id}', 'NO ASISTIO')"><i class="fa-solid fa-xmark"></i> No Asistió</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Podio
        const podiumContainer = document.getElementById('demeritosPodium');
        if(!podiumContainer) return;
        
        const stats = {};
        filteredData.forEach(lead => {
            const agente = (lead.creado_por || '').toLowerCase().trim();
            if(!agente) return;
            if(!stats[agente]) stats[agente] = { asistidas: 0, noAsistidas: 0, total: 0 };
            
            if(['EN PROCESO', 'DISPERSADO', 'DETENIDO'].includes(lead.etapa)) {
                stats[agente].asistidas++;
                stats[agente].total++;
            } else if (lead.etapa === 'NO ASISTIO') {
                stats[agente].noAsistidas++;
                stats[agente].total++;
            }
        });

        const sortedAgents = Object.keys(stats).sort((a, b) => stats[b].asistidas - stats[a].asistidas).slice(0, 3);

        podiumContainer.innerHTML = '';
        const colors = ['#f59e0b', '#94a3b8', '#b45309']; // Oro, Plata, Bronce
        
        if(sortedAgents.length === 0) {
            podiumContainer.innerHTML = '<p style="color: var(--text-secondary); width: 100%; text-align: center; padding: 1.5rem;">Aún no hay datos suficientes para el podio de asistencias.</p>';
        }

        sortedAgents.forEach((agente, index) => {
            const d = stats[agente];
            const div = document.createElement('div');
            div.style.cssText = `flex: 1; min-width: 200px; background: var(--bg-panel); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 1rem; position: relative; overflow: hidden;`;
            
            const ribbon = document.createElement('div');
            ribbon.style.cssText = `position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${colors[index] || 'var(--accent-primary)'};`;
            div.appendChild(ribbon);

            div.innerHTML += `
                <div style="width: 48px; height: 48px; border-radius: 50%; background: ${colors[index] || 'var(--accent-primary)'}20; color: ${colors[index] || 'var(--accent-primary)'}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                    #${index + 1}
                </div>
                <div style="flex: 1;">
                    <h3 style="color: var(--text-primary); font-size: 1rem; font-weight: 600; text-transform: capitalize; margin-bottom: 0.25rem;">${agente}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">Citas Asistidas: <strong style="color: var(--success)">${d.asistidas}</strong></p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">Faltas / Asistencias fallidas: <strong style="color: var(--danger)">${d.noAsistidas}</strong></p>
                </div>
            `;
            podiumContainer.appendChild(div);
        });

    } catch (err) {
        console.error('Error renderAsistenciasSubView:', err);
    }
}

// Redefinir updateAsistencia original para refrescar adecuadamente en cascada
async function updateAsistencia(leadId, nuevaEtapa) {
    if(!confirm(`¿Estás seguro de marcar esta cita como ${nuevaEtapa === 'EN PROCESO' ? 'SÍ ASISTIÓ' : 'NO ASISTIÓ'}?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('leads')
            .update({ etapa: nuevaEtapa, updated_at: new Date().toISOString() })
            .eq('id', leadId);

        if (error) throw error;
        
        triggerNotification('Evaluación guardada', 'La etapa del lead ha sido actualizada.', 'success');
        
        renderAsistenciasSubView();
        if(typeof fetchLeads === 'function') fetchLeads();
        
    } catch(err) {
        console.error('Error updateAsistencia:', err);
        triggerNotification('Error', 'No se pudo guardar la evaluación.', 'danger');
    }
}

// Interceptar llamadas desde la función global switchView
// Para inicializar el módulo la primera vez que se accede
const originalSwitchView = switchView;
switchView = function(targetId) {
    if (targetId === 'demeritosComerciales' && !demeritosModuleInitialized) {
        initDemeritosModule().then(() => {
            demeritosModuleInitialized = true;
        });
    }
    originalSwitchView(targetId);
};
let demeritosModuleInitialized = false;

// ==========================================
// Módulo de Agenda de Mañana
// ==========================================
async function renderAgendaManana() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Formato YYYY-MM-DD
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${yyyy}-${mm}-${dd}`;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = tomorrow.toLocaleDateString('es-MX', options);
    
    const dateTextEl = document.getElementById('agendaMananaFechaText');
    if (dateTextEl) {
        dateTextEl.innerText = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
    }
    
    if (!window.cachedLeads) {
        await fetchLeads();
    }
    
    const leads = window.cachedLeads || [];
    
    const tomorrowAppointments = leads.filter(lead => {
        if (lead.etapa !== 'CITA') return false;
        if (!lead.fecha_cita) return false;
        return lead.fecha_cita.trim() === tomorrowStr;
    });
    
    const totalCitas = tomorrowAppointments.length;
    
    const sucursales = new Set();
    const agentes = new Set();
    tomorrowAppointments.forEach(lead => {
        if (lead.sucursal) sucursales.add(lead.sucursal);
        if (lead.creado_por) agentes.add(lead.creado_por);
    });
    
    const totalEl = document.getElementById('agendaMananaTotalMetric');
    if (totalEl) totalEl.innerText = totalCitas;
    
    const sucursalesEl = document.getElementById('agendaMananaSucursalesMetric');
    if (sucursalesEl) sucursalesEl.innerText = sucursales.size;
    
    const agentesEl = document.getElementById('agendaMananaAgentesMetric');
    if (agentesEl) agentesEl.innerText = agentes.size;
    
    const tbody = document.getElementById('agendaMananaTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (tomorrowAppointments.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay citas programadas para el día de mañana.</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    tomorrowAppointments.forEach(lead => {
        const tr = document.createElement('tr');
        tr.dataset.id = lead.id;
        tr.onclick = () => openLeadPanel(
            lead.id, 
            lead.nombre || '', 
            lead.etapa || '', 
            lead.sucursal || '', 
            lead.vehiculo || '', 
            lead.numero || '', 
            lead.observaciones || '',
            lead.obs_encargado || '',
            lead.fecha_cita || ''
        );
        
        tr.innerHTML = `
            <td class="font-medium">${escapeHTML(lead.sucursal || '')}</td>
            <td>${escapeHTML(lead.nombre || '')}</td>
            <td>${escapeHTML(lead.vehiculo || '')}</td>
            <td>${escapeHTML(lead.numero || '')}</td>
            <td><span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); background: var(--bg-dark); padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${escapeHTML(lead.creado_por || '-')}</span></td>
            <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(lead.observaciones || '')}</td>
            <td style="color: #6366f1; font-weight: 500; font-style: italic;">${escapeHTML(lead.obs_encargado || '')}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function exportAgendaMananaToExcel() {
    const btn = document.getElementById('btnExportAgenda');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
    }

    try {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        const tomorrowStr = `${yyyy}-${mm}-${dd}`;

        if (!window.cachedLeads) {
            await fetchLeads();
        }
        
        const leads = window.cachedLeads || [];
        const tomorrowAppointments = leads.filter(lead => 
            lead.etapa === 'CITA' && lead.fecha_cita && lead.fecha_cita.trim() === tomorrowStr
        );

        if (tomorrowAppointments.length === 0) {
            triggerNotification('Aviso', 'No hay citas para mañana para exportar.', 'warning');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Exportar Excel';
            }
            return;
        }

        const rows = tomorrowAppointments.map(lead => ({
            'SUCURSAL': lead.sucursal || '',
            'CLIENTE': lead.nombre || '',
            'VEHÍCULO': lead.vehiculo || '',
            'NÚMERO/TELÉFONO': lead.numero || '',
            'AGENTE': lead.creado_por || '',
            'OBSERVACIONES': lead.observaciones || '',
            'OBSERVACIONES ENCARGADO': lead.obs_encargado || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        ws['!cols'] = [
            { wch: 22 },  // SUCURSAL
            { wch: 25 },  // CLIENTE
            { wch: 20 },  // VEHÍCULO
            { wch: 15 },  // NÚMERO/TELÉFONO
            { wch: 18 },  // AGENTE
            { wch: 35 },  // OBSERVACIONES
            { wch: 35 }   // OBSERVACIONES ENCARGADO
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Agenda');

        const fileName = `Agenda_Mañana_${tomorrowStr}.xlsx`;
        XLSX.writeFile(wb, fileName);

        triggerNotification('Éxito', 'Agenda exportada correctamente', 'success');
    } catch (err) {
        console.error('Error exportando agenda:', err);
        triggerNotification('Error', 'No se pudo exportar la agenda', 'warning');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Exportar Excel';
        }
    }
}

// ==========================================
// Read-Only Interceptors
// ==========================================
document.addEventListener('click', function(e) {
    if(isReadOnlyUser()) {
        const isModifyingBtn = e.target.closest(`button[onclick^="openNew"], button[onclick^="delete"], button[onclick^="save"], .btn[onclick="document.getElementById('assetUpload').click()"], button[type="submit"], tr[onclick]`);
        const isDeleteIconBtn = e.target.closest('.data-table td button');
        if(isModifyingBtn || isDeleteIconBtn) {
            e.preventDefault();
            e.stopPropagation();
            triggerNotification('Acceso Denegado', 'Solo tienes permisos de visualización.', 'warning');
        }
    }
}, true);

document.addEventListener('dragstart', function(e) {
    if(isReadOnlyUser()) {
        e.preventDefault();
        e.stopPropagation();
        triggerNotification('Acceso Denegado', 'Solo tienes permisos de visualización.', 'warning');
    }
}, true);
