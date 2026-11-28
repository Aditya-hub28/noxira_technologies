import { Link } from 'react-router-dom';
import { ArrowRight, Braces, Globe2, Smartphone, BrainCircuit, Palette, Cloud, Info } from 'lucide-react';
import { resolveProgramDescription } from '../utils/programUtils';
import './program-showcase.css';
export const HOME_PROGRAMME_CODES = ['FE-DEV', 'APP-DEV', 'ML', 'PY-PROG', 'UIUX', 'CLOUD'];
const ICONS = { 'FE-DEV': Globe2, 'APP-DEV': Smartphone, ML: BrainCircuit, 'PY-PROG': Braces, UIUX: Palette, CLOUD: Cloud };
export default function ProgramShowcase({ programs, loading, configured = false }) {
  const displayed = configured ? HOME_PROGRAMME_CODES.map(code=>programs.find(p=>p.code===code)).filter(Boolean) : programs.slice(0,6);
  return <section id="programs" className="program-showcase" aria-labelledby="program-showcase-title"><div className="wrap">
    <div className="program-heading"><p className="kick">FIND YOUR NEXT CHALLENGE</p><h2 id="program-showcase-title">Choose a direction.<br/><span>Start building.</span></h2><p>Explore NOXIRA's internship programmes. Find a track, browse the full catalogue, and take your next step.</p></div>
    {configured && <p className="program-demo"><Info size={16} aria-hidden="true"/>Explore NOXIRA's 31 configured programmes. Current intake status and detailed curriculum are not available right now.</p>}
    {loading && <div className="program-card-grid" aria-label="Loading programmes" aria-busy="true">{[0,1,2].map(n=><div className="program-card program-skeleton" key={n}><div/><div/><div/></div>)}</div>}
    {!loading && programs.length===0 && <div className="program-status"><h3>No programmes published yet</h3><p>New tracks will appear here once NOXIRA publishes them.</p></div>}
    <div className="program-card-grid">{displayed.map((p,index)=>{const Icon=ICONS[p.code]||Braces;return <article key={p.code} className="program-card" style={{'--program-hue':[194,210,266,167,322,37][index%6]}}>
      <div className="program-card-top"><div className="program-icon"><Icon size={24} strokeWidth={1.6} aria-hidden="true"/></div><span className="program-category">{p.category||'Programme'}</span></div>
      <h3><Link to="/apply">{p.title}</Link></h3><p>{configured ? 'Browse our full catalogue to explore this track and check programme information.' : resolveProgramDescription(p)}</p>
      <div className="program-card-actions"><Link to="/apply" aria-label={`Browse all programmes, including ${p.title}`}>Explore programmes <ArrowRight size={15} aria-hidden="true"/></Link></div>
    </article>})}</div>
    <div className="program-directory"><p>Pick your programme on the Apply Now page.</p><Link to="/apply" className="gb">Apply Now <ArrowRight size={16} aria-hidden="true"/></Link></div>
  </div></section>;
}
