/**
 * E2E smoke test da interface experimental do Painel Brasil.
 * Roda em Chrome headless no GitHub Actions. Não publica nem chama a API Claude.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:8000/lab.html';
const output = 'qa/screenshots';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [];

async function ready(page) {
  await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.locator('#status').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('#status')?.textContent?.includes('Consultando'), {timeout: 30000});
  const news = await page.locator('.story').count();
  assert.ok(news >= 1, 'Deve renderizar pelo menos uma notícia RSS');
}

try {
  await mkdir(output, { recursive: true });
  const desktop = await browser.newPage({ viewport: { width: 1365, height: 900 }, deviceScaleFactor: 1 });
  desktop.on('pageerror', e => errors.push('desktop: ' + String(e)));
  await ready(desktop);
  assert.ok((await desktop.locator('#itemCount').innerText()).trim().match(/^\d+$/));
  await desktop.screenshot({ path: output + '/desktop.png', fullPage: true });
  await desktop.locator('[data-view="eleicoes"]').click();
  const sectionTitle = await desktop.locator('#resultsTitle').innerText();
  assert.equal(sectionTitle, 'Eleições');
  const electionCategories = await desktop.locator('.story .tag').allInnerTexts();
  assert.ok(electionCategories.every(cat => cat.toLocaleLowerCase('pt-BR') === 'eleições'), 'Filtro Eleições deve isolar a editoria; categorias exibidas=' + JSON.stringify(electionCategories));
  await desktop.locator('#search').fill('assunto-inexistente-987654321');
  assert.equal(await desktop.locator('.story').count(), 0, 'Pesquisa vazia deve informar ausência');
  await desktop.locator('#search').fill('');
  await desktop.locator('[data-view="arquivo"]').click();
  assert.equal(await desktop.locator('#search').isDisabled(), true, 'Busca recente desativada no arquivo');
  const edition = desktop.getByRole('button', { name: /2026-10-21.*Edição HTML do Claude/ });
  await edition.click();
  const opened = edition.locator('..');
  const editionSearch = opened.locator('.archive-search input');
  await editionSearch.waitFor({ state: 'visible' });
  const countText = await opened.locator('.archive-list .archive-sub').last().innerText();
  assert.match(countText, /689 registros/, 'Arquivo da edição histórica deve abrir');
  await editionSearch.fill('Lula');
  const found = await opened.locator('.archive-list .story').count();
  assert.ok(found >= 1 && found <= 15, 'Pesquisa deve filtrar cards históricos');
  assert.match(await opened.locator('.archive-list .archive-sub').last().innerText(),
               /de 689 registros/, 'Exibir contagem dos resultados históricos');
  await desktop.screenshot({ path: output + '/arquivo.png', fullPage: true });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  mobile.on('pageerror', e => errors.push('mobile: ' + String(e)));
  await ready(mobile);
  const fits = await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 3);
  assert.equal(fits, true, 'Não pode haver rolagem horizontal na tela de celular');
  await mobile.screenshot({ path: output + '/celular.png', fullPage: true });
  await mobile.close();

  assert.deepEqual(errors, [], 'Navegação sem exceções de JavaScript');
  console.log('E2E aprovado: RSS, editorias, pesquisa, arquivo Claude, celular e capturas.');
} finally {
  await browser.close();
}
