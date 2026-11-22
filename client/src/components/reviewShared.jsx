import React from 'react';

/*
 * Shared review-display pieces used by the Student Reviews page and the
 * homepage marquee. SAMPLE_REVIEWS are demo data ONLY: they render exclusively
 * behind the explicit ?demo=1 preview gate, are clearly labelled where shown,
 * and are never sent to or stored by the backend.
 */
export const SAMPLE_REVIEWS = [
  { name: 'Aarav Mehta', role: 'Full Stack Development Intern', rating: 5, text: 'The project tasks felt like real client work. Building and submitting an actual working project taught me more than any tutorial ever did.' },
  { name: 'Priya Nair', role: 'Data Science Intern', rating: 5, text: 'Working on real datasets for my assignments was a game changer. I now have a solid data science portfolio to show recruiters.' },
  { name: 'Rohan Khanna', role: 'Web Development Intern', rating: 4, text: 'Great experience with NOXIRA. The internship helped me sharpen my skills and put a verified certificate on my resume.' },
  { name: 'Sneha Kulkarni', role: 'UI/UX Design Intern', rating: 5, text: 'The design assignments were challenging and practical. Earning the verified certificate validated my skills in UI/UX.' },
  { name: 'Arjun Reddy', role: 'Python Programming Intern', rating: 4, text: 'The projects were exciting, creative, and helped me gain practical experience I could actually talk about in interviews.' },
  { name: 'Ishita Sharma', role: 'Machine Learning Intern', rating: 5, text: 'The way tasks were assigned helped me gain practical knowledge and improve my skills step by step. The review feedback was genuinely useful.' },
  { name: 'Kunal Verma', role: 'Cyber Security Intern', rating: 5, text: 'The network security tasks simulated real scenarios. Completing these assignments proved my skills far better than just watching tutorials.' },
  { name: 'Ananya Iyer', role: 'App Development Intern', rating: 4, text: 'The internship helped me work on ideas and improve my application development skills with every task round.' },
  { name: 'Vikram Joshi', role: 'Java Programming Intern', rating: 4, text: 'The hands-on experience helped me gain practice knowledge and improve my programming skills at my own pace.' },
  { name: 'Tanvi Desai', role: 'Frontend Development Intern', rating: 5, text: 'This internship gave me practical experience with modern tools and improved my technical understanding of how real products ship.' },
  { name: 'Aditya Rao', role: 'Full Stack Development Intern', rating: 5, text: 'The best part of my NOXIRA internship was applying my theoretical knowledge to real-world projects. The tasks improved my coding, problem-solving, and project management skills.' },
  { name: 'Meera Pillai', role: 'Python Programming Intern', rating: 4, text: 'The task-based projects helped me gain practical experience and improve my technical skills week by week.' },
  { name: 'Dev Patel', role: 'Web Development Intern', rating: 5, text: 'My internship experience was smooth from offer letter to certificate. The submission and review flow kept me accountable the whole way.' },
  { name: 'Nidhi Singh', role: 'Data Science Intern', rating: 4, text: 'The internship projects provided a good learning experience and helped me practice my skills on problems that felt real.' },
  { name: 'Sahil Chowdhury', role: 'Cyber Security Intern', rating: 5, text: 'I learned new skills and gained practical experience during this internship. The evaluation was strict but fair, and it made the certificate mean something.' },
];

export const AVATAR_HUES = [199, 262, 152, 28, 336, 188, 230, 84, 12, 288, 160, 210, 340, 46, 175];

export function initials(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export function Stars({ value, size = 14 }) {
  return (
    <span className="rv-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z" />
        </svg>
      ))}
    </span>
  );
}

/** One review card; `marquee` fixes its width for the homepage strip. */
export function ReviewCard({ review, hue, marquee = false }) {
  return (
    <article className={`rv-card${marquee ? ' rv-mcard' : ''}`}>
      <svg className="rv-quote" width="30" height="24" viewBox="0 0 30 24" fill="currentColor" aria-hidden="true">
        <path d="M0 24V13.7C0 5.8 4.6 1.1 12.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H13V24H0zm17 0V13.7C17 5.8 21.6 1.1 29.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H30V24H17z" transform="scale(0.94)" />
      </svg>
      <p className="rv-text">&ldquo;{review.text}&rdquo;</p>
      <div className="rv-meta">
        <span
          className="rv-av"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 40) % 360} 75% 40%))` }}
          aria-hidden="true"
        >
          {initials(review.name)}
        </span>
        <span className="rv-id">
          <b>{review.name}</b>
          <small>{review.role}</small>
        </span>
        <Stars value={review.rating} />
      </div>
    </article>
  );
}
