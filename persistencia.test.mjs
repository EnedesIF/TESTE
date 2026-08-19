import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const camposDeContexto = [
  'nomeProduto', 'conceito', 'tipoProduto', 'totalUnidades', 'metragem', 'areaLazer',
  'servicosFacilidades', 'praca', 'estagio', 'ticket', 'vgv', 'vso', 'concorrentes',
];

assert.match(html, /#page2 input,#page2 textarea,#page2 select/, 'A coleta deve incluir todos os campos de contexto.');
assert.match(html, /Object\.keys\(gameData\)\.forEach/, 'A restauração deve percorrer todas as chaves persistidas.');
assert.match(html, /studentDataHydrated=false/, 'A sessão deve iniciar sem autorização para sobrescrever o servidor.');
assert.match(html, /if\(!studentDataHydrated\)return/, 'O salvamento deve aguardar a hidratação do dossiê remoto.');
assert.match(html, /if\(supa&&currentClassPass\)\{resumeStudentFromServer\(\);\}/, 'Uma sessão Supabase deve buscar o dossiê remoto antes de abrir a atividade.');

for (const campo of camposDeContexto) {
  assert.match(html, new RegExp(`id="${campo}"`), `Campo de contexto ausente: ${campo}`);
}

console.log(`Persistência estática validada: ${camposDeContexto.length} campos de contexto, hidratação remota e bloqueio contra sobrescrita local.`);
