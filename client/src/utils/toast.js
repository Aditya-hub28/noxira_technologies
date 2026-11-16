export function soon(what) {
  let t = document.getElementById('nxtoast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'nxtoast';
    t.className = 'nxtoast';
    document.body.appendChild(t);
  }
  t.textContent = what + ' is coming soon - not connected yet';
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2600);
}
