-- ============================================================
-- Metodologia TESTE — Schema Supabase (tabelas + RLS + RPC)
-- Cole este arquivo inteiro no editor SQL do Supabase e rode.
-- ------------------------------------------------------------
-- MODELO DE SEGURANÇA (leia isto):
-- A chave "anon" do Supabase fica exposta no navegador (é normal).
-- Por isso as TABELAS ficam TRANCADAS para o papel anônimo:
-- ninguém acessa as tabelas direto. Todo acesso passa por FUNÇÕES
-- (RPC) que checam a SENHA da turma no servidor antes de fazer
-- qualquer coisa. Assim, telefone/e-mail de uma equipe não vazam
-- para outra, mesmo com a chave pública em mãos.
-- Há DUAS senhas por turma:
--   * senha_aluno  -> alunos entram e salvam o próprio trabalho
--   * senha_prof   -> professor vê todas as equipes e os contatos
-- ============================================================

create extension if not exists pgcrypto;

-- ---------------------- TABELAS ----------------------
create table if not exists public.turmas (
  codigo        text primary key,
  nome          text not null default '',
  senha_aluno   text not null,          -- hash (bcrypt via crypt())
  senha_prof    text not null,          -- hash (bcrypt via crypt())
  criado_em     timestamptz not null default now()
);

create table if not exists public.equipes (
  turma         text not null references public.turmas(codigo) on delete cascade,
  equipe_id     text not null,
  equipe_nome   text not null default '',
  membros       jsonb not null default '[]'::jsonb,   -- [{nome,tel,email}]
  etapa         int  not null default 0,
  completo      boolean not null default false,
  score         int  not null default 0,
  dados         jsonb not null default '{}'::jsonb,    -- gameData completo
  atualizado_em timestamptz not null default now(),
  primary key (turma, equipe_id)
);

-- ---------------------- RLS: TRANCA TUDO ----------------------
-- Habilita RLS e NÃO cria nenhuma policy permissiva:
-- o papel anônimo não consegue select/insert/update/delete direto.
alter table public.turmas  enable row level security;
alter table public.equipes enable row level security;

revoke all on public.turmas  from anon, authenticated;
revoke all on public.equipes from anon, authenticated;

-- ---------------------- FUNÇÕES (RPC) ----------------------
-- Todas são SECURITY DEFINER: rodam com privilégio elevado e são
-- a ÚNICA porta de entrada. Cada uma valida a senha primeiro.

-- Cria turma (falha se já existir). Retorna o código.
create or replace function public.criar_turma(
  p_codigo text, p_nome text, p_senha_aluno text, p_senha_prof text
) returns text
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from turmas where codigo = upper(p_codigo)) then
    raise exception 'TURMA_EXISTE';
  end if;
  insert into turmas(codigo, nome, senha_aluno, senha_prof)
  values (upper(p_codigo), coalesce(p_nome,''),
          crypt(p_senha_aluno, gen_salt('bf')),
          crypt(p_senha_prof , gen_salt('bf')));
  return upper(p_codigo);
end $$;

-- Professor entra: valida senha_prof. Retorna nome da turma.
create or replace function public.entrar_professor(
  p_codigo text, p_senha_prof text
) returns text
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  select nome into v_nome from turmas
   where codigo = upper(p_codigo) and senha_prof = crypt(p_senha_prof, senha_prof);
  if v_nome is null then raise exception 'SENHA_INVALIDA'; end if;
  return v_nome;
end $$;

-- Professor troca as senhas: exige senha_prof atual.
create or replace function public.trocar_senhas(
  p_codigo text, p_senha_prof_atual text,
  p_nova_aluno text, p_nova_prof text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from turmas
      where codigo = upper(p_codigo) and senha_prof = crypt(p_senha_prof_atual, senha_prof)) then
    raise exception 'SENHA_INVALIDA';
  end if;
  update turmas set
    senha_aluno = case when coalesce(p_nova_aluno,'')<>'' then crypt(p_nova_aluno, gen_salt('bf')) else senha_aluno end,
    senha_prof  = case when coalesce(p_nova_prof ,'')<>'' then crypt(p_nova_prof , gen_salt('bf')) else senha_prof  end
  where codigo = upper(p_codigo);
end $$;

