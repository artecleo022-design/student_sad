// ============================================
// Student Record Management System - App Logic
// ============================================

// ──────────────────────────────────────────────
// 🔧 SUPABASE CONFIGURATION
// ──────────────────────────────────────────────
const SUPABASE_URL = 'https://zadovfjytwamreohdgrl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xLSC8zQ4k6d7s0mlnwS-0w_58FPnz_v';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ──────────────────────────────────────────────
// DOM Elements
// ──────────────────────────────────────────────
const studentForm = document.getElementById('studentForm');
const studentTableBody = document.getElementById('studentTableBody');
const searchInput = document.getElementById('searchInput');
const recordCount = document.getElementById('recordCount');
const navBadge = document.getElementById('navBadge');
const loadingSpinner = document.getElementById('loadingSpinner');
const emptyState = document.getElementById('emptyState');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const toastContainer = document.getElementById('toastContainer');
const refreshIcon = document.getElementById('refreshIcon');
const currentTime = document.getElementById('currentTime');

// Topbar Titles
const viewTitle = document.getElementById('viewTitle');
const viewBreadcrumb = document.getElementById('viewBreadcrumb');

// Dashboard Stats Elements
const statTotal = document.getElementById('statTotal');
const statPrograms = document.getElementById('statPrograms');
const statAvgYear = document.getElementById('statAvgYear');
const statRecentDate = document.getElementById('statRecentDate');

