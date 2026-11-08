const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORAS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 a 20 hs
const RECURSOS = { enchufes: 'Enchufes', proyector: 'Proyector', aire: 'Aire acond.' };
const PAB = { A: 'Pabellón A', B: 'Pabellón B', C: 'Pabellón C' };

// rec: 1 = funciona, 0 = con falla, ausente = el aula no lo tiene. rep = minutos desde el último reporte
const aulas = [
  { id: 'a1', nombre: 'Aula 1',  pab: 'A', tipo: 'aula', cap: 60, ruido: 'silencioso', rec: { enchufes: 1, proyector: 1, aire: 1 }, rep: 25 },
  { id: 'a2', nombre: 'Aula 2',  pab: 'A', tipo: 'aula', cap: 45, ruido: 'moderado',   rec: { enchufes: 0, proyector: 1, aire: 0 }, rep: 70 },
  { id: 'a5', nombre: 'Aula 5',  pab: 'A', tipo: 'aula', cap: 80, ruido: 'ruidoso',    rec: { enchufes: 1, proyector: 0, aire: 1 }, rep: 15 },
  { id: 'b3', nombre: 'Aula 12', pab: 'B', tipo: 'aula', cap: 50, ruido: 'silencioso', rec: { enchufes: 1, proyector: 1 },           rep: 190 },
  { id: 'b4', nombre: 'Aula 14', pab: 'B', tipo: 'aula', cap: 35, ruido: 'moderado',   rec: { enchufes: 1, aire: 1 },                rep: 40 },
  { id: 'la', nombre: 'Laboratorio A', pab: 'C', tipo: 'lab', cap: 30, ruido: 'moderado',   rec: { enchufes: 1, proyector: 1, aire: 1 }, rep: 30 },
  { id: 'lb', nombre: 'Laboratorio B', pab: 'C', tipo: 'lab', cap: 25, ruido: 'silencioso', rec: { enchufes: 1, proyector: 0, aire: 1 }, rep: 55 },
  { id: 'lc', nombre: 'Laboratorio C', pab: 'C', tipo: 'lab', cap: 20, ruido: 'moderado',   rec: { enchufes: 1, aire: 0 },                rep: 95 },
];

// [aula, día (0 = lunes), desde, hasta, materia] -> grilla oficial de Bedelía
const clases = [
  ['a1', 0, 8, 10, 'Análisis Matemático I'], ['a1', 0, 14, 16, 'Álgebra'], ['a1', 2, 10, 12, 'Física II'],
  ['a2', 0, 10, 12, 'Programación I'], ['a2', 1, 8, 11, 'Sistemas de Información'],
  ['a5', 0, 8, 12, 'Química General'], ['a5', 3, 16, 19, 'Estadística'],
  ['b3', 1, 14, 16, 'Base de Datos'], ['b4', 0, 9, 11, 'Inglés Técnico'], ['b4', 4, 8, 10, 'Economía'],
  ['la', 0, 8, 10, 'Programación Avanzada'], ['lb', 1, 10, 12, 'Redes'], ['lc', 2, 14, 17, 'Sistemas Operativos'],
];

const reservasIniciales = [
  { room: 'lb', d: 0, h: 14, who: 'Prof. Gómez', mat: 'Taller de Redes' },
  { room: 'lb', d: 0, h: 15, who: 'Prof. Gómez', mat: 'Taller de Redes' },
  { room: 'la', d: 2, h: 9,  who: 'Prof. Ruiz',  mat: 'Práctica BD' },
  { room: 'la', d: 2, h: 10, who: 'Prof. Ruiz',  mat: 'Práctica BD' },
  { room: 'lc', d: 0, h: 16, who: 'Lucía Pérez', mat: 'Trabajo final' },
];
const incidenciasIniciales = [
  { room: 'a2', rec: 'enchufes',  votos: 3, estado: 'En revisión' },
  { room: 'a5', rec: 'proyector', votos: 5, estado: 'En revisión' },
  { room: 'a2', rec: 'aire',      votos: 1, estado: 'Pendiente' },
];

// día y hora iniciales: ahora mismo, o lunes a las 10 si es fin de semana / fuera de horario
const ahora = new Date();
const S = {
  vista: 'aulas',
  dia: ahora.getDay() >= 1 && ahora.getDay() <= 5 ? ahora.getDay() - 1 : 0,
  hora: Math.min(Math.max(ahora.getHours(), 8), 20),
  tipo: 'aula', pab: '', ruido: '', f: { enchufes: false, proyector: false, aire: false },
  lab: 'la', modo: 'semana',
  res: reservasIniciales, inc: incidenciasIniciales,
};
if (ahora.getDay() === 0 || ahora.getDay() === 6) S.hora = 10;

