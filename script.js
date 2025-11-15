// Track attempts for each problem
const attempts = {};

// Get total number of problems
function getTotalProblems() {
    let total = 0;
    Object.values(problems).forEach(category => {
        total += category.length;
    });
    return total;
}

// Problem data with normalized answers for comparison
const problems = {
    fractions: [
        { num: 1, question: "$\\frac{42}{5} + \\frac{11}{3}$", answer: "$\\frac{181}{15}$", normalized: "181/15" },
        { num: 2, question: "$-\\frac{5}{4} - \\frac{36}{5}$", answer: "$-\\frac{169}{20}$", normalized: "-169/20" },
        { num: 3, question: "$\\frac{3}{4} - \\frac{5}{6}$", answer: "$-\\frac{1}{12}$", normalized: "-1/12" },
        { num: 4, question: "$-\\frac{3}{2} \\times \\frac{11}{6}$", answer: "$-\\frac{11}{4}$", normalized: "-11/4" },
        { num: 5, question: "$-\\frac{9}{8} \\div \\frac{3}{16}$", answer: "$-6$", normalized: "-6" },
        { num: 6, question: "$\\frac{65}{38} \\div \\frac{195}{76}$", answer: "$\\frac{2}{3}$", normalized: "2/3" }
    ],
    graphing: [
        { num: 7, question: "$y = -9x - 9$<br>$y = -x + 7$", answer: "$(-2, 9)$", normalized: "(-2,9)" },
        { num: 8, question: "$y = -\\frac{11}{4}x - 5$<br>$y = \\frac{3}{4}x + 9$", answer: "$(-4, 6)$", normalized: "(-4,6)" },
        { num: 9, question: "$x + 2y = 8$<br>$5x - 2y = 4$", answer: "$(2, 3)$", normalized: "(2,3)" },
        { num: 10, question: "$5x + 2y = 2$<br>$5x + 2y = 4$", answer: "No solution", normalized: "nosolution" }
    ],
    substitution: [
        { num: 11, question: "$-3x + 5y = 7$<br>$x + 7y = 15$", answer: "$(1, 2)$", normalized: "(1,2)" },
        { num: 12, question: "$-10x - 6y = 26$<br>$x - 2y = 0$", answer: "$(-2, -1)$", normalized: "(-2,-1)" },
        { num: 13, question: "$2x + 14y = -2$<br>$x + 7y = 5$", answer: "No solution", normalized: "nosolution" },
        { num: 14, question: "$x + 4y = -28$<br>$-3x - 12y = 84$", answer: "Infinite number of solutions", normalized: "infinitenumberofsolutions" }
    ],
    elimination: [
        { num: 15, question: "$-2x - 10y = 6$<br>$-10x - 20y = 0$", answer: "$(2, -1)$", normalized: "(2,-1)" },
        { num: 16, question: "$6x + 3y = 9$<br>$12x + 5y = 13$", answer: "$(-1, 5)$", normalized: "(-1,5)" },
        { num: 17, question: "$-10x - 4y = 4$<br>$5x - 9y = 9$", answer: "$(0, -1)$", normalized: "(0,-1)" },
        { num: 18, question: "$-3x + 2y = 1$<br>$9x - 6y = 3$", answer: "No solution", normalized: "nosolution" }
    ],
    factoring: [
        { num: 19, question: "$m^2 + 5m - 36$", answer: "$(m - 4)(m + 9)$", normalized: "(m-4)(m+9)" },
        { num: 20, question: "$k^2 - 4k - 60$", answer: "$(k - 10)(k + 6)$", normalized: "(k-10)(k+6)" },
        { num: 21, question: "$n^2 - 11n + 10$", answer: "$(n - 1)(n - 10)$", normalized: "(n-1)(n-10)" },
        { num: 22, question: "$p^2 + 8p + 15$", answer: "$(p + 5)(p + 3)$", normalized: "(p+5)(p+3)" },
        { num: 23, question: "$x^2 + 14x + 45$", answer: "$(x + 5)(x + 9)$", normalized: "(x+5)(x+9)" },
        { num: 24, question: "$n^2 - 2n - 8$", answer: "$(n - 4)(n + 2)$", normalized: "(n-4)(n+2)" },
        { num: 25, question: "$3k^2 + 6k - 105$", answer: "$3(k - 5)(k + 7)$", normalized: "3(k-5)(k+7)" },
        { num: 26, question: "$6x^2 + 24x - 126$", answer: "$6(x - 3)(x + 7)$", normalized: "6(x-3)(x+7)" },
        { num: 27, question: "$2x^2 - 162$", answer: "$2(x - 9)(x + 9)$", normalized: "2(x-9)(x+9)" },
        { num: 28, question: "$v^3 - v^2$", answer: "$v^2(v - 1)$", normalized: "v^2(v-1)" },
        { num: 29, question: "$m^2 - 49$", answer: "$(m - 7)(m + 7)$", normalized: "(m-7)(m+7)" },
        { num: 30, question: "$a^2 - 2a$", answer: "$a(a - 2)$", normalized: "a(a-2)" },
        { num: 31, question: "$4b^2 + 4b$", answer: "$4b(b + 1)$", normalized: "4b(b+1)" },
        { num: 32, question: "$k^3 - 36k$", answer: "$k(k - 6)(k + 6)$", normalized: "k(k-6)(k+6)" }
    ],
    equations: [
        { num: 33, question: "$-8(1 - 4b) = -4(b + 10) + 4b$", answer: "$\\{-1\\}$", normalized: "-1" },
        { num: 34, question: "$-3(x + 2) - 8(x + 8) = 4x - 5x$", answer: "$\\{-7\\}$", normalized: "-7" },
        { num: 35, question: "$-\\frac{14}{5}n - \\frac{15}{4} + \\frac{11}{4}n = -\\frac{92}{25}$", answer: "$\\{-\\frac{7}{5}\\}$", normalized: "-7/5" },
        { num: 36, question: "$-\\frac{187}{48} = \\frac{11}{6}x - \\frac{13}{4}x$", answer: "$\\{\\frac{11}{4}\\}$", normalized: "11/4" },
        { num: 37, question: "$\\frac{517}{12} = -\\frac{11}{3}\\left(4a - \\frac{7}{4}\\right)$", answer: "$\\{-\\frac{5}{2}\\}$", normalized: "-5/2" },
        { num: 38, question: "$4\\left(2n - \\frac{3}{2}\\right) + 2n = -\\frac{128}{3}$", answer: "$\\{-\\frac{11}{3}\\}$", normalized: "-11/3" }
    ],
    inequalities: [
        { num: 39, question: "$11(p - 1) < -11(p - 5)$", answer: "$p < 3$", normalized: "p<3" },
        { num: 40, question: "$-6(9m - 4) + 9m \\leq -6m - (3m + 12)$", answer: "$m \\geq 1$", normalized: "m>=1" }
    ]
};

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

