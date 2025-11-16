// API base URL - use relative path so nginx can proxy
const API_BASE = '/api';

// Constants
const MAX_ATTEMPTS = 3;
const AUTH_CHECK_DELAYS = [500, 1000]; // ms

// State
let courses = [];
let selectedCourse = null;
let categories = [];
let selectedCategories = [];
let isRandom = false;
let questionCount = 'all';
let currentQuestions = [];
let attempts = {};
let currentUser = null;
let currentSessionId = null; // Track current study session

// Initialize MathJax
window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
    }
};

// Load MathJax script
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
script.async = true;
document.head.appendChild(script);

// Initialize app - wait for everything to be ready
function initializeApp() {
    // Double-check that all required elements exist
    const requiredElements = ['userEmailBtn', 'userEmailText', 'statsBtn', 'loginGuestSelection'];
    const allReady = requiredElements.every(id => {
        const el = document.getElementById(id);
        return el && el.style;
    });
    
    if (!allReady) {
        setTimeout(initializeApp, 100);
        return;
    }
    
    setupEventListeners();
    
    // Clear OAuth redirect params if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('auth') || window.location.hash.includes('auth')) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check auth status immediately and after delays (for OAuth redirects)
    checkAuth();
    AUTH_CHECK_DELAYS.forEach(delay => {
        setTimeout(checkAuth, delay);
    });
    
    // Show login/guest selection screen first
    showLoginGuestSelection();
    loadCourses();
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Also try if DOM is already loaded (for cached pages)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Check auth status when page becomes visible (handles tab switching after OAuth)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        checkAuth();
    }
});

// Check auth status on focus (handles window focus after OAuth)
window.addEventListener('focus', checkAuth);

// Check authentication status
async function checkAuth() {
    // Wait for required elements to be ready
    const loginGuestScreen = document.getElementById('loginGuestSelection');
    if (!loginGuestScreen) {
        setTimeout(checkAuth, 100);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/auth/user`, { 
            credentials: 'include',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Auth check failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.authenticated && data.user) {
            currentUser = data.user;
            showUserInfo(data.user);
            // If on login/guest selection screen, proceed to course selection
            // Use a small delay to ensure DOM is ready after OAuth redirect
            if (loginGuestScreen) {
                const isVisible = window.getComputedStyle(loginGuestScreen).display !== 'none';
                if (isVisible) {
                    // Small delay to ensure everything is ready after redirect
                    setTimeout(() => {
                        proceedToCourseSelection();
                    }, 100);
                }
            }
        } else {
            currentUser = null;
            showLoginButtons();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        showLoginButtons();
    }
}

// Show login/guest selection screen
function showLoginGuestSelection() {
    const loginGuestScreen = document.getElementById('loginGuestSelection');
    const courseSelection = document.getElementById('courseSelection');
    const categorySelection = document.getElementById('categorySelection');
    const mainContent = document.getElementById('mainContent');
    
    if (loginGuestScreen) loginGuestScreen.style.display = 'block';
    if (courseSelection) courseSelection.style.display = 'none';
    if (categorySelection) categorySelection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
}

// Show login buttons (in header)
function showLoginButtons() {
    if (document.readyState === 'loading') {
        setTimeout(showLoginButtons, 100);
        return;
    }
    
    const authSection = document.getElementById('authSection');
    const userEmailBtn = document.getElementById('userEmailBtn');
    const statsBtn = document.getElementById('statsBtn');
    
    if (authSection) {
        authSection.style.display = 'none';
    }
    if (userEmailBtn?.style) {
        userEmailBtn.style.display = 'none';
    }
    if (statsBtn?.style) {
        statsBtn.style.display = 'none';
    }
}

// Show user info (in header when logged in)
function showUserInfo(user) {
    if (document.readyState === 'loading') {
        setTimeout(() => showUserInfo(user), 100);
        return;
    }
    
    const authSection = document.getElementById('authSection');
    const userEmailBtn = document.getElementById('userEmailBtn');
    const userEmailText = document.getElementById('userEmailText');
    const statsBtn = document.getElementById('statsBtn');
    
    if (!authSection || !userEmailBtn || !userEmailText || !statsBtn) {
        return;
    }
    
    authSection.style.display = 'flex';
    userEmailBtn.style.display = 'inline-block';
    statsBtn.style.display = 'inline-block';
    userEmailText.textContent = user?.email || 'User';
    
    // If user just logged in, proceed to course selection
    // Check if we're on the login screen before navigating
    const loginGuestScreen = document.getElementById('loginGuestSelection');
    if (loginGuestScreen && window.getComputedStyle(loginGuestScreen).display !== 'none') {
        proceedToCourseSelection();
    }
}

// Proceed to course selection (hide login/guest screen)
function proceedToCourseSelection() {
    const loginGuestScreen = document.getElementById('loginGuestSelection');
    const courseSelection = document.getElementById('courseSelection');
    
    if (loginGuestScreen) loginGuestScreen.style.display = 'none';
    if (courseSelection) courseSelection.style.display = 'block';
}

// Load courses from API
async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE}/courses`);
        courses = await response.json();
        renderCourseTags();
    } catch (error) {
        console.error('Failed to load courses:', error);
    }
}

// Render course tags
function renderCourseTags() {
    const container = document.getElementById('courseTags');
    container.innerHTML = '';
    
    courses.forEach(course => {
        const tag = document.createElement('button');
        tag.className = 'course-tag';
        tag.textContent = course.name;
        tag.dataset.courseId = course.id;
        tag.dataset.courseName = course.name;
        tag.addEventListener('click', () => selectCourse(course.name));
        container.appendChild(tag);
    });
}

