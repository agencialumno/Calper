// Foto de perfil da equipe: só imagem (JPG, PNG ou WEBP), no máximo 2 MB. O tipo é conferido pelos primeiros
// bytes do arquivo (não pelo nome nem pelo tipo informado pelo navegador).
export const TAMANHO_MAXIMO_FOTO = 2 * 1024 * 1024;

const ASSINATURAS = [
  { tipo: 'image/jpeg', confere: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: 'image/png', confere: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    tipo: 'image/webp',
    confere: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'
  }
];

/** Valida o arquivo do formulário e devolve a foto como data URL, ou lança Error com a mensagem pro usuário. */
export async function lerFotoDePerfil(arquivo) {
  if (!arquivo || typeof arquivo === 'string' || arquivo.size === 0) throw new Error('Escolha uma imagem para a foto de perfil.');
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) {
    const mb = (arquivo.size / (1024 * 1024)).toFixed(1).replace('.', ',');
    throw new Error(`A foto tem ${mb} MB; o tamanho máximo é ${TAMANHO_MAXIMO_FOTO / (1024 * 1024)} MB. Escolha uma imagem menor.`);
  }
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const formato = ASSINATURAS.find((a) => a.confere(buffer));
  if (!formato) throw new Error('O arquivo precisa ser uma imagem JPG, PNG ou WEBP.');
  return `data:${formato.tipo};base64,${buffer.toString('base64')}`;
}
