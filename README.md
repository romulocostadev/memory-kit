# Memory Kit

Conecta o Claude à memória da sua empresa (um servidor [ai-memory](https://github.com/akitaonrails/ai-memory)).
Com ele você pode:

- **guardar um documento** (contrato, proposta, e-mail, spec, ata): ele vira fonte na unidade certa e as decisões,
  regras e fatos dele viram rascunhos para aprovação;
- **propor** uma decisão, regra, armadilha, procedimento ou fato no meio da conversa;
- **perguntar** sobre clientes, contratos, projetos e decisões, com a página de onde veio a resposta.

Nada entra na memória oficial sem aprovação: o que você manda vira rascunho, e quem aprova decide.

## Antes de começar

Você precisa do **convite** que recebeu em mensagem privada. Ele é uma linha longa que começa com `aimkit1.`.

- O convite é **pessoal e secreto**: quem tem o convite age como você na memória. Não encaminhe.
- Perdeu ou vazou? Peça um novo; o antigo deixa de funcionar.

Baixe os arquivos da [última versão](https://github.com/romulocostadev/memory-kit/releases/latest).

## Claude Desktop (Windows ou Mac)

1. Baixe `memory-kit.mcpb` e abra o arquivo (dois cliques). O Claude Desktop mostra a extensão **Memory Kit**:
   clique em **Instalar**.
2. Quando pedir o **Convite**, cole a linha `aimkit1.…` inteira e salve. Ela fica no cofre de senhas do sistema
   (Gerenciador de Credenciais no Windows, Chaves no Mac).
3. Baixe os quatro arquivos de skill: `memory-ingest.zip`, `memory-propose.zip`, `memory-ask.zip` e
   `memory-review.zip` (este último só para quem aprova). Em **Configurações**, na área de **Skills**, envie cada zip.
4. Abra uma conversa nova e pergunte: *"quem sou eu na memória da empresa?"*. O Claude deve responder com o seu nome e
   as unidades em que você trabalha.

Não precisa instalar Node nem nada além do Claude Desktop.

## Claude Code

### Windows

1. Baixe `install.ps1`.
2. Copie o convite (Ctrl+C) e rode, no PowerShell:

   ```powershell
   powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\install.ps1"
   ```

   O instalador lê o convite da área de transferência (ou pergunta, sem mostrar na tela).
3. No fim aparece `ready: <seu usuário> on <empresa>`. Reinicie o Claude Code.

Não precisa de permissão de administrador.

### Mac

1. Baixe `install.sh`.
2. Copie o convite (Cmd+C) e rode, no Terminal:

   ```sh
   sh ~/Downloads/install.sh
   ```

   Precisa do `python3` (se faltar, o Mac oferece instalar com `xcode-select --install`).
3. No fim aparece `ready: <seu usuário> on <empresa>`. Reinicie o Claude Code.

### O que o instalador faz

- registra o servidor da empresa no Claude Code (`<empresa>-memory`);
- instala as quatro skills em `~/.claude/skills/`;
- guarda a sua chave em `~/.claude/memory-kit/`, legível só pelo seu usuário;
- liga a **captura de sessões** só nas pastas que têm um arquivo `.ai-memory.toml` da empresa (os repositórios da
  empresa já vêm com ele). Sessões em projetos pessoais ou de outras empresas **nunca** são enviadas.

## Como usar

Fale normalmente com o Claude:

| Você quer | Diga, por exemplo |
|---|---|
| Guardar um documento | "guarda esse contrato" (anexando o arquivo) |
| Propor uma decisão | "anota isso como decisão: …" |
| Registrar uma armadilha | "registra esse gotcha" |
| Perguntar | "o que foi decidido sobre o go-live do Client A?" |
| Aprovar (quem aprova) | "revisar rascunhos" |

O Claude sempre diz onde gravou e que o item espera aprovação.

## Atualizar ou trocar de convite

Recebeu um convite novo (por exemplo, mudou de unidade)? Repita a instalação com ele: no Desktop, abra as
configurações da extensão e cole o novo convite; no Claude Code, rode o instalador de novo. Nada mais muda.

## Para quem mantém

- `skills/`: as quatro skills (`common/` vai junto em cada uma).
- `extension/`: a extensão do Claude Desktop (ponte stdio → servidor, mais a ferramenta `memory_kit_whoami`).
- `install/`: instaladores do Claude Code; `hooks/`: captura (scripts do ai-memory 3.2.5 em `hooks/vendor/`, licença
  MIT, uma alteração descrita em `hooks/vendor/PATCHES.md`).
- `npm test` roda os testes; `npm run build` gera `dist/`. Release: `gh release create vX.Y.Z dist/memory-kit.mcpb dist/skills/*.zip dist/hooks.zip install/install.ps1 install/install.sh`.
- O convite é gerado por `instance invite` no repositório de operação; o formato é
  `aimkit1.` + base64url de `{"v":1,"server","workspace","user","key","reference"}`.

Licença: MIT.
