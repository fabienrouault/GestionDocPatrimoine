// Faux Power Pages : sert la page + une API /_api minimale en mémoire (pour tests locaux uniquement).
const http = require('http'), fs = require('fs'), path = require('path'), { randomUUID } = require('crypto');
const ROOT = path.join(__dirname, '..', 'site', 'web-pages', 'Inventaire');
const csv = f => fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map(l => l.split(';'));
const id = () => randomUUID();
const db = { fsjd_territoires: [], fsjd_sites: [], fsjd_batiments: [], fsjd_modeledocuments: [], fsjd_documentinventaires: [], fsjd_contrats: [] };
const T1 = id(), T2 = id();
db.fsjd_territoires.push({ fsjd_territoireid: T1, fsjd_name: 'Provence' }, { fsjd_territoireid: T2, fsjd_name: 'Île-de-France' });
['Centre Saint Barthélemy', 'Centre Forbin'].forEach(n => db.fsjd_sites.push({ fsjd_siteid: id(), fsjd_name: n, fsjd_adresse: '13 Marseille', _fsjd_territoire_value: T1 }));
db.fsjd_sites.push({ fsjd_siteid: id(), fsjd_name: 'Maison Paris', fsjd_adresse: '75 Paris', _fsjd_territoire_value: T2 });
csv('modeles_documents.csv').forEach(([niv, cat, , lib, ord]) => db.fsjd_modeledocuments.push({
  fsjd_modeledocumentid: id(), fsjd_name: lib, fsjd_niveau: niv === 'Site' ? 100000000 : 100000001, fsjd_categorie: cat, fsjd_ordre: +ord, statecode: 0 }));
db.fsjd_batiments.push({ fsjd_batimentid: id(), fsjd_name: 'Bâtiment A', _fsjd_site_value: db.fsjd_sites[0].fsjd_siteid });
const pk = { fsjd_territoires: 'fsjd_territoireid', fsjd_sites: 'fsjd_siteid', fsjd_batiments: 'fsjd_batimentid', fsjd_modeledocuments: 'fsjd_modeledocumentid', fsjd_documentinventaires: 'fsjd_documentinventaireid', fsjd_contrats: 'fsjd_contratid' };
const bindKeys = { 'fsjd_site@odata.bind': '_fsjd_site_value', 'fsjd_batiment@odata.bind': '_fsjd_batiment_value', 'fsjd_modele@odata.bind': '_fsjd_modele_value', 'fsjd_territoire@odata.bind': '_fsjd_territoire_value' };
const log = []; module.exports.log = log; module.exports.db = db;

function filter(rows, f) {
  if (!f) return rows;
  const conds = f.split(' and ').map(c => c.trim());
  return rows.filter(r => conds.every(c => {
    let m;
    if ((m = c.match(/^(\w+) eq null$/))) return r[m[1]] == null;
    if ((m = c.match(/^(\w+) eq ([\w-]+)$/))) return String(r[m[1]]) === m[2] || (m[2] === '0' && r[m[1]] == null);
    return true;
  }));
}
function handler(req, res) {
  const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
  if (req.method === 'GET' && /^\/inventaire\/?$/.test(p)) {
    const html = fs.readFileSync(path.join(ROOT, 'Inventaire.fr-FR.webpage.copy.html'), 'utf8')
      .replace(/\{% if user %\}|\{% else %\}[\s\S]*?\{% endif %\}/g, '').replace(/\{\{ user.fullname \| escape \}\}/, 'Test Utilisateur').replace(/\{% if user.roles[^%]*%\}1\{% endif %\}/, '1');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><meta charset=utf-8><link rel=stylesheet href=/css><body>${html}<script>window.shell={getTokenDeferred:()=>({done:f=>{f('tok');return{fail(){}}}})}</script><script src=/js></script>`);
  }
  if (p === '/css') { res.setHeader('Content-Type', 'text/css'); return res.end(fs.readFileSync(path.join(ROOT, 'Inventaire.fr-FR.customcss.css'))); }
  if (p === '/js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fs.readFileSync(path.join(ROOT, 'Inventaire.fr-FR.customjs.js'))); }
  const m = p.match(/^\/_api\/(\w+)(?:\(([\w-]+)\)(?:\/(\w+))?)?$/);
  if (!m) { res.statusCode = 404; return res.end('nf'); }
  const [, set, rid, col] = m; const rows = db[set];
  if (!rows) { res.statusCode = 404; return res.end(JSON.stringify({ error: { message: 'table inconnue' } })); }
  if (req.headers['__requestverificationtoken'] !== 'tok') { res.statusCode = 403; return res.end(JSON.stringify({ error: { message: 'token' } })); }
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const buf = Buffer.concat(chunks); log.push(`${req.method} ${p}${u.search}`);
    res.setHeader('Content-Type', 'application/json');
    const row = rid && rows.find(r => r[pk[set]] === rid);
    if (req.method === 'GET') {
      if (rid) { if (!row) { res.statusCode = 404; return res.end(JSON.stringify({ error: { message: 'absent' } })); } return res.end(JSON.stringify(row)); }
      const f = u.searchParams.get('$filter'); const out = filter(rows, f).map(r => ({ ...r, ...(r.fsjd_fichier_name ? {} : {}) }));
      return res.end(JSON.stringify({ value: out }));
    }
    if (req.method === 'POST') {
      const b = JSON.parse(buf.toString()); const r = { [pk[set]]: id() };
      for (const k in b) { if (bindKeys[k]) r[bindKeys[k]] = b[k].match(/\(([^)]+)\)/)[1]; else r[k] = b[k]; }
      rows.push(r); res.statusCode = 204; res.setHeader('entityid', r[pk[set]]); return res.end();
    }
    if (req.method === 'PATCH') { Object.assign(row, JSON.parse(buf.toString())); res.statusCode = 204; return res.end(); }
    if (req.method === 'DELETE') { rows.splice(rows.indexOf(row), 1); res.statusCode = 204; return res.end(); }
    if (req.method === 'PUT' && col === 'fsjd_fichier') {
      row.fsjd_fichier_name = decodeURIComponent(req.headers['x-ms-file-name']); row._bytes = buf.length; res.statusCode = 204; return res.end();
    }
    res.statusCode = 405; res.end('{}');
  });
}
module.exports.start = (port = 0) => new Promise(r => { const s = http.createServer(handler).listen(port, () => r(s)); });
if (require.main === module) module.exports.start(8080).then(() => console.log('http://localhost:8080/inventaire/'));
