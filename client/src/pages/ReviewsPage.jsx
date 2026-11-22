import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Heart, Send, ArrowLeft } from 'lucide-react';
import './reviews.css';

/*
 * Student Reviews page.
 * The 15 reviews below are clearly-labelled SAMPLE data so the layout can be
 * previewed before real interns finish their programmes. No backend stores
 * feedback yet: the form validates and shows an honest notice, nothing is sent.
 */

const SAMPLE_REVIEWS = [
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

const AVATAR_HUES = [199, 262, 152, 28, 336, 188, 230, 84, 12, 288, 160, 210, 340, 46, 175];

function Stars({ value, size = 14 }) {
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

function initials(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function RatingInput({ value, onChange }) {
  return (
    <div className="rv-rate" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          className={i <= value ? 'on' : ''}
          onClick={() => onChange(i)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={i <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95L12 2.6z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [form, setForm] = useState({ name: '', role: '', feedback: '' });
  const [rating, setRating] = useState(0);
  const [notice, setNotice] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const reviews = useMemo(() => SAMPLE_REVIEWS, []);

  const submit = (e) => {
    e.preventDefault();
    if (!rating) {
      setNotice('Please pick a star rating first.');
      return;
    }
    setNotice('Thanks! Review submission is not connected yet, so this was not sent or published. Real reviews will be collected here once the backend is ready.');
  };

  return (
    <div className="rv">
      <span className="glow" aria-hidden="true" />
      <section className="rv-head">
        <div className="wrap">
          <p className="kick">STUDENT REVIEWS</p>
          <h1>
            See what our interns have to say about their journey with <span className="ac">NOXIRA</span>.
          </h1>
          <p className="lede">Your experience matters to us.</p>
          <p className="rv-demo">
            <Info width={13} height={13} aria-hidden="true" />
            Preview build: these 15 reviews are sample data, not real students. Real reviews appear here once interns start completing programmes.
          </p>
        </div>
      </section>

      <section className="rv-gridsec">
        <div className="wrap">
          <div className="rv-grid">
            {reviews.map((r, i) => (
              <article className="rv-card" key={r.name}>
                <svg className="rv-quote" width="30" height="24" viewBox="0 0 30 24" fill="currentColor" aria-hidden="true">
                  <path d="M0 24V13.7C0 5.8 4.6 1.1 12.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H13V24H0zm17 0V13.7C17 5.8 21.6 1.1 29.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H30V24H17z" transform="scale(0.94)" />
                </svg>
                <p className="rv-text">&ldquo;{r.text}&rdquo;</p>
                <div className="rv-meta">
                  <span
                    className="rv-av"
                    style={{ background: `linear-gradient(135deg, hsl(${AVATAR_HUES[i % AVATAR_HUES.length]} 80% 55%), hsl(${(AVATAR_HUES[i % AVATAR_HUES.length] + 40) % 360} 75% 40%))` }}
                    aria-hidden="true"
                  >
                    {initials(r.name)}
                  </span>
                  <span className="rv-id">
                    <b>{r.name}</b>
                    <small>{r.role}</small>
                  </span>
                  <Stars value={r.rating} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rv-storysec">
        <div className="wrap">
          <div className="rv-story">
            <span className="rv-strip" aria-hidden="true" />
            <div className="rv-form">
              <h2><Info width={16} height={16} aria-hidden="true" /> Share Your Story</h2>
              <p>Your feedback helps us improve and guides future students. If you had a positive experience, we would love to hear it!</p>
              <form onSubmit={submit}>
                <div className="rv-row">
                  <div>
                    <label htmlFor="rv-name">Your Name</label>
                    <input id="rv-name" required placeholder="e.g. Rahul Sharma" value={form.name} onChange={set('name')} autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="rv-role">Your Role</label>
                    <input id="rv-role" required placeholder="e.g. Web Dev Intern" value={form.role} onChange={set('role')} />
                  </div>
                </div>
                <label htmlFor="rv-feedback">Your Feedback</label>
                <textarea id="rv-feedback" required rows={4} value={form.feedback} onChange={set('feedback')} />
                <label>Your Rating</label>
                <RatingInput value={rating} onChange={setRating} />
                <button type="submit" className="rv-send"><Send width={14} height={14} aria-hidden="true" /> Submit Feedback</button>
                {notice && <p role="status" className="rv-notice">{notice}</p>}
              </form>
            </div>
            <div className="rv-thanks">
              <Heart width={42} height={42} strokeWidth={1.6} aria-hidden="true" />
              <b>Thank you for your contribution!</b>
              <p>Join our community and help us build the future of tech education.</p>
              <Link to="/" className="rv-back"><ArrowLeft width={13} height={13} aria-hidden="true" /> Back to Home</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
