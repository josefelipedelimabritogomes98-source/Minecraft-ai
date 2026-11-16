const fs = require('fs');
const { chromium } = require('playwright');

async function trabalhar() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('ERRO: GEMINI_API_KEY nao encontrada nos Secrets!');
    process.exit(1);
  }

  const promptBase = fs.readFileSync('prompt.txt', 'utf8');
  let codigoAtual = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : '';
  let relatorioVigilancia = 'Primeira execucao. Crie a estrutura base completa do jogo.';

  if (codigoAtual.length > 500) {
    console.log('Iniciando vigilancia no navegador...');
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 800, height: 360 }, isMobile: true });
    const page = await context.newPage();
    
    const erros = [];
    page.on('pageerror', err => erros.push('ERRO CRÍTICO JS: ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') erros.push('ERRO CONSOLE: ' + msg.text());
    });

    await page.goto('file://' + process.cwd() + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    try {
      const botoes = await page.locator('button').all();
      if (botoes.length > 0) await botoes.at(0).click({ timeout: 2000 });
      await page.waitForTimeout(3000);
    } catch (e) {}

    const temCanvas = await page.evaluate(() => document.querySelector('canvas') !== null);
    if (!temCanvas) erros.push('FALHA VISUAL: Nenhum elemento <canvas> WebGL foi renderizado na tela.');

    await browser.close();

    if (erros.length > 0) {
      relatorioVigilancia = 'ALERTA DA VIGILANCIA - CORRIJA ESTES BUGS IMEDIATAMENTE:\n' + erros.join('\n');
    } else {
      relatorioVigilancia = 'VIGILANCIA OK: Zero erros no console e Canvas 3D ativo. Continue adicionando os itens, texturas, mobs e menus que faltam.';
    }
    console.log(relatorioVigilancia);
  }

  const promptFinal = `${promptBase}\n\n=== RELATÓRIO DA VIGILÂNCIA ===\n${relatorioVigilancia}\n\n=== CÓDIGO ATUAL (index.html) ===\n${codigoAtual || 'Vazio. Comece do zero.'}`;

  // Tenta primeiro o modelo Pro e, se nao disponivel na chave, usa o Flash automaticamente
  const modelos = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  let textoGerado = '';

  for (const modelo of modelos) {
    console.log('Conectando ao modelo:', modelo);
    const url = 'https://googleapis.com' + modelo + ':generateContent?key=' + apiKey;
 
    const resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
      })
    });

    const textoBruto = await resposta.text();
    if (resposta.ok) {
      const dados = JSON.parse(textoBruto);
      textoGerado = dados?.candidates?.at(0)?.content?.parts?.at(0)?.text || '';
      if (textoGerado) {
        console.log('Sucesso com o modelo:', modelo);
        break;
      }
    } else {
      console.log(`Aviso no modelo ${modelo} (Status ${resposta.status}):`, textoBruto.slice(0, 300));
    }
  }

  if (!textoGerado) {
    console.error('Nenhum modelo respondeu. Verifique sua GEMINI_API_KEY.');
    process.exit(1);
  }

  let novoHtml = textoGerado.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

  if (novoHtml.includes('<!DOCTYPE html>') && novoHtml.includes('</html>')) {
    fs.writeFileSync('index.html', novoHtml);
    fs.writeFileSync('status_vigilancia.txt', `Ultima atualizacao: ${new Date().toISOString()}\nStatus: ${relatorioVigilancia}`);
    console.log('Novo index.html salvo com sucesso!');
  } else {
    console.log('Codigo veio incompleto, mantendo versao anterior.');
  }
}

trabalhar();
  
