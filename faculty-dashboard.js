// Initialize Supabase client
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const activeCoursesEl = document.getElementById('activeCourses');
const totalStudentsEl = document.getElementById('totalStudents');
const pendingGradingEl = document.getElementById('pendingGrading');
const recentActivityEl = document.getElementById('recentActivity');
const upcomingDeadlinesEl = document.getElementById('upcomingDeadlines');
const coursesGridEl = document.getElementById('coursesGrid');
const profileDropdown = document.getElementById('profileDropdown');

// Check authentication and load user data
document.addEventListener('DOMContentLoaded', async () => {
  // Check user session
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  
  // Load faculty profile
  const { data: profile, error: profileError } = await supabase
    .from('faculty_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
    
  if (profileError || !profile) {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
    return;
  }
  
  // Update UI with user data
  updateUserProfile(profile);
  
  // Load dashboard data
  loadDashboardData();
  
  // Initialize charts
  initCharts();
  
  // Setup event listeners
  setupEventListeners();
});

// Update user profile in UI
function updateUserProfile(profile) {
  if (profile.avatar_url) {
    userAvatar.src = profile.avatar_url;
    document.getElementById('profileAvatar').src = profile.avatar_url;
  }
  
  userName.textContent = `${profile.title || ''} ${profile.first_name} ${profile.last_name}`.trim();
  document.getElementById('profileName').textContent = `${profile.title || ''} ${profile.first_name} ${profile.last_name}`.trim();
  userEmail.textContent = profile.email;
  document.getElementById('userInitial').textContent = profile.first_name.charAt(0).toUpperCase();
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Fetch active courses count
    const { count: activeCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('faculty_id', user.id)
      .eq('is_active', true);
    
    activeCoursesEl.textContent = activeCourses || 0;
    
    // Fetch total students count
    const { count: totalStudents } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('course_id', activeCourseIds); // You'd need to get active course IDs first
      
    totalStudentsEl.textContent = totalStudents || 0;
    
    // Fetch pending grading count
    const { count: pendingGrading } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .in('course_id', activeCourseIds)
      .lt('due_date', new Date().toISOString())
      .eq('graded', false);
      
    pendingGradingEl.textContent = pendingGrading || 0;
    
    // Fetch recent activity
    const { data: recentActivity } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
      
    renderRecentActivity(recentActivity);
    
    // Fetch upcoming deadlines
    const { data: upcomingDeadlines } = await supabase
      .from('assignments')
      .select('*')
      .in('course_id', activeCourseIds)
      .gt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(5);
      
    renderUpcomingDeadlines(upcomingDeadlines);
    
    // Fetch recent courses
    const { data: recentCourses } = await supabase
      .from('courses')
      .select('*')
      .eq('faculty_id', user.id)
      .order('created_at', { ascending: false })
      .limit(4);
      
    renderRecentCourses(recentCourses);
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    showToast('Failed to load dashboard data', 'error');
  }
}

// Initialize charts
function initCharts() {
  // Enrollment Chart
  const enrollmentCtx = document.getElementById('enrollmentChart').getContext('2d');
  const enrollmentChart = new Chart(enrollmentCtx, {
    type: 'bar',
    data: {
      labels: ['CS 301', 'MATH 201', 'PHYS 101', 'ENG 205', 'HIST 110'],
      datasets: [{
        label: 'Students Enrolled',
        data: [32, 28, 45, 22, 18],
        backgroundColor: 'rgba(78, 115, 223, 0.5)',
        borderColor: 'rgba(78, 115, 223, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 10
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
  
  // Completion Chart
  const completionCtx = document.getElementById('completionChart').getContext('2d');
  const completionChart = new Chart(completionCtx, {
    type: 'doughnut',
    data: {
      labels: ['Submitted', 'Pending', 'Late'],
      datasets: [{
        data: [65, 15, 20],
        backgroundColor: [
          'rgba(28, 200, 138, 0.8)',
          'rgba(246, 194, 62, 0.8)',
          'rgba(231, 74, 59, 0.8)'
        ],
        borderColor: [
          'rgba(28, 200, 138, 1)',
          'rgba(246, 194, 62, 1)',
          'rgba(231, 74, 59, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// Render recent activity
function renderRecentActivity(activities) {
  if (!activities || activities.length === 0) {
    recentActivityEl.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }
  
  let html = '';
  activities.forEach(activity => {
    html += `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas ${getActivityIcon(activity.type)}"></i>
        </div>
        <div class="activity-details">
          <p class="activity-text">${activity.description}</p>
          <p class="activity-time">${formatTime(activity.created_at)}</p>
        </div>
      </div>
    `;
  });
  
  recentActivityEl.innerHTML = html;
}

// Render upcoming deadlines
function renderUpcomingDeadlines(deadlines) {
  if (!deadlines || deadlines.length === 0) {
    upcomingDeadlinesEl.innerHTML = '<div class="empty-state">No upcoming deadlines</div>';
    return;
  }
  
  let html = '';
  deadlines.forEach(deadline => {
    html += `
      <div class="deadline-item">
        <div class="deadline-course">${deadline.course_code}</div>
        <div class="deadline-title">${deadline.title}</div>
        <div class="deadline-date ${isDueSoon(deadline.due_date) ? 'due-soon' : ''}">
          <i class="far fa-clock"></i> ${formatDate(deadline.due_date)}
        </div>
      </div>
    `;
  });
  
  upcomingDeadlinesEl.innerHTML = html;
}

// Render recent courses
function renderRecentCourses(courses) {
  if (!courses || courses.length === 0) {
    coursesGridEl.innerHTML = '<div class="empty-state">No courses found</div>';
    return;
  }
  
  let html = '';
  courses.forEach(course => {
    html += `
      <div class="course-card">
        <div class="course-header">
          <h4>${course.code}</h4>
          <span class="course-status ${course.is_active ? 'active' : 'inactive'}">
            ${course.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <h3 class="course-title">${course.name}</h3>
        <p class="course-description">${course.description || 'No description available'}</p>
        <div class="course-meta">
          <span class="meta-item">
            <i class="fas fa-users"></i> ${course.student_count || 0} Students
          </span>
          <span class="meta-item">
            <i class="fas fa-calendar-alt"></i> ${course.semester} ${course.year}
          </span>
        </div>
        <div class="course-actions">
          <button class="btn btn-sm btn-outline view-course" data-id="${course.id}">
            View Course
          </button>
        </div>
      </div>
    `;
  });
  
  coursesGridEl.innerHTML = html;
}

// Helper functions
function getActivityIcon(type) {
  const icons = {
    'assignment': 'fa-tasks',
    'grade': 'fa-clipboard-check',
    'message': 'fa-comment',
    'login': 'fa-sign-in-alt',
    'course': 'fa-book'
  };
  return icons[type] || 'fa-circle';
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function isDueSoon(dateString) {
  const dueDate = new Date(dateString);
  const now = new Date();
  const diffTime = dueDate - now;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

// Setup event listeners
function setupEventListeners() {
  // Profile dropdown toggle
  profileDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.dropdown-menu').classList.toggle('show');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    document.querySelector('.dropdown-menu').classList.remove('show');
  });
  
  // Logout functionality
  document.querySelectorAll('[onclick="logout()"]').forEach(el => {
    el.addEventListener('click', logout);
  });
  
  // Course card click handlers
  coursesGridEl.addEventListener('click', (e) => {
    if (e.target.closest('.view-course')) {
      const courseId = e.target.closest('.view-course').dataset.id;
      window.location.href = `faculty-course-detail.html?id=${courseId}`;
    }
  });
}

// Logout function
async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error logging out:', error);
    showToast('Failed to logout', 'error');
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}
