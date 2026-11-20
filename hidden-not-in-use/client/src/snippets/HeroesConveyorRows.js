// Extracted from client/src/components/Heroes.jsx
// Original conveyor word configurations with SKILL COURSE and CAREER TOOLS

export const originalWordPool = [
  'WEBSITES',
  'PROJECTS',
  'AI AUTOMATION',
  'JOURNEY',
  'APPS',
  'CERTIFICATES',
  'INTERNSHIPS',
  'SKILL COURSE',
  'TRAINING',
  'CAREER TOOLS',
];

export const originalAllRows = (isMobile) => isMobile
  ? [
      ['WEBSITES'],
      ['APPS'],
      ['AI AUTOMATION'],
      ['INTERNSHIPS'],
      ['PROJECTS', 'CERTIFICATES'],
      ['JOURNEY'],
      ['SKILL COURSE'],
      ['CAREER TOOLS', 'TRAINING'],
    ]
  : [
      ['WEBSITES', 'PROJECTS'],
      ['AI AUTOMATION', 'APPS'],
      ['INTERNSHIPS', 'JOURNEY'],
      ['CERTIFICATES', 'TRAINING'],
      ['SKILL COURSE'],
      ['CAREER TOOLS'],
    ];
