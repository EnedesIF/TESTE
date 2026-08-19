import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

assert.match(html, /function stepCompletion\(step\)/, 'A interface deve calcular pendências obrigatórias por etapa.');
assert.match(html, /function requestLock\(\)/, 'A equipe deve poder solicitar o encerramento ao professor.');
assert.match(html, /function applyLockedState\(\)/, 'A interface deve desabilitar edição quando o dossiê estiver encerrado.');
assert.match(html, /function openCommitteePresentation\(\)/, 'A apresentação executiva deve estar disponível no diagnóstico.');
assert.match(schema, /bloqueado_em\s+timestamptz/, 'O banco precisa registrar o encerramento no servidor.');
assert.match(schema, /definir_bloqueio_equipe/, 'O professor precisa controlar o bloqueio por RPC.');
assert.match(schema, /DOSSIER_ENCERRADO/, 'O servidor deve rejeitar salvamento posterior ao encerramento.');

console.log('Entrega controlada e apresentação executiva: estrutura validada.');
