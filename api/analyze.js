
const U='https://vhpqncvvzwoowhbmlkrm.supabase.co';
const K='sb_publishable_RQU1poSEx2EluMP7EOfWFg_QKwxtldb';
const send=(r,s,b)=>r.status(s).json(b);
async function rpc(name,body){const r=await fetch(`${U}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:K,Authorization:`Bearer ${K}`,'content-type':'application/json'},body:JSON.stringify(body)});return r.ok?await r.json():null}
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','content-type');
 if(req.method==='OPTIONS')return res.status(204).end();if(req.method!=='POST')return send(res,405,{error:'Método não permitido.'});
 const {codigo,senha,papel,equipe_nome,proposta,rubrica}=req.body||{};
 if(!codigo||!senha||!papel||!proposta)return send(res,400,{error:'Parâmetros obrigatórios ausentes.'});
 const prof=String(papel).toLowerCase()==='professor';
 const ok=await rpc(prof?'entrar_professor':'verificar_senha_aluno',prof?{p_codigo:codigo,p_senha_prof:senha}:{p_codigo:codigo,p_senha_aluno:senha});
 if(!ok)return send(res,403,{error:'Acesso à turma não autorizado.'});
 if(!process.env.OPENAI_API_KEY)return send(res,503,{error:'Análise por IA ainda não foi configurada no servidor.'});
 const prompt=`Você avalia propostas de um MBA imobiliário pela metodologia TESTE. Em português, avalie a proposta da equipe ${equipe_nome||'sem nome'}: apresente forças e fragilidades, duas recomendações priorizadas e termine exatamente com ÍNDICE DE SUCESSO: NN/100 — justificativa. Seja rigoroso e não invente fatos.\n\nPROPOSTA:\n${proposta}\n\nRUBRICA:\n${rubrica||'não disponível'}`;
 try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',temperature:.35,max_tokens:900,messages:[{role:'user',content:prompt}]})});if(!r.ok)return send(res,502,{error:`OpenAI retornou HTTP ${r.status}.`});const d=await r.json(),texto=d.choices?.[0]?.message?.content?.trim()||'',m=texto.match(/ÍNDICE DE SUCESSO:\s*(\d{1,3})/i);return send(res,200,{texto,indice:m?Number(m[1]):null})}catch{return send(res,502,{error:'Não foi possível obter a análise por IA.'})}
}
