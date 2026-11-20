/* Light/dark theme state. Dark is the site's default look; the choice persists in localStorage. */
export function currentTheme(){return document.documentElement.dataset.theme==='light'?'light':'dark'}
export function applyTheme(t){
  document.documentElement.dataset.theme=t
  try{localStorage.setItem('nx-theme',t)}catch(e){}
  const icon=t==='light'?'☀️':'🌝' /* user: "Bright pe ☀️ and dark pe moon 🌝" */
  const label=t==='light'?'Light theme on - tap for dark':'Dark theme on - tap for light'
  /* legacy emoji buttons only; the snow-globe toggle (.nxglobe) renders itself from the nx:theme event */
  document.querySelectorAll('.nxtheme:not(.nxglobe)').forEach(b=>{b.textContent=icon;b.setAttribute('aria-label',label);b.title=label})
  window.dispatchEvent(new Event('nx:theme'))
}
export function toggleTheme(){applyTheme(currentTheme()==='light'?'dark':'light')}
export function initTheme(){
  let t='dark'
  try{const s=localStorage.getItem('nx-theme');if(s==='light'||s==='dark')t=s}catch(e){}
  document.documentElement.dataset.theme=t
  window.dispatchEvent(new Event('nx:theme')) /* let toggles sync once the persisted theme is applied */
}
export function makeThemeButton(){
  const b=document.createElement('button')
  b.type='button';b.className='nxtheme'
  b.textContent=currentTheme()==='light'?'☀️':'🌝'
  const label=currentTheme()==='light'?'Light theme on - tap for dark':'Dark theme on - tap for light'
  b.setAttribute('aria-label',label);b.title=label
  b.onclick=()=>toggleTheme()
  return b
}