// ──────────────────────────────────────────────
// Live Clock
// ──────────────────────────────────────────────
function updateClock() {
    if (!currentTime) return;
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// ──────────────────────────────────────────────
// Sidebar & View Switching (SPA)
// ──────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }

    if (viewName === 'dashboard') {
        document.getElementById('viewDashboard').classList.add('active');
        document.getElementById('navDashboard').classList.add('active');
        if (viewTitle) viewTitle.textContent = 'Dashboard Overview';
        if (viewBreadcrumb) viewBreadcrumb.textContent = 'Analytics';
    } else if (viewName === 'add') {
        document.getElementById('viewAdd').classList.add('active');
        document.getElementById('navAdd').classList.add('active');
        if (viewTitle) viewTitle.textContent = 'Student Registration';
        if (viewBreadcrumb) viewBreadcrumb.textContent = 'Enroll Student';
    } else if (viewName === 'records') {
        document.getElementById('viewRecords').classList.add('active');
        document.getElementById('navRecords').classList.add('active');
        if (viewTitle) viewTitle.textContent = 'Student Directory';
        if (viewBreadcrumb) viewBreadcrumb.textContent = 'Records Table';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// Toast Notifications
// ──────────────────────────────────────────────
function showToast(message, type = 'success') {
    const icons = {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icons[type] || ''} <span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// ──────────────────────────────────────────────
// Dashboard Statistics Calculation
// ──────────────────────────────────────────────
function updateDashboardStats(students) {
    const total = students.length;
    if (statTotal) statTotal.textContent = total;
    if (navBadge) navBadge.textContent = total;

    // Unique Programs
    const uniquePrograms = new Set(students.map(s => s.program ? s.program.trim() : '').filter(Boolean));
    if (statPrograms) statPrograms.textContent = uniquePrograms.size;

    // Average Year Level
    if (total > 0) {
        const sum = students.reduce((acc, s) => acc + (parseInt(s.year_level) || 0), 0);
        if (statAvgYear) statAvgYear.textContent = (sum / total).toFixed(1);
    } else {
        if (statAvgYear) statAvgYear.textContent = '0.0';
    }

    // Most Recent Date
    if (total > 0) {
        const sorted = [...students].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        const latest = new Date(sorted[0].created_at);
        if (statRecentDate) {
            statRecentDate.textContent = isNaN(latest) ? 'Recent' : latest.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }
    } else {
        if (statRecentDate) statRecentDate.textContent = '—';
    }
}

// ──────────────────────────────────────────────
// CRUD: READ - Fetch and Display Students
// ──────────────────────────────────────────────
async function fetchStudents(searchTerm = '') {
    showLoading(true);
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    try {
        let query = db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply search filter if provided
        if (searchTerm.trim()) {
            query = query.or(
                `student_id.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,program.ilike.%${searchTerm}%`
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        const students = data || [];
        renderStudents(students);
        updateDashboardStats(students);
    } catch (err) {
        console.error('Error fetching students:', err);
        showToast('Failed to load students. Check Supabase connection.', 'error');
        renderStudents([]);
        updateDashboardStats([]);
    } finally {
        showLoading(false);
        if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

function renderStudents(students) {
    studentTableBody.innerHTML = '';

    // Update record count
    recordCount.textContent = `${students.length} record${students.length !== 1 ? 's' : ''}`;

    // Show empty state if no records
    if (students.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    students.forEach((student, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: var(--text-light); font-size: 0.8rem;">${index + 1}</td>
            <td><span class="id-badge">${escapeHtml(student.student_id)}</span></td>
            <td><strong style="color: var(--text-heading);">${escapeHtml(student.full_name)}</strong></td>
            <td><span class="program-tag">${escapeHtml(student.program)}</span></td>
            <td style="text-align: center;"><span class="year-tag">${student.year_level}</span></td>
            <td style="color: var(--text-muted); font-size: 0.86rem;">${escapeHtml(student.email)}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-edit" onclick="openEditModal(${student.id})"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button class="btn btn-delete" onclick="deleteStudent(${student.id}, '${escapeHtml(student.full_name)}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            </td>
        `;
        studentTableBody.appendChild(row);
    });
}

// ──────────────────────────────────────────────
// CRUD: CREATE - Add New Student
// ──────────────────────────────────────────────
studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;

    const studentData = {
        student_id: document.getElementById('studentId').value.trim(),
        full_name: document.getElementById('fullName').value.trim(),
        program: document.getElementById('program').value.trim(),
        year_level: parseInt(document.getElementById('yearLevel').value),
        email: document.getElementById('email').value.trim(),
    };

    // Validation
    if (!studentData.student_id || !studentData.full_name || !studentData.program || !studentData.year_level || !studentData.email) {
        showToast('Please fill in all fields.', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const { error } = await db
            .from('students')
            .insert([studentData]);

        if (error) {
            if (error.code === '23505') {
                showToast('A student with this ID already exists.', 'error');
            } else {
                throw error;
            }
            return;
        }

        showToast('Student enrolled successfully!', 'success');
        studentForm.reset();
        await fetchStudents(searchInput.value);

        // Automatically switch to Records Directory view so the user can see the new student
        setTimeout(() => {
            switchView('records');
        }, 600);
    } catch (err) {
        console.error('Error adding student:', err);
        showToast('Failed to add student. Please try again.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
});

// ──────────────────────────────────────────────
// CRUD: UPDATE - Edit Student
// ──────────────────────────────────────────────
async function openEditModal(id) {
    try {
        const { data, error } = await db
            .from('students')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Populate modal fields
        document.getElementById('editId').value = data.id;
        document.getElementById('editStudentId').value = data.student_id;
        document.getElementById('editFullName').value = data.full_name;
        document.getElementById('editProgram').value = data.program;
        document.getElementById('editYearLevel').value = data.year_level;
        document.getElementById('editEmail').value = data.email;

        // Show modal
        editModal.classList.add('active');
    } catch (err) {
        console.error('Error loading student:', err);
        showToast('Failed to load student data.', 'error');
    }
}

function closeModal() {
    editModal.classList.remove('active');
}

// Close modal when clicking outside
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updateBtn = document.getElementById('updateBtn');
    const originalText = updateBtn.innerHTML;

    const id = document.getElementById('editId').value;
    const updatedData = {
        student_id: document.getElementById('editStudentId').value.trim(),
        full_name: document.getElementById('editFullName').value.trim(),
        program: document.getElementById('editProgram').value.trim(),
        year_level: parseInt(document.getElementById('editYearLevel').value),
        email: document.getElementById('editEmail').value.trim(),
    };

    try {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

        const { error } = await db
            .from('students')
            .update(updatedData)
            .eq('id', id);

        if (error) {
            if (error.code === '23505') {
                showToast('A student with this ID already exists.', 'error');
            } else {
                throw error;
            }
            return;
        }

        showToast('Student updated successfully!', 'success');
        closeModal();
        await fetchStudents(searchInput.value);
    } catch (err) {
        console.error('Error updating student:', err);
        showToast('Failed to update student. Please try again.', 'error');
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalText;
    }
});

// ──────────────────────────────────────────────
// CRUD: DELETE - Remove Student
// ──────────────────────────────────────────────
async function deleteStudent(id, name) {
    const confirmed = confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`);

    if (!confirmed) return;

    try {
        const { error } = await db
            .from('students')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast(`"${name}" has been deleted.`, 'info');
        await fetchStudents(searchInput.value);
    } catch (err) {
        console.error('Error deleting student:', err);
        showToast('Failed to delete student. Please try again.', 'error');
    }
}

// ──────────────────────────────────────────────
// SEARCH - Filter Students (Debounced)
// ──────────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetchStudents(searchInput.value);
    }, 250);
});

// ──────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
    if (show) {
        emptyState.style.display = 'none';
    }
}

// ──────────────────────────────────────────────
// Initialize
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();
});
