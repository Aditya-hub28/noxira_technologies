/*
 * Pre-launch sample reviews, seeded as APPROVED so the homepage marquee and
 * Student Reviews page are populated until real intern feedback exists.
 * Approved by the owner on 22 Nov 2026 ("real students review ki tarah
 * rakhna ... woh sab hum hosting ke time pe hata denge"): these stay until
 * hosting time, then get removed. Keep in sync with the client's
 * SAMPLE_REVIEWS in client/src/components/reviewShared.jsx.
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

/**
 * Insert any missing sample reviews as APPROVED. Idempotent per review:
 * a sample is skipped when a review with the same name already exists.
 */
async function seedSampleReviews(Review) {
  let inserted = 0;
  for (const sample of SAMPLE_REVIEWS) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Review.findOne({ name: sample.name }).lean();
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await Review.create({ ...sample, status: 'APPROVED' });
      inserted += 1;
    }
  }
  return inserted;
}

module.exports = { SAMPLE_REVIEWS, seedSampleReviews };
