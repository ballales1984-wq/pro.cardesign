# Pro.Cardesign - Project Checklist

## ✅ FASE 0: BASE (Completata)
- [x] Classe Brick con misure mm
- [x] BrickEngine con massa e COM
- [x] Sistema Componenti parametrici
- [x] ComponentLibrary con wheel e beam

## ✅ FASE 1: INTERAZIONE (Completata)
- [x] InteractionManager per scaling drag su facce
- [x] Integrazione nel frontend Three.js
- [x] Sistema per select brick con Shift+Click
- [x] Ridimensionamento in tempo reale con righello
- [x] Visualizzazione selezione e wireframe
- [x] Aggiornamento massa e COM in tempo reale

## ⏳ FASE 2: VISUALIZZAZIONE
- [ ] Estrarre superficie esterna (solo mesh visibile)
- [ ] Wireframe interno opzionale
- [ ] LOD automatico

## ⏳ FASE 3: GESTIONE PROGETTO
- [ ] Salva/carica progetto
- [ ] Export STL
- [ ] Import STL

## ⏳ FASE 4: FUNZIONALITÀ AVANZATE
- [ ] Analisi deformazione import
- [ ] Collision detection
- [ ] Aerodinamica base

---

## Status Attuale
- **Backend Python**: BrickEngine operativo con scaling
- **Frontend Three.js**: BrickSystem con drag scaling (Shift+Click)
- **Componenti**: wheel_26/27/28, beam_200/400
- **Prossimo**: Implementare sistema snap griglia 5/10mm