// Select course and load categories
async function selectCourse(courseName) {
    selectedCourse = courseName;
    
    // Load categories for this course
    try {
        const response = await fetch(`${API_BASE}/categories?course=${encodeURIComponent(courseName)}`);
        categories = await response.json();
        
        // Hide course selection, show category selection
        document.getElementById('courseSelection').style.display = 'none';
        document.getElementById('categorySelection').style.display = 'block';
        
        renderCategoryTags();
        resetCategorySelection();
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}


// Render category tags
function renderCategoryTags() {
    const container = document.getElementById('categoryTags');
    container.innerHTML = '';
    
    // Create random button as first element
    const randomTag = document.createElement('button');
    randomTag.className = 'category-tag';
    randomTag.id = 'randomTag';
    randomTag.innerHTML = '<span class="tag-icon">🎲</span> Random (All Categories)';
    randomTag.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Random button clicked');
        toggleRandom();
    });
    container.appendChild(randomTag);
    
    // Then add all categories
    categories.forEach(category => {
        const tag = document.createElement('button');
        tag.className = 'category-tag';
        tag.textContent = category.description || category.name;
        tag.dataset.categoryId = category.id;
        tag.dataset.categoryName = category.name;
        tag.addEventListener('click', () => toggleCategory(category.name, tag));
        container.appendChild(tag);
    });
}

// Toggle category selection
function toggleCategory(categoryName, element) {
    // If random is selected, deselect it
    if (isRandom) {
        isRandom = false;
        document.getElementById('randomTag').classList.remove('selected');
    }
    
    const index = selectedCategories.indexOf(categoryName);
    if (index > -1) {
        selectedCategories.splice(index, 1);
        element.classList.remove('selected');
    } else {
        selectedCategories.push(categoryName);
        element.classList.add('selected');
    }
    
    updateStartButton();
}

// Toggle random selection
function toggleRandom() {
    const randomTag = document.getElementById('randomTag');
    
    if (!randomTag) {
        console.error('Random tag not found');
        return;
    }
    
    if (isRandom) {
        isRandom = false;
        randomTag.classList.remove('selected');
        // Deselect all categories (but not the random button itself)
        selectedCategories = [];
        document.querySelectorAll('.category-tag').forEach(tag => {
            if (tag.id !== 'randomTag') {
                tag.classList.remove('selected');
            }
        });
    } else {
        isRandom = true;
        randomTag.classList.add('selected');
        // Deselect all categories (but not the random button itself)
        selectedCategories = [];
        document.querySelectorAll('.category-tag').forEach(tag => {
            if (tag.id !== 'randomTag') {
                tag.classList.remove('selected');
            }
        });
    }
    
    updateStartButton();
}

// Update start button state
function updateStartButton() {
    const startBtn = document.getElementById('startStudyBtn');
    startBtn.disabled = !isRandom && selectedCategories.length === 0;
}

