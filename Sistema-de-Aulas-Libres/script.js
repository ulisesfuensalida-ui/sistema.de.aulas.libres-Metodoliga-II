const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORAS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 a 20 hs
const RECURSOS = { enchufes: 'Enchufes', proyector: 'Proyector', aire: 'Aire acond.' };
const PAB = { A: 'Pabellón A', B: 'Pabellón B', C: 'Pabellón C' };

// ---------- roles y permisos ----------
// vistas:   pestañas que ve el rol
// reservar: puede reservar aulas y laboratorios (y cancelar sus propias reservas)
// reportar: puede reportar fallas y sumar su confirmación a una ya reportada
// admin:    ve todas las reservas y puede gestionarlas; ve quién reportó cada falla (solo lectura)
const ROLES = {
  alumno:   { nombre: 'Alumno',   desc: 'Consulta qué aulas y laboratorios están libres u ocupados y reporta fallas.', vistas: ['aulas', 'grilla', 'fallas'], reportar: true },
  profesor: { nombre: 'Profesor', desc: 'Lo mismo que el alumno, y además reserva aulas y laboratorios.', vistas: ['aulas', 'grilla', 'fallas'], reservar: true, reportar: true },
  bedel:    { nombre: 'Bedel',    desc: 'Acceso total: ve todas las reservas y las fallas reportadas (las fallas solo en lectura).', vistas: ['aulas', 'grilla', 'reservas', 'fallas'], reservar: true, admin: true },
};
const CLAVE_SESION = 'aulas-libres-sesion';
const CLAVE_DATOS = 'aulas-libres-demo';

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

// día y hora actuales; si es fin de semana (o fuera de horario) usamos lunes a las 10
function momentoActual() {
  const n = new Date(), g = n.getDay();
  if (g === 0 || g === 6) return { dia: 0, hora: 10 };
  return { dia: g - 1, hora: Math.min(Math.max(n.getHours(), 8), 20) };
}

function cargarSesion() {
  try {
    const u = JSON.parse(localStorage.getItem(CLAVE_SESION));
    if (u && ROLES[u.rol] && u.nombre) return { nombre: String(u.nombre), rol: u.rol };
  } catch (e) { /* sin storage: se pide el ingreso cada vez */ }
  return null;
}
function guardarSesion(u) {
  try { u ? localStorage.setItem(CLAVE_SESION, JSON.stringify(u)) : localStorage.removeItem(CLAVE_SESION); } catch (e) {}
}

const ini = momentoActual();
const S = {
  user: cargarSesion(), ultimo: null,
  vista: 'aulas',
  dia: ini.dia, hora: ini.hora,
  tipo: 'aula', pab: '', ruido: '', f: { enchufes: false, proyector: false, aire: false },
  esp: 'la', modo: 'semana',
  res: reservasIniciales, inc: incidenciasIniciales,
};

