import { prepararBancoDeTeste } from '../preparar-banco-teste.js';

export default async function globalSetup() {
  await prepararBancoDeTeste();
}
