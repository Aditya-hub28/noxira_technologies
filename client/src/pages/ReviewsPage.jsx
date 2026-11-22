import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Heart, Send, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import './reviews.css';

/*
 * Student Reviews page.
 * Approved reviews come from the backend (submissions stay hidden until an
 * admin approves them). The normal page shows honest loading / empty / error
 * states - never sample data. The 15 SAMPLE_REVIEWS render ONLY in the
 * explicit demo preview (?demo=1) when there is no approved data to show,
 * always behind the visible demo badge. Samples are never sent to the server.
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
  const [form, setForm] = useState({ name: '', role: '', feedback: '', website: '' });
  const [rating, setRating] = useState(0);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('info');
  const [submitting, setSubmitting] = useState(false);
  // 'loading' | 'live' | 'empty' | 'error'
  const [feedState, setFeedState] = useState('loading');
  const [apiReviews, setApiReviews] = useState(null);
  // Sample reviews render ONLY in the explicit demo preview (?demo=1), never
  // on the normal page: production shows honest loading/empty/error states.
  const [demoMode] = useState(() => new URLSearchParams(window.location.search).get('demo') === '1');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    let alive = true;
    api.getApprovedReviews()
      .then((res) => {
        if (!alive) return;
        if (res && Array.isArray(res.reviews) && res.reviews.length > 0) {
          setApiReviews(res.reviews);
          setFeedState('live');
        } else {
          setFeedState('empty');
        }
      })
      .catch(() => {
        if (alive) setFeedState('error');
      });
    return () => { alive = false; };
  }, []);

  const sampleMode = demoMode && (feedState === 'empty' || feedState === 'error');
  const reviews = useMemo(() => {
    const source = feedState === 'live' ? apiReviews : (sampleMode ? SAMPLE_REVIEWS : []);
    return (source || []).map((r, i) => ({
      key: r._id || r.name,
      name: r.name,
      role: r.role,
      text: r.text,
      rating: r.rating,
      hue: AVATAR_HUES[i % AVATAR_HUES.length]
    }));
  }, [apiReviews, feedState, sampleMode]);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setNoticeKind('info');
      setNotice('Please pick a star rating first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitReview({
        name: form.name,
        role: form.role,
        text: form.feedback,
        rating,
        website: form.website
      });
      setNoticeKind('ok');
      setNotice(res.message || 'Thank you! Your feedback was submitted and will appear after review.');
      setForm({ name: '', role: '', feedback: '', website: '' });
      setRating(0);
    } catch (err) {
      setNoticeKind('info');
      const serverMessage = err && err.data && err.data.message;
      if (err && err.status === 429) {
        setNotice(serverMessage || 'Too many submissions from your network. Please try again later.');
      } else if (serverMessage && err.status && err.status < 500) {
        setNotice(serverMessage);
      } else {
        setNotice('Feedback submission is not connected in this preview, so nothing was sent. Once the site is deployed with its backend, submitted reviews are saved and appear after admin approval.');
      }
    } finally {
      setSubmitting(false);
    }
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
          {sampleMode && (
            <p className="rv-demo">
              <Info width={13} height={13} aria-hidden="true" />
              Demo preview: these 15 reviews are sample data, not real students. Real reviews appear here once interns complete programmes and their feedback is approved.
            </p>
          )}
        </div>
      </section>

      <section className="rv-gridsec">
        <div className="wrap">
          {feedState === 'loading' && !sampleMode && (
            <p className="rv-state" role="status">Loading reviews...</p>
          )}
          {feedState === 'empty' && !sampleMode && (
            <p className="rv-state">No reviews yet. Feedback from interns appears here after it is reviewed and approved. Yours could be the first - share your story below.</p>
          )}
          {feedState === 'error' && !sampleMode && (
            <p className="rv-state">Reviews could not be loaded right now. Please try again later.</p>
          )}
          <div className="rv-grid">
            {reviews.map((r) => (
              <article className="rv-card" key={r.key}>
                <svg className="rv-quote" width="30" height="24" viewBox="0 0 30 24" fill="currentColor" aria-hidden="true">
                  <path d="M0 24V13.7C0 5.8 4.6 1.1 12.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H13V24H0zm17 0V13.7C17 5.8 21.6 1.1 29.3 0l1.5 4.1c-4.3 1.2-6.4 3.6-6.7 6.9H30V24H17z" transform="scale(0.94)" />
                </svg>
                <p className="rv-text">&ldquo;{r.text}&rdquo;</p>
                <div className="rv-meta">
                  <span
                    className="rv-av"
                    style={{ background: `linear-gradient(135deg, hsl(${r.hue} 80% 55%), hsl(${(r.hue + 40) % 360} 75% 40%))` }}
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
                <textarea id="rv-feedback" required rows={4} maxLength={600} value={form.feedback} onChange={set('feedback')} />
                {/* honeypot: hidden from people, bots fill it and get dropped server-side */}
                <input
                  type="text"
                  name="website"
                  className="rv-hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={form.website}
                  onChange={set('website')}
                />
                <label>Your Rating</label>
                <RatingInput value={rating} onChange={setRating} />
                <button type="submit" className="rv-send" disabled={submitting}><Send width={14} height={14} aria-hidden="true" /> {submitting ? 'Submitting...' : 'Submit Feedback'}</button>
                {notice && <p role="status" className={`rv-notice${noticeKind === 'ok' ? ' ok' : ''}`}>{notice}</p>}
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
