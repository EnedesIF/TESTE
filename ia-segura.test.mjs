import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../api/analyze.js', import.meta.url), 'utf8');

assert.doesNotMatch(html, /api\.anthropic\.com/, 'A interface não deve chamar provedores de IA diretamente.');
assert.doesNotMatch(html, /localStorage\.setItem\('anthropicKey'/, 'A interface não deve persistir chave de IA no navegador.');
assert.match(html, /api\/analyze/, 'A interface deve chamar a rota segura do servidor.');
assert.match(server, /process\.env\.OPENAI_API_KEY/, 'A chave OpenAI deve ser lida somente no servidor.');
assert.match(server, /verificar_senha_aluno/, 'A função deve validar acesso de aluno.');
assert.match(server, /entrar_professor/, 'A função deve validar acesso de professor.');
assert.doesNotMatch(server, /sk-proj-|sk-ant-/, 'Nenhuma chave pode ser versionada no código.');

console.log('Integração de IA segura: cliente sem chave e Edge Function OpenAI validada.');
