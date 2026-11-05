# Regras permanentes

- O sistema está em uso com dados reais. Não altere o que já existe sem perguntar. Reaproveite funções existentes, com mudanças aditivas e compatíveis. Os testes existentes devem passar sem edição.
- Nunca apague dados. Sem DELETE em produção e sem rodar scripts de limpeza.
- Migrations só aditivas (colunas novas com valor padrão). Nunca aplique migration nem rode nada em produção sem avisar, fazer dump novo e esperar autorização.
- Ordem para subir migration: dump novo → aplicar migration em produção (com autorização) → só então merge na main.
- Testes só em `schema=calper_test` e DocuSign demo. Nenhum envelope de teste na conta de produção.
- O preview da Vercel usa o banco de produção: não use preview para testar código com migration pendente. Teste localmente.
- Nenhum arquivo .xlsx, .pdf, dump, .env ou chave vai para o git.
- Sempre branch nova a partir da main atualizada, PR para a main, sem push direto.
- Durante o desenvolvimento rode só os testes do que mudou; a suíte completa uma vez no fim de cada PR.
- Respostas curtas: resultado, decisões e pendências, sem colar logs.
- Comece conversas com a Skill caveman ativada.
- Falha na suíte: rode de novo só com --last-failed antes de rodar tudo.
- Compare falhas com tests/FALHAS-CONHECIDAS.md em vez de rodar a main. Atualize o arquivo quando mudar.
- Suíte completa com --workers=1, uma única vez, no fim do PR.
