/* Inventaire documentaire du patrimoine – FSJD
 * Application cliente (JS natif) qui s'appuie sur l'API Web Power Pages (/_api).
 * Les droits d'accès sont appliqués côté serveur par les autorisations de table :
 * un responsable technique ne voit que les établissements dont il est responsable.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Configuration : noms logiques Dataverse (voir docs/modele-donnees.md) */
  /* ------------------------------------------------------------------ */
  var SET = {
    territoire: 'fsjd_territoires',
    site: 'fsjd_sites',
    batiment: 'fsjd_batiments',
    modele: 'fsjd_modeledocuments',
    doc: 'fsjd_documentinventaires',
    contrat: 'fsjd_contrats'
  };
  var MAX_FILE_MB = 50;
  var EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'dwg', 'dxf', 'jpg', 'jpeg', 'png', 'zip', 'msg', 'txt'];

  var STATUT = [
    { v: 100000000, l: 'Disponible', c: 'ok' },
    { v: 100000001, l: 'Obsolète / partiel', c: 'warn' },
    { v: 100000002, l: 'Manquant', c: 'ko' },
    { v: 100000003, l: 'Non applicable', c: 'na' }
  ];
  var PRIORITE = [
    { v: 100000000, l: 'Haute' }, { v: 100000001, l: 'Moyenne' },
    { v: 100000002, l: 'Basse' }, { v: 100000003, l: 'Non applicable' }
  ];
  var FAMILLES = [
    { v: 100000000, l: 'Électricité', type: 'Énergie' },
    { v: 100000001, l: 'Gaz', type: 'Énergie' },
    { v: 100000002, l: 'Fuel', type: 'Énergie' },
    { v: 100000003, l: 'Eau potable', type: 'Énergie' },
    { v: 100000004, l: 'Téléphonie / Internet', type: 'Énergie' },
    { v: 100000005, l: 'CVC', type: 'Maintenance' },
    { v: 100000006, l: 'Plomberie', type: 'Maintenance' },
    { v: 100000007, l: 'Électricité courants forts (CFO)', type: 'Maintenance' },
    { v: 100000008, l: 'Électricité courants faibles (Cfa)', type: 'Maintenance' },
    { v: 100000009, l: 'Systèmes de sécurité incendie (SSI)', type: 'Maintenance' },
    { v: 100000010, l: 'Appareils élévateurs', type: 'Maintenance' },
    { v: 100000011, l: 'Gestion technique du bâtiment (GTB)', type: 'Maintenance' },
    { v: 100000012, l: 'Portes et portails', type: 'Maintenance' },
    { v: 100000013, l: 'Autres', type: 'Maintenance' }
  ];
  var ETAT_PATRIMOINE = [{ v: 100000000, l: 'Propriétaire' }, { v: 100000001, l: 'Locataire' }];
  var OCCUPATION = [
    { v: 100000000, l: 'Propriétaire' }, { v: 100000001, l: 'Locataire' },
    { v: 100000002, l: 'Mise à disposition' }, { v: 100000003, l: 'Copropriété' },
    { v: 100000004, l: 'Crédit-bail' }, { v: 100000005, l: 'Autre' }
  ];
  var STATUT_ETAB = [
    { v: 100000000, l: 'ERP' }, { v: 100000001, l: 'HAB' }, { v: 100000002, l: 'ERT' },
    { v: 100000003, l: 'ICPE' }, { v: 100000004, l: 'Autres' }, { v: 100000005, l: 'Non concerné' }
  ];
  var CAT_ERP = [
    { v: 100000000, l: '1ère' }, { v: 100000001, l: '2ème' }, { v: 100000002, l: '3ème' },
    { v: 100000003, l: '4ème' }, { v: 100000004, l: '5ème' }, { v: 100000005, l: 'Non concerné' }
  ];

  var SITE_FIELDS = [
    { k: 'fsjd_adresse', l: 'Adresse postale', t: 'text' },
    { k: 'fsjd_contactdirection', l: "Contact Direction d'établissement", t: 'text', h: 'NOM Prénom - téléphone - mail' },
    { k: 'fsjd_contacttechnique', l: 'Contact Responsable technique', t: 'text', h: 'NOM Prénom - téléphone - mail' },
    { k: 'fsjd_activites', l: 'Activité(s) du site', t: 'area' },
    { k: 'fsjd_etatpatrimoine', l: 'État du patrimoine', t: 'choice', o: ETAT_PATRIMOINE },
    { k: 'fsjd_anneeacquisition', l: "Année d'acquisition", t: 'int' },
    { k: 'fsjd_superficieterrain', l: 'Superficie terrain (m²)', t: 'num' },
    { k: 'fsjd_superficiebatiments', l: 'Superficie des bâtiments, planchers (m²)', t: 'num' },
    { k: 'fsjd_superficiestationnements', l: 'Superficie des stationnements aériens (m²)', t: 'num' },
    { k: 'fsjd_nbplacesstationnement', l: 'Nombre de places de stationnement', t: 'int' }
  ];
  var BAT_FIELDS = [
    { k: 'fsjd_name', l: 'Nom du bâtiment', t: 'text', req: true },
    { k: 'fsjd_activites', l: 'Activité(s) du bâtiment', t: 'area' },
    { k: 'fsjd_statutoccupation', l: "Statut d'occupation", t: 'choice', o: OCCUPATION },
    { k: 'fsjd_anneeconstruction', l: 'Année de construction', t: 'int' },
    { k: 'fsjd_superficieterrain', l: 'Superficie terrain (m²)', t: 'num' },
    { k: 'fsjd_superficiebatiment', l: 'Superficie du bâtiment, tous planchers (m²)', t: 'num' },
    { k: 'fsjd_nbetages', l: "Nombre d'étages", t: 'int' },
    { k: 'fsjd_hauteurplancherbas', l: 'Hauteur du plancher bas du dernier étage (m)', t: 'num' },
    { k: 'fsjd_effectifadmissible', l: 'Effectifs admissibles (public + personnel)', t: 'int' },
    { k: 'fsjd_nblits', l: 'Nombre de lits', t: 'int' },
    { k: 'fsjd_statutetablissement', l: "Statut d'établissement", t: 'choice', o: STATUT_ETAB },
    { k: 'fsjd_typeerp', l: "Si ERP, type d'établissement", t: 'text', h: 'J, L, R, U, W…' },
    { k: 'fsjd_categorieerp', l: "Si ERP, catégorie de l'établissement", t: 'choice', o: CAT_ERP }
  ];

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                          */
  /* ------------------------------------------------------------------ */
  var root = document.getElementById('fsjd-app');
  if (!root) { return; }
  var USER = { name: root.getAttribute('data-user-name') || '', pilotage: root.getAttribute('data-pilotage') === '1' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function opts(list, sel, blank) {
    return (blank === false ? '' : '<option value="">' + (blank || '—') + '</option>') + list.map(function (o) {
      return '<option value="' + o.v + '"' + (o.v === sel ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
  }
  function label(list, v) { var o = list.filter(function (x) { return x.v === v; })[0]; return o ? o.l : ''; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function daysTo(d) { return Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5); }

  var toastTimer;
  function toast(msg, kind) {
    var t = document.getElementById('fsjd-toast');
    if (!t) { t = document.createElement('div'); t.id = 'fsjd-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'fsjd-toast ' + (kind || 'ok') + ' show';
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'fsjd-toast'; }, kind === 'ko' ? 6000 : 1800);
  }

  /* ------------------------------------------------------------------ */
  /* Couche API Power Pages                                              */
  /* ------------------------------------------------------------------ */
  var api = (function () {
    var tokenP;
    function token() {
      if (!tokenP) {
        tokenP = new Promise(function (res, rej) {
          if (window.shell && shell.getTokenDeferred) { shell.getTokenDeferred().done(res).fail(rej); }
          else { res(''); }
        });
      }
      return tokenP;
    }
    function call(method, url, body, extra) {
      return token().then(function (tk) {
        var h = { 'Accept': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', '__RequestVerificationToken': tk };
        if (body && !extra) { h['Content-Type'] = 'application/json'; }
        for (var k in (extra || {})) { h[k] = extra[k]; }
        return fetch(url, { method: method, headers: h, credentials: 'same-origin', body: extra ? body : (body ? JSON.stringify(body) : undefined) });
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var m = t; try { m = JSON.parse(t).error.message; } catch (e) { /* texte brut */ }
            throw new Error((m || r.statusText) + ' (' + r.status + ') — ' + method + ' ' + decodeURIComponent(url).replace(/^\/_api\//, ''));
          });
        }
        return r;
      });
    }
    return {
      list: function (set, query) {
        var out = [];
        function page(url) {
          return call('GET', url).then(function (r) { return r.json(); }).then(function (j) {
            out = out.concat(j.value || []);
            return j['@odata.nextLink'] ? page(j['@odata.nextLink'].replace(/^https?:\/\/[^/]+/, '')) : out;
          });
        }
        return page('/_api/' + set + (query ? '?' + query : ''));
      },
      get: function (set, id, query) {
        return call('GET', '/_api/' + set + '(' + id + ')' + (query ? '?' + query : '')).then(function (r) { return r.json(); });
      },
      create: function (set, body) {
        return call('POST', '/_api/' + set, body).then(function (r) {
          var id = r.headers.get('entityid') || (r.headers.get('OData-EntityId') || '').replace(/.*\(([^)]+)\).*/, '$1');
          return id;
        });
      },
      update: function (set, id, body) { return call('PATCH', '/_api/' + set + '(' + id + ')', body); },
      remove: function (set, id) { return call('DELETE', '/_api/' + set + '(' + id + ')'); },
      upload: function (set, id, column, file) {
        return call('PUT', '/_api/' + set + '(' + id + ')/' + column, file, {
          'Content-Type': 'application/octet-stream',
          'x-ms-file-name': encodeURIComponent(file.name)
        });
      }
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Données de référence                                                  */
  /* ------------------------------------------------------------------ */
  var ref = null;
  function loadRef() {
    if (ref) { return Promise.resolve(ref); }
    return Promise.all([
      api.list(SET.modele, '$select=fsjd_modeledocumentid,fsjd_name,fsjd_niveau,fsjd_categorie,fsjd_ordre&$filter=statecode eq 0&$orderby=fsjd_ordre asc'),
      api.list(SET.territoire, '$select=fsjd_territoireid,fsjd_name')
    ]).then(function (r) {
      var terr = {}; r[1].forEach(function (t) { terr[t.fsjd_territoireid] = t.fsjd_name; });
      ref = {
        site: r[0].filter(function (m) { return m.fsjd_niveau === 100000000; }),
        bat: r[0].filter(function (m) { return m.fsjd_niveau === 100000001; }),
        terr: terr
      };
      return ref;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Calculs d'avancement                                                */
  /* ------------------------------------------------------------------ */
  function stats(models, rows) {
    var byModel = {}; rows.forEach(function (r) { byModel[r._fsjd_modele_value] = r; });
    var s = { total: models.length, traite: 0, dispo: 0, manquant: 0, sansFichier: 0 };
    models.forEach(function (m) {
      var r = byModel[m.fsjd_modeledocumentid];
      if (!r || r.fsjd_statut == null) { return; }
      s.traite++;
      if (r.fsjd_statut === 100000000 || r.fsjd_statut === 100000001) {
        s.dispo++;
        if (!r.fsjd_fichier_name && !r.fsjd_lien) { s.sansFichier++; }
      }
      if (r.fsjd_statut === 100000002) { s.manquant++; }
    });
    return s;
  }
  function bar(done, total) {
    var p = pct(done, total);
    return '<div class="fsjd-bar" title="' + done + ' / ' + total + '"><span style="width:' + p + '%"></span></div><span class="fsjd-pct">' + p + ' %</span>';
  }

  /* ------------------------------------------------------------------ */
  /* Vue : liste des établissements                                      */
  /* ------------------------------------------------------------------ */
  function viewHome() {
    root.innerHTML = '<p class="fsjd-loading">Chargement des établissements…</p>';
    return Promise.all([
      loadRef(),
      api.list(SET.site, '$select=fsjd_siteid,fsjd_name,_fsjd_territoire_value,fsjd_adresse&$orderby=fsjd_name asc'),
      api.list(SET.batiment, '$select=fsjd_batimentid,fsjd_name,_fsjd_site_value'),
      api.list(SET.doc, '$select=_fsjd_site_value,_fsjd_batiment_value,_fsjd_modele_value,fsjd_statut,fsjd_fichier_name,fsjd_lien')
    ]).then(function (r) {
      var R = r[0], sites = r[1], bats = r[2], docs = r[3];
      if (!sites.length) {
        root.innerHTML = '<div class="fsjd-empty"><h2>Aucun établissement</h2><p>Aucun établissement ne vous est rattaché. Contactez le service Patrimoine de la Fondation.</p></div>';
        return;
      }
      var groups = {};
      sites.forEach(function (s) {
        var siteBats = bats.filter(function (b) { return b._fsjd_site_value === s.fsjd_siteid; });
        var st = stats(R.site, docs.filter(function (d) { return d._fsjd_site_value === s.fsjd_siteid && !d._fsjd_batiment_value; }));
        siteBats.forEach(function (b) {
          var sb = stats(R.bat, docs.filter(function (d) { return d._fsjd_batiment_value === b.fsjd_batimentid; }));
          ['total', 'traite', 'dispo', 'manquant', 'sansFichier'].forEach(function (k) { st[k] += sb[k]; });
        });
        var terr = R.terr[s._fsjd_territoire_value] || 'Sans territoire';
        (groups[terr] = groups[terr] || []).push({ s: s, nb: siteBats.length, st: st });
      });
      var all = { total: 0, traite: 0 };
      var html = '<div class="fsjd-head"><h1>Inventaire documentaire</h1><button class="btn btn-default" data-act="export">Exporter la synthèse (CSV)</button></div>';
      Object.keys(groups).sort().forEach(function (g) {
        var t = { total: 0, traite: 0 };
        groups[g].forEach(function (x) { t.total += x.st.total; t.traite += x.st.traite; });
        all.total += t.total; all.traite += t.traite;
        html += '<section class="fsjd-card"><h2>' + esc(g) + '<small>' + bar(t.traite, t.total) + '</small></h2><div class="fsjd-sites">';
        groups[g].forEach(function (x) {
          html += '<a class="fsjd-site" href="#/site/' + x.s.fsjd_siteid + '"><strong>' + esc(x.s.fsjd_name) + '</strong>' +
            '<span class="fsjd-sub">' + esc(x.s.fsjd_adresse || '') + '</span>' +
            '<span class="fsjd-prog">' + bar(x.st.traite, x.st.total) + '</span>' +
            '<span class="fsjd-chips"><em>' + x.nb + ' bâtiment' + (x.nb > 1 ? 's' : '') + '</em>' +
            (x.st.manquant ? '<em class="ko">' + x.st.manquant + ' manquant' + (x.st.manquant > 1 ? 's' : '') + '</em>' : '') +
            (x.st.sansFichier ? '<em class="warn">' + x.st.sansFichier + ' fichier(s) à déposer</em>' : '') + '</span></a>';
        });
        html += '</div></section>';
      });
      root.innerHTML = html;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Composants : formulaire d'informations générales                    */
  /* ------------------------------------------------------------------ */
  function fieldHtml(f, rec) {
    var v = rec[f.k], id = 'f_' + f.k, h = '<div class="fsjd-field"><label for="' + id + '">' + esc(f.l) + (f.req ? ' *' : '') + '</label>';
    if (f.t === 'choice') { h += '<select id="' + id + '" data-k="' + f.k + '" data-t="choice">' + opts(f.o, v) + '</select>'; }
    else if (f.t === 'area') { h += '<textarea id="' + id + '" data-k="' + f.k + '" data-t="text" rows="2">' + esc(v) + '</textarea>'; }
    else {
      h += '<input id="' + id + '" data-k="' + f.k + '" data-t="' + f.t + '" type="' + (f.t === 'text' ? 'text' : 'number') + '"' +
        (f.t === 'num' ? ' step="any"' : '') + (f.t === 'int' ? ' step="1"' : '') + (f.t !== 'text' ? ' min="0"' : '') +
        ' value="' + esc(v) + '" placeholder="' + esc(f.h || '') + '">';
    }
    return h + '</div>';
  }
  function readValue(el) {
    var t = el.getAttribute('data-t'), v = el.value;
    if (v === '') { return null; }
    if (t === 'choice' || t === 'int') { return parseInt(v, 10); }
    if (t === 'num') { return parseFloat(v); }
    return v;
  }

  /* ------------------------------------------------------------------ */
  /* Composants : liste de contrôle des documents                        */
  /* ------------------------------------------------------------------ */
  var ctx = null; // contexte de la vue courante

  function fileCell(rec) {
    if (!rec || (!rec.fsjd_fichier_name && !rec.fsjd_lien)) { return ''; }
    var s = rec.fsjd_lien
      ? '<a href="' + esc(rec.fsjd_lien) + '" target="_blank" rel="noopener">' + esc(rec.fsjd_fichier_name || 'Ouvrir dans Teams') + '</a>'
      : '<span>' + esc(rec.fsjd_fichier_name) + '</span> <em class="fsjd-sync">transfert vers Teams en cours…</em>';
    return s;
  }

  function checklistHtml(items, kind) {
    var html = '', cat = null;
    items.forEach(function (it, i) {
      var m = it.m, r = it.rec || {};
      if (m.fsjd_categorie !== cat) {
        if (cat !== null) { html += '</div></details>'; }
        cat = m.fsjd_categorie;
        html += '<details class="fsjd-group" open data-cat="' + esc(cat) + '"><summary><span class="fsjd-gt">' + esc(cat) + '</span><span class="fsjd-gp"></span></summary><div class="fsjd-rows">' +
          '<div class="fsjd-row fsjd-row-h"><div>Document</div><div>Statut</div><div>Date du document</div><div>Priorité</div><div>Fichier</div><div>Commentaire</div></div>';
      }
      html += '<div class="fsjd-row s-' + statutClass(r.fsjd_statut) + '" data-kind="' + kind + '" data-i="' + i + '">' +
        '<div class="fsjd-lab">' + esc(m.fsjd_name) + (r.fsjd_modifiepar ? '<span class="fsjd-by">Modifié par ' + esc(r.fsjd_modifiepar) + '</span>' : '') + '</div>' +
        '<div><select aria-label="Statut" data-f="fsjd_statut" data-t="choice">' + opts(STATUT, r.fsjd_statut, 'À renseigner') + '</select></div>' +
        '<div><input aria-label="Date du document" type="date" data-f="fsjd_datedocument" data-t="date" value="' + esc(r.fsjd_datedocument || '') + '"></div>' +
        '<div><select aria-label="Priorité" data-f="fsjd_priorite" data-t="choice">' + opts(PRIORITE, r.fsjd_priorite) + '</select></div>' +
        '<div class="fsjd-file">' + uploadBtn() + '<span class="fsjd-fileinfo">' + fileCell(it.rec) + '</span></div>' +
        '<div><input aria-label="Commentaire" type="text" data-f="fsjd_commentaire" data-t="text" maxlength="500" value="' + esc(r.fsjd_commentaire || '') + '" placeholder="Commentaire"></div></div>';
    });
    return html + (cat !== null ? '</div></details>' : '');
  }
  function uploadBtn() { return '<button type="button" class="btn btn-xs btn-default" data-act="pick">Déposer</button>'; }
  function statutClass(v) { var s = STATUT.filter(function (x) { return x.v === v; })[0]; return s ? s.c : 'none'; }

  function updateProgress() {
    if (!ctx) { return; }
    var groups = {};
    ctx.items.forEach(function (it) {
      var g = groups[it.m.fsjd_categorie] = groups[it.m.fsjd_categorie] || { t: 0, d: 0 };
      g.t++; if (it.rec && it.rec.fsjd_statut != null) { g.d++; }
    });
    var total = 0, done = 0;
    Array.prototype.forEach.call(root.querySelectorAll('.fsjd-group'), function (el) {
      var g = groups[el.getAttribute('data-cat')]; if (!g) { return; }
      el.querySelector('.fsjd-gp').innerHTML = bar(g.d, g.t);
      total += g.t; done += g.d;
    });
    var top = root.querySelector('.fsjd-topprog');
    if (top) { top.innerHTML = bar(done, total) + ' <span class="fsjd-sub">' + done + ' / ' + total + ' documents traités</span>'; }
  }

  /* Enregistrement sérialisé par ligne (création paresseuse au premier changement) */
  function saveRow(it, patch) {
    patch.fsjd_modifiepar = USER.name;
    it.q = (it.q || Promise.resolve()).then(function () {
      if (it.rec && it.rec.id) {
        return api.update(it.set, it.rec.id, patch).then(function () { Object.assign(it.rec, patch); });
      }
      var body = Object.assign({}, it.base, patch);
      return api.create(it.set, body).then(function (id) { it.rec = Object.assign({ id: id }, patch); });
    }).then(function () { toast('Enregistré'); updateProgress(); },
      function (e) { toast('Échec de l’enregistrement : ' + e.message, 'ko'); throw e; });
    it.q = it.q.catch(function () { /* l'erreur est déjà affichée */ });
    return it.q;
  }

  function uploadFile(it, file, rowEl, isContrat) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (EXTENSIONS.indexOf(ext) < 0) { toast('Type de fichier non autorisé (.' + ext + ')', 'ko'); return; }
    if (file.size > MAX_FILE_MB * 1048576) { toast('Fichier trop volumineux (max ' + MAX_FILE_MB + ' Mo)', 'ko'); return; }
    var info = rowEl.querySelector('.fsjd-fileinfo');
    info.innerHTML = '<em class="fsjd-sync">Envoi de ' + esc(file.name) + '…</em>';
    var patch = {};
    if (!isContrat && (!it.rec || it.rec.fsjd_statut == null)) { patch.fsjd_statut = 100000000; }
    (isContrat ? Promise.resolve() : saveRow(it, patch)).then(function () {
      if (!it.rec || !it.rec.id) { throw new Error('enregistrement impossible'); }
      return (isContrat ? api.update(it.set, it.rec.id, { fsjd_modifiepar: USER.name }) : Promise.resolve())
        .then(function () { return api.upload(it.set, it.rec.id, 'fsjd_fichier', file); });
    }).then(function () {
      it.rec.fsjd_fichier_name = file.name;
      if (!isContrat) {
        rowEl.querySelector('[data-f="fsjd_statut"]').value = String(it.rec.fsjd_statut);
        rowEl.className = 'fsjd-row s-' + statutClass(it.rec.fsjd_statut);
      }
      info.innerHTML = fileCell(it.rec);
      toast('Fichier déposé');
    }).catch(function (e) { info.innerHTML = ''; toast('Échec du dépôt : ' + e.message, 'ko'); });
  }

  /* ------------------------------------------------------------------ */
  /* Contrats                                                              */
  /* ------------------------------------------------------------------ */
  function contratsHtml() {
    var html = '<section class="fsjd-card"><h2>Contrats</h2><p class="fsjd-sub">Pour chaque famille, renseignez les contrats en cours (un par ligne) et déposez le contrat.</p>';
    ['Énergie', 'Maintenance'].forEach(function (type) {
      html += '<h3>' + (type === 'Énergie' ? 'Fournitures d’énergie(s) / abonnements' : 'Contrats d’exploitation / maintenance') + '</h3>';
      FAMILLES.filter(function (f) { return f.type === type; }).forEach(function (f) {
        var rows = ctx.contrats.filter(function (c) { return c.fsjd_famille === f.v; });
        html += '<details class="fsjd-group" ' + (rows.length ? 'open' : '') + ' data-fam="' + f.v + '"><summary><span class="fsjd-gt">' + esc(f.l) +
          '</span><span class="fsjd-gp"><em>' + rows.length + ' contrat' + (rows.length > 1 ? 's' : '') + '</em></span></summary><div class="fsjd-rows">';
        rows.forEach(function (c) { html += contratRow(c, type); });
        html += '<button type="button" class="btn btn-sm btn-default" data-act="addcontrat" data-fam="' + f.v + '">+ Ajouter un contrat</button></div></details>';
      });
    });
    return html + '</section>';
  }
  function contratRow(c, type) {
    var alert = '';
    if (c.fsjd_echeance) {
      var d = daysTo(c.fsjd_echeance);
      alert = d < 0 ? '<em class="ko">Échu</em>' : (d <= 90 ? '<em class="warn">Échéance dans ' + d + ' j</em>' : '');
    }
    return '<div class="fsjd-contrat" data-kind="contrat" data-id="' + c.id + '">' +
      cf(c, 'fsjd_nature', 'Nature du contrat', 'text') + cf(c, 'fsjd_fournisseur', type === 'Énergie' ? 'Fournisseur' : 'Prestataire', 'text') +
      cf(c, 'fsjd_echeance', 'Échéance du contrat', 'date') + cf(c, 'fsjd_reconduction', 'Reconduction / préavis', 'text') +
      (type === 'Maintenance' ? cf(c, 'fsjd_equipements', 'Nature des équipements', 'text') : '') +
      cf(c, 'fsjd_criticite', 'Criticité / remarque', 'text') +
      '<div class="fsjd-field"><label>Contrat (fichier)</label><div class="fsjd-file">' + uploadBtn() + '<span class="fsjd-fileinfo">' + fileCell(c) + '</span></div></div>' +
      '<div class="fsjd-ctail">' + (c.fsjd_modifiepar ? '<span class="fsjd-by">Modifié par ' + esc(c.fsjd_modifiepar) + '</span>' : '') + alert + '<button type="button" class="btn btn-xs btn-link" data-act="delcontrat">Supprimer</button></div></div>';
  }
  function cf(c, k, l, t) {
    return '<div class="fsjd-field"><label>' + esc(l) + '</label><input type="' + t + '" data-f="' + k + '" data-t="' + (t === 'date' ? 'date' : 'text') + '" value="' + esc(c[k] || '') + '"></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Vue : établissement et bâtiment                                     */
  /* ------------------------------------------------------------------ */
  function buildItems(models, rows, base, set) {
    var byModel = {}; rows.forEach(function (r) { byModel[r._fsjd_modele_value] = r; });
    return models.map(function (m) {
      var r = byModel[m.fsjd_modeledocumentid];
      if (r) { r.id = r.fsjd_documentinventaireid; }
      var b = Object.assign({}, base, { fsjd_name: m.fsjd_name.substring(0, 200), 'fsjd_modele@odata.bind': '/' + SET.modele + '(' + m.fsjd_modeledocumentid + ')' });
      return { m: m, rec: r || null, base: b, set: set };
    });
  }
  var DOC_SELECT = '$select=fsjd_documentinventaireid,_fsjd_modele_value,fsjd_statut,fsjd_datedocument,fsjd_priorite,fsjd_commentaire,fsjd_modifiepar,fsjd_fichier_name,fsjd_lien';

  function viewSite(id) {
    root.innerHTML = '<p class="fsjd-loading">Chargement…</p>';
    return Promise.all([
      loadRef(), api.get(SET.site, id),
      api.list(SET.batiment, '$select=fsjd_batimentid,fsjd_name&$filter=_fsjd_site_value eq ' + id + '&$orderby=fsjd_name asc'),
      api.list(SET.doc, DOC_SELECT + '&$filter=_fsjd_site_value eq ' + id + ' and _fsjd_batiment_value eq null')
    ]).then(function (r) {
      var R = r[0], site = r[1];
      ctx = { type: 'site', id: id, rec: site, fields: SITE_FIELDS, set: SET.site, idKey: 'fsjd_siteid',
        items: buildItems(R.site, r[3], { 'fsjd_site@odata.bind': '/' + SET.site + '(' + id + ')' }, SET.doc), contrats: [] };
      var html = '<nav class="fsjd-crumb"><a href="#/">Établissements</a> › <span>' + esc(site.fsjd_name) + '</span></nav>' +
        '<div class="fsjd-head"><h1>' + esc(site.fsjd_name) + '</h1><div class="fsjd-topprog"></div></div>' +
        '<section class="fsjd-card"><h2>Informations générales du site</h2><div class="fsjd-grid" data-kind="info">' +
        SITE_FIELDS.map(function (f) { return fieldHtml(f, site); }).join('') + '</div></section>' +
        '<section class="fsjd-card"><h2>Bâtiments</h2><div class="fsjd-bats">' +
        r[2].map(function (b) { return '<a class="fsjd-bat" href="#/batiment/' + b.fsjd_batimentid + '">' + esc(b.fsjd_name) + '</a>'; }).join('') +
        '<button type="button" class="btn btn-primary" data-act="addbat">+ Ajouter un bâtiment</button></div></section>' +
        '<section class="fsjd-card"><h2>Documents du site</h2>' + checklistHtml(ctx.items, 'doc') + '</section>';
      root.innerHTML = html;
      updateProgress();
    });
  }

  function viewBatiment(id) {
    root.innerHTML = '<p class="fsjd-loading">Chargement…</p>';
    return Promise.all([
      loadRef(), api.get(SET.batiment, id),
      api.list(SET.doc, DOC_SELECT + '&$filter=_fsjd_batiment_value eq ' + id),
      api.list(SET.contrat, '$select=fsjd_contratid,fsjd_famille,fsjd_nature,fsjd_fournisseur,fsjd_echeance,fsjd_reconduction,fsjd_equipements,fsjd_criticite,fsjd_modifiepar,fsjd_fichier_name,fsjd_lien&$filter=_fsjd_batiment_value eq ' + id)
    ]).then(function (r) {
      var R = r[0], bat = r[1], siteId = bat._fsjd_site_value;
      return api.get(SET.site, siteId, '$select=fsjd_name').then(function (site) {
        var base = { 'fsjd_site@odata.bind': '/' + SET.site + '(' + siteId + ')', 'fsjd_batiment@odata.bind': '/' + SET.batiment + '(' + id + ')' };
        r[3].forEach(function (c) { c.id = c.fsjd_contratid; });
        ctx = { type: 'bat', id: id, siteId: siteId, rec: bat, fields: BAT_FIELDS, set: SET.batiment, base: base,
          items: buildItems(R.bat, r[2], base, SET.doc), contrats: r[3] };
        root.innerHTML = '<nav class="fsjd-crumb"><a href="#/">Établissements</a> › <a href="#/site/' + siteId + '">' + esc(site.fsjd_name) + '</a> › <span>' + esc(bat.fsjd_name) + '</span></nav>' +
          '<div class="fsjd-head"><h1>' + esc(bat.fsjd_name) + '</h1><div class="fsjd-topprog"></div></div>' +
          '<section class="fsjd-card"><h2>Informations générales du bâtiment</h2><div class="fsjd-grid" data-kind="info">' +
          BAT_FIELDS.map(function (f) { return fieldHtml(f, bat); }).join('') + '</div></section>' +
          '<section class="fsjd-card"><h2>Documents du bâtiment</h2>' + checklistHtml(ctx.items, 'doc') + '</section>' + contratsHtml();
        updateProgress();
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Export CSV de la synthèse                                           */
  /* ------------------------------------------------------------------ */
  function exportCsv() {
    toast('Préparation de l’export…');
    Promise.all([
      loadRef(),
      api.list(SET.site, '$select=fsjd_siteid,fsjd_name,_fsjd_territoire_value'),
      api.list(SET.batiment, '$select=fsjd_batimentid,fsjd_name,_fsjd_site_value'),
      api.list(SET.doc, '$select=_fsjd_site_value,_fsjd_batiment_value,_fsjd_modele_value,fsjd_statut,fsjd_datedocument,fsjd_priorite,fsjd_commentaire,fsjd_fichier_name,fsjd_lien')
    ]).then(function (r) {
      var R = r[0], rows = [['Territoire', 'Établissement', 'Bâtiment', 'Catégorie', 'Document', 'Statut', 'Date du document', 'Priorité', 'Fichier', 'Lien Teams', 'Commentaire']];
      var idx = {}; r[3].forEach(function (d) { idx[(d._fsjd_batiment_value || d._fsjd_site_value) + '|' + d._fsjd_modele_value] = d; });
      function add(site, bat, models, owner) {
        models.forEach(function (m) {
          var d = idx[owner + '|' + m.fsjd_modeledocumentid] || {};
          rows.push([R.terr[site._fsjd_territoire_value] || '', site.fsjd_name, bat ? bat.fsjd_name : '(site)', m.fsjd_categorie, m.fsjd_name,
            label(STATUT, d.fsjd_statut) || 'À renseigner', d.fsjd_datedocument || '', label(PRIORITE, d.fsjd_priorite), d.fsjd_fichier_name || '', d.fsjd_lien || '', d.fsjd_commentaire || '']);
        });
      }
      r[1].forEach(function (s) {
        add(s, null, R.site, s.fsjd_siteid);
        r[2].filter(function (b) { return b._fsjd_site_value === s.fsjd_siteid; }).forEach(function (b) { add(s, b, R.bat, b.fsjd_batimentid); });
      });
      var csv = '﻿' + rows.map(function (row) { return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'synthese_inventaire_' + today() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      toast('Export généré');
    }).catch(function (e) { toast('Échec de l’export : ' + e.message, 'ko'); });
  }

  /* ------------------------------------------------------------------ */
  /* Événements (délégation)                                             */
  /* ------------------------------------------------------------------ */
  function rowItem(el) {
    var row = el.closest('[data-kind]');
    if (!row || !ctx) { return null; }
    if (row.getAttribute('data-kind') === 'doc') { return { el: row, it: ctx.items[+row.getAttribute('data-i')] }; }
    if (row.getAttribute('data-kind') === 'contrat') {
      var id = row.getAttribute('data-id');
      var c = ctx.contrats.filter(function (x) { return x.id === id; })[0];
      return { el: row, it: { rec: c, set: SET.contrat, base: null, q: c && c.q }, contrat: c };
    }
    return null;
  }

  root.addEventListener('change', function (e) {
    var el = e.target;
    if (el.type === 'file') { return; }
    var info = el.closest('[data-kind="info"]');
    if (info && el.getAttribute('data-k')) {                       // informations générales
      var k = el.getAttribute('data-k'), v = readValue(el), body = {};
      if (k === 'fsjd_name' && !v) { toast('Le nom est obligatoire', 'ko'); el.value = ctx.rec[k]; return; }
      body[k] = v;
      api.update(ctx.set, ctx.id, body).then(function () { ctx.rec[k] = v; toast('Enregistré'); },
        function (err) { toast('Échec de l’enregistrement : ' + err.message, 'ko'); });
      return;
    }
    var f = el.getAttribute('data-f'), ri = rowItem(el);
    if (!f || !ri) { return; }
    var val = readValue(el), patch = {}; patch[f] = val;
    if (ri.contrat) {
      patch.fsjd_modifiepar = USER.name;                                                // ligne de contrat
      api.update(SET.contrat, ri.contrat.id, patch).then(function () { ri.contrat[f] = val; toast('Enregistré'); if (f === 'fsjd_echeance') { render(true); } },
        function (err) { toast('Échec de l’enregistrement : ' + err.message, 'ko'); });
      return;
    }
    if (f === 'fsjd_statut') { ri.el.className = 'fsjd-row s-' + statutClass(val); }
    saveRow(ri.it, patch);
  });

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) { return; }
    var act = b.getAttribute('data-act');
    if (act === 'export') { exportCsv(); }
    else if (act === 'pick') {
      var ri = rowItem(b); if (!ri) { return; }
      var inp = document.createElement('input'); inp.type = 'file';
      inp.onchange = function () { if (inp.files[0]) { uploadFile(ri.it, inp.files[0], ri.el, !!ri.contrat); } };
      inp.click();
    }
    else if (act === 'addbat') {
      var name = window.prompt('Nom du nouveau bâtiment :');
      if (!name || !name.trim()) { return; }
      api.create(SET.batiment, { fsjd_name: name.trim(), 'fsjd_site@odata.bind': '/' + SET.site + '(' + ctx.id + ')' })
        .then(function (id) { location.hash = '#/batiment/' + id; }, function (err) { toast('Création impossible : ' + err.message, 'ko'); });
    }
    else if (act === 'addcontrat') {
      var fam = parseInt(b.getAttribute('data-fam'), 10);
      api.create(SET.contrat, { fsjd_name: label(FAMILLES, fam), fsjd_famille: fam, 'fsjd_site@odata.bind': ctx.base['fsjd_site@odata.bind'], 'fsjd_batiment@odata.bind': ctx.base['fsjd_batiment@odata.bind'] })
        .then(function (id) { ctx.contrats.push({ id: id, fsjd_famille: fam }); render(true); },
          function (err) { toast('Création impossible : ' + err.message, 'ko'); });
    }
    else if (act === 'delcontrat') {
      var r2 = rowItem(b);
      if (r2 && window.confirm('Supprimer ce contrat de l’inventaire ?')) {
        api.remove(SET.contrat, r2.contrat.id).then(function () {
          ctx.contrats = ctx.contrats.filter(function (c) { return c.id !== r2.contrat.id; }); render(true);
        }, function (err) { toast('Suppression impossible : ' + err.message, 'ko'); });
      }
    }
  });

  /* ------------------------------------------------------------------ */
  /* Routage par hash                                                      */
  /* ------------------------------------------------------------------ */
  function render(keepScroll) {
    var m = (location.hash || '#/').match(/^#\/(site|batiment)\/([0-9a-f-]{36})$/i), p;
    var y = window.pageYOffset;
    ctx = null;
    if (m) { p = m[1] === 'site' ? viewSite(m[2]) : viewBatiment(m[2]); } else { p = viewHome(); }
    p.then(function () { window.scrollTo(0, keepScroll === true ? y : 0); }).catch(function (e) {
      root.innerHTML = '<div class="fsjd-empty"><h2>Une erreur est survenue</h2><p>' + esc(e.message) + '</p><p><a href="#/">Retour à la liste</a></p></div>';
    });
  }
  window.addEventListener('hashchange', function () { render(); });
  render();
})();
