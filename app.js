// ==========================================
// SPA Navigation Logic
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const viewSections = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // Remove active class from all nav items and sections
        navItems.forEach(nav => nav.classList.remove('active'));
        viewSections.forEach(section => section.classList.remove('active'));
        
        // Add active class to clicked item and target section
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
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
    
    // Auto remove after animation ends (4s delay + 0.3s fadeOut)
    setTimeout(() => {
        if(container.contains(toast)) {
            container.removeChild(toast);
        }
    }, 4500);
}

// ==========================================
// Supabase Integration
// ==========================================
const supabaseUrl = 'https://tbzfvulycbaiwlrewpxv.supabase.co';
const supabaseKey = 'sb_publishable_KRCLKUEu8d9EJgZzRmbBLg_hdk9IhFK';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function fetchLeads() {
    const { data, error } = await supabaseClient.from('leads').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }
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
            lead.observaciones || ''
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
    const btnDel = document.getElementById('btnDeleteLead');
    if(btnDel) btnDel.style.display = 'none';
    document.getElementById('leadPanel').classList.add('open');
}

function openLeadPanel(id, name, stage, sucursal, vehiculo, numero, obs) {
    currentLeadId = id;
    document.getElementById('panelTitle').innerText = "Detalles del Lead";
    document.getElementById('panelLeadNameInput').value = name;
    document.getElementById('panelLeadStage').value = stage;
    document.getElementById('panelLeadSucursal').value = sucursal;
    document.getElementById('panelLeadVehiculo').value = vehiculo;
    document.getElementById('panelLeadNumero').value = numero;
    document.getElementById('panelLeadObs').value = obs;
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
        creado_por: currentUser
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
    
    updateCloserSummary();
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

// Inicializar datos al cargar
document.addEventListener('DOMContentLoaded', async () => {
    await fetchLeads();
    await fetchDispersiones();
});

// ==========================================
// Global Month Filter Logic
// ==========================================
function applyGlobalFilter() {
    const filter = document.getElementById('globalMonthFilter').value;
    
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
    if (dispTbody) {
        const rows = dispTbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 2) {
                const dateStr = cells[2].innerText.trim();
                row.style.display = matchesFilter(dateStr) ? '' : 'none';
            }
        });
        updateCloserSummary();
    }

    // Filter Leads
    const leadsTbody = document.querySelector('#leads .data-table tbody');
    if (leadsTbody) {
        const rows = leadsTbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const dateStr = cells[0].innerText.trim();
                row.style.display = matchesFilter(dateStr) ? '' : 'none';
            }
        });
    }
    
    if (typeof updateDashboardCharts === 'function') updateDashboardCharts();
}

// Function to update Closer summaries
function updateCloserSummary() {
    const tbody = document.querySelector('#dispersiones .data-table tbody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    const closerTotals = {};
    let totalGeneral = 0;

    rows.forEach(row => {
        if (row.style.display === 'none') return;
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
            let montoText = cells[3].innerText.replace(/[\$,]/g, '');
            let monto = parseFloat(montoText) || 0;
            let closer = cells[5].innerText.trim() || 'Sin Asignar';

            if (!closerTotals[closer]) closerTotals[closer] = 0;
            closerTotals[closer] += monto;
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
}

// ==========================================
// Chart.js Initialization (Graphical Section)
let branchChartInstance = null;
let statusChartInstance = null;

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

// Check saved theme on load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    const savedTheme = localStorage.getItem('crm-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const btn = document.getElementById('themeToggleBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    // Initial data fetch
    fetchLeads();
    fetchTasks();
    if(typeof fetchDispersiones === 'function') fetchDispersiones();
});

// ==========================================
// Authentication Logic
// ==========================================
const allowedUsers = [
    { user: 'adminlr', pass: 'AdminLR123', initials: 'AD', panels: ['dashboard', 'leads', 'kanban', 'assets', 'dispersiones'] },
    { user: 'franco lozada', pass: 'Franco123', initials: 'FL', panels: ['dashboard', 'leads', 'kanban', 'assets', 'dispersiones'] },
    { user: 'fabiola mendoza', pass: 'Fabiola123', initials: 'FM', panels: ['dashboard', 'leads', 'kanban', 'assets', 'dispersiones'] },
    { user: 'fatima morales', pass: 'Fatima123', initials: 'FT', panels: ['kanban', 'leads', 'assets'] },
    { user: 'invitado', pass: 'invitado123', initials: 'IN', panels: ['dashboard'] }
];

function switchView(targetId) {
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    navItems.forEach(nav => nav.classList.remove('active'));
    viewSections.forEach(section => section.classList.remove('active'));
    
    const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if(targetNav) targetNav.classList.add('active');
    
    const targetSection = document.getElementById(targetId);
    if(targetSection) targetSection.classList.add('active');
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
        setTimeout(() => {
            loginScreen.style.display = 'none';
            applyPermissions(validUser);
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
