import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*\/\* ============================ CONFIG[\s\S]*?<\/script>/)?.[0]
  .replace(/^<script>|<\/script>$/g, '');

assert.ok(script, 'O script principal da aplicação deve estar presente.');
new Function(script);
assert.match(html, /const cards=STEPS\.map/, 'O radar do aluno deve construir seus cartões de etapa antes de renderizá-los.');
assert.match(html, /Prioridades de intervenção docente/, 'O painel deve indicar equipes que pedem intervenção.');
assert.match(html, /function toggleTeamLock/, 'O professor deve poder encerrar ou reabrir dossiês.');
assert.match(html, /function openTeamPresentation/, 'O professor deve abrir a apresentação de uma equipe.');
assert.match(html, /Comitê de decisão · Metodologia TESTE/, 'A apresentação executiva deve identificar o contexto de banca.');

console.log('Interface avançada: sintaxe, intervenção docente e apresentação executiva validadas.');