// Setup event listeners
function setupEventListeners() {
    // Header title click - return to course selection
    document.getElementById('headerTitle')?.addEventListener('click', () => {
        const loginGuestScreen = document.getElementById('loginGuestSelection');
        const courseSelection = document.getElementById('courseSelection');
        
        // Only navigate if not already on login screen
        if (loginGuestScreen && loginGuestScreen.style.display === 'none') {
            // Reset state
            currentQuestions = [];
            attempts = {};
            selectedCourse = null;
            selectedCategories = [];
            isRandom = false;
            questionCount = 'all';
            
            // Hide all screens and show course selection
            document.getElementById('categorySelection').style.display = 'none';
            document.getElementById('mainContent').style.display = 'none';
            if (courseSelection) {
                courseSelection.style.display = 'block';
            }
            
            // Reset progress display
            resetProgressDisplay();
            
            // Close any open modals/panels
            const statsModal = document.getElementById('statsModal');
            const adminPanel = document.getElementById('adminPanel');
            if (statsModal) {
                statsModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            if (adminPanel) {
                adminPanel.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }
    });
    
    // Login/Guest/Admin selection buttons
    document.getElementById('continueAsGuestBtn')?.addEventListener('click', () => {
        currentUser = null;
        showLoginButtons();
        proceedToCourseSelection();
    });
    
    document.getElementById('loginFromSelectionBtn')?.addEventListener('click', () => {
        window.location.href = `${API_BASE}/auth/google`;
    });
    
    document.getElementById('adminFromSelectionBtn')?.addEventListener('click', () => {
        handleAdminClick();
    });
    
    // Back to login/guest selection button
    document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
        showLoginGuestSelection();
        selectedCourse = null;
        resetCategorySelection();
    });
    
    // Back to course button
    document.getElementById('backToCourseBtn')?.addEventListener('click', () => {
        document.getElementById('categorySelection').style.display = 'none';
        document.getElementById('courseSelection').style.display = 'block';
        selectedCourse = null;
        resetCategorySelection();
    });
    
    // Question count buttons
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            questionCount = btn.dataset.count;
        });
    });
    
    // Start study button
    document.getElementById('startStudyBtn').addEventListener('click', startStudy);
    
    // New study session button
    document.getElementById('newStudyBtn')?.addEventListener('click', () => {
        document.getElementById('courseSelection').style.display = 'block';
        document.getElementById('categorySelection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        selectedCourse = null;
        resetSelection();
    });
    
    // Note: Google login button is handled in setupEventListeners above as loginFromSelectionBtn
    
    // User email button - click to logout
    document.getElementById('userEmailBtn')?.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
            
            // Reset all state
            currentUser = null;
            currentQuestions = [];
            attempts = {};
            selectedCourse = null;
            selectedCategories = [];
            isRandom = false;
            questionCount = 'all';
            
            // Reset UI - return to login/guest selection
            showLoginGuestSelection();
            
            // Clear questions content
            const questionsContent = document.getElementById('questionsContent');
            if (questionsContent) {
                questionsContent.innerHTML = '';
            }
            
            // Reset progress display
            resetProgressDisplay();
            
            // Reset category selection UI
            resetCategorySelection();
            
            // Also reset selection state (similar to "New Study Session" button)
            resetSelection();
            
            // Close any open modals/panels
            const statsModal = document.getElementById('statsModal');
            const adminPanel = document.getElementById('adminPanel');
            if (statsModal) {
                statsModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            if (adminPanel) {
                adminPanel.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            
            // Show login buttons
            showLoginButtons();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
    
    // Stats button
    document.getElementById('statsBtn')?.addEventListener('click', () => {
        if (currentUser) {
            loadStats();
        }
    });
    
    // Close stats modal
    document.getElementById('closeStatsBtn')?.addEventListener('click', () => {
        const statsModal = document.getElementById('statsModal');
        if (statsModal) {
            statsModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Close stats modal when clicking outside
    document.getElementById('statsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'statsModal') {
            document.getElementById('statsModal').style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Admin button (in header - only visible after login)
    document.getElementById('adminBtn')?.addEventListener('click', handleAdminClick);
    
    // Close admin panel
    document.getElementById('closeAdminBtn')?.addEventListener('click', () => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel) {
            adminPanel.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Close admin panel when clicking outside
    document.getElementById('adminPanel')?.addEventListener('click', (e) => {
        if (e.target.id === 'adminPanel') {
            document.getElementById('adminPanel').style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Report modal event listeners
    document.getElementById('closeReportBtn')?.addEventListener('click', closeReportModal);
    document.getElementById('cancelReportBtn')?.addEventListener('click', closeReportModal);
    document.getElementById('reportForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentReportQuestionId) return;
        
        const issueType = document.getElementById('reportIssueType').value;
        const description = document.getElementById('reportDescription').value;
        
        if (!issueType || !description) {
            alert('Please fill in all fields');
            return;
        }
        
        await submitReport(currentReportQuestionId, issueType, description);
    });
    
    // Close report modal when clicking outside
    document.getElementById('reportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'reportModal') {
            closeReportModal();
        }
    });
    
    // Question editor modal event listeners
    document.getElementById('closeQuestionEditorBtn')?.addEventListener('click', closeQuestionEditor);
    document.getElementById('cancelQuestionEditorBtn')?.addEventListener('click', closeQuestionEditor);
    document.getElementById('addAlternativeBtn')?.addEventListener('click', () => addAlternativeAnswerField());
    document.getElementById('questionEditorForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveQuestion();
    });
    
    // Close question editor modal when clicking outside
    document.getElementById('questionEditorModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'questionEditorModal') {
            closeQuestionEditor();
        }
    });
    
    // Toggle show/hide all answers
    document.getElementById('toggleAll')?.addEventListener('click', toggleAllAnswers);
    
    // Reset progress button - resets current session progress (works for both logged-in and guest users)
    document.getElementById('resetProgressBtn')?.addEventListener('click', async () => {
        if (currentQuestions.length === 0) {
            alert('No progress to reset.');
            return;
        }
        
        // For guest users, just reset local state
        if (!currentUser) {
            if (!confirm('Are you sure you want to reset your progress for this session?')) {
                return;
            }
            
            // Reset local state
            attempts = {};
            currentQuestions.forEach(q => {
                attempts[`problem-${q.id}`] = { wrong: 0, correct: false };
            });
            
            // Reset UI
            currentQuestions.forEach(q => {
                const input = document.getElementById(`input-${q.id}`);
                const feedback = document.getElementById(`feedback-${q.id}`);
                const toggleBtn = document.getElementById(`toggle-${q.id}`);
                const submitBtn = input?.parentElement.querySelector('.submit-answer');
                
                if (input) {
                    input.disabled = false;
                    input.style.backgroundColor = '';
                    input.value = '';
                }
                if (feedback) {
                    feedback.textContent = '';
                    feedback.className = 'feedback';
                }
                if (toggleBtn) {
                    toggleBtn.style.display = 'none';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }
            });
            
            resetProgressDisplay();
            updateProgress();
            return;
        }
        
        // For logged-in users, delete from database
        if (!confirm('Are you sure you want to reset your progress for this session? This will clear your answers but keep your statistics.')) {
            return;
        }
        
        try {
            const questionIds = currentQuestions.map(q => q.id);
            await fetch(`${API_BASE}/progress`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ questionIds })
            });
            
            // Reset local state
            attempts = {};
            currentQuestions.forEach(q => {
                attempts[`problem-${q.id}`] = { wrong: 0, correct: false };
            });
            
            // Reset UI
            currentQuestions.forEach(q => {
                const input = document.getElementById(`input-${q.id}`);
                const feedback = document.getElementById(`feedback-${q.id}`);
                const toggleBtn = document.getElementById(`toggle-${q.id}`);
                const submitBtn = input?.parentElement.querySelector('.submit-answer');
                
                if (input) {
                    input.disabled = false;
                    input.style.backgroundColor = '';
                    input.value = '';
                }
                if (feedback) {
                    feedback.textContent = '';
                    feedback.className = 'feedback';
                }
                if (toggleBtn) {
                    toggleBtn.style.display = 'none';
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                }
            });
            
            resetProgressDisplay();
            updateProgress();
        } catch (error) {
            console.error('Failed to reset progress:', error);
            alert('Failed to reset progress. Please try again.');
        }
    });
    
    // Finish button - clears questions but keeps stats, returns to category selection
    document.getElementById('finishBtn')?.addEventListener('click', async () => {
        // Clear local question state (allows questions to be answered again)
        currentQuestions = [];
        attempts = {};
        
        // Clear questions content
        const questionsContent = document.getElementById('questionsContent');
        if (questionsContent) {
            questionsContent.innerHTML = '';
        }
        
        // Reset progress display
        resetProgressDisplay();
        
        // Hide Finish button
        const finishBtn = document.getElementById('finishBtn');
        if (finishBtn) {
            finishBtn.style.display = 'none';
        }
        
        // Return to category selection (keep course selected)
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('categorySelection').style.display = 'block';
    });
}

// Reset category selection
function resetCategorySelection() {
    selectedCategories = [];
    isRandom = false;
    questionCount = 'all';
    document.querySelectorAll('.category-tag').forEach(tag => tag.classList.remove('selected'));
    const randomTag = document.getElementById('randomTag');
    if (randomTag) randomTag.classList.remove('selected');
    document.querySelectorAll('.count-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.count === 'all') btn.classList.add('active');
    });
    updateStartButton();
}

