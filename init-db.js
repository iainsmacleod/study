const { getDB, initSchema, needsSeeding } = require('./database');

// Course data
const coursesData = [
    { name: 'Honors Algebra 2' }
];

// Category and question data from the original app
const categoriesData = [
    { name: 'fractions', description: 'Fraction Arithmetic' },
    { name: 'graphing', description: 'Solve by Graphing' },
    { name: 'substitution', description: 'Solve by Substitution' },
    { name: 'elimination', description: 'Solve by Elimination' },
    { name: 'factoring', description: 'Factoring' },
    { name: 'equations', description: 'Solving Equations' },
    { name: 'inequalities', description: 'Solving Inequalities' }
];

const questionsData = [
    // Fractions (1-6)
    { course: 'Honors Algebra 2', category: 'fractions', num: 1, question: "$\\frac{42}{5} + \\frac{11}{3}$", answer: "$\\frac{181}{15}$", normalized: "181/15" },
    { course: 'Honors Algebra 2', category: 'fractions', num: 2, question: "$-\\frac{5}{4} - \\frac{36}{5}$", answer: "$-\\frac{169}{20}$", normalized: "-169/20" },
    { course: 'Honors Algebra 2', category: 'fractions', num: 3, question: "$\\frac{3}{4} - \\frac{5}{6}$", answer: "$-\\frac{1}{12}$", normalized: "-1/12" },
    { course: 'Honors Algebra 2', category: 'fractions', num: 4, question: "$-\\frac{3}{2} \\times \\frac{11}{6}$", answer: "$-\\frac{11}{4}$", normalized: "-11/4" },
    { course: 'Honors Algebra 2', category: 'fractions', num: 5, question: "$-\\frac{9}{8} \\div \\frac{3}{16}$", answer: "$-6$", normalized: "-6" },
    { course: 'Honors Algebra 2', category: 'fractions', num: 6, question: "$\\frac{65}{38} \\div \\frac{195}{76}$", answer: "$\\frac{2}{3}$", normalized: "2/3" },
    
    // Graphing (7-10)
    { course: 'Honors Algebra 2', category: 'graphing', num: 7, question: "$y = -9x - 9$<br>$y = -x + 7$", answer: "$(-2, 9)$", normalized: "(-2,9)" },
    { course: 'Honors Algebra 2', category: 'graphing', num: 8, question: "$y = -\\frac{11}{4}x - 5$<br>$y = \\frac{3}{4}x + 9$", answer: "$(-4, 6)$", normalized: "(-4,6)" },
    { course: 'Honors Algebra 2', category: 'graphing', num: 9, question: "$x + 2y = 8$<br>$5x - 2y = 4$", answer: "$(2, 3)$", normalized: "(2,3)" },
    { course: 'Honors Algebra 2', category: 'graphing', num: 10, question: "$5x + 2y = 2$<br>$5x + 2y = 4$", answer: "No solution", normalized: "nosolution" },
    
    // Substitution (11-14)
    { course: 'Honors Algebra 2', category: 'substitution', num: 11, question: "$-3x + 5y = 7$<br>$x + 7y = 15$", answer: "$(1, 2)$", normalized: "(1,2)" },
    { course: 'Honors Algebra 2', category: 'substitution', num: 12, question: "$-10x - 6y = 26$<br>$x - 2y = 0$", answer: "$(-2, -1)$", normalized: "(-2,-1)" },
    { course: 'Honors Algebra 2', category: 'substitution', num: 13, question: "$2x + 14y = -2$<br>$x + 7y = 5$", answer: "No solution", normalized: "nosolution" },
    { course: 'Honors Algebra 2', category: 'substitution', num: 14, question: "$x + 4y = -28$<br>$-3x - 12y = 84$", answer: "Infinite number of solutions", normalized: "infinitenumberofsolutions" },
    
    // Elimination (15-18)
    { course: 'Honors Algebra 2', category: 'elimination', num: 15, question: "$-2x - 10y = 6$<br>$-10x - 20y = 0$", answer: "$(2, -1)$", normalized: "(2,-1)" },
    { course: 'Honors Algebra 2', category: 'elimination', num: 16, question: "$6x + 3y = 9$<br>$12x + 5y = 13$", answer: "$(-1, 5)$", normalized: "(-1,5)" },
    { course: 'Honors Algebra 2', category: 'elimination', num: 17, question: "$-10x - 4y = 4$<br>$5x - 9y = 9$", answer: "$(0, -1)$", normalized: "(0,-1)" },
    { course: 'Honors Algebra 2', category: 'elimination', num: 18, question: "$-3x + 2y = 1$<br>$9x - 6y = 3$", answer: "No solution", normalized: "nosolution" },
    
    // Factoring (19-32)
    { course: 'Honors Algebra 2', category: 'factoring', num: 19, question: "$m^2 + 5m - 36$", answer: "$(m - 4)(m + 9)$", normalized: "(m-4)(m+9)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 20, question: "$k^2 - 4k - 60$", answer: "$(k - 10)(k + 6)$", normalized: "(k-10)(k+6)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 21, question: "$n^2 - 11n + 10$", answer: "$(n - 1)(n - 10)$", normalized: "(n-1)(n-10)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 22, question: "$p^2 + 8p + 15$", answer: "$(p + 5)(p + 3)$", normalized: "(p+5)(p+3)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 23, question: "$x^2 + 14x + 45$", answer: "$(x + 5)(x + 9)$", normalized: "(x+5)(x+9)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 24, question: "$n^2 - 2n - 8$", answer: "$(n - 4)(n + 2)$", normalized: "(n-4)(n+2)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 25, question: "$3k^2 + 6k - 105$", answer: "$3(k - 5)(k + 7)$", normalized: "3(k-5)(k+7)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 26, question: "$6x^2 + 24x - 126$", answer: "$6(x - 3)(x + 7)$", normalized: "6(x-3)(x+7)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 27, question: "$2x^2 - 162$", answer: "$2(x - 9)(x + 9)$", normalized: "2(x-9)(x+9)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 28, question: "$v^3 - v^2$", answer: "$v^2(v - 1)$", normalized: "v^2(v-1)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 29, question: "$m^2 - 49$", answer: "$(m - 7)(m + 7)$", normalized: "(m-7)(m+7)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 30, question: "$a^2 - 2a$", answer: "$a(a - 2)$", normalized: "a(a-2)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 31, question: "$4b^2 + 4b$", answer: "$4b(b + 1)$", normalized: "4b(b+1)" },
    { course: 'Honors Algebra 2', category: 'factoring', num: 32, question: "$k^3 - 36k$", answer: "$k(k - 6)(k + 6)$", normalized: "k(k-6)(k+6)" },
    
    // Equations (33-38)
    { course: 'Honors Algebra 2', category: 'equations', num: 33, question: "$-8(1 - 4b) = -4(b + 10) + 4b$", answer: "$\\{-1\\}$", normalized: "-1" },
    { course: 'Honors Algebra 2', category: 'equations', num: 34, question: "$-3(x + 2) - 8(x + 8) = 4x - 5x$", answer: "$\\{-7\\}$", normalized: "-7" },
    { course: 'Honors Algebra 2', category: 'equations', num: 35, question: "$-\\frac{14}{5}n - \\frac{15}{4} + \\frac{11}{4}n = -\\frac{92}{25}$", answer: "$\\{-\\frac{7}{5}\\}$", normalized: "-7/5" },
    { course: 'Honors Algebra 2', category: 'equations', num: 36, question: "$-\\frac{187}{48} = \\frac{11}{6}x - \\frac{13}{4}x$", answer: "$\\{\\frac{11}{4}\\}$", normalized: "11/4" },
    { course: 'Honors Algebra 2', category: 'equations', num: 37, question: "$\\frac{517}{12} = -\\frac{11}{3}\\left(4a - \\frac{7}{4}\\right)$", answer: "$\\{-\\frac{5}{2}\\}$", normalized: "-5/2" },
    { course: 'Honors Algebra 2', category: 'equations', num: 38, question: "$4\\left(2n - \\frac{3}{2}\\right) + 2n = -\\frac{128}{3}$", answer: "$\\{-\\frac{11}{3}\\}$", normalized: "-11/3" },
    
    // Inequalities (39-40)
    { course: 'Honors Algebra 2', category: 'inequalities', num: 39, question: "$11(p - 1) < -11(p - 5)$", answer: "$p < 3$", normalized: "p<3" },
    { course: 'Honors Algebra 2', category: 'inequalities', num: 40, question: "$-6(9m - 4) + 9m \\leq -6m - (3m + 12)$", answer: "$m \\geq 1$", normalized: "m>=1" }
];

