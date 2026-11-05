// Atendimento da vistoria (Bloco 3). Isomórfico (servidor e navegador): regras de quem assina e rótulos do resultado.
// O status da vistoria é DERIVADO do agendamento (vistoriaResultado): nada é gravado em Unidade.vistoriaStatus/vistoriaAprovada.

export const TIPO_DOCUMENTO_VISTORIA = 'termo_vistoria';
export const NOME_DOCUMENTO_VISTORIA = 'Termo de Recebimento do Imóvel';
export const MAX_ASSINANTES = 6;

export const RESULTADO = { aceita: 'aceita', naoAceita: 'nao_aceita' };
export const ROTULO_RESULTADO = { aceita: 'Vistoria aceita', nao_aceita: 'Vistoria não aceita' };

/** Etiqueta do resultado de um agendamento de vistoria: "Vistoria aceita", "Vistoria não aceita" ou "Em andamento"/"Agendada". */
export function rotuloDaVistoria(ag) {
  // aceita só vale depois do termo assinado por todos (o agendamento vira "realizado"); antes disso ainda falta assinar
  if (ag.vistoriaResultado === RESULTADO.aceita && ag.status !== 'realizado') return 'Aceita — aguardando assinatura do termo';
  if (ag.vistoriaResultado && ROTULO_RESULTADO[ag.vistoriaResultado]) return ROTULO_RESULTADO[ag.vistoriaResultado];
  if (ag.status === 'cancelado') return 'Desmarcada';
  return ag.vistoriaPresentes?.length || ag.checkinEm ? 'Em andamento' : 'Agendada';
}

/** Rótulo da tentativa: a 1ª é "1ª vistoria"; as seguintes são revistorias ("Revistoria · 2ª vistoria"). */
export const rotuloDaTentativa = (numero) => (numero > 1 ? `Revistoria · ${numero}ª vistoria` : `${numero}ª vistoria`);

/** Lista de presentes gravada no agendamento, sempre como array. */
export const presentesDoAgendamento = (ag) => (Array.isArray(ag?.vistoriaPresentes) ? ag.vistoriaPresentes : []);

const ehProcurador = (p) => p.vinculo === 'procurador';

/**
 * Quem assina o Termo de Recebimento (a Calper assina à parte, pelo funcionário do atendimento):
 *  - todos os compradores marcados como presentes;
 *  - o procurador presente, se houver (a procuração dele é obrigatória, como na entrega de chaves);
 *  - sem comprador presente, o procurador assina sozinho;
 *  - sem comprador e sem procurador com procuração: bloqueia.
 * @param {{nome:string,email?:string,vinculo:string}[]} presentes
 * @param {{ procuracaoValida: boolean }} opcoes procuração anexada vale para o procurador presente
 * @returns {{ ok: true, signatarios: {nome:string,email:string,vinculo:string}[] } | { ok: false, erro: string }}
 */
export function signatariosDaVistoria(presentes, { procuracaoValida = false } = {}) {
  const lista = Array.isArray(presentes) ? presentes : [];
  const compradores = lista.filter((p) => !ehProcurador(p));
  const procurador = lista.find(ehProcurador) ?? null;

  if (compradores.length === 0 && !procurador) {
    return { ok: false, erro: 'Marque quem comparece: pelo menos um comprador ou um procurador com procuração.' };
  }
  if (procurador && !procuracaoValida) {
    return { ok: false, erro: 'Quem comparece é procurador: a procuração é obrigatória antes de seguir para o documento.' };
  }
  const signatarios = [...compradores, ...(procurador ? [procurador] : [])];
  if (signatarios.length > MAX_ASSINANTES) return { ok: false, erro: `No máximo ${MAX_ASSINANTES} pessoas assinam o termo.` };
  const semEmail = signatarios.find((p) => !String(p.email ?? '').trim());
  if (semEmail) return { ok: false, erro: `Informe o e-mail de ${semEmail.nome}: ele é usado na assinatura.` };
  const vistos = new Set();
  for (const p of signatarios) {
    const chave = String(p.email).trim().toLowerCase();
    if (vistos.has(chave)) return { ok: false, erro: 'Cada pessoa precisa de um e-mail diferente: cada uma recebe o próprio link de assinatura.' };
    vistos.add(chave);
  }
  return { ok: true, signatarios: signatarios.map((p) => ({ nome: p.nome, email: String(p.email).trim(), vinculo: p.vinculo })) };
}

/**
 * Pode abrir a revistoria? Só depois de "não aceita", e só se ainda não existe a vistoria seguinte (não cancelada).
 * @returns {string|null} o motivo do bloqueio, ou null se pode
 */
export function motivoSemRevistoria(ag, { existeProxima = false } = {}) {
  if (ag.status === 'cancelado') return 'o agendamento está cancelado';
  if (ag.vistoriaResultado !== RESULTADO.naoAceita) return 'a revistoria só abre depois de uma vistoria não aceita';
  if (existeProxima) return 'já existe uma revistoria aberta para esta unidade';
  return null;
}