try {
  const guardado = JSON.parse(localStorage.getItem('aulas-libres-demo'));
  if (guardado) { S.res = guardado.res; S.inc = guardado.inc; }
} catch (e) { /* sin storage, seguimos con los datos de ejemplo */ }
const guardar = () => { try { localStorage.setItem('aulas-libres-demo', JSON.stringify({ res: S.res, inc: S.inc })); } catch (e) {} };

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hh = (h) => String(h).padStart(2, '0') + ':00';
const aulaPorId = (id) => aulas.find((a) => a.id === id);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- disponibilidad ----------
function ocupacion(id, d, h) {
  const c = clases.find((x) => x[0] === id && x[1] === d && h >= x[2] && h < x[3]);
  if (c) return { tipo: 'clase', txt: c[4] };
  const r = S.res.find((x) => x.room === id && x.d === d && x.h === h);
  if (r) return { tipo: 'reserva', txt: r.who, mat: r.mat };
  return null;
}
function libreHasta(id, d, h) {
  let x = h;
  while (x < 21 && !ocupacion(id, d, x)) x++;
  return x;
}

// ---------- vista: aulas libres ----------
function tarjeta(a, occ, faltan) {
  const chips = Object.keys(RECURSOS).filter((k) => a.rec[k] !== undefined)
    .map((k) => `<span class="chip ${a.rec[k] ? 'ok' : 'bad'}">${a.rec[k] ? '✓' : '✕'} ${RECURSOS[k]}</span>`).join('');
  const hasta = libreHasta(a.id, S.dia, S.hora);
  const estado = occ
    ? `<span class="tag bad">${occ.tipo === 'clase' ? 'En clase' : 'Reservada'}</span>`
    : `<span class="tag ok">Libre hasta ${hh(hasta)}</span>`;
  const detalle = occ
    ? `<div class="sub">${esc(occ.txt)}${occ.mat ? ' · ' + esc(occ.mat) : ''}</div>`
    : '';
  const viejo = a.rep > 120 ? `<div class="note">Último reporte hace ${Math.round(a.rep / 60)} h. La información puede haber cambiado.</div>` : '';
  const alt = faltan && faltan.length ? `<div class="note">Sin coincidencia exacta: ${faltan.join(', ')}</div>` : '';
  return `<div class="card ${occ ? 'busy' : ''}">
    <div class="top"><div><h3>${esc(a.nombre)}</h3><div class="sub">${PAB[a.pab]} · ${a.cap} personas · ${a.ruido}</div></div>${estado}</div>
    ${detalle}<div class="chips">${chips}</div>${alt}${viejo}</div>`;
}