// Reset selection (full reset)
function resetSelection() {
    selectedCourse = null;
    resetCategorySelection();
}

// Reset progress display to zero
function resetProgressDisplay() {
    const elements = {
        progressFill: document.getElementById('progressFill'),
        progressBar: document.getElementById('progressBar'),
        score: document.getElementById('score'),
        total: document.getElementById('total'),
        scorePercentage: document.getElementById('scorePercentage'),
        scoreText: document.getElementById('scoreText')
    };
    
    if (elements.progressFill) elements.progressFill.style.width = '0%';
    if (elements.progressBar) elements.progressBar.style.width = '0%';
    if (elements.score) elements.score.textContent = '0';
    if (elements.total) elements.total.textContent = '0';
    if (elements.scorePercentage) elements.scorePercentage.textContent = '0%';
    if (elements.scoreText) elements.scoreText.textContent = '0 / 0 (0%)';
}

// Start study session
async function startStudy() {
    if (!selectedCourse) {
        alert('Please select a course first.');
        return;
    }
    
    try {
        // Build query parameters
        const params = new URLSearchParams();
        
        // Course is required
        params.append('course', selectedCourse);
        
        if (isRandom) {
            params.append('random', 'true');
        } else if (selectedCategories.length > 0) {
            params.append('categories', selectedCategories.join(','));
        }
        
        if (questionCount !== 'all') {
            params.append('count', questionCount);
        }
        
        // Fetch questions
        const response = await fetch(`${API_BASE}/questions?${params.toString()}`);
        currentQuestions = await response.json();
        
        if (currentQuestions.length === 0) {
            alert('No questions found for the selected criteria.');
            return;
        }
        
        // Hide category selection, show main content
        document.getElementById('categorySelection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        
        // Initialize attempts and generate session ID
        attempts = {};
        currentSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        currentQuestions.forEach(q => {
            attempts[`problem-${q.id}`] = { wrong: 0, correct: false };
        });
        
        // Render questions
        renderQuestions();
        
        // Load user progress if authenticated (skip for guest users)
        if (currentUser) {
            await loadUserProgress();
        }
        
        // Update progress display
        updateProgress();
    } catch (error) {
        console.error('Failed to start study:', error);
        alert('Failed to load questions. Please try again.');
    }
}

// Render questions
function renderQuestions() {
    const container = document.getElementById('questionsContent');
    container.innerHTML = '';
    
    // Group by category
    const byCategory = {};
    currentQuestions.forEach(q => {
        const catName = q.category.name;
        if (!byCategory[catName]) {
            byCategory[catName] = [];
        }
        byCategory[catName].push(q);
    });
    
    // Render each category section
    Object.keys(byCategory).forEach(catName => {
        const section = document.createElement('section');
        section.className = 'section';
        
        const category = currentQuestions.find(q => q.category.name === catName).category;
        section.innerHTML = `<h2>${category.description || category.name}</h2><div class="problems" id="category-${category.name}"></div>`;
        
        const problemsContainer = section.querySelector('.problems');
        
        byCategory[catName].forEach(problem => {
            const problemId = `problem-${problem.id}`;
            const card = document.createElement('div');
            card.className = 'problem-card';
            card.innerHTML = `
                <div class="problem-number">Problem ${problem.num || problem.id}</div>
                <div class="problem-text">${problem.question}</div>
                <div class="answer-input-container">
                    <input type="text" 
                           id="input-${problem.id}" 
                           class="answer-input" 
                           placeholder="Enter your answer"
                           data-problem-id="${problemId}">
                    <button class="submit-answer" onclick="submitAnswer(${problem.id}, '${problemId}')">
                        Check Answer
                    </button>
                </div>
                <div id="feedback-${problem.id}" class="feedback"></div>
                <button class="toggle-answer" 
                        id="toggle-${problem.id}" 
                        onclick="toggleAnswer(this, ${problem.id})"
                        style="display: none;">
                    Show Answer
                </button>
                <div class="answer" id="answer-${problem.id}">
                    <div class="answer-text">Answer: ${problem.answer}</div>
                </div>
                <button class="report-icon" onclick="showReportModal(${problem.id})" title="Report an issue with this question">
                    ⚠️
                </button>
            `;
            problemsContainer.appendChild(card);
        });
        
        container.appendChild(section);
    });
    
    // Re-render MathJax
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => console.log(err));
    }
    
    // Add Enter key support
    document.querySelectorAll('.answer-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const problemId = input.getAttribute('data-problem-id');
                const problemNum = parseInt(input.id.split('-')[1]);
                const problem = currentQuestions.find(q => q.id === problemNum);
                if (problem) {
                    submitAnswer(problemNum, problemId);
                }
            }
        });
    });
}

