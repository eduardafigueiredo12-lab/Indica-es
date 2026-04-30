# Formulário de Indicação de Campo - UniFatecie

Projeto separado do Gerador de Termo de Convênio.

## Como rodar

```powershell
npm.cmd start
```

No Windows, você também pode abrir `iniciar-formulario.cmd`.

Acesse:

```text
http://localhost:3000
```

## Integração com a planilha

O formulário envia os dados para:

```text
POST /api/indicacoes
```

Para gravar na planilha do SharePoint, crie um fluxo no Power Automate com o gatilho `Quando uma solicitação HTTP for recebida` e uma ação `Adicionar uma linha em uma tabela` do Excel Online (Business).

Configure no ambiente do servidor:

```text
INDICACOES_WEBHOOK_URL=https://...
```

A aba `Indicações` precisa estar formatada como tabela no Excel.

## Colunas enviadas

- Trim
- Data indicação
- Aluno
- Curso
- Local indicado
- Cidade
- Estado
- E-mail
- Telefone/WhatsApp
- Responsável do local
- Responsável p/ contato
- Prazo 1º contato
- Data 1º contato
- Prazo 2º contato
- Data 2º contato
- Prazo 3º contato
- Data 3º contato
- Convênio firmado
- Link p/ Download
- Observações
