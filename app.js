// ==========================================================================
// EDUTRACK PRO - Student Record Management System
// Supabase Cloud Backend Integration & Interactive Controller
// ==========================================================================

// ──────────────────────────────────────────────
// 🔧 SUPABASE CONFIGURATION
// ──────────────────────────────────────────────
const SUPABASE_URL = 'https://zadovfjytwamreohdgrl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xLSC8zQ4k6d7s0mlnwS-0w_58FPnz_v';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ──────────────────────────────────────────────
// Global State & DOM Element Cache
// ──────────────────────────────────────────────
let allStudents = [];
let pendingDeleteId = null;
let searchDebounceTimer = null;

const elements = {
    studentForm: document.getElementById('studentForm'),
    studentTableBody: document.getElementById('studentTableBody'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterProgram: document.getElementById('filterProgram'),
    filterYear: document.getElementById('filterYear'),
    showingCount: document.getElementById('showingCount'),
    recordBadge: document.getElementById('recordBadge'),
    navCount: document.getElementById('navCount'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    emptyState: document.getElementById('emptyState'),
    emptyStateMsg: document.getElementById('emptyStateMsg'),
    toastContainer: document.getElementById('toastContainer'),
    refreshIcon: document.getElementById('refreshIcon'),
    currentTime: document.getElementById('currentTime'),

    // Dashboard Stats
    statTotal: document.getElementById('statTotal'),
    statPrograms: document.getElementById('statPrograms'),
    statRecentDate: document.getElementById('statRecentDate'),
    statAvgYear: document.getElementById('statAvgYear'),

    // Edit Modal
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editStudentId: document.getElementById('editStudentId'),
    editFullName: document.getElementById('editFullName'),
    editProgram: document.getElementById('editProgram'),
    editYearLevel: document.getElementById('editYearLevel'),
    editEmail: document.getElementById('editEmail'),

    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteStudentName: document.getElementById('deleteStudentName'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
};

// ──────────────────────────────────────────────
// Clock & Live Time
// ──────────────────────────────────────────────
function updateClock() {
    if (!elements.currentTime) return;
    const now = new Date();
    elements.currentTime.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// ──────────────────────────────────────────────
// Toast Notifications
// ──────────────────────────────────────────────
function showToast(message, type = 'success') {
    const icons = {
        success: '<i class="fa-solid fa-circle-check toast-icon"></i>',
        error: '<i class="fa-solid fa-circle-exclamation toast-icon"></i>',
        info: '<i class="fa-solid fa-circle-info toast-icon"></i>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        ${icons[type] || icons.info}
        <div class="toast-text">${escapeHtml(message)}</div>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ──────────────────────────────────────────────
// Avatar Color Generator & Initials
// ──────────────────────────────────────────────
const AVATAR_COLORS = [
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #f59e0b, #b45309)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #06b6d4, #0e7490)',
    'linear-gradient(135deg, #6366f1, #4338ca)'
];

function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarBackground(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_COLORS.length;
    return AVATAR_COLORS[index];
}

// ──────────────────────────────────────────────
// Navigation & Sidebar Handling
// ──────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function navigateSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
}

// ──────────────────────────────────────────────
// Analytics & Dashboard Stats
// ──────────────────────────────────────────────
function updateDashboardStats(data) {
    const total = data.length;
    elements.statTotal.textContent = total;
    elements.recordBadge.textContent = `${total} Student${total !== 1 ? 's' : ''}`;
    elements.navCount.textContent = total;

    // Unique Programs
    const uniquePrograms = new Set(data.map(s => s.program.trim()).filter(Boolean));
    elements.statPrograms.textContent = uniquePrograms.size;

    // Average Year Level
    if (total > 0) {
        const sum = data.reduce((acc, s) => acc + (parseInt(s.year_level) || 0), 0);
        elements.statAvgYear.textContent = (sum / total).toFixed(1);
    } else {
        elements.statAvgYear.textContent = '0.0';
    }

    // Most Recent Date
    if (total > 0) {
        const sorted = [...data].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const latest = new Date(sorted[0].created_at);
        elements.statRecentDate.textContent = isNaN(latest) ? 'Recent' : latest.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    } else {
        elements.statRecentDate.textContent = '—';
    }

    // Populate Program Filter Options dynamically
    populateProgramFilter(uniquePrograms);
}

function populateProgramFilter(programsSet) {
    const currentVal = elements.filterProgram.value;
    elements.filterProgram.innerHTML = '<option value="">All Programs</option>';
    
    Array.from(programsSet).sort().forEach(prog => {
        const opt = document.createElement('option');
        opt.value = prog;
        opt.textContent = prog;
        if (prog === currentVal) opt.selected = true;
        elements.filterProgram.appendChild(opt);
    });
}

// ──────────────────────────────────────────────
// READ: Fetch Students from Supabase
// ──────────────────────────────────────────────
async function fetchStudents() {
    showLoading(true);
    if (elements.refreshIcon) elements.refreshIcon.classList.add('fa-spin');

    try {
        const { data, error } = await db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allStudents = data || [];
        updateDashboardStats(allStudents);
        applyFiltersAndRender();
    } catch (err) {
        console.error('Error fetching students from Supabase:', err);
        showToast('Failed to load student records. Please check your connection.', 'error');
        allStudents = [];
        updateDashboardStats([]);
        renderTableRows([]);
    } finally {
        showLoading(false);
        if (elements.refreshIcon) elements.refreshIcon.classList.remove('fa-spin');
    }
}

// ──────────────────────────────────────────────
// Filter & Render Table
// ──────────────────────────────────────────────
function filterRecords() {
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    const searchTerm = (elements.searchInput.value || '').trim().toLowerCase();
    const progFilter = elements.filterProgram.value;
    const yearFilter = elements.filterYear.value;

    // Toggle clear search icon
    elements.clearSearchBtn.style.display = searchTerm ? 'block' : 'none';

    let filtered = allStudents.filter(student => {
        // Search Filter
        const matchesSearch = !searchTerm ||
            (student.student_id && student.student_id.toLowerCase().includes(searchTerm)) ||
            (student.full_name && student.full_name.toLowerCase().includes(searchTerm)) ||
            (student.program && student.program.toLowerCase().includes(searchTerm)) ||
            (student.email && student.email.toLowerCase().includes(searchTerm));

        // Program Filter
        const matchesProgram = !progFilter || (student.program && student.program.trim() === progFilter);

        // Year Level Filter
        const matchesYear = !yearFilter || (student.year_level && student.year_level.toString() === yearFilter);

        return matchesSearch && matchesProgram && matchesYear;
    });

    renderTableRows(filtered);
}

function renderTableRows(students) {
    elements.studentTableBody.innerHTML = '';
    const count = students.length;
    elements.showingCount.textContent = `Showing ${count} of ${allStudents.length} students`;

    if (count === 0) {
        elements.emptyState.style.display = 'flex';
        if (allStudents.length > 0) {
            elements.emptyStateMsg.textContent = 'No student records match your current search or filter criteria.';
        } else {
            elements.emptyStateMsg.textContent = 'There are currently no students registered. Use the registration form to add your first student record.';
        }
        return;
    }

    elements.emptyState.style.display = 'none';

    students.forEach((student, index) => {
        const row = document.createElement('tr');
        const initials = getInitials(student.full_name);
        const avatarBg = getAvatarBackground(student.full_name || 'Student');

        row.innerHTML = `
            <td style="color: var(--text-light); font-size: 0.78rem;">${index + 1}</td>
            <td>
                <span class="student-code-tag">${escapeHtml(student.student_id)}</span>
            </td>
            <td>
                <div class="student-info-cell">
                    <div class="student-avatar" style="background: ${avatarBg};">
                        ${initials}
                    </div>
                    <div class="student-meta-text">
                        <span class="student-name-text">${escapeHtml(student.full_name)}</span>
                        <span class="student-email-text"><i class="fa-regular fa-envelope"></i> ${escapeHtml(student.email)}</span>
                    </div>
                </div>
            </td>
            <td>
                <span class="program-pill">${escapeHtml(student.program)}</span>
            </td>
            <td style="text-align: center;">
                <span class="year-badge-circle" title="${student.year_level} Year Level">${student.year_level}</span>
            </td>
            <td>
                <div class="actions-row">
                    <button class="action-btn edit-btn" title="Edit Student Record" onclick="openEditModal(${student.id})">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn delete-btn" title="Delete Student Record" onclick="openDeleteModal(${student.id}, '${escapeQuote(student.full_name)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        elements.studentTableBody.appendChild(row);
    });
}

function clearSearch() {
    elements.searchInput.value = '';
    applyFiltersAndRender();
}

elements.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFiltersAndRender, 200);
});

// ──────────────────────────────────────────────
// CREATE: Register New Student
// ──────────────────────────────────────────────
elements.studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('btnSaveStudent');
    const originalContent = saveBtn.innerHTML;

    const studentData = {
        student_id: document.getElementById('studentId').value.trim(),
        full_name: document.getElementById('fullName').value.trim(),
        program: document.getElementById('program').value.trim(),
        year_level: parseInt(document.getElementById('yearLevel').value),
        email: document.getElementById('email').value.trim(),
    };

    if (!studentData.student_id || !studentData.full_name || !studentData.program || !studentData.year_level || !studentData.email) {
        showToast('Please fill out all required fields marked with *', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';

        const { error } = await db
            .from('students')
            .insert([studentData]);

        if (error) {
            if (error.code === '23505') {
                showToast(`Student ID "${studentData.student_id}" is already registered.`, 'error');
            } else {
                throw error;
            }
            return;
        }

        showToast(`Student "${studentData.full_name}" registered successfully!`, 'success');
        elements.studentForm.reset();
        await fetchStudents();

        // Scroll smoothly to records section
        navigateSection('recordsSection');
    } catch (err) {
        console.error('Error adding student:', err);
        showToast('Failed to save student record. Please try again.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
    }
});

// ──────────────────────────────────────────────
// UPDATE: Edit Student Record Modal
// ──────────────────────────────────────────────
async function openEditModal(id) {
    try {
        const student = allStudents.find(s => s.id === id);
        let data = student;

        if (!data) {
            const { data: fetched, error } = await db
                .from('students')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            data = fetched;
        }

        elements.editId.value = data.id;
        elements.editStudentId.value = data.student_id;
        elements.editFullName.value = data.full_name;
        elements.editProgram.value = data.program;
        elements.editYearLevel.value = data.year_level;
        elements.editEmail.value = data.email;

        openModal('editModal');
    } catch (err) {
        console.error('Error fetching student detail:', err);
        showToast('Could not load student information for editing.', 'error');
    }
}

elements.editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updateBtn = document.getElementById('btnUpdateStudent');
    const originalContent = updateBtn.innerHTML;

    const id = elements.editId.value;
    const updatedData = {
        student_id: elements.editStudentId.value.trim(),
        full_name: elements.editFullName.value.trim(),
        program: elements.editProgram.value.trim(),
        year_level: parseInt(elements.editYearLevel.value),
        email: elements.editEmail.value.trim(),
    };

    try {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Updating...</span>';

        const { error } = await db
            .from('students')
            .update(updatedData)
            .eq('id', id);

        if (error) {
            if (error.code === '23505') {
                showToast(`Student ID "${updatedData.student_id}" is already used by another record.`, 'error');
            } else {
                throw error;
            }
            return;
        }

        showToast('Student record updated successfully!', 'success');
        closeModal('editModal');
        await fetchStudents();
    } catch (err) {
        console.error('Error updating student:', err);
        showToast('Failed to update student record.', 'error');
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalContent;
    }
});

// ──────────────────────────────────────────────
// DELETE: Remove Student Modal & Supabase Call
// ──────────────────────────────────────────────
function openDeleteModal(id, fullName) {
    pendingDeleteId = id;
    elements.deleteStudentName.textContent = fullName || 'this student';
    openModal('deleteModal');
}

elements.confirmDeleteBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    const deleteBtn = elements.confirmDeleteBtn;
    const originalContent = deleteBtn.innerHTML;

    try {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Deleting...</span>';

        const { error } = await db
            .from('students')
            .delete()
            .eq('id', pendingDeleteId);

        if (error) throw error;

        showToast('Student record deleted successfully.', 'info');
        closeModal('deleteModal');
        await fetchStudents();
    } catch (err) {
        console.error('Error deleting student:', err);
        showToast('Failed to delete student record.', 'error');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalContent;
        pendingDeleteId = null;
    }
});

// ──────────────────────────────────────────────
// Modal Helper Functions
// ──────────────────────────────────────────────
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

// Close modals when clicking background overlay
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeModal(backdrop.id);
        }
    });
});

// Escape key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('editModal');
        closeModal('deleteModal');
    }
});

// ──────────────────────────────────────────────
// Export Data to CSV
// ──────────────────────────────────────────────
function exportToCSV() {
    if (allStudents.length === 0) {
        showToast('No student records available to export.', 'info');
        return;
    }

    const headers = ['#', 'Student ID', 'Full Name', 'Program', 'Year Level', 'Email', 'Created At'];
    const rows = allStudents.map((s, idx) => [
        idx + 1,
        `"${s.student_id || ''}"`,
        `"${(s.full_name || '').replace(/"/g, '""')}"`,
        `"${(s.program || '').replace(/"/g, '""')}"`,
        s.year_level || '',
        `"${s.email || ''}"`,
        `"${s.created_at || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Student records exported to CSV successfully!', 'success');
}

// ──────────────────────────────────────────────
// Print Records
// ──────────────────────────────────────────────
function printRecords() {
    window.print();
}

// ──────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeQuote(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showLoading(show) {
    if (elements.loadingSpinner) {
        elements.loadingSpinner.style.display = show ? 'flex' : 'none';
    }
    if (show && elements.emptyState) {
        elements.emptyState.style.display = 'none';
    }
}

// ──────────────────────────────────────────────
// Initial Load on Page Ready
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();
});
