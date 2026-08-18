// ============================================================
// Edge Function: analyze
// Roda a análise de IA (Anthropic) com a CHAVE PROTEGIDA no servidor.
// O navegador do aluno NUNCA vê a chave.
//
// Fluxo:
//   1) recebe { codigo, senha, equipe_nome, proposta, rubrica }
//   2) valida a senha da turma via RPC (verificar_senha_aluno)
//   3) chama a Anthropic com a chave secreta (env ANTHROPIC_API_KEY)
//   4) devolve o parecer + índice de sucesso
//
// Secrets necessários (configurados via CLI, ver README):
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   (opcional) ANTHROPIC_MODEL  -> default abaixo
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-latest";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const body = await req.json();
    const { codigo, senha, equipe_nome, proposta, rubrica } = body ?? {};

    if (!codigo || !senha || !proposta) {
      return json({ error: "Parâmetros faltando (codigo, senha, proposta)." }, 400);
    }

    // 1) valida a senha da turma no banco (não gasta tokens à toa)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ok, error: rpcErr } = await supabase.rpc("verificar_senha_aluno", {
      p_codigo: codigo,
      p_senha_aluno: senha,
    });
    if (rpcErr) return json({ error: "Falha ao validar senha: " + rpcErr.message }, 500);
    if (!ok) return json({ error: "Senha da turma inválida." }, 403);

    // 2) chama a Anthropic com a chave secreta
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave da Anthropic não configurada no servidor." }, 500);

    const prompt =
      `Você é avaliador(a) de um MBA de inteligência de mercado e comportamento do consumidor ` +
      `no setor imobiliário. Avalie a proposta da equipe "${equipe_nome ?? "—"}", construída ` +
      `pela metodologia TESTE (Target, Explorar, Soluções, Testar, Escalar).\n\n` +
      `Entregue em português, objetivo:\n` +
      `1) Parecer (pontos fortes e fracos, 3-5 linhas);\n` +
      `2) Duas recomendações práticas;\n` +
      `3) Uma linha final: "ÍNDICE DE SUCESSO: NN/100 — justificativa".\n` +
      `Seja rigoroso e aponte incoerências entre público, solução e teste.\n\n` +
      `PROPOSTA:\n${proposta}\n\n` +
      (rubrica ? `Referência da rubrica automática: ${rubrica}.` : "");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `Anthropic HTTP ${resp.status}: ${t.slice(0, 300)}` }, 502);
    }

    const data = await resp.json();
    const texto = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const m = texto.match(/ÍNDICE DE SUCESSO:\s*(\d{1,3})/i);
    const indice = m ? Number(m[1]) : null;

    return json({ texto, indice });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
