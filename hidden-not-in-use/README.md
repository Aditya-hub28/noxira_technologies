# NOXIRA - Deferred Feature Archive (`hidden-not-in-use`)

This directory preserves reusable source code and tests for features deferred for the current internship launch scope.
No reusable code or schema logic has been deleted or destroyed. Database collections and records are preserved intact.

## Deferred Features
1. **Student Authentication & Accounts**: Student signup, login, session validation (`/me`), password reset OTP flow, and student account profile.
2. **Skill Courses & Quizzes**: Course browsing, student quizzes, and course-specific certificates.
3. **Career & Developer Tools**: Resume ATS checker, Job Email Builder, Interview Preparation.
4. **Student Dashboard**: Deferred until course release.

---

## Archive Manifest

| Original Path | Archived Path | Reason | Dependencies |
| :--- | :--- | :--- | :--- |
| `client/src/pages/LoginPage.jsx` | `hidden-not-in-use/client/src/pages/LoginPage.jsx` | Student login page deferred for launch | `StudentAuthContext`, `api.studentLogin` |
| `client/src/pages/SignupPage.jsx` | `hidden-not-in-use/client/src/pages/SignupPage.jsx` | Student signup page deferred for launch | `StudentAuthContext`, `api.studentSignup` |
| `client/src/pages/ForgotPasswordPage.jsx` | `hidden-not-in-use/client/src/pages/ForgotPasswordPage.jsx` | Student password reset OTP page deferred | `api.studentForgotPassword`, `studentVerifyOtp`, `studentResetPassword` |
| `client/src/pages/AccountPage.jsx` | `hidden-not-in-use/client/src/pages/AccountPage.jsx` | Student profile & account page deferred | `StudentAuthContext` |
| `client/src/context/StudentAuthContext.jsx` | `hidden-not-in-use/client/src/context/StudentAuthContext.jsx` | Student auth React context & hook | `api.js` student auth endpoints |
| `server/src/controllers/studentAuthController.js` | `hidden-not-in-use/server/src/controllers/studentAuthController.js` | Student auth controller (signup, login, me, OTP reset) | `Student` model, `emailService.sendPasswordResetOtpEmail`, `AuditLog` |
| `server/src/routes/studentAuthRoutes.js` | `hidden-not-in-use/server/src/routes/studentAuthRoutes.js` | Student auth Express router (`/api/v1/student/auth`) | `studentAuthController`, `requireStudent`, rate limiters |
| `server/src/middleware/studentAuth.js` | `hidden-not-in-use/server/src/middleware/studentAuth.js` | Student token verification middleware | `Student` model, `jwt`, `env` |
| `server/src/models/Student.js` | `hidden-not-in-use/server/src/models/Student.js` | Student Mongoose schema & methods | `bcryptjs`, MongoDB |
| `client/tests/student_auth.cjs` | `hidden-not-in-use/client/tests/student_auth.cjs` | Acceptance tests for student auth routes & client methods | Archived pages & context |
| `server/tests/studentAuth.test.js` | `hidden-not-in-use/server/tests/studentAuth.test.js` | Backend integration test suite for student auth | Archived controllers & rate limiters |
| Extracted from `client/src/services/api.js` | `hidden-not-in-use/client/src/services/studentApiSnippet.js` | Student API client requests | Base `request()` helper |
| Extracted from `server/src/middleware/rateLimiter.js` | `hidden-not-in-use/server/src/middleware/studentRateLimitersSnippet.js` | Express rate limiters for student auth | `express-rate-limit` |
| Extracted from `server/src/services/emailService.js` | `hidden-not-in-use/server/src/services/studentEmailSnippet.js` | Password reset OTP email helper | `emailService.js` transport |
| Extracted from `client/src/pages/HomePage.jsx` | `hidden-not-in-use/client/src/snippets/CareerToolsSection.jsx` | Career Tools & Courses UI grid section | Tailwind CSS, toast `soon()` |
| Extracted from `client/src/components/Heroes.jsx` | `hidden-not-in-use/client/src/snippets/HeroesConveyorRows.js` | Hero conveyor row words for courses & tools | GSAP conveyor engine |
| Extracted from `SiteShell.jsx` & `MobileMenu.jsx` | `hidden-not-in-use/client/src/snippets/NavAndMenuAccountControls.jsx` | Navbar & drawer account/login/signup controls | `StudentAuthContext` |

---

## Steps to Re-enable Features in Future

When ready to launch Courses and Student Accounts, follow these steps:

### 1. Backend Restoration
1. Move backend files back to their original locations:
   - `hidden-not-in-use/server/src/models/Student.js` -> `server/src/models/Student.js`
   - `hidden-not-in-use/server/src/middleware/studentAuth.js` -> `server/src/middleware/studentAuth.js`
   - `hidden-not-in-use/server/src/controllers/studentAuthController.js` -> `server/src/controllers/studentAuthController.js`
   - `hidden-not-in-use/server/src/routes/studentAuthRoutes.js` -> `server/src/routes/studentAuthRoutes.js`
2. Restore student rate limiters from `hidden-not-in-use/server/src/middleware/studentRateLimitersSnippet.js` into `server/src/middleware/rateLimiter.js` and export them.
3. Restore `sendPasswordResetOtpEmail` from `hidden-not-in-use/server/src/services/studentEmailSnippet.js` into `server/src/services/emailService.js` and export it.
4. Mount the route in `server/src/index.js`:
   ```javascript
   const studentAuthRoutes = require('./routes/studentAuthRoutes');
   app.use('/api/v1/student/auth', studentAuthRoutes);
   ```

### 2. Client API & Context Restoration
1. Move client files back:
   - `hidden-not-in-use/client/src/context/StudentAuthContext.jsx` -> `client/src/context/StudentAuthContext.jsx`
   - `hidden-not-in-use/client/src/pages/LoginPage.jsx` -> `client/src/pages/LoginPage.jsx`
   - `hidden-not-in-use/client/src/pages/SignupPage.jsx` -> `client/src/pages/SignupPage.jsx`
   - `hidden-not-in-use/client/src/pages/ForgotPasswordPage.jsx` -> `client/src/pages/ForgotPasswordPage.jsx`
   - `hidden-not-in-use/client/src/pages/AccountPage.jsx` -> `client/src/pages/AccountPage.jsx`
2. Restore student API methods from `hidden-not-in-use/client/src/services/studentApiSnippet.js` into `client/src/services/api.js`.
3. Wrap public layout in `client/src/App.jsx` with `<StudentAuthProvider>` and re-mount routes:
   ```jsx
   <Route path="/login" element={<LoginPage />} />
   <Route path="/signup" element={<SignupPage />} />
   <Route path="/forgot-password" element={<ForgotPasswordPage />} />
   <Route path="/account" element={<AccountPage />} />
   ```
4. Restore account controls in `client/src/components/SiteShell.jsx` and `client/src/components/MobileMenu.jsx` from `hidden-not-in-use/client/src/snippets/NavAndMenuAccountControls.jsx`.
5. Restore Career Tools section from `hidden-not-in-use/client/src/snippets/CareerToolsSection.jsx` into `client/src/pages/HomePage.jsx`.
6. Restore 'Tools' in `client/src/nx.config.js` and conveyor rows in `client/src/components/Heroes.jsx`.

### 3. Test Restoration
1. Move `hidden-not-in-use/client/tests/student_auth.cjs` back to `client/tests/student_auth.cjs` and re-add to `client/package.json` test script.
2. Move `hidden-not-in-use/server/tests/studentAuth.test.js` back to `server/tests/studentAuth.test.js` and re-enable in `server/tests/runAllTests.js`.