function vistaAulas() {
  const pool = aulas.filter((a) => (!S.tipo || a.tipo === S.tipo) && (!S.pab || a.pab === S.pab));
  const libres = pool.filter((a) => !ocupacion(a.id, S.dia, S.hora));
  const ocupadas = pool.filter((a) => ocupacion(a.id, S.dia, S.hora));

  // cuáles de los criterios elegidos NO cumple cada aula
  const faltantes = (a) => {
    const f = Object.keys(S.f).filter((k) => S.f[k] && a.rec[k] !== 1).map((k) => RECURSOS[k].toLowerCase());
    if (S.ruido && a.ruido !== S.ruido) f.push('nivel de ruido ' + a.ruido);
    return f;
  };
  const exactas = libres.filter((a) => faltantes(a).length === 0);
  let aviso = '', mostrar = exactas.map((a) => tarjeta(a, null));
  if (!exactas.length && libres.length) {
    aviso = '<div class="msg">No hay aulas que cumplan todos los requisitos en este momento. Estas son las alternativas más cercanas:</div>';
    mostrar = libres.slice().sort((x, y) => faltantes(x).length - faltantes(y).length).map((a) => tarjeta(a, null, faltantes(a)));
  } else if (!libres.length) {
    aviso = '<div class="msg">Todas las aulas están ocupadas en este horario.</div>';
  }

  const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${t}</option>`).join('');
  return `
  <div class="bar">
    <label>Día<select data-k="dia" data-n="1">${opts(DIAS.map((d, i) => [i, d]), S.dia)}</select></label>
    <label>Hora<select data-k="hora" data-n="1">${opts(HORAS.map((h) => [h, hh(h)]), S.hora)}</select></label>
    <label>Tipo<select data-k="tipo">${opts([['', 'Todos'], ['aula', 'Aulas'], ['lab', 'Laboratorios']], S.tipo)}</select></label>
    <label>Pabellón<select data-k="pab">${opts([['', 'Todos'], ...Object.entries(PAB)], S.pab)}</select></label>
    <label>Ruido<select data-k="ruido">${opts([['', 'Cualquiera'], ['silencioso', 'Silencioso']], S.ruido)}</select></label>
    ${Object.keys(RECURSOS).map((k) => `<button class="btn ${S.f[k] ? 'on' : ''}" data-act="filtro" data-r="${k}">${RECURSOS[k]}</button>`).join('')}
    <button class="btn" data-act="ahora">Ahora</button>
  </div>
  <p class="sum"><b>${libres.length}</b> de ${pool.length} espacios libres el ${DIAS[S.dia].toLowerCase()} a las ${hh(S.hora)}</p>
  ${aviso}<div class="grid">${mostrar.join('')}</div>
  ${ocupadas.length ? `<h2>Ocupados en este horario</h2><div class="grid">${ocupadas.map((a) => tarjeta(a, ocupacion(a.id, S.dia, S.hora))).join('')}</div>` : ''}`;
}

// ---------- vista: laboratorios ----------
function celda(id, d, h) {
  const o = ocupacion(id, d, h);
  if (!o) return `<button class="slot free" data-act="reservar" data-d="${d}" data-h="${h}">Libre</button>`;
  if (o.tipo === 'clase') return `<div class="slot clase" title="Clase oficial">${esc(o.txt)}</div>`;
  return `<button class="slot res" data-act="ver" data-d="${d}" data-h="${h}" title="${esc(o.mat)}">${esc(o.txt)}</button>`;
}

function vistaLabs() {
  const labs = aulas.filter((a) => a.tipo === 'lab');
  let cuerpo;
  if (S.modo === 'semana') {
    cuerpo = `<div class="scroll"><table><thead><tr><th></th>${DIAS.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>
      ${HORAS.map((h) => `<tr><td>${hh(h)}</td>${DIAS.map((_, d) => `<td>${celda(S.lab, d, h)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  } else {
    cuerpo = `<div class="scroll list">${HORAS.map((h) => `<div class="row"><span class="sub">${hh(h)}</span>${celda(S.lab, S.dia, h)}</div>`).join('')}</div>`;
  }
  return `
  <div class="bar">
    ${labs.map((l) => `<button class="btn ${S.lab === l.id ? 'on' : ''}" data-act="lab" data-id="${l.id}">${l.nombre}</button>`).join('')}
    <span style="flex:1"></span>
    <button class="btn ${S.modo === 'semana' ? 'on' : ''}" data-act="modo" data-m="semana">Semana</button>
    <button class="btn ${S.modo === 'dia' ? 'on' : ''}" data-act="modo" data-m="dia">Día</button>
    ${S.modo === 'dia' ? `<select data-k="dia" data-n="1">${DIAS.map((d, i) => `<option value="${i}" ${i === S.dia ? 'selected' : ''}>${d}</option>`).join('')}</select>` : ''}
  </div>
  <p class="sum">Tocá un horario libre para reservarlo, o una reserva para ver quién la hizo. Los bloques grises son clases oficiales cargadas por Bedelía.</p>
  ${cuerpo}`;
}

// ---------- vista: fallas ----------
function vistaFallas() {
  const filas = S.inc.map((x, i) => {
    const a = aulaPorId(x.room);
    return `<div class="inc"><div><b>${RECURSOS[x.rec]} · ${esc(a.nombre)}</b><div class="sub">${PAB[a.pab]} · ${x.votos} confirmaciones · ${x.estado}</div></div>
      <button class="btn" data-act="mas1" data-i="${i}">+1 a mí también</button></div>`;
  }).join('');
  return `
  <div class="bar">
    <label>Aula<select id="f-room">${aulas.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join('')}</select></label>
    <label>Recurso<select id="f-rec">${Object.entries(RECURSOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <button class="btn p" data-act="reportar">Reportar falla</button>
  </div>
  <div class="card" style="padding:0">${filas || '<div class="inc sub">No hay fallas abiertas.</div>'}</div>`;
}

// ---------- reservas ----------
function dialogoReservar(d, h) {
  const a = aulaPorId(S.lab);
  $('#dlg').innerHTML = `<h3 style="margin:0">Reservar ${a.nombre}</h3>
    <div class="sub">${DIAS[d]} desde las ${hh(h)}</div>
    <div class="f">
      <label>Tu nombre<input id="r-who" maxlength="40" placeholder="Ej: Prof. Díaz"></label>
      <label>Materia o motivo<input id="r-mat" maxlength="50" placeholder="Ej: Práctica de redes"></label>
      <label>Duración<select id="r-dur"><option value="1">1 hora</option><option value="2">2 horas</option><option value="3">3 horas</option></select></label>
    </div>
    <div class="acts"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn p" data-act="confirmar" data-d="${d}" data-h="${h}">Reservar</button></div>`;
  $('#dlg').showModal();
}

function dialogoVer(d, h) {
  const r = S.res.find((x) => x.room === S.lab && x.d === d && x.h === h);
  $('#dlg').innerHTML = `<h3 style="margin:0">${esc(r.mat)}</h3>
    <div class="sub">${aulaPorId(S.lab).nombre} · ${DIAS[d]} ${hh(h)}</div>
    <p>Reservado por <b>${esc(r.who)}</b></p>
    <div class="acts"><button class="btn" data-act="cerrar">Cerrar</button>
    <button class="btn" data-act="cancelar" data-d="${d}" data-h="${h}">Cancelar reserva</button></div>`;
  $('#dlg').showModal();
}

function confirmarReserva(d, h) {
  const who = $('#r-who').value.trim(), mat = $('#r-mat').value.trim(), dur = +$('#r-dur').value;
  if (!who || !mat) return toast('Completá tu nombre y el motivo de la reserva.');
  for (let x = h; x < h + dur; x++) {
    const o = x > 20 ? { txt: 'cierre de la facultad' } : ocupacion(S.lab, d, x);
    if (o) return toast(`Conflicto de horario a las ${hh(x)}: ${o.txt}. Probá con menos horas.`);
  }
  for (let x = h; x < h + dur; x++) S.res.push({ room: S.lab, d, h: x, who, mat });
  guardar(); $('#dlg').close(); render();
  toast('Reserva confirmada ✓');
}

// ---------- eventos ----------
const acciones = {
  vista: (b) => { S.vista = b.dataset.v; },
  filtro: (b) => { S.f[b.dataset.r] = !S.f[b.dataset.r]; },
  ahora: () => { S.dia = Math.min(Math.max(ahora.getDay() - 1, 0), 4); S.hora = Math.min(Math.max(new Date().getHours(), 8), 20); },
  lab: (b) => { S.lab = b.dataset.id; },
  modo: (b) => { S.modo = b.dataset.m; },
  reservar: (b) => dialogoReservar(+b.dataset.d, +b.dataset.h),
  ver: (b) => dialogoVer(+b.dataset.d, +b.dataset.h),
  cerrar: () => $('#dlg').close(),
  confirmar: (b) => confirmarReserva(+b.dataset.d, +b.dataset.h),
  cancelar: (b) => {
    S.res = S.res.filter((x) => !(x.room === S.lab && x.d === +b.dataset.d && x.h === +b.dataset.h));
    guardar(); $('#dlg').close(); toast('Reserva cancelada');
  },
  mas1: (b) => { S.inc[+b.dataset.i].votos++; guardar(); toast('Sumamos tu confirmación al reporte.'); },
  reportar: () => {
    const room = $('#f-room').value, rec = $('#f-rec').value, a = aulaPorId(room);
    if (a.rec[rec] === undefined) return toast(`${a.nombre} no tiene ${RECURSOS[rec].toLowerCase()}.`);
    const previo = S.inc.find((x) => x.room === room && x.rec === rec);
    if (previo) { previo.votos++; toast(`Este problema ya fue notificado. Estado actual: ${previo.estado}. Sumamos tu +1.`); }
    else { S.inc.push({ room, rec, votos: 1, estado: 'Pendiente' }); toast('Falla enviada a Bedelía y Mantenimiento.'); }
    guardar();
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  acciones[b.dataset.act](b);
  if (b.dataset.act !== 'reservar' && b.dataset.act !== 'ver' && b.dataset.act !== 'confirmar' && b.dataset.act !== 'cerrar') render();
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k) return;
  S[k] = e.target.dataset.n ? +e.target.value : e.target.value;
  render();
});

function render() {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.vista));
  $('#app').innerHTML = S.vista === 'aulas' ? vistaAulas() : S.vista === 'labs' ? vistaLabs() : vistaFallas();
}
render();
