# Metodologia TESTE — Guia de Publicação (Git → Vercel → Supabase)

Este guia leva a ferramenta do "modo local" para o ar, funcionando entre
vários dispositivos, com **painel do professor ao vivo** e **dados de aluno
protegidos** (LGPD). Siga na ordem.

> **Resumo do que cada peça faz**
> - **Vercel** hospeda o `index.html` (site estático).
> - **Supabase** guarda turmas, equipes e respostas, e protege os contatos.
> - A **senha da turma** controla quem entra (RLS no servidor).
> - A **Edge Function** roda a análise OpenAI sem expor a chave no navegador.

---

## Pré-requisitos
- Conta no **GitHub**, no **Vercel** e no **Supabase** (todas têm plano gratuito).
- Para a IA do aluno: a **CLI do Supabase** (passo 4). É opcional — o resto
  funciona sem ela.

---

## Passo 1 — Criar o projeto no Supabase e rodar o SQL
1. Em https://supabase.com → **New project**. Guarde a senha do banco.
2. No projeto, abra **SQL Editor** → **New query**.
3. Cole todo o conteúdo de **`schema.sql`** e clique **Run**.
   Isso cria as tabelas, tranca o acesso direto e cria as funções de acesso
   por senha.
4. Em **Project Settings → API**, copie:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public key** (uma chave longa)

> A `anon key` é **pública** de propósito — ela sozinha não abre nada, porque
> as tabelas estão trancadas e todo acesso exige a **senha da turma**.

---

## Passo 2 — Configurar o `index.html`
Abra o `index.html` e, no início do `<script>`, localize o bloco `CONFIG`:

```js
const CONFIG={useSupabase:false,supabaseUrl:'',supabaseAnonKey:'', ...};
```

Troque para:

```js
const CONFIG={useSupabase:true,
  supabaseUrl:'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey:'SUA_ANON_KEY',
  aiEvalEndpoint:'',pisoEtapa:60,pisoGeral:60};
```

E confirme que a linha do SDK do Supabase está **descomentada** no `<head>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

---

## Passo 3 — Subir no GitHub e publicar no Vercel
1. Crie um repositório no GitHub e envie os arquivos (pelo site ou por linha de comando):
   ```bash
   git init
   git add index.html
   git commit -m "Metodologia TESTE"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```
2. Em https://vercel.com → **Add New… → Project** → importe o repositório.
3. Framework: **Other**. Não precisa de build. Clique **Deploy**.
4. Ao final, o Vercel te dá uma URL pública (ex.: `sua-turma.vercel.app`).
   É esse link que você compartilha com a turma.

> Para atualizar o site depois, basta dar `git push` — o Vercel republica sozinho.

---

## Passo 4 — IA segura via Edge Function
Este passo ativa a análise por IA para **alunos e professor(a)** sem expor
nenhuma chave no navegador. A interface chama apenas a função segura no
Supabase, que valida a senha da turma antes de consultar a OpenAI.

**4.1 Instalar a CLI do Supabase** (uma vez):
- **Mac:** `brew install supabase/tap/supabase`
- **Windows:** `scoop install supabase` (ou baixe o instalador no GitHub do Supabase)
- **Linux:** veja as instruções em https://supabase.com/docs/guides/cli

**4.2 Conectar ao seu projeto:**
```bash
supabase login
supabase link --project-ref SEU_REF
```
> O `SEU_REF` é o trecho da URL do projeto (ex.: em `https://abcd1234.supabase.co`, o ref é `abcd1234`).

**4.3 Guardar a chave OpenAI como secret** (nunca no código):
```bash
supabase secrets set OPENAI_API_KEY=sua_chave_openai
# opcional: modelo econômico e adequado para pareceres curtos
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` normalmente já ficam disponíveis
> para a função; se necessário, defina-os também com `supabase secrets set`.

**4.4 Publicar a função** (a pasta `supabase/functions/analyze` já está no pacote):
```bash
supabase functions deploy analyze
```

Pronto. No diagnóstico do aluno e no painel docente aparece o botão **"Analisar
com IA"**, que chama essa função. A chave OpenAI **nunca** vai para o navegador.

---

## Como usar no dia da oficina
1. **Professor:** abra o site, aba **Professor(a)**. Para **criar** a turma,
   deixe o código vazio e defina **senha do professor** e **senha dos alunos**.
   Anote o código gerado e a senha dos alunos.
2. **Alunos:** abrem o mesmo site, aba **Aluno(a)**, e entram com **código +
   senha da turma + nome da equipe + seus dados**. Qualquer membro entra com o
   mesmo código/senha e todos compartilham o trabalho.
3. **Painel ao vivo:** o dashboard do professor atualiza sozinho (a cada ~4s),
   prioriza as equipes que precisam de intervenção e permite encerrar/reabrir
   um dossiê individualmente.
4. **Banca simulada:** a equipe pode abrir **Apresentar ao comitê** no diagnóstico;
   o professor também acessa a mesma visão pelo botão **Comitê** do cartão da equipe.

---

## Segurança e LGPD (leia)
- Os **contatos dos alunos** (telefone, e-mail) só são acessíveis com a **senha
  do professor**. As tabelas ficam trancadas; todo acesso passa por funções que
  checam a senha no servidor.
- A **senha da turma protege contra acesso casual**. Como parte do código roda
  no navegador, ela dificulta, mas não é um cofre militar — troque a senha se
  suspeitar de vazamento (o professor pode trocar quando quiser).
- **Finalidade dos dados:** use apenas para a dinâmica da disciplina. Ao final,
  se não precisar mais dos contatos, apague os dados da turma no Supabase
  (tabela `equipes`), cumprindo a minimização da LGPD.
- **Chave de IA:** mantenha a chave OpenAI exclusivamente como segredo da Edge
  Function. Nunca cole uma chave em `index.html`, GitHub ou no painel visível.

---

## Solução de problemas
- **"Senha da turma inválida"** no login do aluno → confira a senha com o professor.
- **Dashboard vazio** → verifique se `CONFIG.useSupabase` está `true`, se a URL
  e a `anon key` estão corretas e se o `schema.sql` foi executado.
- **IA falha** → confirme `supabase functions deploy analyze` e o secret
  `OPENAI_API_KEY`. Erros de modelo podem ser resolvidos ajustando `OPENAI_MODEL`.
- **Encerramento não funciona** → execute novamente o `schema.sql` atualizado;
  ele cria a função segura `definir_bloqueio_equipe` e impede edições após o bloqueio.
