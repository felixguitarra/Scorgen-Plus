Dependências para o ThinkPad T430 (Bluefin)
Para garantir que o Scorgen-Plus funcione perfeitamente no Linux nativo, segue este checklist:

1. Sistema (Audio & UI)

O Bluefin já é moderno, mas garante que estas libs estão presentes:

• `libasound2` (ALSA)

• `pkg-config`

• `build-essential` (se precisares de compilar módulos nativos)

2. Comandos de Setup

```

git clone [URL-DO-TEU-REPO]

npm install

```

3. Scripts de Build corrigidos

Lembra-te de usar a ordem que validámos no WSL:

1. `npx tsc -p tsconfig.electron.json`

2. `npx tsc electron/preload.ts --outDir dist-electron --module commonjs --target es6 --skipLibCheck true`

3. `npx electron .`

4. Áudio

Se o som não sair de primeira:

• No console (F12): `Tone.start()`

• Verifica se o `PipeWire` está ativo (padrão no Bluefin).