// Load user progress
async function loadUserProgress() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/progress`, { credentials: 'include' });
        const progress = await response.json();
        
        progress.forEach(p => {
            const problemId = `problem-${p.questionId}`;
            if (attempts[problemId]) {
                attempts[problemId].correct = p.isCorrect;
                attempts[problemId].wrong = p.attempts;
                
                // Update UI if completed
                if (p.isCorrect || p.attempts >= MAX_ATTEMPTS) {
                    const input = document.getElementById(`input-${p.questionId}`);
                    if (input) {
                        if (p.isCorrect) {
                            input.disabled = true;
                            input.style.backgroundColor = "#d4edda";
                            const submitBtn = input.parentElement.querySelector('.submit-answer');
                            if (submitBtn) {
                                submitBtn.disabled = true;
                                submitBtn.style.opacity = "0.6";
                            }
                        } else if (p.attempts >= 3) {
                            const toggleBtn = document.getElementById(`toggle-${p.questionId}`);
                            if (toggleBtn) toggleBtn.style.display = "inline-block";
                        }
                    }
                }
            }
        });
        
        updateProgress();
    } catch (error) {
        console.error('Failed to load progress:', error);
    }
}

// Normalize user input
function normalizeInput(input) {
    if (!input) return "";
    let normalized = input
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/≥|>=/g, ">=")
        .replace(/≤|<=/g, "<=")
        .replace(/infinitenumberofsolutions|infinitesolutions|infinitelymanysolutions|infinite/g, "infinitenumberofsolutions")
        .replace(/nosolution|nosolutions|none/g, "nosolution");
    return normalized;
}

// Check if answer is correct
function checkAnswer(userInput, correctAnswer, alternativeAnswers = []) {
    const normalized = normalizeInput(userInput);
    const correct = normalizeInput(correctAnswer);
    
    // Check against primary answer
    if (normalized === correct) return true;
    
    // Check against alternative answers (pre-normalize to avoid redundant calls)
    const normalizedAlternatives = alternativeAnswers.map(alt => normalizeInput(alt));
    if (normalizedAlternatives.includes(normalized)) return true;
    
    // Special handling for coordinate pairs
    const coordPattern = /^\((-?\d+),(-?\d+)\)$/;
    const correctCoords = correct.match(coordPattern);
    if (correctCoords) {
        const userCoords = normalized.match(coordPattern);
        if (userCoords && userCoords[1] === correctCoords[1] && userCoords[2] === correctCoords[2]) {
            return true;
        }
    }
    
    // Special handling for integers
    if (/^-?\d+$/.test(correct)) {
        const numMatch = normalized.match(/^-?\d+$/);
        if (numMatch && numMatch[0] === correct) return true;
    }
    
    // Special handling for fractions
    if (correct.includes("/")) {
        const fracPattern = /^(-?\d+)\/(-?\d+)$/;
        const userFrac = normalized.match(fracPattern);
        const correctFrac = correct.match(fracPattern);
        if (userFrac && correctFrac) {
            const userNum = parseInt(userFrac[1]);
            const userDen = parseInt(userFrac[2]);
            const correctNum = parseInt(correctFrac[1]);
            const correctDen = parseInt(correctFrac[2]);
            if (userNum * correctDen === userDen * correctNum) {
                return true;
            }
        }
    }
    
    return false;
}

// Submit answer
async function submitAnswer(problemNum, problemId) {
    const input = document.getElementById(`input-${problemNum}`);
    const feedback = document.getElementById(`feedback-${problemNum}`);
    const toggleBtn = document.getElementById(`toggle-${problemNum}`);
    
    if (attempts[problemId] && attempts[problemId].correct) {
        return;
    }
    
    const userAnswer = input.value.trim();
    
    if (!userAnswer) {
        feedback.textContent = "Please enter an answer.";
        feedback.className = "feedback feedback-error";
        return;
    }
    
    const problem = currentQuestions.find(q => q.id === problemNum);
    if (!problem) return;
    
    const isCorrect = checkAnswer(userAnswer, problem.normalized, problem.alternativeAnswers || []);
    
    if (isCorrect) {
        attempts[problemId].correct = true;
        feedback.textContent = "✓ Correct!";
        feedback.className = "feedback feedback-correct";
        input.disabled = true;
        input.style.backgroundColor = "#d4edda";
        const submitBtn = input.parentElement.querySelector('.submit-answer');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.6";
            submitBtn.style.cursor = "not-allowed";
        }
        toggleBtn.style.display = "none";
        
        // Save progress to API
        if (currentUser) {
            await saveProgress(problemNum, true, attempts[problemId].wrong + 1);
        }
    } else {
        attempts[problemId].wrong++;
        const remaining = MAX_ATTEMPTS - attempts[problemId].wrong;
        
        if (remaining > 0) {
            feedback.textContent = `✗ Incorrect. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
            feedback.className = "feedback feedback-error";
        } else {
            feedback.textContent = "✗ Incorrect. Show answer button unlocked.";
            feedback.className = "feedback feedback-error";
            toggleBtn.style.display = "inline-block";
            
            // Save progress to API
            if (currentUser) {
                await saveProgress(problemNum, false, MAX_ATTEMPTS);
            }
        }
    }
    
    updateProgress();
}