async function seedDatabase() {
    const db = getDB();
    
    try {
        await initSchema(db);
        const needsSeed = await needsSeeding(db);
        
        if (!needsSeed) {
            console.log('Database already seeded');
            db.close((err) => {
                if (err) console.error('Error closing database:', err);
            });
            return;
        }
        
        console.log('Seeding database...');
        
        // Insert courses
        const courseMap = {};
        for (const course of coursesData) {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO courses (name) VALUES (?)',
                    [course.name],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            courseMap[course.name] = this.lastID;
                            resolve();
                        }
                    }
                );
            });
        }
        
        // Insert categories
        const categoryMap = {};
        for (const cat of categoriesData) {
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO categories (name, description) VALUES (?, ?)',
                    [cat.name, cat.description],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            categoryMap[cat.name] = this.lastID;
                            resolve();
                        }
                    }
                );
            });
        }
        
        // Insert questions
        for (const q of questionsData) {
            const courseId = courseMap[q.course];
            const categoryId = categoryMap[q.category];
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO questions (course_id, category_id, question_text, answer, normalized_answer, question_number) VALUES (?, ?, ?, ?, ?, ?)',
                    [courseId, categoryId, q.question, q.answer, q.normalized, q.num],
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        }
        
        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) console.error('Error closing database:', err);
        });
    }
}

// Run if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };

