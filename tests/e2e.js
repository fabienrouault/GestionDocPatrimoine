// Test de bout en bout de l'application contre le faux serveur. Lancer : node tests/e2e.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os');
const srv = require('./mock_server');
(async () => {
  const s = await srv.start(); const base = `http://localhost:${s.address().port}/inventaire/`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const pg = await b.newPage({ acceptDownloads: true }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Bâtiment B' : undefined));
  await pg.goto(base);
  await pg.waitForSelector('.fsjd-site');
  assert.equal(await pg.locator('.fsjd-card h2').count(), 2, 'deux territoires');
  assert.equal(await pg.locator('.fsjd-site').count(), 3);
  // fiche site + info
  await pg.locator('.fsjd-site', { hasText: 'Saint Barthélemy' }).click();
  await pg.waitForSelector('.fsjd-row');
  await pg.fill('#f_fsjd_adresse', '72 Av. Claude Monet'); await pg.locator('#f_fsjd_adresse').blur();
  await pg.fill('#f_fsjd_anneeacquisition', '1998'); await pg.locator('#f_fsjd_anneeacquisition').blur();
  await pg.waitForTimeout(200);
  assert.equal(srv.db.fsjd_sites[0].fsjd_adresse, '72 Av. Claude Monet'); assert.strictEqual(srv.db.fsjd_sites[0].fsjd_anneeacquisition, 1998);
  assert.equal(await pg.locator('.fsjd-row:not(.fsjd-row-h)').count(), 11, '11 documents site');
  // statut -> création paresseuse
  const row = pg.locator('.fsjd-row:not(.fsjd-row-h)').first();
  await row.locator('[data-f=fsjd_statut]').selectOption('100000002'); await pg.waitForTimeout(200);
  assert.equal(srv.db.fsjd_documentinventaires.length, 1);
  const d = srv.db.fsjd_documentinventaires[0];
  assert.equal(d._fsjd_site_value, srv.db.fsjd_sites[0].fsjd_siteid); assert.equal(d.fsjd_statut, 100000002);
  await row.locator('[data-f=fsjd_commentaire]').fill('À rechercher aux archives'); await row.locator('[data-f=fsjd_commentaire]').blur(); await pg.waitForTimeout(200);
  assert.equal(srv.db.fsjd_documentinventaires.length, 1, 'pas de doublon'); assert.equal(d.fsjd_commentaire, 'À rechercher aux archives');
  // dépôt fichier
  const f = path.join(os.tmpdir(), 'acte.pdf'); fs.writeFileSync(f, 'PDF-test');
  const second = pg.locator('.fsjd-row:not(.fsjd-row-h)').nth(1);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), second.locator('[data-act=pick]').click()]);
  await fc.setFiles(f); await pg.waitForTimeout(400);
  const d2 = srv.db.fsjd_documentinventaires[1];
  assert.equal(d2.fsjd_fichier_name, 'acte.pdf'); assert.equal(d2.fsjd_statut, 100000000, 'statut auto = disponible');
  assert.equal(await second.locator('[data-f=fsjd_statut]').inputValue(), '100000000');
  // refus d'extension
  fs.writeFileSync(path.join(os.tmpdir(), 'x.exe'), 'x');
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), second.locator('[data-act=pick]').click()]);
  await fc2.setFiles(path.join(os.tmpdir(), 'x.exe')); await pg.waitForTimeout(200);
  assert.ok(await pg.locator('#fsjd-toast.ko').count(), 'toast erreur extension');
  // bâtiment
  await pg.locator('.fsjd-bat', { hasText: 'Bâtiment A' }).click();
  await pg.waitForSelector('h1:has-text("Bâtiment A")');
  assert.equal(await pg.locator('.fsjd-row:not(.fsjd-row-h)').count(), 46, '46 documents bâtiment');
  await pg.locator('details[data-fam="100000005"] summary').click();
  await pg.locator('[data-act=addcontrat][data-fam="100000005"]').click(); await pg.waitForSelector('.fsjd-contrat');
  const c = pg.locator('.fsjd-contrat').first();
  await c.locator('[data-f=fsjd_fournisseur]').fill('Dalkia'); await c.locator('[data-f=fsjd_fournisseur]').blur();
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  await c.locator('[data-f=fsjd_echeance]').fill(soon); await c.locator('[data-f=fsjd_echeance]').blur();
  await pg.waitForSelector('.fsjd-contrat em.warn');
  assert.equal(srv.db.fsjd_contrats[0].fsjd_fournisseur, 'Dalkia'); assert.equal(srv.db.fsjd_contrats[0].fsjd_famille, 100000005);
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser'), pg.locator('.fsjd-contrat [data-act=pick]').click()]);
  await fc3.setFiles(f); await pg.waitForTimeout(400);
  assert.equal(srv.db.fsjd_contrats[0].fsjd_fichier_name, 'acte.pdf');
  // ajout bâtiment depuis la fiche site
  await pg.goto(base + '#/site/' + srv.db.fsjd_sites[0].fsjd_siteid); await pg.waitForSelector('[data-act=addbat]');
  await pg.click('[data-act=addbat]'); await pg.waitForSelector('h1:has-text("Bâtiment B")');
  assert.equal(srv.db.fsjd_batiments.length, 2);
  // accueil : avancement + export
  await pg.goto(base + '#/'); await pg.waitForSelector('.fsjd-site');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-act=export]')]);
  const out = fs.readFileSync(await dl.path(), 'utf8');
  assert.ok(out.includes('Centre Saint Barthélemy') && out.includes('À rechercher aux archives') && out.includes('Bâtiment B'));
  assert.equal(out.trim().split('\r\n').length, 1 + (11 + 46 * 2) + 11 + 11 + 0 - 0 + 0, 'lignes export');
  await pg.screenshot({ path: path.join(os.tmpdir(), 'home.png'), fullPage: true });
  assert.deepEqual(errs, []);
  console.log('E2E OK —', srv.log.length, 'appels API'); await b.close(); s.close();
})().catch(e => { console.error('ÉCHEC', e); process.exit(1); });
