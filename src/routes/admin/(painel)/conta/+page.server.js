import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha, verificarSenha } from '$lib/server/auth.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { senhaAceitavel } from '$lib/password.js';
import { ROTULO_PERFIL } from '$lib/perfis.js';
import { TAMANHO_MAXIMO_FOTO, lerFotoDePerfil } from '$lib/server/fotoPerfil.js';

// "Minha conta": qualquer perfil logado troca a PRÓPRIA senha e a PRÓPRIA foto.

export function load({ locals }) {
  const f = locals.funcionario;
  return {
    conta: { id: f.id, nome: f.nome, email: f.email, perfil: f.perfil, rotuloPerfil: ROTULO_PERFIL[f.perfil], fotoVersao: f.fotoVersao },
    fotoMaximoMb: TAMANHO_MAXIMO_FOTO / (1024 * 1024)
  };
}

export const actions = {
  trocarSenha: async (event) => {
    const { request, locals } = event;
    const form = await request.formData();
    const atual = String(form.get('senhaAtual') ?? '');
    const nova = String(form.get('novaSenha') ?? '');
    const confirmar = String(form.get('confirmarSenha') ?? '');

    const funcionario = await db.funcionario.findUnique({ where: { id: locals.funcionario.id } });
    if (!funcionario || !verificarSenha(atual, funcionario.senhaHash)) {
      await registrarLog({
        event,
        atorTipo: 'funcionario',
        acao: 'senha_alteracao_falhou',
        descricao: `${rotuloFuncionario(locals.funcionario)} tentou trocar a senha e errou a senha atual`,
        entidadeTipo: 'Funcionario',
        entidadeId: locals.funcionario.id
      });
      return fail(400, { erroSenha: 'A senha atual está incorreta.' });
    }
    if (!senhaAceitavel(nova)) {
      return fail(400, {
        erroSenha: 'A nova senha precisa ter pelo menos 8 caracteres e atingir o nível "forte" (maiúscula, minúscula, número e caractere especial).'
      });
    }
    if (nova !== confirmar) return fail(400, { erroSenha: 'As senhas novas não coincidem.' });
    if (nova === atual) return fail(400, { erroSenha: 'A nova senha precisa ser diferente da atual.' });

    await db.funcionario.update({ where: { id: funcionario.id }, data: { senhaHash: hashSenha(nova) } });
    // por segurança, derruba as OUTRAS sessões desta conta (a atual continua)
    await db.sessaoFuncionario.deleteMany({ where: { funcionarioId: funcionario.id, id: { not: locals.staffSessionToken ?? '' } } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'senha_alterada',
      descricao: `${rotuloFuncionario(locals.funcionario)} trocou a própria senha`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    return { sucesso: 'Senha alterada. As outras sessões desta conta foram encerradas.' };
  },

  enviarFoto: async (event) => {
    const { request, locals } = event;
    const form = await request.formData();
    let dataUrl;
    try {
      dataUrl = await lerFotoDePerfil(form.get('foto'));
    } catch (err) {
      return fail(400, { erroFoto: err.message });
    }
    await db.funcionarioFoto.upsert({
      where: { funcionarioId: locals.funcionario.id },
      update: { dataUrl },
      create: { funcionarioId: locals.funcionario.id, dataUrl }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'foto_perfil_alterada',
      descricao: `${rotuloFuncionario(locals.funcionario)} atualizou a própria foto de perfil`,
      entidadeTipo: 'Funcionario',
      entidadeId: locals.funcionario.id
    });
    return { sucessoFoto: 'Foto atualizada.' };
  },

  removerFoto: async (event) => {
    await event.locals.funcionario;
    await db.funcionarioFoto.deleteMany({ where: { funcionarioId: event.locals.funcionario.id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'foto_perfil_removida',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} removeu a própria foto de perfil`,
      entidadeTipo: 'Funcionario',
      entidadeId: event.locals.funcionario.id
    });
    return { sucessoFoto: 'Foto removida.' };
  }
};
