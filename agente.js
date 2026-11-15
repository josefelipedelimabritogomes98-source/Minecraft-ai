const fs = require('fs');
const { chromium } = require('playwright');

async function trabalhar() {
  const apiKey = process.env.GEMINI_API_KEY;
  const promptBase = fs.readFileSync('prompt.txt', 'utf8');
  let codigoAtual = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : '';
  let relatorioVigilancia = 'Primeira execucao. Crie a estrutura base completa do jogo.';

  // === SISTEMA DE VIGILÂNCIA (TESTA O JOGO ANTES DE MANDAR PARA A IA) ===
  if (codigoAtual.length > 500) {
    console.log('Iniciando vigilancia no navegador...');
    const browser = await chromium.launch();
    // Simula a tela e memoria de um celular antigo
    const context = await browser.newContext({ viewport: { width: 800, height: 360 }, isMobile: true });
    const page = await context.newPage();
    
    const erros = [];
    page.on('pageerror', err => erros.push('ERRO CRÍTICO JS: ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') erros.push('ERRO CONSOLE: ' + msg.text());
    });

    await page.goto('file://' + process.cwd() + '/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Tenta clicar no botao de Jogar para testar se o mundo 3D abre sem travar
    try {
      const botoes = await page.locator('button').all();
      if (botoes.length > 0) await botoes[0].click({ timeout: 2000 });
      await page.waitForTimeout(3000);
    } catch (e) {}

    // Verifica se o canvas 3D foi criado na tela
    const temCanvas = await page.evaluate(() => document.querySelector('canvas') !== null);
    if (!temCanvas) erros.push('FALHA VISUAL: Nenhum elemento <canvas> WebGL foi renderizado na tela.');

    await browser.close();

    if (erros.length > 0) {
      relatorioVigilancia = 'ALERTA DA VIGILANCIA - CORRIJA ESTES BUGS IMEDIATAMENTE:\n' + erros.join('\n');
    } else {
      relatorioVigilancia = 'VIGILANCIA OK: Zero erros no console e Canvas 3D ativo. Agora adicione os itens, texturas, mobs ou menus que ainda faltam na lista obrigatória.';
    }
    console.log(relatorioVigilancia);
  }

  // === ENVIA PARA A IA PROGRAMAR / CORRIGIR ===
  const promptFinal = `${promptBase}\n\n=== RELATÓRIO DA VIGILÂNCIA ===\n${relatorioVigilancia}\n\n=== CÓDIGO ATUAL (index.html) ===\n${codigoAtual || 'Vazio. Comece do zero.'}`;

  const resposta = await fetch(`https://googleapis.com{apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptFinal }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 65536 }
    })
  });

  const dados = await resposta.json();
  if (!dados.candidates || !dados.candidates[0]) {
    console.error('Erro na API:', JSON.stringify(dados));
    process.exit(1);
  }

  let novoHtml = dados.candidates[0].content.parts[0].text;
  // Limpa marcacoes de markdown caso a IA envie
  novoHtml = novoHtml.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

  if (novoHtml.includes('<!DOCTYPE html>') && novoHtml.includes('</html>')) {
    fs.writeFileSync('index.html', novoHtml);
    fs.writeFileSync('status_vigilancia.txt', `Ultima atualizacao: ${new Date().toISOString()}\nStatus: ${relatorioVigilancia}`);
    console.log('Novo index.html salvo com sucesso!');
  } else {
    console.log('Codigo veio incompleto, mantendo versao anterior para nao quebrar o jogo.');
  }
}

trabalhar();
    
