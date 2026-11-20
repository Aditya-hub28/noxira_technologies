/* Light/dark theme state. Dark is the site's default look; the choice persists in localStorage. */
export function currentTheme(){return document.documentElement.dataset.theme==='light'?'light':'dark'}
export function applyTheme(t){
  document.documentElement.dataset.theme=t
  try{localStorage.setItem('nx-theme',t)}catch(e){}
  const dark=t!=='light'
  const label=dark?'Dark theme on - tap for light':'Light theme on - tap for dark'
  document.querySelectorAll('.nxtheme').forEach(b=>{b.setAttribute('aria-checked',dark?'true':'false');b.setAttribute('aria-label',label);b.title=label})
  window.dispatchEvent(new Event('nx:theme'))
}
export function toggleTheme(){applyTheme(currentTheme()==='light'?'dark':'light')}
export function initTheme(){
  let t='dark'
  try{const s=localStorage.getItem('nx-theme');if(s==='light'||s==='dark')t=s}catch(e){}
  document.documentElement.dataset.theme=t
}
const SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
const MOON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 14.2A8.5 8.5 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4Z"/></svg>'
export function themeButtonInner(){
  return '<span class="nxthumb" aria-hidden="true"></span><span class="nxsun" aria-hidden="true">'+SUN+'</span><span class="nxmoon" aria-hidden="true">'+MOON+'</span>'
}
export function makeThemeButton(){
  const b=document.createElement('button')
  b.type='button';b.className='nxtheme';b.setAttribute('role','switch')
  b.setAttribute('aria-checked',currentTheme()!=='light'?'true':'false')
  const label=currentTheme()==='light'?'Light theme on - tap for dark':'Dark theme on - tap for light'
  b.setAttribute('aria-label',label);b.title=label
  b.innerHTML=themeButtonInner()
  b.onclick=()=>toggleTheme()
  return b
}
