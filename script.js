// API base URL - use relative path so nginx can proxy
const API_BASE = '/api';

// Debug: Log that script loaded
console.log('Study script loaded, version 3');

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
    const requiredElements = ['googleLogin', 'logoutBtn', 'userInfo', 'userEmail'];
    const allReady = requiredElements.every(id => {
        const el = document.getElementById(id);
        return el && el.style;
    });
    
    if (!allReady) {
        setTimeout(initializeApp, 100);
        return;
    }
    
    setupEventListeners();
    checkAuth();
    loadCourses();
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Also try if DOM is already loaded (for cached pages)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Check authentication status
async function checkAuth() {
    // Wait for DOM elements to be available
    const googleLogin = document.getElementById('googleLogin');
    if (!googleLogin || !googleLogin.style) {
        setTimeout(checkAuth, 100);
        return;
    }
    
    try {
        console.log('Checking auth status...');
        const response = await fetch(`${API_BASE}/auth/user`, { 
            credentials: 'include',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Auth response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Auth check failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Auth response data:', data);
        
        if (data.authenticated && data.user) {
            console.log('User is authenticated:', data.user);
            currentUser = data.user;
            showUserInfo(data.user);
        } else {
            console.log('User is not authenticated');
            currentUser = null;
            showLoginButtons();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        currentUser = null;
        // Only show login buttons if elements are ready
        const loginBtn = document.getElementById('googleLogin');
        if (loginBtn && loginBtn.style) {
            showLoginButtons();
        } else {
            // Retry after a short delay if elements aren't ready
            setTimeout(() => {
                const retryBtn = document.getElementById('googleLogin');
                if (retryBtn && retryBtn.style) {
                    showLoginButtons();
                }
            }, 200);
        }
    }
}

// Show login buttons
function showLoginButtons() {
    // Safety check - ensure we're not called before DOM is ready
    if (document.readyState === 'loading') {
        setTimeout(showLoginButtons, 100);
        return;
    }
    
    try {
        const googleLogin = document.getElementById('googleLogin');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        
        // Double-check elements exist and have style property
        if (!googleLogin || !googleLogin.style) {
            console.warn('googleLogin element not ready');
            return;
        }
        if (!logoutBtn || !logoutBtn.style) {
            console.warn('logoutBtn element not ready');
            return;
        }
        if (!userInfo || !userInfo.style) {
            console.warn('userInfo element not ready');
            return;
        }
        
        googleLogin.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        userInfo.style.display = 'none';
    } catch (error) {
        console.error('Error in showLoginButtons:', error);
    }
}

// Show user info
function showUserInfo(user) {
    // Safety check - ensure we're not called before DOM is ready
    if (document.readyState === 'loading') {
        setTimeout(() => showUserInfo(user), 100);
        return;
    }
    
    try {
        const googleLogin = document.getElementById('googleLogin');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        const userEmail = document.getElementById('userEmail');
        
        // Double-check elements exist and have style property
        if (!googleLogin || !googleLogin.style) {
            console.warn('googleLogin element not ready');
            return;
        }
        if (!logoutBtn || !logoutBtn.style) {
            console.warn('logoutBtn element not ready');
            return;
        }
        if (!userInfo || !userInfo.style) {
            console.warn('userInfo element not ready');
            return;
        }
        if (!userEmail) {
            console.warn('userEmail element not ready');
            return;
        }
        
        googleLogin.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        userInfo.style.display = 'flex';
        userEmail.textContent = user?.email || 'User';
    } catch (error) {
        console.error('Error in showUserInfo:', error);
    }
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

// Load categories from API (for current course)
async function loadCategories() {
    if (!selectedCourse) return;
    
    try {
        const response = await fetch(`${API_BASE}/categories?course=${encodeURIComponent(selectedCourse)}`);
        categories = await response.json();
        renderCategoryTags();
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Render category tags
function renderCategoryTags() {
    const container = document.getElementById('categoryTags');
    container.innerHTML = '';
    
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
    
    if (isRandom) {
        isRandom = false;
        randomTag.classList.remove('selected');
        // Deselect all categories
        selectedCategories = [];
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.remove('selected');
        });
    } else {
        isRandom = true;
        randomTag.classList.add('selected');
        // Deselect all categories
        selectedCategories = [];
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.remove('selected');
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
    // Back to course button
    document.getElementById('backToCourseBtn')?.addEventListener('click', () => {
        document.getElementById('categorySelection').style.display = 'none';
        document.getElementById('courseSelection').style.display = 'block';
        selectedCourse = null;
        resetCategorySelection();
    });
    
    // Random tag
    document.getElementById('randomTag')?.addEventListener('click', toggleRandom);
    
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
    
    // Auth buttons
    const googleLoginBtn = document.getElementById('googleLogin');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Login button clicked, redirecting to:', `${API_BASE}/auth/google`);
            window.location.href = `${API_BASE}/auth/google`;
        });
    } else {
        console.warn('Google login button not found when setting up event listener');
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
            currentUser = null;
            showLoginButtons();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
    
    // Show/hide all answers
    document.getElementById('toggleAll')?.addEventListener('click', showAllAnswers);
    document.getElementById('hideAll')?.addEventListener('click', hideAllAnswers);
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
        
        // Initialize attempts
        attempts = {};
        currentQuestions.forEach(q => {
            attempts[`problem-${q.id}`] = { wrong: 0, correct: false };
        });
        
        // Render questions
        renderQuestions();
        
        // Load user progress if authenticated
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
                if (p.isCorrect || p.attempts >= 3) {
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
    return input
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/≥|>=/g, ">=")
        .replace(/≤|<=/g, "<=")
        .replace(/infinitenumberofsolutions|infinitesolutions|infinitelymanysolutions/g, "infinitenumberofsolutions")
        .replace(/nosolution|nosolutions/g, "nosolution");
}

// Check if answer is correct
function checkAnswer(userInput, correctAnswer) {
    const normalized = normalizeInput(userInput);
    const correct = normalizeInput(correctAnswer);
    
    if (normalized === correct) return true;
    
    if (correct.match(/^\(-?\d+,-?\d+\)$/)) {
        const coordMatch = normalized.match(/^\((-?\d+),(-?\d+)\)$/);
        if (coordMatch) {
            const correctCoords = correct.match(/^\((-?\d+),(-?\d+)\)$/);
            if (correctCoords && 
                coordMatch[1] === correctCoords[1] && 
                coordMatch[2] === correctCoords[2]) {
                return true;
            }
        }
    }
    
    if (correct.match(/^-?\d+$/)) {
        const numMatch = normalized.match(/^-?\d+$/);
        if (numMatch && numMatch[0] === correct) return true;
    }
    
    if (correct.includes("/")) {
        const fracMatch = normalized.match(/^(-?\d+)\/(-?\d+)$/);
        if (fracMatch) {
            const correctFrac = correct.match(/^(-?\d+)\/(-?\d+)$/);
            if (correctFrac) {
                const userNum = parseInt(fracMatch[1]);
                const userDen = parseInt(fracMatch[2]);
                const correctNum = parseInt(correctFrac[1]);
                const correctDen = parseInt(correctFrac[2]);
                if (userNum * correctDen === userDen * correctNum) {
                    return true;
                }
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
    
    const isCorrect = checkAnswer(userAnswer, problem.normalized);
    
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
        const remaining = 3 - attempts[problemId].wrong;
        
        if (remaining > 0) {
            feedback.textContent = `✗ Incorrect. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`;
            feedback.className = "feedback feedback-error";
        } else {
            feedback.textContent = "✗ Incorrect. Show answer button unlocked.";
            feedback.className = "feedback feedback-error";
            toggleBtn.style.display = "inline-block";
            
            // Save progress to API
            if (currentUser) {
                await saveProgress(problemNum, false, 3);
            }
        }
    }
    
    updateProgress();
}

// Save progress to API
async function saveProgress(questionId, isCorrect, attempts) {
    if (!currentUser) return;
    
    try {
        await fetch(`${API_BASE}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                questionId,
                isCorrect,
                attempts
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

// Show all answers
function showAllAnswers() {
    const answers = document.querySelectorAll('.answer');
    const buttons = document.querySelectorAll('.toggle-answer');
    
    answers.forEach(answer => answer.classList.add('show'));
    buttons.forEach(button => {
        if (button.style.display !== 'none') {
            button.textContent = 'Hide Answer';
        }
    });
    
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => console.log(err));
    }
}

// Hide all answers
function hideAllAnswers() {
    const answers = document.querySelectorAll('.answer');
    const buttons = document.querySelectorAll('.toggle-answer');
    
    answers.forEach(answer => answer.classList.remove('show'));
    buttons.forEach(button => {
        if (button.style.display !== 'none') {
            button.textContent = 'Show Answer';
        }
    });
}

// Update progress
function updateProgress() {
    const total = currentQuestions.length;
    let completed = 0;
    let correct = 0;
    
    Object.keys(attempts).forEach(problemId => {
        const attempt = attempts[problemId];
        if (attempt.correct || attempt.wrong >= 3) {
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
    
    const completedEl = document.getElementById('completed');
    const totalProblemsEl = document.getElementById('totalProblems');
    const progressPercentageEl = document.getElementById('progressPercentage');
    const scoreEl = document.getElementById('score');
    const totalEl = document.getElementById('total');
    const scorePercentageEl = document.getElementById('scorePercentage');
    
    if (completedEl) completedEl.textContent = completed;
    if (totalProblemsEl) totalProblemsEl.textContent = total;
    if (progressPercentageEl) progressPercentageEl.textContent = `${progressPercent}%`;
    if (scoreEl) scoreEl.textContent = correct;
    if (totalEl) totalEl.textContent = total;
    if (scorePercentageEl) scorePercentageEl.textContent = `${scorePercent}%`;
}

// Make functions globally available
window.submitAnswer = submitAnswer;
window.toggleAnswer = toggleAnswer;
