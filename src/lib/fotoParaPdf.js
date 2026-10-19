import { PDFDocument } from 'pdf-lib';

// Converte fotos (câmera do iPad/celular) em um PDF, no navegador: cada foto vira uma página A4.
// Existe para a procuração do atendimento só aceitar documento (PDF/DOC/DOCX) sem afrouxar a
// validação para imagem solta. A foto é reduzida antes (celular gera 5–12 MB; o limite do envio é 4 MB).

const A4 = { largura: 595.28, altura: 841.89 };
const LADO_MAXIMO_PX = 1800;
const QUALIDADE_JPEG = 0.8;

async function fotoParaJpeg(arquivo) {
  // createImageBitmap respeita a orientação EXIF das fotos tiradas em pé/deitado
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
  if (!blob) throw new Error('Não foi possível processar a foto.');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), largura: canvas.width, altura: canvas.height };
}

/** Junta as fotos (na ordem) em um PDF de uma página por foto e devolve como File application/pdf. */
export async function fotosParaPdf(fotos, nomeArquivo = 'procuracao.pdf') {
  if (!fotos.length) throw new Error('Nenhuma foto para converter.');
  const pdf = await PDFDocument.create();
  for (const foto of fotos) {
    const { bytes, largura, altura } = await fotoParaJpeg(foto);
    const imagem = await pdf.embedJpg(bytes);
    // página A4 (retrato ou paisagem, conforme a foto) com a imagem ocupando a página inteira
    const paisagem = largura > altura;
    const pagina = pdf.addPage(paisagem ? [A4.altura, A4.largura] : [A4.largura, A4.altura]);
    const { width: pw, height: ph } = pagina.getSize();
    const escala = Math.min(pw / largura, ph / altura);
    const w = largura * escala;
    const h = altura * escala;
    pagina.drawImage(imagem, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  const bytes = await pdf.save();
  return new File([bytes], nomeArquivo, { type: 'application/pdf' });
}
