# Scorgen Plus - Sight-Reading Trainer

Um aplicativo web moderno para treino de leitura à primeira vista de partituras musicais, com geração aleatória de notas musicais, renderização de partituras via VexFlow e playback via Tone.js.

## 🎵 Features

- **Geração Aleatória de Partituras**: Crie partituras baseadas em parâmetros configuráveis (tonalidade, escala, dificuldade, clave)
- **Renderização Visual**: Partituras renderizadas profissionalmente usando VexFlow
- **Playback de Áudio**: Ouça as partituras geradas com Tone.js
- **Interface Premium**: Design moderno com glassmorphism e gradientes vibrantes
- **Controles de Tempo**: Ajuste o BPM (40-200) para prática em diferentes velocidades
- **Responsivo**: Interface adaptável para diferentes tamanhos de tela

## 🚀 Tecnologias

- **React** + **TypeScript** - Framework e tipagem
- **Vite** - Build tool e dev server
- **VexFlow** - Renderização de partituras musicais
- **Tone.js** - Síntese e playback de áudio
- **Tonal** - Teoria musical e geração de escalas
- **React Router** - Navegação entre páginas
- **CSS Modules** - Estilos com escopo local
- **Lucide React** - Ícones modernos

## 📦 Instalação

```bash
# Clone o repositório
git clone <seu-repo-url>

# Entre no diretório
cd "Scorgen Plus"

# Instale as dependências
npm install

# Rode o servidor de desenvolvimento
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173`

## 🎮 Como Usar

1. **Configuração**: Na página inicial, configure:
   - **Key**: Escolha a tonalidade (C, G, D, A, E, B, F#, Db, Ab, Eb, Bb, F)
   - **Scale**: Major ou Minor
   - **Difficulty**: Easy, Medium ou Hard
   - **Clef**: Treble (Clave de Sol) ou Bass (Clave de Fá)

2. **Practice**: Clique em "Start Practice" para:
   - Ver a partitura gerada
   - Ajustar o tempo (BPM)
   - Tocar/parar o playback
   - Gerar nova partitura com "Generate New Score"

## 📁 Estrutura do Projeto

```
src/
├── components/           # Componentes React
│   ├── ConfigForm.tsx    # Formulário de configuração
│   ├── ScoreDisplay.tsx  # Display da partitura (VexFlow)
│   └── PlayerControls.tsx # Controles de áudio (Tone.js)
├── engine/               # Lógica de negócio
│   └── MusicGenerator.ts # Geração de notas musicais
├── pages/                # Páginas da aplicação
│   ├── Home.tsx          # Página inicial
│   └── Practice.tsx      # Página de prática
├── App.tsx               # Router principal
├── main.tsx              # Entry point
└── index.css             # Estilos globais
```

## 🎨 Design

O Scorgen Plus utiliza um design moderno com:
- **Dark Mode**: Tema escuro por padrão
- **Glassmorphism**: Efeitos de vidro translúcido
- **Gradientes Vibrantes**: Cores ricas e dinâmicas
- **Tipografia Premium**: Google Fonts (Inter)
- **Micro-animações**: Transições suaves e feedback visual

## 🔧 Scripts Disponíveis

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de produção
npm run preview  # Preview do build de produção
```

## 📝 Licença

MIT

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

Desenvolvido com ❤️ e 🎵
