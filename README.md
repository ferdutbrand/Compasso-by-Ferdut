# Compasso — Estúdio de Construção Geométrica

Aplicação interativa de desenho e construção geométrica euclidiana com régua, compasso, polígonos regulares, grids proporcionais (Fibonacci, Modular, Áureo/Phi, Isométrico e Polar), sistema avançado de tangências (1 a 4 objetos), construtor booleano de formas e exportação SVG em camadas.

## Estrutura do Projeto

```text
├── index.html                        # Entrada HTML e metadados
├── metadata.json                     # Metadados do projeto
├── package.json                      # Dependências e scripts (dev, build, lint, test)
├── src/
│   ├── App.tsx                       # Estado principal, atalhos, histórico Undo/Redo e orquestração
│   ├── index.css                     # Estilos globais Tailwind CSS
│   ├── main.tsx                      # Ponto de entrada React
│   ├── components/
│   │   ├── CanvasStage.tsx           # Palco SVG/DOM interativo, seleção por arraste (marquee) e overlays
│   │   ├── FreeformAlignPopover.tsx  # Menu situacional em cápsula (5 ícones) + popover de alinhamento/simetria
│   │   ├── GridPopover.tsx           # Configuração de grids (Fibonacci, Modular, Phi, Isométrico, Polar)
│   │   ├── PhaseTimeline.tsx         # Gerenciamento de fases/camadas e visibilidade
│   │   └── Toolbar.tsx               # Barra flutuante consolidada com ícones e tooltips
│   └── geometry/
│       ├── types.ts                  # Tipagens geométricas (PointObj, LineObj, CircleObj, PolyObj, etc.)
│       ├── engine.ts                 # Motor geométrico, tangências, snap, layout, cópia/colagem e SVG
│       ├── grid.ts                   # Cálculo de grids (Fibonacci, Modular, Phi, Isométrico, Polar) e regras de tamanho
│       └── shapeBuilder.ts           # Arranjo planar e operações booleanas (união, interseção, subtração, exclusão)
├── tests/
│   └── compasso.test.ts              # Suíte automatizada de testes do motor geométrico e regras de grid
├── ATUALIZACOES_E_TESTES.md          # Histórico completo das atualizações e relatório de testes em Markdown
└── README.md                         # Documentação geral do projeto
```

## Como Executar Localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento (porta 3000)
npm run dev

# Verificar tipagem TypeScript
npm run lint

# Executar suíte de testes automatizados
npm test

# Gerar build de produção
npm run build
```

## Principais Atalhos de Teclado

| Atalho | Ação |
| --- | --- |
| `V` / `L` / `C` / `Q` / `F` / `U` / `X` | Mover / Reta / Círculo / Polígono / Construtor / Régua / Apagar |
| `Ctrl/Cmd + C` / `Ctrl/Cmd + V` / `Ctrl/Cmd + D` | Copiar / Colar / Duplicar seleção |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` | Desfazer / Refazer |
| `G` | Ativar/desativar Snap geral |
| `E` | Ativar/desativar Snap de Tangência |
| `Shift` + clique ou arraste no canvas | Seleção múltipla / Seleção por área (marquee) |
| `Delete` / `Backspace` | Excluir objetos selecionados (com limpeza de pontos órfãos) |