-- Aluno entra/junta-se à equipe: valida senha_aluno, cria a equipe se
-- não existir, adiciona/atualiza o membro (por e-mail) e devolve a
-- equipe (com os dados já salvos, para retomar em qualquer aparelho).
create or replace function public.entrar_equipe(
  p_codigo text, p_senha_aluno text,
  p_equipe_id text, p_equipe_nome text, p_membro jsonb
) returns public.equipes
language plpgsql security definer set search_path = public as $$
declare v_row public.equipes; v_membros jsonb; v_email text;
begin
  if not exists (select 1 from turmas
      where codigo = upper(p_codigo) and senha_aluno = crypt(p_senha_aluno, senha_aluno)) then
    raise exception 'SENHA_INVALIDA';
  end if;

  select * into v_row from equipes where turma=upper(p_codigo) and equipe_id=p_equipe_id;
  if not found then
    insert into equipes(turma, equipe_id, equipe_nome, membros)
    values (upper(p_codigo), p_equipe_id, coalesce(p_equipe_nome,''),
            case when p_membro is null then '[]'::jsonb else jsonb_build_array(p_membro) end)
    returning * into v_row;
    return v_row;
  end if;

  -- equipe existe: adiciona/atualiza o membro por e-mail
  if p_membro is not null then
    v_email := lower(coalesce(p_membro->>'email',''));
    select coalesce(jsonb_agg(m),'[]'::jsonb) into v_membros
      from jsonb_array_elements(v_row.membros) m
      where lower(coalesce(m->>'email','')) <> v_email;
    v_membros := v_membros || jsonb_build_array(p_membro);
    update equipes set membros=v_membros, equipe_nome=coalesce(p_equipe_nome,equipe_nome),
                       atualizado_em=now()
      where turma=upper(p_codigo) and equipe_id=p_equipe_id
      returning * into v_row;
  end if;
  return v_row;
end $$;

-- Aluno salva o trabalho da equipe (valida senha_aluno).
create or replace function public.salvar_equipe(
  p_codigo text, p_senha_aluno text, p_equipe_id text,
  p_etapa int, p_completo boolean, p_score int, p_dados jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from turmas
      where codigo = upper(p_codigo) and senha_aluno = crypt(p_senha_aluno, senha_aluno)) then
    raise exception 'SENHA_INVALIDA';
  end if;
  update equipes set etapa=p_etapa, completo=p_completo, score=p_score,
                     dados=coalesce(p_dados,'{}'::jsonb), atualizado_em=now()
    where turma=upper(p_codigo) and equipe_id=p_equipe_id;
  if not found then raise exception 'EQUIPE_NAO_ENCONTRADA'; end if;
end $$;

-- Aluno carrega a própria equipe (retomar em outro aparelho).
create or replace function public.carregar_equipe(
  p_codigo text, p_senha_aluno text, p_equipe_id text
) returns public.equipes
language plpgsql security definer set search_path = public as $$
declare v_row public.equipes;
begin
  if not exists (select 1 from turmas
      where codigo = upper(p_codigo) and senha_aluno = crypt(p_senha_aluno, senha_aluno)) then
    raise exception 'SENHA_INVALIDA';
  end if;
  select * into v_row from equipes where turma=upper(p_codigo) and equipe_id=p_equipe_id;
  return v_row;
end $$;

-- Professor lista TODAS as equipes (com contatos) — exige senha_prof.
create or replace function public.listar_equipes_prof(
  p_codigo text, p_senha_prof text
) returns setof public.equipes
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from turmas
      where codigo = upper(p_codigo) and senha_prof = crypt(p_senha_prof, senha_prof)) then
    raise exception 'SENHA_INVALIDA';
  end if;
  return query select * from equipes where turma=upper(p_codigo) order by score desc;
end $$;

-- Verifica senha do aluno (usada pela Edge Function da IA).
create or replace function public.verificar_senha_aluno(
  p_codigo text, p_senha_aluno text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  return exists (select 1 from turmas
    where codigo = upper(p_codigo) and senha_aluno = crypt(p_senha_aluno, senha_aluno));
end $$;

-- Permissões: o papel anônimo só pode EXECUTAR as funções.
grant execute on function
  public.criar_turma(text,text,text,text),
  public.entrar_professor(text,text),
  public.trocar_senhas(text,text,text,text),
  public.entrar_equipe(text,text,text,text,jsonb),
  public.salvar_equipe(text,text,text,int,boolean,int,jsonb),
  public.carregar_equipe(text,text,text),
  public.listar_equipes_prof(text,text),
  public.verificar_senha_aluno(text,text)
to anon, authenticated;

-- ============================================================
-- FIM. Nada de dados sensíveis é acessível sem a senha correta.
-- ============================================================
