/**
 * Skill course catalogue + question banks.
 * Original NOXIRA-authored MCQs. Every question has exactly 4 options (o)
 * and one correct index (c). Banks hold 50 questions; each attempt serves
 * course.questionCount randomly sampled questions.
 */

const COURSES = [
  {
    code: 'WEB-DEV',
    title: 'Web Development',
    category: 'DEVELOPMENT',
    level: 'BEGINNER',
    description: 'HTML, CSS, JavaScript and how the modern web fits together.',
    durationMinutes: 45,
    passPercent: 60,
    questionCount: 50,
    order: 1
  },
  {
    code: 'PY-PROG',
    title: 'Python Programming',
    category: 'PROGRAMMING',
    level: 'INTERMEDIATE',
    description: 'Core Python: syntax, data structures, functions and problem solving.',
    durationMinutes: 45,
    passPercent: 60,
    questionCount: 50,
    order: 2
  }
];

const BANKS = {
  'WEB-DEV': [
    { q: 'Which HTML tag creates the largest heading?', o: ['<h6>', '<heading>', '<h1>', '<head>'], c: 2 },
    { q: 'Which attribute provides alternative text for an image?', o: ['title', 'alt', 'src', 'caption'], c: 1 },
    { q: 'Which tag is used to create a hyperlink?', o: ['<link>', '<a>', '<href>', '<url>'], c: 1 },
    { q: 'What does CSS stand for?', o: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style System', 'Coded Style Sheets'], c: 1 },
    { q: 'Which CSS property changes text colour?', o: ['text-style', 'font-color', 'color', 'text-color'], c: 2 },
    { q: 'How do you select an element with id "main" in CSS?', o: ['.main', '#main', 'main', '*main'], c: 1 },
    { q: 'How do you select all elements with class "card" in CSS?', o: ['#card', 'card', '.card', '@card'], c: 2 },
    { q: 'Which HTML element is used for an unordered list?', o: ['<ol>', '<li>', '<ul>', '<list>'], c: 2 },
    { q: 'Which keyword declares a block-scoped variable in JavaScript?', o: ['var', 'let', 'dim', 'global'], c: 1 },
    { q: 'What is the correct way to write a JavaScript array?', o: ['let a = (1,2,3)', 'let a = [1,2,3]', 'let a = {1,2,3}', 'let a = <1,2,3>'], c: 1 },
    { q: 'Which method converts a JSON string into a JavaScript object?', o: ['JSON.stringify()', 'JSON.toObject()', 'JSON.parse()', 'JSON.convert()'], c: 2 },
    { q: 'Which HTML tag embeds JavaScript directly in a page?', o: ['<js>', '<javascript>', '<script>', '<code>'], c: 2 },
    { q: 'What does DOM stand for?', o: ['Document Object Model', 'Data Order Method', 'Document Oriented Markup', 'Digital Object Map'], c: 0 },
    { q: 'Which method selects an element by its id in JavaScript?', o: ['document.querySelector(".id")', 'document.getElementById()', 'document.selectId()', 'document.findById()'], c: 1 },
    { q: 'In CSS Flexbox, which property aligns items along the main axis?', o: ['align-items', 'justify-content', 'flex-direction', 'align-content'], c: 1 },
    { q: 'Which HTML5 element is the most semantic container for a standalone article?', o: ['<div>', '<section>', '<article>', '<content>'], c: 2 },
    { q: 'What does the "async" attribute on a <script> tag do?', o: ['Blocks rendering until the script runs', 'Loads the script without blocking HTML parsing and runs it as soon as ready', 'Runs the script only after user input', 'Delays the script until the window closes'], c: 1 },
    { q: 'Which HTTP status code means "Not Found"?', o: ['200', '301', '404', '500'], c: 2 },
    { q: 'Which CSS unit is relative to the root element font size?', o: ['em', 'px', 'rem', 'vh'], c: 2 },
    { q: 'What will `typeof null` return in JavaScript?', o: ['"null"', '"undefined"', '"object"', '"number"'], c: 2 },
    { q: 'Which array method adds an element to the END of an array?', o: ['shift()', 'unshift()', 'pop()', 'push()'], c: 3 },
    { q: 'Which event fires when a user clicks an element?', o: ['onhover', 'onclick', 'onpress', 'onchange'], c: 1 },
    { q: 'What is the correct HTML for a checkbox input?', o: ['<input type="check">', '<input type="checkbox">', '<checkbox>', '<input checkbox>'], c: 1 },
    { q: 'Which CSS property controls the space BETWEEN lines of text?', o: ['letter-spacing', 'word-spacing', 'line-height', 'text-spacing'], c: 2 },
    { q: 'In JavaScript, `===` compares:', o: ['Value only, with type conversion', 'Value and type, without conversion', 'Reference only', 'Strings only'], c: 1 },
    { q: 'Which HTML attribute opens a link in a new tab?', o: ['target="_new"', 'new-tab="true"', 'target="_blank"', 'rel="newtab"'], c: 2 },
    { q: 'What is the box model order from inside to outside?', o: ['margin, border, padding, content', 'content, padding, border, margin', 'padding, content, margin, border', 'content, margin, border, padding'], c: 1 },
    { q: 'Which method removes the LAST element of an array?', o: ['pop()', 'shift()', 'slice()', 'splice(0,1)'], c: 0 },
    { q: 'What does `git clone` do?', o: ['Creates a new empty repository', 'Copies a remote repository to your machine', 'Merges two branches', 'Deletes a repository'], c: 1 },
    { q: 'Which HTML tag defines a table row?', o: ['<td>', '<th>', '<tr>', '<row>'], c: 2 },
    { q: 'What is the default display value of a <div>?', o: ['inline', 'block', 'inline-block', 'flex'], c: 1 },
    { q: 'Which function schedules a one-time delayed call in JavaScript?', o: ['setInterval()', 'delay()', 'setTimeout()', 'wait()'], c: 2 },
    { q: 'Which meta tag makes a page responsive on mobile devices?', o: ['<meta name="mobile" content="yes">', '<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta responsive="true">', '<meta name="scale" content="auto">'], c: 1 },
    { q: 'What does API stand for?', o: ['Application Programming Interface', 'Automated Program Integration', 'Applied Protocol Internet', 'Application Process Identifier'], c: 0 },
    { q: 'Which CSS declaration hides an element AND removes it from layout?', o: ['visibility: hidden', 'opacity: 0', 'display: none', 'position: hidden'], c: 2 },
    { q: 'How do you write a single-line comment in JavaScript?', o: ['<!-- comment -->', '# comment', '// comment', '** comment **'], c: 2 },
    { q: 'Which string method joins array elements into a string?', o: ['concat()', 'join()', 'merge()', 'toText()'], c: 1 },
    { q: 'What does SQL stand for?', o: ['Structured Query Language', 'Simple Query Language', 'Standard Question Language', 'Sequential Query Logic'], c: 0 },
    { q: 'Which HTML element plays video files natively?', o: ['<media>', '<movie>', '<video>', '<play>'], c: 2 },
    { q: 'Which operator returns the remainder of a division in JavaScript?', o: ['/', '//', '%', 'mod'], c: 2 },
    { q: 'What is a responsive design breakpoint typically defined with?', o: ['@media queries', '@responsive rules', '<breakpoint> tags', 'window.resize() only'], c: 0 },
    { q: 'Which JavaScript method converts a value to a string?', o: ['toText()', 'String()', 'parseString()', 'asString()'], c: 1 },
    { q: 'What does the z-index property control?', o: ['Zoom level', 'Stacking order of positioned elements', 'Font weight', 'Grid columns'], c: 1 },
    { q: 'Which input type validates an email format in HTML5?', o: ['<input type="text">', '<input type="mail">', '<input type="email">', '<input type="address">'], c: 2 },
    { q: 'What does HTTPS add over HTTP?', o: ['Faster speed', 'Encryption via TLS', 'Better SEO by default', 'Larger request size'], c: 1 },
    { q: 'Which command creates a new branch in git?', o: ['git new branch', 'git branch <name>', 'git create <name>', 'git checkout --new'], c: 1 },
    { q: 'What is the result of "2" + 2 in JavaScript?', o: ['4', '"22"', 'NaN', 'TypeError'], c: 1 },
    { q: 'Which CSS property makes an element a flex container?', o: ['flex: true', 'display: flex', 'position: flex', 'flex-direction: row'], c: 1 },
    { q: 'Which JavaScript keyword defines a constant?', o: ['const', 'let', 'static', 'final'], c: 0 },
    { q: 'What does the <label> element improve when linked to an input?', o: ['Page load speed', 'Accessibility and click target', 'SEO ranking', 'Form styling only'], c: 1 }
  ],
  'PY-PROG': [
    { q: 'How do you print text in Python 3?', o: ['echo "Hi"', 'print("Hi")', 'console.log("Hi")', 'printf("Hi")'], c: 1 },
    { q: 'Which of these creates a list in Python?', o: ['(1, 2, 3)', '[1, 2, 3]', '{1, 2, 3}', '<1, 2, 3>'], c: 1 },
    { q: 'What is the output of len("hello")?', o: ['4', '5', '6', 'Error'], c: 1 },
    { q: 'Which keyword defines a function in Python?', o: ['function', 'func', 'def', 'define'], c: 2 },
    { q: 'What does the expression 7 // 2 evaluate to?', o: ['3.5', '3', '4', '2'], c: 1 },
    { q: 'Which data type is immutable in Python?', o: ['list', 'dict', 'set', 'tuple'], c: 3 },
    { q: 'How do you start a comment in Python?', o: ['//', '/*', '#', '--'], c: 2 },
    { q: 'What is the output of bool([])?', o: ['True', 'False', 'None', 'Error'], c: 1 },
    { q: 'Which method adds an item to the end of a list?', o: ['add()', 'push()', 'append()', 'insert()'], c: 2 },
    { q: 'What does the range(3) call produce?', o: ['1, 2, 3', '0, 1, 2', '0, 1, 2, 3', '3 items starting at 1'], c: 1 },
    { q: 'Which keyword is used for exception handling?', o: ['catch', 'except', 'rescue', 'handle'], c: 1 },
    { q: 'What is the type of 3.14 in Python?', o: ['int', 'decimal', 'float', 'double'], c: 2 },
    { q: 'How do you get the value for key "a" from dict d, returning None if missing?', o: ['d["a"]', 'd.get("a")', 'd->a', 'd.value("a")'], c: 1 },
    { q: 'Which statement is used to skip the rest of the current loop iteration?', o: ['break', 'pass', 'continue', 'skip'], c: 2 },
    { q: 'What does the strip() string method remove by default?', o: ['All spaces inside', 'Leading and trailing whitespace', 'Punctuation', 'Newlines only'], c: 1 },
    { q: 'Which operator checks membership in a collection?', o: ['has', 'contains', 'in', 'exists'], c: 2 },
    { q: 'What is the output of "abc" * 2?', o: ['"abc2"', '"abcabc"', 'Error', '"aabbcc"'], c: 1 },
    { q: 'How do you open a file for reading in Python?', o: ['open("f.txt")', 'file.open("f.txt")', 'read("f.txt")', 'open("f.txt", "w")'], c: 0 },
    { q: 'Which collection type stores unique items only?', o: ['list', 'tuple', 'set', 'dict'], c: 2 },
    { q: 'What does the // operator do?', o: ['Comment', 'Floor division', 'Float division', 'Exponent'], c: 1 },
    { q: 'What is a lambda in Python?', o: ['A loop construct', 'An anonymous function', 'A class decorator', 'A string method'], c: 1 },
    { q: 'Which function converts a string "42" to an integer?', o: ['str(42)', 'int("42")', 'toInt("42")', 'parse("42")'], c: 1 },
    { q: 'What does list [1,2,3,4][1:3] return?', o: ['[1, 2]', '[2, 3]', '[2, 3, 4]', '[1, 2, 3]'], c: 1 },
    { q: 'Which keyword creates a class in Python?', o: ['struct', 'object', 'class', 'type'], c: 2 },
    { q: 'What is self in a Python class method?', o: ['A reserved global', 'The instance the method is called on', 'The class definition', 'A static reference'], c: 1 },
    { q: 'What is the output of 2 ** 3?', o: ['6', '8', '9', '5'], c: 1 },
    { q: 'Which method removes and returns the last list item?', o: ['remove()', 'delete()', 'pop()', 'cut()'], c: 2 },
    { q: 'How do you write a multi-line string?', o: ['"..." over lines', "'''...'''", '`...`', '//...//'], c: 1 },
    { q: 'What does the pass statement do?', o: ['Skips the function', 'Nothing - it is a placeholder', 'Passes a value', 'Exits the program'], c: 1 },
    { q: 'Which module is used to work with dates?', o: ['time only', 'datetime', 'calendar only', 'date'], c: 1 },
    { q: 'What is the correct way to handle a file so it closes automatically?', o: ['try/finally only', 'with open(...) as f:', 'open() then forget()', 'file.autoclose()'], c: 1 },
    { q: 'What does enumerate([\'a\',\'b\']) yield?', o: ['just \'a\', \'b\'', '(0,\'a\'), (1,\'b\')', '[\'a0\', \'b1\']', 'Error'], c: 1 },
    { q: 'What is the result of 10 % 3?', o: ['3', '1', '0', '3.33'], c: 1 },
    { q: 'Which statement about Python dictionaries is true?', o: ['They allow duplicate keys', 'Keys must be unique', 'They preserve no order ever', 'Keys can be lists'], c: 1 },
    { q: 'What does the is keyword compare?', o: ['Values', 'Object identity', 'Types', 'Lengths'], c: 1 },
    { q: 'How do you get user input as a string in Python 3?', o: ['scanf()', 'input()', 'readline()', 'gets()'], c: 1 },
    { q: 'What does len({\'a\': 1, \'b\': 2}) return?', o: ['4', '2', '1', 'Error'], c: 1 },
    { q: 'Which of these is a valid variable name?', o: ['2count', 'my-var', 'my_var', 'class'], c: 2 },
    { q: 'What does the join() method belong to?', o: ['list', 'str', 'dict', 'set'], c: 1 },
    { q: 'What is the output of sorted([3, 1, 2])?', o: ['[3, 1, 2]', '[1, 2, 3]', '[3, 2, 1]', 'Error'], c: 1 },
    { q: 'Which block always executes in try/except/finally?', o: ['try', 'except', 'finally', 'else'], c: 2 },
    { q: 'What does the break statement do inside a loop?', o: ['Skips one iteration', 'Exits the loop entirely', 'Restarts the loop', 'Pauses the loop'], c: 1 },
    { q: 'How do you import the math module?', o: ['include math', 'import math', 'using math', 'require math'], c: 1 },
    { q: 'What is the result of "Py" in "Python"?', o: ['False', 'True', '0', 'Error'], c: 1 },
    { q: 'Which function returns the number of items in a list?', o: ['count()', 'size()', 'len()', 'length()'], c: 2 },
    { q: 'What does a function return if there is no return statement?', o: ['0', 'Empty string', 'None', 'False'], c: 2 },
    { q: 'Which comprehension creates a list of squares of 0..4?', o: ['[x^2 for x in range(5)]', '[x**2 for x in range(5)]', '{x**2 for x in range(5)}', '(x**2 for x in range(5))'], c: 1 },
    { q: 'What is the type of True in Python?', o: ['int', 'bool', 'str', 'bit'], c: 1 },
    { q: 'How do you remove a key "k" from dict d safely?', o: ['del d["k"]', 'd.pop("k", None)', 'remove d["k"]', 'd.delete("k")'], c: 1 },
    { q: 'What does the upper() string method do?', o: ['Capitalizes first letter', 'Converts all letters to uppercase', 'Moves text up', 'Counts uppercase letters'], c: 1 }
  ]
};

// Additional banks live in per-track modules to keep this file readable.
const extra = require('./skillBanks');
COURSES.push(...extra.COURSES);
Object.assign(BANKS, extra.BANKS);

module.exports = { COURSES, BANKS };
