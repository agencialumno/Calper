import { carregarDocumentoUnidade, enviarDocumentoUnidade } from '$lib/server/documentoUnidade.js';

export const load = ({ params, url }) => carregarDocumentoUnidade(params.id, 'termo', url);

export const actions = {
  enviar: (event) => enviarDocumentoUnidade(event, 'termo')
};
