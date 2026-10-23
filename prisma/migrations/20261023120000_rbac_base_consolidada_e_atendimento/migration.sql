-- Migração ADITIVA (compatível com a versão anterior do app, que continua no ar até o deploy):
-- só acrescenta colunas/relaxa restrições. Nada é removido: as colunas "financiado" e "grupoFinanciamento"
-- de Unidade deixam de ser usadas pelo código, mas continuam no banco (a versão antiga ainda lê) e podem ser
-- apagadas numa limpeza posterior, depois do deploy. A conversão dos perfis da equipe NÃO está aqui de propósito:
-- ela roda depois do deploy (scripts/migrar-perfis.js), senão a versão antiga barraria quem virar supervisor/colaborador.

-- Funcionario: novo padrão de perfil; foto de perfil em tabela própria (nunca lida junto com a sessão)
ALTER TABLE "Funcionario" ALTER COLUMN "perfil" SET DEFAULT 'colaborador';

CREATE TABLE "FuncionarioFoto" (
    "funcionarioId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuncionarioFoto_pkey" PRIMARY KEY ("funcionarioId")
);

ALTER TABLE "FuncionarioFoto" ADD CONSTRAINT "FuncionarioFoto_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SessaoFuncionario: última atividade (usuários logados agora)
ALTER TABLE "SessaoFuncionario" ADD COLUMN     "ultimaAtividadeEm" TIMESTAMP(3);

-- Unidade: dados da base consolidada do Murano
ALTER TABLE "Unidade" ADD COLUMN     "statusVenda" TEXT,
ADD COLUMN     "dataVenda" TIMESTAMP(3),
ADD COLUMN     "vencidoPago" DOUBLE PRECISION,
ADD COLUMN     "vencidoNaoPago" DOUBLE PRECISION,
ADD COLUMN     "saldoVincendo" DOUBLE PRECISION,
ADD COLUMN     "faseEscritura" TEXT,
ADD COLUMN     "escriturada" TEXT,
ADD COLUMN     "dataEscritura" TIMESTAMP(3),
ADD COLUMN     "escrituraAtual" TEXT,
ADD COLUMN     "escrituraALavrar" TEXT;

-- Agendamento: observações do atendimento presencial
ALTER TABLE "Agendamento" ADD COLUMN     "observacoesAtendimento" TEXT;

-- DocumentoAssinado: sobrevive à exclusão do agendamento (fica ligado à unidade)
ALTER TABLE "DocumentoAssinado" ADD COLUMN     "unidadeId" TEXT;
UPDATE "DocumentoAssinado" d SET "unidadeId" = a."unidadeId" FROM "Agendamento" a WHERE a."id" = d."agendamentoId";
ALTER TABLE "DocumentoAssinado" ALTER COLUMN "agendamentoId" DROP NOT NULL;
ALTER TABLE "DocumentoAssinado" DROP CONSTRAINT "DocumentoAssinado_agendamentoId_fkey";
ALTER TABLE "DocumentoAssinado" ADD CONSTRAINT "DocumentoAssinado_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentoAssinado" ADD CONSTRAINT "DocumentoAssinado_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DocumentoAssinado_unidadeId_idx" ON "DocumentoAssinado"("unidadeId");
