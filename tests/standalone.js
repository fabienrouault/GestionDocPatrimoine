// Test de bout en bout de standalone/Inventaire_Patrimoine.html. Lancer : node tests/standalone.js
// La page est servie en http://127.0.0.1 avec un showDirectoryPicker remplacé par un dossier OPFS
// (vrai FileSystemDirectoryHandle), ce qui permet de vérifier les fichiers écrits sans sélecteur natif.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('assert'), fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'standalone', 'Inventaire_Patrimoine.html'), 'utf8');
// Dossier simulé en mémoire (même interface que FileSystemDirectoryHandle). L'OPFS de Chromium headless ne convient
// pas : il ignore les répertoires dont le nom contient des accents.
const SHIM = `<script>(function () {
  function nf(n) { return new DOMException(n + ' introuvable', 'NotFoundError'); }
  function mkFile(name) {
    var blob = new Blob([]), lm = 0;
    return { kind: 'file', name: name,
      getFile: async function () { return new File([blob], name, { lastModified: lm }); },
      createWritable: async function () { var parts = []; return { write: async function (d) { parts.push(d); }, close: async function () { blob = new Blob(parts); lm = Math.max(Date.now(), lm + 1); } }; } };
  }
  function mkDir(name) {
    var kids = new Map();
    function get(kind, mk) { return async function (n, o) { var h = kids.get(n); if (!h) { if (!(o && o.create)) { throw nf(n); } h = mk(n); kids.set(n, h); } if (h.kind !== kind) { throw new DOMException(n, 'TypeMismatchError'); } return h; }; }
    return { kind: 'directory', name: name, _kids: kids,
      getDirectoryHandle: get('directory', mkDir), getFileHandle: get('file', mkFile),
      removeEntry: async function (n) { var h = kids.get(n); if (!h) { throw nf(n); } if (h.kind === 'directory' && h._kids.size) { throw new DOMException(n, 'InvalidModificationError'); } kids.delete(n); },
      entries: async function* () { for (var e of Array.from(kids)) { yield e; } },
      keys: async function* () { for (var k of Array.from(kids.keys())) { yield k; } },
      values: async function* () { for (var v of Array.from(kids.values())) { yield v; } },
      queryPermission: async function () { return 'granted'; }, requestPermission: async function () { return 'granted'; } };
  }
  window.__root = mkDir('audit');
  window.showDirectoryPicker = async function () { return window.__root; };
})();</script>`;
(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(HTML.replace('<head>', '<head>' + SHIM)); }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/Inventaire_Patrimoine.html`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const ctx = await b.newContext({ acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const answers = [];
  pg.on('dialog', d => d.accept(d.type() === 'prompt' ? (answers.shift() ?? '') : undefined));
  const opfs = (p) => pg.evaluate(async (p) => {
    let d = window.__root;
    const a = p.split('/'); for (const x of a.slice(0, -1)) d = await d.getDirectoryHandle(x);
    return await (await (await d.getFileHandle(a[a.length - 1])).getFile()).text();
  }, p);
  const ls = () => pg.evaluate(async () => {
    const out = []; async function walk(d, pre) { for await (const [n, h] of d.entries()) { if (h.kind === 'file') out.push(pre + n); else await walk(h, pre + n + '/'); } }
    await walk(window.__root, ''); return out.sort();
  });
  const data = async () => { await pg.evaluate(() => FSJD_TEST.flush()); return JSON.parse(await opfs('inventaire-donnees.json')); };

  await pg.goto(base);
  await pg.click('text=Choisir le dossier de l’inventaire…');
  await pg.waitForSelector('text=Aucun établissement');
  assert.deepEqual(await ls(), ['inventaire-donnees.json']);

  // établissement + nom de l'utilisateur
  answers.push('Résidence Saint-Jean / Lyon', 'Rhône-Alpes', 'Jean Dupont');
  await pg.click('text=+ Ajouter un établissement');
  await pg.waitForSelector('.row[data-doc]');
  assert.equal(await pg.locator('.row[data-doc]').count(), 11, '11 documents site');
  await pg.fill('#f_etab_adresse', '1 rue de la Paix'); await pg.locator('#f_etab_adresse').blur();
  await pg.fill('#f_etab_annee_acquisition', '1998'); await pg.locator('#f_etab_annee_acquisition').blur();
  let d = await data(); const eid = Object.keys(d.etablissements)[0];
  assert.equal(d.etablissements[eid].adresse, '1 rue de la Paix'); assert.strictEqual(d.etablissements[eid].annee_acquisition, 1998);
  assert.equal(d.etablissements[eid].modifie_par, 'Jean Dupont');

  // statut + commentaire d'un document du site
  const r1 = pg.locator('.row[data-doc=S01]');
  await r1.locator('[data-f=statut]').selectOption('Manquant');
  await pg.locator('.row[data-doc=S01] [data-f=commentaire]').fill('Aux archives'); await pg.locator('.row[data-doc=S01] [data-f=commentaire]').blur();
  d = await data(); assert.equal(d.documents[eid + '|S01'].statut, 'Manquant'); assert.equal(d.documents[eid + '|S01'].commentaire, 'Aux archives');

  // pièce jointe → statut Disponible automatique + rangement
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-')); const pdf = path.join(tmp, 'Plan masse 2020.pdf'); fs.writeFileSync(pdf, '%PDF-1.4 test');
  const ch = pg.waitForEvent('filechooser'); await pg.locator('.row[data-doc=S04] [data-act=attach]').click(); (await ch).setFiles(pdf);
  await pg.waitForSelector('.row[data-doc=S04] .f');
  d = await data();
  const f1 = d.documents[eid + '|S04'].fichiers[0];
  assert.equal(d.documents[eid + '|S04'].statut, 'Disponible');
  assert.equal(f1.chemin, 'fichiers/Résidence Saint-Jean - Lyon/_Site/PLN - Plans/04 - Plan masse/Plan masse 2020.pdf');
  assert.equal(await opfs(f1.chemin), '%PDF-1.4 test');
  // même nom → suffixe (2)
  const ch2 = pg.waitForEvent('filechooser'); await pg.locator('.row[data-doc=S04] [data-act=attach]').click(); (await ch2).setFiles(pdf);
  await pg.waitForSelector('.row[data-doc=S04] .f >> nth=1');
  d = await data(); assert.match(d.documents[eid + '|S04'].fichiers[1].chemin, /Plan masse 2020 \(2\)\.pdf$/);

  // filtre
  await pg.selectOption('#flt', 'ko');
  assert.equal(await pg.locator('.row[data-doc]:not(.hidden)').count(), 1);
  await pg.selectOption('#flt', 'all');

  // bâtiment + document + contrat
  answers.push('Bâtiment A');
  await pg.click('text=+ Ajouter un bâtiment');
  await pg.waitForSelector('.row[data-doc=B01]');
  assert.equal(await pg.locator('.row[data-doc]').count(), 46);
  const ch3 = pg.waitForEvent('filechooser'); await pg.locator('.row[data-doc=B23] [data-act=attach]').click(); (await ch3).setFiles(pdf);
  await pg.waitForSelector('.row[data-doc=B23] .f');
  await pg.locator('details:has([data-fam=gaz]) > summary').click();
  await pg.locator('[data-act=add-contrat][data-fam=gaz]').click();
  await pg.waitForSelector('.contrat');
  await pg.fill('.contrat [data-cf=fournisseur]', 'Engie'); await pg.locator('.contrat [data-cf=fournisseur]').blur();
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await pg.fill('.contrat [data-cf=echeance]', soon); await pg.locator('.contrat [data-cf=echeance]').blur();
  await pg.waitForSelector('.contrat em.warn');
  const ch4 = pg.waitForEvent('filechooser'); await pg.locator('.contrat [data-act=attach]').click(); (await ch4).setFiles(pdf);
  await pg.waitForSelector('.contrat .f');
  d = await data(); const bid = Object.keys(d.batiments)[0], c = Object.values(d.contrats)[0];
  assert.equal(c.fournisseur, 'Engie'); assert.equal(c.famille, 'gaz');
  assert.equal(c.fichiers[0].chemin, 'fichiers/Résidence Saint-Jean - Lyon/Bâtiment A/Contrats/Énergie/Gaz/Plan masse 2020.pdf');
  assert.match(d.documents[bid + '|B23'].fichiers[0].chemin, /Bâtiment A\/DIA - Diagnostics du bâtiment\/23 - Diagnostic Amiante\//);

  // renommage du bâtiment → fichiers déplacés
  await pg.fill('#f_bat_nom', 'Bâtiment Nord'); await pg.locator('#f_bat_nom').blur();
  await pg.waitForSelector('#toast:has-text("Fichiers rangés")');
  d = await data();
  const files = await ls();
  assert.ok(!files.some(f => f.includes('Bâtiment A/')), 'ancien dossier vidé : ' + files.join('\n'));
  assert.ok(files.includes(c.fichiers[0].chemin.replace('Bâtiment A', 'Bâtiment Nord')), files.join('\n'));

  // document hors liste
  answers.push('Audit énergétique 2024');
  await pg.click('text=+ Ajouter un document hors liste');
  await pg.waitForSelector('.row:has-text("Audit énergétique 2024")');
  assert.equal(await pg.locator('.row[data-doc]').count(), 47);

  // accueil : alerte d'échéance, carte établissement
  await pg.click('nav.crumb >> text=Établissements');
  await pg.waitForSelector('.site');
  assert.ok(await pg.locator('text=Échéances de contrats à surveiller').isVisible());
  assert.ok(await pg.locator('.site em.ko', { hasText: '1 manquant' }).isVisible());

  // modification externe du fichier → reprise silencieuse (rien en attente)
  await pg.evaluate(() => FSJD_TEST.flush());
  await pg.evaluate(async () => {
    const dir = window.__root;
    const fh = await dir.getFileHandle('inventaire-donnees.json'); const j = JSON.parse(await (await fh.getFile()).text());
    Object.values(j.etablissements)[0].adresse = 'Modifiée ailleurs';
    const w = await fh.createWritable(); await w.write(JSON.stringify(j)); await w.close();
  });
  await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
  await pg.waitForFunction(() => Object.values(FSJD_TEST.db.etablissements)[0].adresse === 'Modifiée ailleurs');
  // modification externe + saisie locale en attente → conflit
  await pg.evaluate(id => { location.hash = '#/etab/' + id; }, eid); await pg.waitForSelector('#f_etab_adresse');
  await pg.evaluate(async () => {
    const dir = window.__root;
    const fh = await dir.getFileHandle('inventaire-donnees.json'); const j = JSON.parse(await (await fh.getFile()).text());
    j.modifie_le = 'autre poste'; const w = await fh.createWritable(); await w.write(JSON.stringify(j)); await w.close();
  });
  await pg.fill('#f_etab_adresse', 'Saisie locale'); await pg.locator('#f_etab_adresse').blur();
  await pg.waitForSelector('#banner.ko');
  await pg.click('text=Garder ma version');
  await pg.waitForFunction(() => !document.querySelector('#banner.ko'));
  d = await data(); assert.equal(d.etablissements[eid].adresse, 'Saisie locale');
  assert.ok((await ls()).some(f => /^sauvegardes\/inventaire-donnees-externe-/.test(f)), 'copie de la version externe');
  assert.ok((await ls()).some(f => /^sauvegardes\/inventaire-donnees-\d{4}-\d{2}-\d{2}\.json$/.test(f)), 'sauvegarde du jour');

  // export .zip
  const dl = pg.waitForEvent('download'); await pg.click('#btn-zip');
  const zipPath = path.join(tmp, 'export.zip'); await (await dl).saveAs(zipPath);
  const { execSync } = require('child_process');
  const listing = execSync(`python3 -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('\\n'.join(z.namelist()))" ${zipPath}`).toString();
  assert.match(listing, /Inventaire_patrimoine_\d{4}-\d{2}-\d{2}\/inventaire-donnees\.json/);
  assert.match(listing, /\/fichiers\/Résidence Saint-Jean - Lyon\/Bâtiment Nord\/Contrats\/Énergie\/Gaz\/Plan masse 2020\.pdf/);
  assert.match(listing, /synthese_documents\.csv/); assert.match(listing, /Inventaire_Patrimoine\.html/);
  const nbZip = listing.trim().split('\n').length;

  // import de l'archive dans un dossier vierge (nouveau profil)
  const ctx2 = await b.newContext(); const pg2 = await ctx2.newPage();
  pg2.on('pageerror', e => errs.push(e.message)); pg2.on('dialog', d => d.accept('Marie Martin'));
  await pg2.goto(base); await pg2.click('text=Choisir le dossier de l’inventaire…'); await pg2.waitForSelector('text=Aucun établissement');
  await pg2.click('#menu summary');
  const ch5 = pg2.waitForEvent('filechooser'); await pg2.click('text=Importer un inventaire (.zip)…'); (await ch5).setFiles(zipPath);
  await pg2.waitForSelector('.site');
  await pg2.evaluate(() => FSJD_TEST.flush());
  const imported = await pg2.evaluate(() => FSJD_TEST.db);
  assert.equal(Object.keys(imported.batiments).length, 1); assert.equal(Object.keys(imported.contrats).length, 1);
  await pg2.evaluate(id => { location.hash = '#/bat/' + id; }, bid); await pg2.waitForSelector('.contrat .f');
  const pop = pg2.waitForEvent('popup'); await pg2.locator('.contrat .f a').click(); await pop;
  const files2 = await pg2.evaluate(async () => { const out = []; async function walk(d, pre) { for await (const [n, h] of d.entries()) { if (h.kind === 'file') out.push(pre + n); else await walk(h, pre + n + '/'); } } await walk(window.__root, ''); return out; });
  assert.equal(files2.filter(f => f.startsWith('fichiers/')).length, 4, 'les 4 fichiers importés');
  // suppression d'un fichier → corbeille
  await pg.evaluate(id => { location.hash = '#/etab/' + id; }, eid); await pg.waitForSelector('.row[data-doc=S04] .f');
  await pg.locator('.row[data-doc=S04] [data-act=detach]').first().click();
  await pg.waitForFunction(() => FSJD_TEST.db.documents[Object.keys(FSJD_TEST.db.etablissements)[0] + '|S04'].fichiers.length === 1);
  assert.ok((await ls()).some(f => f.startsWith('corbeille/') && f.endsWith('Plan masse 2020.pdf')));

  // réouverture du dossier : la 1re écriture de la session garde l'état précédent dans .backup.json
  await pg.evaluate(() => FSJD_TEST.connect(window.__root));
  await pg.evaluate(id => { location.hash = '#/etab/' + id; }, eid); await pg.waitForSelector('#f_etab_adresse');
  await pg.fill('#f_etab_adresse', 'Après réouverture'); await pg.locator('#f_etab_adresse').blur();
  await data();
  assert.equal(JSON.parse(await opfs('inventaire-donnees.backup.json')).etablissements[eid].adresse, 'Saisie locale');
  if (process.env.SHOTS) {
    await pg.setViewportSize({ width: 1366, height: 900 });
    await pg.screenshot({ path: path.join(process.env.SHOTS, 'etab.png'), fullPage: false });
    await pg.evaluate(id => { location.hash = '#/bat/' + id; }, bid); await pg.waitForSelector('.contrat');
    await pg.locator('.contrat').scrollIntoViewIfNeeded(); await pg.screenshot({ path: path.join(process.env.SHOTS, 'bat.png') });
    await pg.evaluate(() => { location.hash = '#/'; }); await pg.waitForSelector('.site'); await pg.screenshot({ path: path.join(process.env.SHOTS, 'home.png') });
    await pg2.close(); const p3 = await ctx2.newPage(); await p3.goto(base); await p3.waitForSelector('.welcome'); await p3.screenshot({ path: path.join(process.env.SHOTS, 'welcome.png') });
  }
  assert.deepEqual(errs, [], 'aucune erreur JavaScript');
  console.log('OK — archive de ' + nbZip + ' entrées, ' + (await ls()).length + ' fichiers dans le dossier');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