// Save progress to API
async function saveProgress(questionId, isCorrect, attempts) {
    if (!currentUser) return; // Don't save for anonymous/guest users
    
    try {
        await fetch(`${API_BASE}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                questionId,
                isCorrect,
                attempts,
                sessionId: currentSessionId
            })
        });
    } catch (error) {
        console.error('Failed to save progress:', error);
    }
}

// Toggle answer
function toggleAnswer(button, problemNum) {
    const answer = document.getElementById(`answer-${problemNum}`);
    const isShowing = answer.classList.contains('show');
    
    if (isShowing) {
        answer.classList.remove('show');
        button.textContent = 'Show Answer';
    } else {
        answer.classList.add('show');
        button.textContent = 'Hide Answer';
    }
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([answer]).catch((err) => console.log(err));
    }
}

// Toggle show/hide all answers
function toggleAllAnswers() {
    const answers = document.querySelectorAll('.answer');
    const buttons = document.querySelectorAll('.toggle-answer');
    const toggleBtn = document.getElementById('toggleAll');
    
    // Check if any answer is currently shown
    const anyShown = Array.from(answers).some(answer => answer.classList.contains('show'));
    
    if (anyShown) {
        // Hide all answers
        answers.forEach(answer => answer.classList.remove('show'));
        buttons.forEach(button => {
            if (button.style.display !== 'none') {
                button.textContent = 'Show Answer';
            }
        });
        if (toggleBtn) toggleBtn.textContent = 'Show All Answers';
    } else {
        // Show all answers
        answers.forEach(answer => answer.classList.add('show'));
        buttons.forEach(button => {
            if (button.style.display !== 'none') {
                button.textContent = 'Hide Answer';
            }
        });
        if (toggleBtn) toggleBtn.textContent = 'Hide All Answers';
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch((err) => console.log(err));
        }
    }
}

// Update progress
function updateProgress() {
    const total = currentQuestions.length;
    let completed = 0;
    let correct = 0;
    
    Object.values(attempts).forEach(attempt => {
        if (attempt.correct || attempt.wrong >= MAX_ATTEMPTS) {
            completed++;
            if (attempt.correct) {
                correct++;
            }
        }
    });
    
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    const scoreEl = document.getElementById('score');
    const totalEl = document.getElementById('total');
    const scorePercentageEl = document.getElementById('scorePercentage');
    if (scoreEl) scoreEl.textContent = correct;
    if (totalEl) totalEl.textContent = total;
    if (scorePercentageEl) scorePercentageEl.textContent = `${scorePercent}%`;
    
    // Show Finish button when all questions are completed
    const finishBtn = document.getElementById('finishBtn');
    if (finishBtn) {
        if (completed === total && total > 0) {
            finishBtn.style.display = 'inline-block';
        } else {
            finishBtn.style.display = 'none';
        }
    }
}

// Load and display stats
async function loadStats() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/stats`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Failed to load stats');
        }
        const stats = await response.json();
        renderStats(stats);
        
        const statsModal = document.getElementById('statsModal');
        if (statsModal) {
            statsModal.style.display = 'flex';
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
        alert('Failed to load statistics. Please try again.');
    }
}

// Render stats in modal
function renderStats(stats) {
    const statsContent = document.getElementById('statsContent');
    if (!statsContent) return;
    
    let html = '<div class="stats-section-overall">';
    html += '<h4>Overall Statistics</h4>';
    html += `<p><strong>Total Completed:</strong> ${stats.overall.total || 0} questions</p>`;
    html += `<p><strong>Correct Answers:</strong> ${stats.overall.correct || 0}</p>`;
    html += `<p><strong>Accuracy:</strong> ${stats.overall.percentage || 0}%</p>`;
    html += '</div>';
    
    if (stats.byCourse && stats.byCourse.length > 0) {
        html += '<div class="stats-section-breakdown">';
        html += '<h4>Course Completion</h4>';
        html += '<table class="stats-table">';
        html += '<thead><tr><th>Course</th><th>Completed</th><th>Total</th><th>Completion %</th><th>Accuracy %</th></tr></thead>';
        html += '<tbody>';
        stats.byCourse.forEach(course => {
            html += `<tr>
                <td>${course.courseName}</td>
                <td>${course.completed || 0}</td>
                <td>${course.totalQuestions || 0}</td>
                <td>${course.completionPercentage || 0}%</td>
                <td>${course.accuracyPercentage || 0}%</td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '</div>';
    }
    
    if (stats.byCategory && stats.byCategory.length > 0) {
        html += '<div class="stats-section-breakdown">';
        html += '<h4>Category Completion</h4>';
        html += '<table class="stats-table">';
        html += '<thead><tr><th>Category</th><th>Completed</th><th>Total</th><th>Completion %</th><th>Accuracy %</th></tr></thead>';
        html += '<tbody>';
        stats.byCategory.forEach(category => {
            html += `<tr>
                <td>${category.categoryName}</td>
                <td>${category.completed || 0}</td>
                <td>${category.totalQuestions || 0}</td>
                <td>${category.completionPercentage || 0}%</td>
                <td>${category.accuracyPercentage || 0}%</td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '</div>';
    }
    
    statsContent.innerHTML = html;
}

// Handle admin button click
async function handleAdminClick() {
    const adminPanel = document.getElementById('adminPanel');
    if (!adminPanel) return;
    
    // Check if already logged in as admin
    try {
        const statusResponse = await fetch(`${API_BASE}/admin/status`, { credentials: 'include' });
        const status = await statusResponse.json();
        
        if (status.isAdmin) {
            loadAdminPanel('users');
        } else {
            const password = prompt('Enter admin password:');
            if (password) {
                const loginResponse = await fetch(`${API_BASE}/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ password })
                });
                
                const loginResult = await loginResponse.json();
                if (loginResult.success) {
                    // Wait longer for session to be fully saved and persisted before loading admin panel
                    // This ensures the session recovery middleware can find the session
                    await new Promise(resolve => setTimeout(resolve, 500));
                    loadAdminPanel('users');
                } else {
                    alert('Invalid password');
                }
            }
        }
    } catch (error) {
        console.error('Admin check failed:', error);
        alert('Failed to access admin panel');
    }
}


// View user stats (admin)
async function viewUserStats(userId) {
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}/stats`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Failed to load user stats');
        }
        const stats = await response.json();
        
        let html = '<div class="stats-section-overall">';
        html += `<h4>User Statistics (User ID: ${userId})</h4>`;
        html += `<p><strong>Total Completed:</strong> ${stats.overall.total || 0} questions</p>`;
        html += `<p><strong>Correct Answers:</strong> ${stats.overall.correct || 0}</p>`;
        html += `<p><strong>Accuracy:</strong> ${stats.overall.percentage || 0}%</p>`;
        html += '</div>';
        
        if (stats.byCourse && stats.byCourse.length > 0) {
            html += '<div class="stats-section-breakdown"><h4>By Course</h4><table class="stats-table"><thead><tr><th>Course</th><th>Correct</th><th>Total</th><th>%</th></tr></thead><tbody>';
            stats.byCourse.forEach(course => {
                html += `<tr><td>${course.courseName}</td><td>${course.correct}</td><td>${course.total}</td><td>${course.percentage}%</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        if (stats.byCategory && stats.byCategory.length > 0) {
            html += '<div class="stats-section-breakdown"><h4>By Category</h4><table class="stats-table"><thead><tr><th>Category</th><th>Correct</th><th>Total</th><th>%</th></tr></thead><tbody>';
            stats.byCategory.forEach(category => {
                html += `<tr><td>${category.categoryName}</td><td>${category.correct}</td><td>${category.total}</td><td>${category.percentage}%</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        
        const adminContent = document.getElementById('adminContent');
        if (adminContent) {
            adminContent.innerHTML = html + '<button class="btn" onclick="loadAdminPanel(\'users\')">Back to User List</button>';
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
        alert('Failed to load user statistics');
    }
}

// Reset user progress (admin)
async function resetUserProgress(userId) {
    if (!confirm('Are you sure you want to reset this user\'s active progress? This will delete their current progress but keep historical data.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}/reset`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset user progress');
        }
        
        alert('User progress reset successfully');
        loadAdminPanel('users');
    } catch (error) {
        console.error('Failed to reset user progress:', error);
        alert('Failed to reset user progress');
    }
}

// Delete user (admin)
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This will permanently delete all their data including history. This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
        
        alert('User deleted successfully');
        loadAdminPanel('users');
    } catch (error) {
        console.error('Failed to delete user:', error);
        alert('Failed to delete user');
    }
}

// Report Modal Functions
let currentReportQuestionId = null;

function showReportModal(questionId) {
    currentReportQuestionId = questionId;
    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        // Reset form
        document.getElementById('reportForm').reset();
    }
}

function closeReportModal() {
    const reportModal = document.getElementById('reportModal');
    if (reportModal) {
        reportModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentReportQuestionId = null;
    }
}

async function submitReport(questionId, issueType, description) {
    try {
        const response = await fetch(`${API_BASE}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                questionId,
                issueType,
                description
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit report');
        }
        
        const result = await response.json();
        alert('Report submitted successfully. Thank you for your feedback!');
        closeReportModal();
        return result;
    } catch (error) {
        console.error('Failed to submit report:', error);
        alert('Failed to submit report. Please try again.');
        throw error;
    }
}

// Load admin panel with tabs
async function loadAdminPanel(activeTab = 'users') {
    const adminPanel = document.getElementById('adminPanel');
    const adminContent = document.getElementById('adminContent');
    if (!adminPanel || !adminContent) return;
    
    // Create tab navigation
    let html = '<div class="admin-tabs">';
    html += `<button class="admin-tab ${activeTab === 'users' ? 'active' : ''}" onclick="loadAdminPanel('users')">Users</button>`;
    html += `<button class="admin-tab ${activeTab === 'issues' ? 'active' : ''}" onclick="loadAdminPanel('issues')">Issues</button>`;
    html += '</div>';
    html += '<div id="adminTabContent"></div>';
    
    adminContent.innerHTML = html;
    adminPanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    if (activeTab === 'users') {
        await loadUsersTab();
    } else if (activeTab === 'issues') {
        await loadIssuesTab();
    }
}

async function loadUsersTab() {
    const tabContent = document.getElementById('adminTabContent');
    if (!tabContent) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        const users = await response.json();
        renderUserList(users);
    } catch (error) {
        console.error('Failed to load users:', error);
        tabContent.innerHTML = '<p>Failed to load users.</p>';
    }
}

function renderUserList(users) {
    const tabContent = document.getElementById('adminTabContent');
    if (!tabContent) return;
    
    if (users.length === 0) {
        tabContent.innerHTML = '<p>No users found.</p>';
        return;
    }
    
    let html = '<div class="admin-container">';
    html += '<table class="admin-table">';
    html += '<thead><tr><th>Email</th><th>Provider</th><th>Created</th><th>Actions</th></tr></thead>';
    html += '<tbody>';
    
    users.forEach(user => {
        const createdDate = new Date(user.created_at).toLocaleDateString();
        html += `<tr>
            <td>${user.email}</td>
            <td>${user.provider}</td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-small btn-stats" onclick="viewUserStats(${user.id})">View Stats</button>
                <button class="btn btn-small btn-warning" onclick="resetUserProgress(${user.id})">Reset Progress</button>
                <button class="btn btn-small btn-danger" onclick="deleteUser(${user.id})">Delete</button>
            </td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += '</div>';
    
    tabContent.innerHTML = html;
}

async function loadIssuesTab() {
    const tabContent = document.getElementById('adminTabContent');
    if (!tabContent) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/reports`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Failed to load reports');
        }
        const reports = await response.json();
        renderReportsList(reports);
    } catch (error) {
        console.error('Failed to load reports:', error);
        tabContent.innerHTML = '<p>Failed to load reports.</p>';
    }
}

function renderReportsList(reports) {
    const tabContent = document.getElementById('adminTabContent');
    if (!tabContent) return;
    
    if (reports.length === 0) {
        tabContent.innerHTML = '<p>No reports found.</p>';
        return;
    }
    
    let html = '<div class="admin-container">';
    reports.forEach(report => {
        const reportedDate = new Date(report.reported_at).toLocaleDateString();
        const issueTypeLabels = {
            'wrong_answer': 'Wrong Answer',
            'answer_should_be_accepted': 'Answer Should Be Accepted',
            'other': 'Other'
        };
        const questionPreview = report.question_text.length > 100 
            ? report.question_text.substring(0, 100) + '...' 
            : report.question_text;
        
        html += `<div class="report-item" style="border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: white;">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">`;
        html += `<div><strong>Question ID:</strong> ${report.question_id}</div>`;
        html += `<div><strong>Issue Type:</strong> ${issueTypeLabels[report.issue_type] || report.issue_type}</div>`;
        html += `</div>`;
        html += `<div style="margin-bottom: 10px;"><strong>Question:</strong> ${questionPreview}</div>`;
        html += `<div style="margin-bottom: 10px;"><strong>Description:</strong> ${report.description}</div>`;
        html += `<div style="margin-bottom: 10px; color: #666; font-size: 0.9em;">`;
        html += `<strong>Reported by:</strong> ${report.reporter_email || 'Anonymous'} | `;
        html += `<strong>Date:</strong> ${reportedDate}`;
        html += `</div>`;
        html += `<div style="display: flex; gap: 10px;">`;
        html += `<button class="btn btn-small btn-primary" onclick="editQuestion(${report.question_id})">Edit Question</button>`;
        html += `<button class="btn btn-small btn-warning" onclick="acknowledgeReport(${report.id})">Acknowledge</button>`;
        html += `</div>`;
        html += `</div>`;
    });
    html += '</div>';
    
    tabContent.innerHTML = html;
}

async function acknowledgeReport(reportId) {
    if (!confirm('Are you sure you want to acknowledge this report? This will mark it as resolved.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to acknowledge report');
        }
        
        alert('Report acknowledged successfully');
        loadIssuesTab();
    } catch (error) {
        console.error('Failed to acknowledge report:', error);
        alert('Failed to acknowledge report');
    }
}

async function editQuestion(questionId) {
    try {
        const response = await fetch(`${API_BASE}/admin/questions/${questionId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load question');
        }
        
        const question = await response.json();
        showQuestionEditor(question);
    } catch (error) {
        console.error('Failed to load question:', error);
        alert('Failed to load question for editing');
    }
}

async function showQuestionEditor(question) {
    const editorModal = document.getElementById('questionEditorModal');
    if (!editorModal) return;
    
    // Set question ID
    document.getElementById('editorQuestionId').value = question.id;
    document.getElementById('editorQuestionText').value = question.question_text;
    document.getElementById('editorAnswer').value = question.answer;
    
    // Load categories and courses
    const categorySelect = document.getElementById('editorCategory');
    const courseSelect = document.getElementById('editorCourse');
    
    // Load courses
    const coursesResponse = await fetch(`${API_BASE}/courses`, { credentials: 'include' });
    if (coursesResponse.ok) {
        const courses = await coursesResponse.json();
        const currentCourse = courses.find(c => c.id === question.course_id);
        
        // Populate course select
        courseSelect.innerHTML = '';
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.name;
            if (course.id === question.course_id) option.selected = true;
            courseSelect.appendChild(option);
        });
        
        // Load categories for the current course
        if (currentCourse) {
            const categoriesResponse = await fetch(`${API_BASE}/categories?course=${encodeURIComponent(currentCourse.name)}`, { credentials: 'include' });
            if (categoriesResponse.ok) {
                const cats = await categoriesResponse.json();
                categorySelect.innerHTML = '';
                cats.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id;
                    option.textContent = cat.description || cat.name;
                    if (cat.id === question.category_id) option.selected = true;
                    categorySelect.appendChild(option);
                });
            }
        }
        
        // Update categories when course changes
        courseSelect.addEventListener('change', async (e) => {
            const selectedCourseId = parseInt(e.target.value);
            const selectedCourse = courses.find(c => c.id === selectedCourseId);
            
            if (selectedCourse) {
                const categoriesResponse = await fetch(`${API_BASE}/categories?course=${encodeURIComponent(selectedCourse.name)}`, { credentials: 'include' });
                if (categoriesResponse.ok) {
                    const cats = await categoriesResponse.json();
                    categorySelect.innerHTML = '';
                    cats.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = cat.description || cat.name;
                        categorySelect.appendChild(option);
                    });
                }
            }
        });
    }
    
    // Load alternative answers
    const altAnswersList = document.getElementById('alternativeAnswersList');
    altAnswersList.innerHTML = '';
    if (question.alternativeAnswers && question.alternativeAnswers.length > 0) {
        question.alternativeAnswers.forEach((alt, index) => {
            addAlternativeAnswerField(alt.normalized_answer);
        });
    }
    
    editorModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeQuestionEditor() {
    const editorModal = document.getElementById('questionEditorModal');
    if (editorModal) {
        editorModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function addAlternativeAnswerField(value = '') {
    const list = document.getElementById('alternativeAnswersList');
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.innerHTML = `
        <input type="text" class="answer-input" value="${value}" placeholder="Alternative answer" style="flex: 1;">
        <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">Remove</button>
    `;
    list.appendChild(div);
}

async function saveQuestion() {
    const questionId = document.getElementById('editorQuestionId').value;
    const questionText = document.getElementById('editorQuestionText').value;
    const answer = document.getElementById('editorAnswer').value;
    const categoryId = document.getElementById('editorCategory').value;
    const courseId = document.getElementById('editorCourse').value;
    
    // Get alternative answers and normalize them
    const altInputs = document.querySelectorAll('#alternativeAnswersList input');
    const alternativeAnswers = Array.from(altInputs)
        .map(input => input.value.trim())
        .filter(val => val.length > 0)
        .map(val => {
            // Normalize the alternative answer (same logic as normalizeInput function)
            let normalized = val.toLowerCase().trim();
            if (normalized === 'none') normalized = 'nosolution';
            if (normalized === 'infinite') normalized = 'infinitenumberofsolutions';
            normalized = normalized.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            return { normalizedAnswer: normalized };
        });
    
    // Normalize the main answer (same logic as backend)
    const normalizedAnswer = answer.toLowerCase().trim()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    
    try {
        const response = await fetch(`${API_BASE}/admin/questions/${questionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                questionText,
                answer,
                normalizedAnswer,
                categoryId: parseInt(categoryId),
                courseId: parseInt(courseId),
                alternativeAnswers
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save question');
        }
        
        alert('Question updated successfully!');
        closeQuestionEditor();
        // Reload issues tab to refresh data
        loadIssuesTab();
    } catch (error) {
        console.error('Failed to save question:', error);
        alert('Failed to save question. Please try again.');
    }
}

// Make functions globally available
window.submitAnswer = submitAnswer;
window.toggleAnswer = toggleAnswer;
window.viewUserStats = viewUserStats;
window.resetUserProgress = resetUserProgress;
window.deleteUser = deleteUser;
window.loadAdminPanel = loadAdminPanel;
window.showReportModal = showReportModal;
window.editQuestion = editQuestion;
window.acknowledgeReport = acknowledgeReport;
window.addAlternativeAnswerField = addAlternativeAnswerField;
