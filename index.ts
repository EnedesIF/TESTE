import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { codigo, senha, papel, equipe_nome, proposta, rubrica } = await req.json();
    if (!codigo || !senha || !proposta) return json({ error: "Parâmetros obrigatórios ausentes." }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const isTeacher = papel === "professor";
    const auth = await supabase.rpc(isTeacher ? "entrar_professor" : "verificar_senha_aluno", isTeacher
      ? { p_codigo: codigo, p_senha_prof: senha }
      : { p_codigo: codigo, p_senha_aluno: senha });
    if (auth.error || !auth.data) return json({ error: "Acesso à turma não autorizado." }, 403);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Chave OpenAI não configurada no servidor." }, 500);

    const prompt = `Você é avaliador(a) de um MBA de inteligência de mercado e comportamento do consumidor no setor imobiliário. Avalie a proposta da equipe "${equipe_nome ?? "—"}", construída pela metodologia TESTE (Target, Explorar, Soluções, Testar, Escalar).

Escreva em português, de forma objetiva:
1) Parecer com pontos fortes e fracos (3–5 linhas);
2) Duas recomendações práticas e priorizadas;
3) Uma linha final exatamente no formato: ÍNDICE DE SUCESSO: NN/100 — justificativa.
Seja rigoroso quanto à coerência entre público, solução, hipótese e teste.

PROPOSTA:
${proposta}

REFERÊNCIA DA RUBRICA AUTOMÁTICA: ${rubrica ?? "não disponível"}.`;

    const openai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!openai.ok) return json({ error: `OpenAI HTTP ${openai.status}: ${(await openai.text()).slice(0, 300)}` }, 502);
    const payload = await openai.json();
    const texto = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const match = texto.match(/ÍNDICE DE SUCESSO:\s*(\d{1,3})/i);
    return json({ texto, indice: match ? Number(match[1]) : null });
  } catch (error) {
    return json({ error: String(error instanceof Error ? error.message : error) }, 500);
  }
});