try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE_DATOS));
  if (guardado) { S.res = guardado.res; S.inc = guardado.inc; }
} catch (e) { /* sin storage, seguimos con los datos de ejemplo */ }
const guardar = () => { try { localStorage.setItem(CLAVE_DATOS, JSON.stringify({ res: S.res, inc: S.inc })); } catch (e) {} };

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hh = (h) => String(h).padStart(2, '0') + ':00';
const aulaPorId = (id) => aulas.find((a) => a.id === id);
const opts = (arr, sel) => arr.map(([v, t]) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${t}</option>`).join('');

// ---------- permisos ----------
const can = (permiso) => !!(S.user && ROLES[S.user.rol][permiso]);
const puedeCancelar = (r) => can('admin') || (can('reservar') && r.who === S.user.nombre);
const tituloVista = (v) => ({
  aulas: 'Aulas libres',
  grilla: can('reservar') ? 'Reservar' : 'Horarios',
  reservas: 'Todas las reservas',
  fallas: can('reportar') ? 'Reportar fallas' : 'Fallas reportadas',
}[v]);

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

// ---------- ingreso ----------
function vistaLogin() {
  const rolInicial = S.ultimo ? S.ultimo.rol : 'alumno';
  const nombreInicial = S.ultimo ? S.ultimo.nombre : '';
  const roles = Object.entries(ROLES).map(([k, r]) => `
    <label class="rol"><input type="radio" name="rol" value="${k}" ${k === rolInicial ? 'checked' : ''}>
      <span class="rol-body"><b>${r.nombre}</b><span class="sub">${r.desc}</span></span></label>`).join('');
  return `
  <form class="card login" id="login" autocomplete="off">
    <div><h3>Ingresá al sistema</h3><p class="sub">Elegí tu rol para ver las opciones que tenés disponibles.</p></div>
    <div class="roles">${roles}</div>
    <label>Tu nombre<input id="l-nombre" maxlength="40" value="${esc(nombreInicial)}" placeholder="Ej: Prof. Díaz"></label>
    <button class="btn p" type="submit">Ingresar</button>
    <p class="sub">Versión demo: no pide contraseña. Los alumnos pueden ingresar sin nombre.</p>
  </form>`;
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
  const reservar = !occ && can('reservar')
    ? `<div class="card-actions"><button class="btn sm p" data-act="reservar" data-id="${a.id}" data-d="${S.dia}" data-h="${S.hora}">Reservar desde las ${hh(S.hora)}</button></div>`
    : '';
  return `<div class="card ${occ ? 'busy' : ''}">
    <div class="top"><div><h3>${esc(a.nombre)}</h3><div class="sub">${PAB[a.pab]} · ${a.cap} personas · ${a.ruido}</div></div>${estado}</div>
    ${detalle}<div class="chips">${chips}</div>${alt}${viejo}${reservar}</div>`;
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

// ---------- vista: horarios y reservas (aulas y laboratorios) ----------
// Quien puede reservar toca las casillas; el resto solo las ve.
function celda(id, d, h) {
  const o = ocupacion(id, d, h);
  const reserva = can('reservar');
  if (!o) {
    return reserva
      ? `<button class="slot free" data-act="reservar" data-d="${d}" data-h="${h}">Libre</button>`
      : `<div class="slot free">Libre</div>`;
  }
  if (o.tipo === 'clase') return `<div class="slot clase" title="Clase oficial">${esc(o.txt)}</div>`;
  return reserva
    ? `<button class="slot res" data-act="ver" data-d="${d}" data-h="${h}" title="${esc(o.mat)}">${esc(o.txt)}</button>`
    : `<div class="slot res" title="${esc(o.mat)}">${esc(o.txt)}</div>`;
}

function vistaGrilla() {
  const a = aulaPorId(S.esp);
  const grupo = (tipo, titulo) => `<optgroup label="${titulo}">${aulas.filter((x) => x.tipo === tipo)
    .map((x) => `<option value="${x.id}" ${x.id === S.esp ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</optgroup>`;
  let cuerpo;
  if (S.modo === 'semana') {
    cuerpo = `<div class="scroll"><table><thead><tr><th></th>${DIAS.map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>
      ${HORAS.map((h) => `<tr><td>${hh(h)}</td>${DIAS.map((_, d) => `<td>${celda(S.esp, d, h)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>`;
  } else {
    cuerpo = `<div class="scroll list">${HORAS.map((h) => `<div class="row"><span class="sub">${hh(h)}</span>${celda(S.esp, S.dia, h)}</div>`).join('')}</div>`;
  }
  const ayuda = can('reservar')
    ? 'Tocá un horario libre para reservarlo, o una reserva para ver los detalles.'
    : 'Consultá en qué horarios está libre.';
  return `
  <div class="bar">
    <label>Espacio<select data-k="esp">${grupo('aula', 'Aulas')}${grupo('lab', 'Laboratorios')}</select></label>
    <span class="spacer"></span>
    <button class="btn ${S.modo === 'semana' ? 'on' : ''}" data-act="modo" data-m="semana">Semana</button>
    <button class="btn ${S.modo === 'dia' ? 'on' : ''}" data-act="modo" data-m="dia">Día</button>
    ${S.modo === 'dia' ? `<label>Día<select data-k="dia" data-n="1">${opts(DIAS.map((d, i) => [i, d]), S.dia)}</select></label>` : ''}
  </div>
  <p class="sum"><b>${esc(a.nombre)}</b> · ${PAB[a.pab]} · ${a.cap} personas. ${ayuda} Los bloques grises son clases oficiales cargadas por Bedelía.</p>
  ${cuerpo}`;
}

// ---------- vista: todas las reservas (solo bedel) ----------
function bloquesReservas() {
  const orden = S.res.slice().sort((a, b) => a.room.localeCompare(b.room) || a.d - b.d || a.h - b.h);
  const bloques = [];
  for (const r of orden) {
    const u = bloques[bloques.length - 1];
    if (u && u.room === r.room && u.d === r.d && u.who === r.who && u.mat === r.mat && u.hasta === r.h) u.hasta = r.h + 1;
    else bloques.push({ room: r.room, d: r.d, desde: r.h, hasta: r.h + 1, who: r.who, mat: r.mat });
  }
  return bloques.sort((a, b) => a.d - b.d || a.desde - b.desde || a.room.localeCompare(b.room));
}

function vistaReservas() {
  const bloques = bloquesReservas();
  const filas = bloques.map((b) => `<div class="inc"><div><b>${esc(aulaPorId(b.room).nombre)} · ${esc(b.mat)}</b>
      <div class="sub">${DIAS[b.d]} ${hh(b.desde)} a ${hh(b.hasta)} · ${esc(b.who)}</div></div>
      <button class="btn" data-act="cancelarBloque" data-room="${b.room}" data-d="${b.d}" data-desde="${b.desde}" data-hasta="${b.hasta}">Cancelar reserva</button></div>`).join('');
  return `
  <p class="sum"><b>${bloques.length}</b> reservas activas · <b>${S.inc.length}</b> fallas reportadas · ${aulas.length} espacios en total</p>
  <div class="card flush">${filas || '<div class="inc sub">No hay reservas cargadas.</div>'}</div>`;
}

// ---------- vista: fallas ----------
// Alumnos y profesores reportan y confirman fallas. El bedel solo las lee.
function vistaFallas() {
  const reporta = can('reportar');
  const filas = S.inc.map((x, i) => {
    const a = aulaPorId(x.room);
    const quien = can('admin') && x.por
      ? ` · Reportada por ${esc(x.por)}${ROLES[x.rol] ? ' (' + ROLES[x.rol].nombre.toLowerCase() + ')' : ''}`
      : '';
    return `<div class="inc"><div><b>${RECURSOS[x.rec]} · ${esc(a.nombre)}</b><div class="sub">${PAB[a.pab]} · ${x.votos} ${x.votos === 1 ? 'confirmación' : 'confirmaciones'} · ${x.estado}${quien}</div></div>
      ${reporta ? `<button class="btn" data-act="mas1" data-i="${i}">+1 a mí también</button>` : ''}</div>`;
  }).join('');
  const cabecera = reporta
    ? `<div class="bar">
    <label>Aula<select id="f-room">${aulas.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join('')}</select></label>
    <label>Recurso<select id="f-rec">${Object.entries(RECURSOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <button class="btn p" data-act="reportar">Reportar falla</button>
  </div>`
    : `<p class="sum"><b>${S.inc.length}</b> fallas reportadas por alumnos y profesores. Esta vista es solo de lectura.</p>`;
  return `${cabecera}
  <div class="card flush">${filas || '<div class="inc sub">No hay fallas abiertas.</div>'}</div>`;
}

// ---------- reservas ----------
function dialogoReservar(d, h) {
  const a = aulaPorId(S.esp);
  $('#dlg').innerHTML = `<h3>Reservar ${esc(a.nombre)}</h3>
    <div class="sub">${DIAS[d]} desde las ${hh(h)}</div>
    <div class="f">
      <label>Reservar a nombre de<input id="r-who" maxlength="40" value="${esc(S.user.nombre)}" ${can('admin') ? '' : 'readonly'}></label>
      <label>Materia o motivo<input id="r-mat" maxlength="50" placeholder="Ej: Práctica de redes"></label>
      <label>Duración<select id="r-dur"><option value="1">1 hora</option><option value="2">2 horas</option><option value="3">3 horas</option></select></label>
    </div>
    <div class="acts"><button class="btn" data-act="cerrar">Cancelar</button><button class="btn p" data-act="confirmar" data-d="${d}" data-h="${h}">Reservar</button></div>`;
  $('#dlg').showModal();
}

function dialogoVer(d, h) {
  const r = S.res.find((x) => x.room === S.esp && x.d === d && x.h === h);
  if (!r) return;
  $('#dlg').innerHTML = `<h3>${esc(r.mat)}</h3>
    <div class="sub">${esc(aulaPorId(S.esp).nombre)} · ${DIAS[d]} ${hh(h)}</div>
    <p>Reservado por <b>${esc(r.who)}</b></p>
    <div class="acts"><button class="btn" data-act="cerrar">Cerrar</button>
    ${puedeCancelar(r) ? `<button class="btn" data-act="cancelar" data-d="${d}" data-h="${h}">Cancelar reserva</button>` : ''}</div>`;
  $('#dlg').showModal();
}

function confirmarReserva(d, h) {
  if (!can('reservar')) return toast('Tu rol no permite reservar.');
  // solo el bedel puede reservar a nombre de otra persona
  const who = can('admin') ? $('#r-who').value.trim() : S.user.nombre;
  const mat = $('#r-mat').value.trim(), dur = +$('#r-dur').value;
  if (!who || !mat) return toast('Completá el nombre y el motivo de la reserva.');
  for (let x = h; x < h + dur; x++) {
    const o = x > 20 ? { txt: 'cierre de la facultad' } : ocupacion(S.esp, d, x);
    if (o) return toast(`Conflicto de horario a las ${hh(x)}: ${o.txt}. Probá con menos horas.`);
  }
  for (let x = h; x < h + dur; x++) S.res.push({ room: S.esp, d, h: x, who, mat });
  guardar(); $('#dlg').close(); render();
  toast('Reserva confirmada ✓');
}

// ---------- eventos ----------
const sinPermiso = () => toast('Tu rol no tiene permiso para esta acción.');

const acciones = {
  vista: (b) => { if (ROLES[S.user.rol].vistas.includes(b.dataset.v)) S.vista = b.dataset.v; },
  filtro: (b) => { S.f[b.dataset.r] = !S.f[b.dataset.r]; },
  ahora: () => { const n = momentoActual(); S.dia = n.dia; S.hora = n.hora; },
  modo: (b) => { S.modo = b.dataset.m; },
  reservar: (b) => {
    if (!can('reservar')) return sinPermiso();
    if (b.dataset.id) S.esp = b.dataset.id;
    dialogoReservar(+b.dataset.d, +b.dataset.h);
  },
  ver: (b) => { if (!can('reservar')) return sinPermiso(); dialogoVer(+b.dataset.d, +b.dataset.h); },
  cerrar: () => $('#dlg').close(),
  confirmar: (b) => confirmarReserva(+b.dataset.d, +b.dataset.h),
  cancelar: (b) => {
    const d = +b.dataset.d, h = +b.dataset.h;
    const r = S.res.find((x) => x.room === S.esp && x.d === d && x.h === h);
    if (!r || !puedeCancelar(r)) return sinPermiso();
    S.res = S.res.filter((x) => x !== r);
    guardar(); $('#dlg').close(); toast('Reserva cancelada');
  },
  cancelarBloque: (b) => {
    if (!can('admin')) return sinPermiso();
    const d = +b.dataset.d, desde = +b.dataset.desde, hasta = +b.dataset.hasta;
    S.res = S.res.filter((x) => !(x.room === b.dataset.room && x.d === d && x.h >= desde && x.h < hasta));
    guardar(); toast('Reserva cancelada');
  },
  mas1: (b) => {
    if (!can('reportar')) return sinPermiso();
    S.inc[+b.dataset.i].votos++; guardar(); toast('Sumamos tu confirmación al reporte.');
  },
  reportar: () => {
    if (!can('reportar')) return sinPermiso();
    const room = $('#f-room').value, rec = $('#f-rec').value, a = aulaPorId(room);
    if (a.rec[rec] === undefined) return toast(`${a.nombre} no tiene ${RECURSOS[rec].toLowerCase()}.`);
    const previo = S.inc.find((x) => x.room === room && x.rec === rec);
    if (previo) { previo.votos++; toast(`Este problema ya fue notificado. Estado actual: ${previo.estado}. Sumamos tu +1.`); }
    else { S.inc.push({ room, rec, votos: 1, estado: 'Pendiente', por: S.user.nombre, rol: S.user.rol }); toast('Falla enviada a Bedelía y Mantenimiento.'); }
    guardar();
  },
  salir: () => {
    S.ultimo = S.user; S.user = null; S.vista = 'aulas';
    guardarSesion(null);
    toast('Cerraste la sesión.');
  },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !S.user) return;
  acciones[b.dataset.act](b);
  if (b.dataset.act !== 'reservar' && b.dataset.act !== 'ver' && b.dataset.act !== 'confirmar' && b.dataset.act !== 'cerrar') render();
});
document.addEventListener('change', (e) => {
  const k = e.target.dataset.k;
  if (!k || !S.user) return;
  S[k] = e.target.dataset.n ? +e.target.value : e.target.value;
  render();
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'login') return;
  e.preventDefault();
  const rol = new FormData(e.target).get('rol');
  if (!ROLES[rol]) return toast('Elegí un rol para ingresar.');
  let nombre = $('#l-nombre').value.trim();
  if (!nombre && rol === 'alumno') nombre = 'Alumno';
  if (!nombre) return toast('Escribí tu nombre para ingresar.');
  S.user = { nombre, rol }; S.vista = 'aulas';
  guardarSesion(S.user);
  render();
  toast(`Ingresaste como ${ROLES[rol].nombre.toLowerCase()}.`);
});

function render() {
  const u = S.user;
  $('#user').innerHTML = u
    ? `<div class="user-info">${u.nombre === ROLES[u.rol].nombre ? '' : `<b>${esc(u.nombre)}</b>`}<span class="badge ${u.rol}">${ROLES[u.rol].nombre}</span></div>
       <button class="btn sm" data-act="salir">Salir</button>`
    : '';
  if (!u) {
    $('#tabs').innerHTML = '';
    $('#app').innerHTML = vistaLogin();
    return;
  }
  const vistas = ROLES[u.rol].vistas;
  if (!vistas.includes(S.vista)) S.vista = vistas[0];
  $('#tabs').innerHTML = vistas
    .map((v) => `<button class="${v === S.vista ? 'on' : ''}" data-act="vista" data-v="${v}">${tituloVista(v)}</button>`).join('');
  $('#app').innerHTML = { aulas: vistaAulas, grilla: vistaGrilla, reservas: vistaReservas, fallas: vistaFallas }[S.vista]();
}
render();