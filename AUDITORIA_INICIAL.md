# Compasso — Auditoria técnica inicial

**Data:** 24/11/2026  
**Repositório:** [ferdutbrand/Compasso-by-Ferdut](https://github.com/ferdutbrand/Compasso-by-Ferdut)  
**Branch inspecionada:** `main`  
**Escopo:** leitura estática de arquivos do repositório; sem execução local de testes, build ou inspeção visual em navegador.

## 1. Resumo executivo

O Compasso já possui uma base funcional de construção geométrica 2D e uma primeira implementação de Studio 3D com Three.js. A evolução recomendada é incremental: preservar o motor geométrico, consolidar a arquitetura visual e amadurecer o Studio 3D como ambiente de apresentação/renderização de isotipos — não como modelador genérico.

## 2. Arquitetura observada

- **Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, lucide-react, Motion e Three.js.
- **Orquestração:** `src/App.tsx` concentra estado da aplicação, interações, histórico e integração dos módulos.
- **Canvas:** `src/components/CanvasStage.tsx` reúne a visualização SVG, ferramentas contextuais, grids, fases e interações.
- **Componentes auxiliares:** `Toolbar.tsx`, `GridPopover.tsx`, `FreeformAlignPopover.tsx` e `PhaseTimeline.tsx`.
- **Geometria:** `src/geometry/engine.ts`, `grid.ts`, `shapeBuilder.ts` e `types.ts`.
- **Studio 3D:** `src/components/Studio3DView.tsx`, ligado ao estado principal pelo `App.tsx`.

## 3. Pontos fortes confirmados

- Motor geométrico separado dos principais componentes visuais.
- Recursos avançados de tangência, snap, grids proporcionais, fases, alinhamento, distribuição e operações booleanas.
- Testes automatizados para regras geométricas e operações do motor.
- Uso de React/TypeScript e dependências adequadas à evolução do viewport 3D.

## 4. Diagnóstico da interface

- O CSS global (`src/index.css`) é pequeno; grande parte da apresentação é definida por classes utilitárias diretamente nos componentes.
- A interface usa uma linguagem visual baseada em Tailwind, com variações light/dark e padrões locais de borda, raio, sombra e cor.
- Ainda não foi identificado um conjunto centralizado e explícito de tokens ou componentes de design compartilhados.
- `App.tsx` concentra muitas responsabilidades e possui grande quantidade de estado e callbacks; merece avaliação de decomposição por domínio, sem refatoração ampla prematura.

**Direção:** criar tokens e primitivas compartilhadas, padronizar estados de interação e aplicar a nova linguagem gradualmente, mantendo o canvas como protagonista e usando painéis contextuais.

## 5. Diagnóstico do Studio 3D atual

**Implementado no código:**
- Cena Three.js, câmera em perspectiva e renderer WebGL.
- Órbita por arraste e zoom pela roda do mouse.
- Extrusão de círculos e polígonos, com bevel fixo.
- Material configurável por cor, roughness, metalness e wireframe.
- Iluminação ambiente e direcional, além de grid de referência.

**Lacunas observadas no arquivo atual:**
- O processamento de `BuiltShape` ainda está como placeholder; os paths construídos não são convertidos em malhas 3D.
- Retas e outras entidades geométricas não são representadas como ativos 3D; a conversão atual trata círculos e polígonos.
- Não há preservação explícita de contornos internos/furos na conversão observada.
- Não há interface de presets de materiais, ambientes/HDRI ou controles de luz.
- Não há presets de câmera, projeção ortográfica, salvamento de vistas ou controles de enquadramento.
- Não foi encontrada rotina de captura/exportação de render no componente.
- A interação de câmera está baseada em mouse; a adaptação a toque precisa ser avaliada.
- A cena usa loop contínuo de renderização; avaliar pausa quando inativa e estratégia de atualização sob demanda.
- O redimensionamento depende do evento global `resize`; observar também mudanças de tamanho do container.

## 6. Testes e validação

O repositório contém `tests/compasso.test.ts` e scripts `npm test`, `npm run lint` e `npm run build`. O relatório histórico registra 15 testes aprovados e build/typecheck concluídos, mas esses comandos **não foram executados novamente nesta auditoria**.

## 7. Prioridades recomendadas

1. **P0 — Linha de base:** executar testes, typecheck e build; registrar erros e validar os fluxos 2D essenciais.
2. **P1 — Design System:** definir tokens semânticos, tipografia, espaçamento, superfícies, raios, foco e motion; criar primitivas reutilizáveis.
3. **P2 — Shell e módulos 2D:** unificar toolbar, popovers, painéis, feedback e estados; migrar gradualmente.
4. **P3 — Studio 3D MVP:** corrigir a conversão para preservar paths, furos e relações do isotipo; incluir controles de profundidade/bevel, materiais básicos, iluminação, vistas padrão e exportação PNG.
5. **P4 — Evolução:** presets completos, Camera Lab, variações de render e efeitos/shaders.

## 8. Critérios de aceite da próxima etapa

- Não degradar a precisão nem os recursos do motor 2D.
- Testes, typecheck e build executados e aprovados.
- Padrões visuais compartilhados entre módulos.
- Conversão 2D→3D fiel a contornos, vazios e proporções.
- Render e exportação integrados ao fluxo de criação de identidade.

---
**Conclusão:** há uma fundação 2D sólida e um protótipo 3D funcional, mas o Studio 3D ainda precisa evoluir de uma demonstração de extrusão para um estúdio de direção de arte e geração de ativos visuais. A próxima etapa deve começar pela linha de base automatizada e pelo Design System, preservando a geometria existente.
