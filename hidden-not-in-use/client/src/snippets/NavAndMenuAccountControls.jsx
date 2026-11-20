// Extracted from client/src/components/SiteShell.jsx & client/src/components/MobileMenu.jsx
// Student login/account controls and Skill/Career drawer navigation items

// In SiteShell.jsx (Desktop navbar right side):
/*
{student ? (
  <span
    className={`l nxacct ${openDropdown === 'account' ? 'open' : ''}`}
    role="button"
    tabIndex={0}
    title="Student Account"
    onClick={(e) => toggleDropdown('account', e.currentTarget)}
  >
    <span className="nxav">{(student.name || 'S').trim().charAt(0).toUpperCase()}</span>
    <span className="nxan">{(student.name || 'Student').trim().split(' ')[0]}</span>
    <svg className="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  </span>
) : (
  <span className="l nxa nxl" role="button" tabIndex={0} onClick={() => navigate('/login')}>
    Login
  </span>
)}
*/

// In MobileMenu.jsx (Drawer menu items and footer):
/*
{ k: 'skill', t: 'Skill Course', sub: ['Dashboard', 'Browse Courses', 'My Certificates', 'Skill Certificate verification'] },
{ k: 'career', t: 'Career Tools', sub: ['Check ATS Score', 'Job Email Builder', 'Interview Preparation'] },

{student ? (
  <div className="mfoot in">
    <div className="prof">
      <span className="av">{(student.name || 'S').trim().charAt(0).toUpperCase()}</span>
      <span className="pn">{student.name}</span>
      <button type="button" className="lo" onClick={async () => { onClose(); await logout(); navigate('/'); }}>
        Logout
      </button>
    </div>
    <button type="button" className="dash" onClick={() => { onClose(); navigate('/account'); }}>
      My account
    </button>
  </div>
) : (
  <div className="mfoot">
    <button type="button" className="dash" onClick={() => { onClose(); navigate('/signup'); }}>
      Sign up
    </button>
    <button type="button" className="ghostb" onClick={() => { onClose(); navigate('/login'); }}>
      Login
    </button>
  </div>
)}
*/
