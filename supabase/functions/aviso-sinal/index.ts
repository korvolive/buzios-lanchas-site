// Búzios Lanchas: aviso de sinal pago ao administrador (Rodrigo 2026-11-13: WhatsApp e e-mail).
// POST { id: <pedido>, email?: false }  com a sessão do operador (a VPS) ou do administrador.
// Manda o e-mail aos administradores (só se o pagamento tiver menos de 6 horas; a VPS chama uma vez por pagamento)
// e devolve { emails, info } com forma, valor e quem trouxe, que a VPS usa no aviso do WhatsApp
// (o operador não lê pagamentos_asaas nem a rpc origem_reserva).
// E-mail pelo mesmo caminho do notificar: modelo "Magic Link" do Supabase com user_metadata.msg/assunto.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const dataBR = (d: string) => d.split("-").reverse().join("/");
const brl = (v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const HOR: Record<string, string> = { manha: "10h às 14h", tarde: "14h às 18h", dia: "10h às 17h", noite: "noite" };
const hm = (x: string) => { const [h, m] = x.split(":").map(Number); return h + "h" + (m ? String(m).padStart(2, "0") : ""); };
const QUEM: Record<string, (n: string) => string> = { vendedor: n => n ? `vendedor ${n}` : "vendedor", parceiro: n => n ? `parceiro ${n}` : "parceiro", lucas: () => "Lucas, pelo WhatsApp", dono: n => n ? `dono da lancha ${n}` : "dono da lancha", painel: () => "painel da Búzios Lanchas", site: () => "site, cliente direto" };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "método" }, 405);
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const uid = (await db.auth.getUser(token)).data?.user?.id;
    if (!uid) return json({ erro: "sem sessão" }, 401);
    const admin = !!(await db.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
    const op = (await db.from("papeis_painel").select("papel").eq("user_id", uid).maybeSingle()).data?.papel === "operador";
    if (!admin && !op) return json({ erro: "sem acesso" }, 403);

    const corpo = await req.json().catch(() => ({}));
    const id = Number(corpo.id);
    if (!(id > 0)) return json({ erro: "id" }, 400);
    const { data: pd } = await db.from("pedidos").select("id, cliente, lancha, data, horario, pessoas, bloqueio_id, repasse_dono, hora_ini, hora_fim").eq("id", id).maybeSingle();
    if (!pd) return json({ erro: "pedido não encontrado" }, 404);
    const pa = (await db.from("pagamentos_asaas").select("metodo, valor, pago_em, wallet_id").eq("pedido", id).not("pago_em", "is", null).order("pago_em", { ascending: false }).limit(1).maybeSingle()).data;
    const pp = pa ? null : (await db.from("pagamentos_pp").select("pago_em, pago_valor").eq("pedido", id).not("pago_em", "is", null).maybeSingle()).data;
    const pagoEm = pa?.pago_em || pp?.pago_em;
    if (!pagoEm) return json({ erro: "sem pagamento" }, 404);

    const an = pd.bloqueio_id ? (await db.from("anotacoes").select("cliente, pessoas, hora_ini, hora_fim").eq("bloqueio_id", pd.bloqueio_id).maybeSingle()).data : null;
    const cli = String((await db.from("clientes").select("nome").eq("user_id", pd.cliente).maybeSingle()).data?.nome || an?.cliente || "").trim();
    const lancha = (await db.from("lanchas").select("nome").eq("slug", pd.lancha).maybeSingle()).data?.nome || pd.lancha;
    const hi = an?.hora_ini || pd.hora_ini, hf = an?.hora_fim || pd.hora_fim;
    const horario = hi && hf ? `${hm(String(hi))} às ${hm(String(hf))}` : HOR[pd.horario] || pd.horario;
    let o: any = null;
    try { const r = await db.rpc("origem_reserva", { p_pedido: pd.id, ...(pd.bloqueio_id ? { p_bloqueio: pd.bloqueio_id } : {}) }); o = r.data; } catch (_) { o = null; }
    const quem = o?.tipo && QUEM[o.tipo] ? QUEM[o.tipo](String(o.nome || "").trim()) : "";
    const info = {
      pedido: pd.id, cliente: cli, lancha, data: pd.data, horario, pessoas: an?.pessoas || pd.pessoas || null,
      valor: pa ? brl(pa.valor) : String(pp?.pago_valor || ""), forma: pa ? (pa.metodo === "cartao" ? "cartão" : "Pix") : "PayPal",
      repasse: +pd.repasse_dono > 0 ? brl(pd.repasse_dono) : "", sem_conta_dono: !!pa && !pa.wallet_id && +pd.repasse_dono > 0, quem, pago_em: pagoEm,
    };
    if (corpo.email === false || Date.now() - Date.parse(pagoEm) > 6 * 3600 * 1000) return json({ emails: 0, info });

    const linhas = [`Cliente: ${cli}`, `Data: ${dataBR(pd.data)}`, `Horário: ${horario}`, ...(info.pessoas ? [`Pessoas: ${info.pessoas}`] : []),
      `Valor pago: ${info.valor} por ${info.forma}`, ...(info.repasse ? [`Parte do dono: ${info.repasse}${info.sem_conta_dono ? " (fica no saldo dele até a conta no Asaas ser aprovada)" : ""}`] : []),
      ...(quem ? [`Quem trouxe: ${quem}`] : [])];
    const assunto = `Sinal pago: ${lancha} · ${dataBR(pd.data)}${cli ? " · " + cli : ""}`;
    const { data: ads } = await db.from("admins").select("user_id");
    let emails = 0;
    for (const a of ads || []) {
      const u = (await db.auth.admin.getUserById(a.user_id)).data?.user;
      if (!u?.email || !u.email_confirmed_at || /@sem-email\.lanchaembuzios\.com\.br$/.test(u.email)) continue;
      const meta = { ...(u.user_metadata || {}) };
      const primeiro = String(meta.nome || meta.full_name || "").trim().split(" ")[0];
      const msg = { lang: "pt", oi: primeiro ? `Olá, ${primeiro}!` : "Olá!", texto: `Sinal pago: ${lancha}.`, linhas, nota: "A reserva já está confirmada e o cliente recebeu o recibo.", botao: "Abrir as reservas" };
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg, assunto } });
      const { error } = await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: "https://www.lanchaembuzios.com.br/login/" } });
      await db.auth.admin.updateUserById(u.id, { user_metadata: { ...meta, msg: null, assunto: null } });
      if (error) console.error("email", error.message); else emails++;
    }
    return json({ emails, info });
  } catch (e) {
    console.error(e);
    return json({ erro: "falhou" }, 500);
  }
});
