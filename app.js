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
const loadingSpinner = document.getElementById('loadingSpinner');
const emptyState = document.getElementById('emptyState');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const toastContainer = document.getElementById('toastContainer');

// ──────────────────────────────────────────────
// Toast Notifications
// ──────────────────────────────────────────────
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

// ──────────────────────────────────────────────
// CRUD: READ - Fetch and Display Students
// ──────────────────────────────────────────────
async function fetchStudents(searchTerm = '') {
    showLoading(true);

    try {
        let query = db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply search filter if provided
        if (searchTerm.trim()) {
            query = query.or(
                `student_id.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        renderStudents(data || []);
    } catch (err) {
        console.error('Error fetching students:', err);
        showToast('Failed to load students. Check Supabase connection.', 'error');
        renderStudents([]);
    } finally {
        showLoading(false);
    }
}

function renderStudents(students) {
    studentTableBody.innerHTML = '';

    // Update record count
    recordCount.textContent = `${students.length} record${students.length !== 1 ? 's' : ''}`;

    // Show empty state if no records
    if (students.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    students.forEach((student, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><span class="id-badge">${escapeHtml(student.student_id)}</span></td>
            <td><strong>${escapeHtml(student.full_name)}</strong></td>
            <td><span class="program-tag">${escapeHtml(student.program)}</span></td>
            <td><span class="year-tag">${student.year_level}</span></td>
            <td>${escapeHtml(student.email)}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-edit" onclick="openEditModal(${student.id})">✏️ Edit</button>
                    <button class="btn btn-delete" onclick="deleteStudent(${student.id}, '${escapeHtml(student.full_name)}')">🗑️ Delete</button>
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
        saveBtn.textContent = 'Saving...';

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

        showToast('Student added successfully!', 'success');
        studentForm.reset();
        fetchStudents(searchInput.value);
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
        updateBtn.textContent = 'Updating...';

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
        fetchStudents(searchInput.value);
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
        fetchStudents(searchInput.value);
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
    }, 300);
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
