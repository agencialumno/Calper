# Falhas conhecidas da suíte e2e

Compare o resultado da suíte com esta lista em vez de rodar a main. Atualize quando mudar.

| Teste | Situação | Observação |
|---|---|---|
| `cores-escritura.spec.js:51` | falha sempre (também na main) | Dados dos testes compartilhados. Resolve com o PR de isolamento de dados (pendência). |
| `atendimento-direto.spec.js:44` | instável | Falha na main e às vezes passa. |