// Normalize user input for comparison
function normalizeInput(input) {
    if (!input) return "";
    return input
        .toLowerCase()
        .replace(/\s+/g, "")  // Remove all spaces
        .replace(/≥|>=/g, ">=")  // Normalize >=
        .replace(/≤|<=/g, "<=")  // Normalize <=
        .replace(/infinitenumberofsolutions|infinitesolutions|infinitelymanysolutions/g, "infinitenumberofsolutions")
        .replace(/nosolution|nosolutions/g, "nosolution");
}

// Check if answer is correct
function checkAnswer(userInput, correctAnswer) {
    const normalized = normalizeInput(userInput);
    const correct = normalizeInput(correctAnswer);
    
    // Direct match
    if (normalized === correct) return true;
    
    // For coordinate answers, try different formats
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
    
    // For set notation like {-1}, try just the number
    if (correct.match(/^-?\d+$/)) {
        const numMatch = normalized.match(/^-?\d+$/);
        if (numMatch && numMatch[0] === correct) return true;
    }
    
    // For fractions, try different formats
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

// Render problems
function renderProblems() {
    Object.keys(problems).forEach(category => {
        const container = document.getElementById(category);
        if (!container) return;

        problems[category].forEach(problem => {
            const problemId = `problem-${problem.num}`;
            attempts[problemId] = { wrong: 0, correct: false };
            
            const card = document.createElement('div');
            card.className = 'problem-card';
            card.innerHTML = `
                <div class="problem-number">Problem ${problem.num}</div>
                <div class="problem-text">${problem.question}</div>
                <div class="answer-input-container">
                    <input type="text" 
                           id="input-${problem.num}" 
                           class="answer-input" 
                           placeholder="Enter your answer"
                           data-problem-id="${problemId}">
                    <button class="submit-answer" onclick="submitAnswer(${problem.num}, '${problemId}')">
                        Check Answer
                    </button>
                </div>
                <div id="feedback-${problem.num}" class="feedback"></div>
                <button class="toggle-answer" 
                        id="toggle-${problem.num}" 
                        onclick="toggleAnswer(this, ${problem.num})"
                        style="display: none;">
                    Show Answer
                </button>
                <div class="answer" id="answer-${problem.num}">
                    <div class="answer-text">Answer: ${problem.answer}</div>
                </div>
            `;
            container.appendChild(card);
        });
    });

    // Re-render MathJax after adding content
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => console.log(err));
    }
    
    // Add Enter key support for inputs
    document.querySelectorAll('.answer-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const problemId = input.getAttribute('data-problem-id');
                const problemNum = parseInt(input.id.split('-')[1]);
                const problem = findProblemByNum(problemNum);
                if (problem) {
                    submitAnswer(problemNum, problemId);
                }
            }
        });
    });
}

// Find problem by number
function findProblemByNum(num) {
    for (const category of Object.values(problems)) {
        const problem = category.find(p => p.num === num);
        if (problem) return problem;
    }
    return null;
}

// Update progress and score
function updateProgress() {
    const total = getTotalProblems();
    let completed = 0;
    let correct = 0;
    
    Object.keys(attempts).forEach(problemId => {
        const attempt = attempts[problemId];
        // Problem is completed if correct OR if 3 wrong attempts made
        if (attempt.correct || attempt.wrong >= 3) {
            completed++;
            if (attempt.correct) {
                correct++;
            }
        }
    });
    
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
    }
    
    // Update text displays
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

// Submit answer
function submitAnswer(problemNum, problemId) {
    const input = document.getElementById(`input-${problemNum}`);
    const feedback = document.getElementById(`feedback-${problemNum}`);
    const toggleBtn = document.getElementById(`toggle-${problemNum}`);
    
    // Don't allow submission if already correct
    if (attempts[problemId] && attempts[problemId].correct) {
        return;
    }
    
    const userAnswer = input.value.trim();
    
    if (!userAnswer) {
        feedback.textContent = "Please enter an answer.";
        feedback.className = "feedback feedback-error";
        return;
    }
    
    const problem = findProblemByNum(problemNum);
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
        updateProgress();
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
            updateProgress();
        }
    }
}

// Toggle individual answer
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

    // Re-render MathJax for the answer
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    renderProblems();
    updateProgress(); // Initialize progress display
    
    document.getElementById('toggleAll').addEventListener('click', showAllAnswers);
    document.getElementById('hideAll').addEventListener('click', hideAllAnswers);
});

// Make functions available globally
window.toggleAnswer = toggleAnswer;
window.submitAnswer = submitAnswer;

