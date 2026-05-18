/**
 * UI - Interfaccia utente del VoxelCAD Editor
 * Gestisce toolbar, pannelli laterali, e interazione
 */

import { ComponentLibrary } from './core/component-library.js';
import { ScalingTool } from './core/scaling-tool.js';

export class UI {
    constructor(opts) {
      this.voxelEngine = opts.voxelEngine;
      this.materialDB = opts.materialDB;
      this.moduleSystem = opts.moduleSystem;
      this.physics = opts.physics;
      this.meshExporter = opts.meshExporter;
      this.proceduralEngine = opts.proceduralEngine;
      this.controls = opts.controls;
      this.camera = opts.camera;
      this.renderer = opts.renderer;
      this.scene = opts.scene;

      // Essential setup only - defer heavy work to avoid blocking main thread
      this._setupToolbar();
      this._setupModals();
      this._setupKeyboard();
      this._subscribeEvents();
      
      // Defer non-critical UI work
      requestIdleCallback(() => {
        this._setupPanels();
        this._setupProceduralPanel();
        this._populateMaterials();
        this._populateModules();
        this._setupLibrary();
        this._addDemoVoxels();
      }, { timeout: 500 });
    }

  // Notification helper
  _notify(message, type) {
    type = type || 'info';
    var existing = document.querySelectorAll('.app-notification');
    for (var i = 0; i < existing.length; i++) existing[i].remove();

    var el = document.createElement('div');
    el.className = 'app-notification notification-' + type;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function() {
      el.classList.add('fade-out');
      setTimeout(function() { el.remove(); }, 300);
    }, 2500);
  }

  // Toolbar
  _setupToolbar() {
    var self = this;
    document.getElementById('tool-select').addEventListener('click', function() { self.voxelEngine.setTool('select'); });
    document.getElementById('tool-add').addEventListener('click', function() { self.voxelEngine.setTool('add'); });
    document.getElementById('tool-remove').addEventListener('click', function() { self.voxelEngine.setTool('remove'); });
    document.getElementById('tool-fill').addEventListener('click', function() { self._fillLayer(); });
    document.getElementById('tool-scaling').addEventListener('click', function() { self.voxelEngine.setTool('scaling'); });

    document.getElementById('btn-export').addEventListener('click', function() { self._openExportModal(); });
    document.getElementById('btn-import').addEventListener('click', function() { self._openImportModal(); });
    document.getElementById('btn-sim').addEventListener('click', function() { self._runSimulation(); });
    document.getElementById('btn-clear').addEventListener('click', function() { self._confirmClear(); });
    document.getElementById('btn-undo').addEventListener('click', function() { self.voxelEngine.undo(); self._refreshProperties(); });
    document.getElementById('btn-redo').addEventListener('click', function() { self.voxelEngine.redo(); self._refreshProperties(); });
    document.getElementById('btn-save').addEventListener('click', function() { self._saveProject(); });
    document.getElementById('btn-load').addEventListener('click', function() { self._loadProject(); });
    document.getElementById('btn-reset-cam').addEventListener('click', function() { self.voxelEngine.resetCamera(); });

    var toolNames = { add: 'Aggiungi (A)', remove: 'Rimuovi (R)', select: 'Seleziona (V)', fill: 'Riempimento (F)' };
    window.addEventListener('tool-changed', function(e) {
      var hint = toolNames[e.detail] || e.detail;
      document.getElementById('tool-hint').textContent = 'Strumento: ' + hint;
    });
  }

  // Panels
  _setupPanels() {
    var self = this;
    document.querySelectorAll('.panel-header').forEach(function(header) {
      header.addEventListener('click', function() {
        this.parentElement.classList.toggle('collapsed');
      });
    });

    // Add module
    document.getElementById('btn-add-module').addEventListener('click', function() {
      var name = document.getElementById('new-module-name').value.trim();
      if (!name) return self._notify('Inserisci un nome per il modulo', 'warn');
      var activeMod = self.voxelEngine.activeModule;
      var parentId = activeMod || self.moduleSystem.rootId;
      var realParent = (activeMod === self.moduleSystem.rootId) ? null : parentId;
      var id = self.moduleSystem.createModule(name, realParent);
      if (id) {
        document.getElementById('new-module-name').value = '';
        self._refreshModules();
        self._notify('Modulo "' + name + '" creato', 'success');
      }
    });

    // Remove module
    document.getElementById('btn-remove-module').addEventListener('click', function() {
      if (!self.voxelEngine.activeModule) return self._notify('Seleziona un modulo dal pannello Moduli', 'warn');
      var mod = self.moduleSystem.get(self.voxelEngine.activeModule);
      if (!mod) return;
      if (confirm('Rimuovere modulo "' + mod.name + '" e tutti i suoi figli?')) {
        self.moduleSystem.removeModule(self.voxelEngine.activeModule);
        self.voxelEngine.activeModule = null;
        self._refreshModules();
        self._showVoxelProperties(null);
        self._notify('Modulo "' + mod.name + '" rimosso', 'success');
      }
    });

    // Add custom material
    document.getElementById('btn-add-material').addEventListener('click', function() {
      var name = document.getElementById('custom-mat-name').value.trim();
      var density = parseFloat(document.getElementById('custom-mat-density').value);
      var strength = parseFloat(document.getElementById('custom-mat-strength').value);
      var cost = parseFloat(document.getElementById('custom-mat-cost').value);
      if (!name || isNaN(density) || isNaN(strength) || isNaN(cost)) {
        return self._notify('Compila tutti i campi numerici', 'warn');
      }
      var ok = self.materialDB.add({
        name: name, label: name, color: self._randomColor(),
        density: density, youngsModulus: strength * 1e6, poissonRatio: 0.3,
        tensileStrength: strength * 1e6, thermalConductivity: 1.0,
        specificHeat: 800, meltingPoint: 300, costPerKg: cost,
        recyclable: false, roughness: 0.4, metalness: 0.3
      });
      if (!ok) return self._notify('Materiale gia esistente', 'warn');
      document.getElementById('custom-mat-name').value = '';
      document.getElementById('custom-mat-density').value = '';
      document.getElementById('custom-mat-strength').value = '';
      document.getElementById('custom-mat-cost').value = '';
      self._refreshMaterials();
      self._notify('Materiale "' + name + '" aggiunto', 'success');
    });

    // Remove material
    document.getElementById('btn-remove-material').addEventListener('click', function() {
      var matName = self.voxelEngine.activeMaterial;
      if (self.materialDB.count() <= 1) return self._notify('Non puoi rimuovere tutti i materiali', 'warn');
      if (confirm('Rimuovere il materiale "' + matName + '"?')) {
        self.materialDB.remove(matName);
        self.voxelEngine.activeMaterial = self.materialDB.getAll()[0].name;
        self._refreshMaterials();
        self._notify('Materiale "' + matName + '" rimosso', 'success');
      }
    });
  }

  _refreshModules() { this._renderModuleTree(); }

  _refreshMaterials() {
    var prev = this.voxelEngine.activeMaterial;
    this._populateMaterials();
    if (this.materialDB.get(prev)) {
      this.voxelEngine.activeMaterial = prev;
      var swatches = document.querySelectorAll('.material-swatch');
      for (var i = 0; i < swatches.length; i++) {
        swatches[i].classList.toggle('active', swatches[i].dataset.mat === prev);
      }
    }
  }

   _setupModals() {
     document.addEventListener('click', function(e) {
       if (e.target.classList.contains('modal-overlay')) e.target.remove();
     });
   }

   // Procedural Rules Panel
   _setupProceduralPanel() {
     const self = this;
     const container = document.getElementById('procedural-panel');
     const rulesList = document.getElementById('procedural-rules-list');
     const ruleEditor = document.getElementById('rule-editor');
     const ruleEditorHeader = document.getElementById('rule-editor-header');
     const ruleEditorBody = document.getElementById('rule-editor-body');
     const newRuleNameInput = document.getElementById('new-rule-name');
     const addRuleBtn = document.getElementById('btn-add-rule');

     // Populate rules list
     function populateRulesList() {
       rulesList.innerHTML = '';
       const rules = Array.from(self.proceduralEngine.rules.keys());
       if (rules.length === 0) {
         rulesList.innerHTML = '<p class="hint">Nessuna regola definita</p>';
         return;
       }
        rules.forEach(ruleName => {
          const ruleDiv = document.createElement('div');
          ruleDiv.className = 'procedural-rule-item';
          ruleDiv.innerHTML = `
            <span class="rule-name">${ruleName}</span>
            <button id="rule-apply-${ruleName}" class="rule-apply-btn" data-rule="${ruleName}" title="Applica regola nella scena" style="background:var(--accent);color:#fff;border:none;border-radius:3px;padding:2px 7px;font-size:10px;cursor:pointer;">▶ Applica</button>
            <button id="rule-edit-${ruleName}" class="rule-edit-btn" data-rule="${ruleName}">Modifica</button>
            <button id="rule-delete-${ruleName}" class="rule-delete-btn" data-rule="${ruleName}">Elimina</button>
          `;
          rulesList.appendChild(ruleDiv);
        });

        // Apply button
        document.querySelectorAll('.rule-apply-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const ruleName = this.getAttribute('data-rule');
            // Read offset from inputs (with fallback to 0)
            const ox = parseInt(document.getElementById('rule-offset-x')?.value) || 0;
            const oy = parseInt(document.getElementById('rule-offset-y')?.value) || 0;
            const oz = parseInt(document.getElementById('rule-offset-z')?.value) || 0;
            try {
              const voxels = self.proceduralEngine.build(ruleName, {
                position: { x: ox, y: oy, z: oz },
                material: self.voxelEngine.activeMaterial
              });
              if (!voxels || voxels.length === 0) {
                self._notify(`Regola "${ruleName}" non ha generato voxel`, 'warn');
              } else {
                self._notify(`Regola "${ruleName}" applicata: ${voxels.length} voxel`, 'success');
              }
            } catch(e) {
              self._notify(`Errore nell'applicare "${ruleName}": ` + e.message, 'error');
            }
          });
        });

        // Add event listeners to edit/delete buttons
        document.querySelectorAll('.rule-edit-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const ruleName = this.getAttribute('data-rule');
            self._editRule(ruleName);
          });
        });

        document.querySelectorAll('.rule-delete-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const ruleName = this.getAttribute('data-rule');
            if (confirm(`Eliminare la regola "${ruleName}"?`)) {
              self.proceduralEngine.rules.delete(ruleName);
              populateRulesList();
              self._notify(`Regola "${ruleName}" eliminata`, 'success');
            }
          });
        });
     }

     // Add new rule
     addRuleBtn.addEventListener('click', function() {
       const ruleName = newRuleNameInput.value.trim();
       if (!ruleName) {
         self._notify('Inserisci un nome per la regola', 'warn');
         return;
       }
       if (self.proceduralEngine.rules.has(ruleName)) {
         self._notify('Una regola con questo nome esiste già', 'warn');
         return;
       }
       // Create a simple rule template
       self.proceduralEngine.rules.set(ruleName, {
         execute: (params, context) => {
           // Default: create a single voxel at origin
           return [{x: 0, y: 0, z: 0, material: 'steel'}];
         }
       });
       newRuleNameInput.value = '';
       populateRulesList();
       self._notify(`Regola "${ruleName}" creata`, 'success');
     });

     // Initial population
     populateRulesList();
   }

   _editRule(ruleName) {
     if (!this.proceduralEngine.rules.has(ruleName)) return;
     const rule = this.proceduralEngine.rules.get(ruleName);

    const editorHeader = document.getElementById('rule-editor-header');
    const editorBody = document.getElementById('rule-editor-body');

    editorHeader.textContent = `Modifica regola: ${ruleName}`;
    editorBody.innerHTML = `
      <div class="rule-editor-section">
        <label for="rule-code">Funzione execute (params, context)</label>
        <textarea id="rule-code" rows="10" class="rule-editor-textarea" spellcheck="false"></textarea>
      </div>
      <div class="rule-editor-actions">
        <button id="save-rule-btn" class="btn-primary">Salva Regola</button>
        <button id="cancel-rule-btn" class="btn-secondary">Annulla</button>
      </div>
    `;

    const saveBtn = document.getElementById('save-rule-btn');
    const cancelBtn = document.getElementById('cancel-rule-btn');
    const codeTextarea = document.getElementById('rule-code');

    // Set current rule code (simplified)
    codeTextarea.value = rule.execute.toString();

      const engine = this.proceduralEngine;
      const notifyFn  = this._notify.bind(this);
      const refreshFn = this._setupProceduralPanel.bind(this);

      saveBtn.addEventListener('click', function() {
        try {
          const newCode = codeTextarea.value;
          // Extract function body from string like "function (params, context) { ... }"
          const funcBody = newCode.includes('{')
            ? newCode.substring(newCode.indexOf('{') + 1, newCode.lastIndexOf('}'))
            : newCode;

          // ⚠️  SECURITY NOTE: `new Function` executes arbitrary code from the
          // textarea. This is intentional — power-users need JS flexibility —
          // but in a production or multi-user deployment this MUST be replaced
          // with a sandboxed expression parser (e.g. Acorn + whitelisted AST),
          // a Web-Worker worker-based evaluator, or a dedicated DSL.
          // Current behaviour: trusted-user-only.
          const newFunction = new Function('params', 'context', `return {${funcBody}}`);

          // Update rule
          engine.rules.set(ruleName, { execute: newFunction });
          notifyFn(`Regola "${ruleName}" salvata`, 'success');
          refreshFn(); // Refresh the panel
        } catch (err) {
          notifyFn(`Errore nel salvare la regola: ${err.message}`, 'error');
        }
      });

      cancelBtn.addEventListener('click', function() {
        refreshFn(); // Reset to default view
      });
   }

   // Materials palette
   _populateMaterials() {
     var container = document.getElementById('materials-list');
     var materials = this.materialDB.getAll();

      var sel = document.createElement('select');
      sel.id = 'material-select';
      sel.name = 'material';
      sel.className = 'prop-input';
      sel.style.marginBottom = '8px';
      sel.style.width = '100%';
     for (var i = 0; i < materials.length; i++) {
       var mat = materials[i];
       var opt = document.createElement('option');
       opt.value = mat.name;
       opt.textContent = mat.label + ' (' + mat.density + ')';
       sel.appendChild(opt);
     }
     sel.value = this.voxelEngine.activeMaterial;

     var self = this;
     sel.addEventListener('change', function() {
       self.voxelEngine.activeMaterial = sel.value;
       self._syncMaterialSwatch();
     });

     var matGroup = document.createElement('div');
     matGroup.className = 'material-swatch-group';

     for (var j = 0; j < materials.length; j++) {
       var m = materials[j];
       var swatch = document.createElement('div');
       swatch.className = 'material-swatch' + (m.name === this.voxelEngine.activeMaterial ? ' active' : '');
       swatch.dataset.mat = m.name;
       var colorHex = m.color.toString(16);
       while (colorHex.length < 6) colorHex = '0' + colorHex;
       swatch.appendChild(this._createSwatchColor('#' + colorHex));
       var nameSpan = document.createElement('span');
       nameSpan.textContent = m.label;
       swatch.appendChild(nameSpan);
       var densitySpan = document.createElement('span');
       densitySpan.style.cssText = 'color: var(--text-dim); font-size: 10px; margin-left: auto;';
       densitySpan.textContent = m.density + ' kg/m3';
       swatch.appendChild(densitySpan);
       swatch.title = m.label + '\nDensita: ' + m.density + ' kg/m3\nResistenza: ' + (m.tensileStrength / 1e6).toFixed(0) + ' MPa\nCosto: EUR ' + m.costPerKg + '/kg';

       swatch.addEventListener('click', (function(matName) {
         return function() {
           self.voxelEngine.activeMaterial = matName;
           sel.value = matName;
           self._syncMaterialSwatch();
         };
       })(m.name));

       matGroup.appendChild(swatch);
     }

     container.innerHTML = '';
     container.appendChild(sel);
     container.appendChild(matGroup);
   }

   _createSwatchColor(colorValue) {
     var div = document.createElement('div');
     div.className = 'swatch-color';
     div.style.background = colorValue;
     return div;
   }

    _syncMaterialSwatch() {
    var swatches = document.querySelectorAll('.material-swatch');
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].classList.toggle('active', swatches[i].dataset.mat === this.voxelEngine.activeMaterial);
    }
    var sel = document.querySelector('#materials-list #material-select');
    if (sel) sel.value = this.voxelEngine.activeMaterial;
  }

  // Modules tree
  _populateModules() { this._renderModuleTree(); }

  _renderModuleTree() {
    var container = document.getElementById('modules-tree');
    container.innerHTML = '';
    var tree = this.moduleSystem.getTree();
    if (!tree) return;
    this._renderModuleNode(container, tree, 0);
  }

  _renderModuleNode(parent, node, depth) {
    var self = this;
    var row = document.createElement('div');
    row.className = 'module-node' + (node.id === this.voxelEngine.activeModule ? ' selected' : '');
    row.style.paddingLeft = (8 + depth * 16) + 'px';
    row.innerHTML = '<span class="module-icon">' + (node.icon || '') + '</span> ' + node.name +
      ' <small style="color: var(--text-dim); margin-left: auto;">(' + node.voxelCount + ')</small>';

    row.addEventListener('click', function() {
      self.voxelEngine.activeModule = node.id;
      var nodes = document.querySelectorAll('.module-node');
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('selected');
      row.classList.add('selected');
    });

    parent.appendChild(row);

    if (node.children && node.children.length > 0) {
      for (var c = 0; c < node.children.length; c++) {
        this._renderModuleNode(parent, node.children[c], depth + 1);
      }
    }
  }

  // Properties Panel
  _showVoxelProperties(voxel) {
    var container = document.getElementById('properties-panel');
    if (!voxel) {
      container.innerHTML = '<p class="hint">Seleziona un voxel o un modulo</p>';
      return;
    }

    var mat = this.materialDB.get(voxel.material);
    var matInfo = '';
    
    // Dimension display — use real scale from voxel data
    var sc = voxel.scale ? voxel.scale : [1,1,1];
    var sx = Math.round(sc[0]*100)/100, sy = Math.round(sc[1]*100)/100, sz = Math.round(sc[2]*100)/100;
    var vVol = Math.round(sx * sy * sz * 100)/100;
    var dimsHtml = '<hr style="border-color: var(--border); margin: 8px 0;"><div style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px;">Dimensioni (mm)</div>' +
      '<div class="prop-row"><span class="prop-label">Posizione</span><span class="prop-value">' + voxel.x + ', ' + voxel.y + ', ' + voxel.z + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Scala voxel</span><span class="prop-value">' + sx.toFixed(1) + ' x ' + sy.toFixed(1) + ' x ' + sz.toFixed(1) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Volume voxel</span><span class="prop-value">' + vVol.toFixed(1) + ' mm³</span></div>' +
      '<div class="prop-row"><span class="prop-label">Materiale</span><span class="prop-value">' + (mat ? mat.label : voxel.material) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Densita</span><span class="prop-value">' + (mat ? mat.density : 'N/A') + ' kg/m3</span></div>' +
      '<div class="prop-row"><span class="prop-label">Massa voxel</span><span class="prop-value">' + this.physics.voxelMass(voxel).toFixed(4) + ' kg</span></div>' +
      '<div class="prop-row"><span class="prop-label">Peso</span><span class="prop-value">' + this.physics.voxelWeight(voxel).toFixed(4) + ' N</span></div>' +
      '<div class="prop-row"><span class="prop-label">Modulo</span><span class="prop-value">' + (voxel.module || 'Nessuno') + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Temperatura</span><span class="prop-value">' + ((voxel.temperature != null) ? voxel.temperature + ' K' : '300 K') + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Danno</span><span class="prop-value">' + ((voxel.damage != null) ? (voxel.damage * 100).toFixed(1) + '%' : '0.0%') + '</span></div>';
    if (mat) {
      matInfo = '<div class="prop-row"><span class="prop-label">E (Young)</span><span class="prop-value">' + (mat.youngsModulus / 1e9).toFixed(1) + ' GPa</span></div>' +
        '<div class="prop-row"><span class="prop-label">Sigma max</span><span class="prop-value">' + (mat.tensileStrength / 1e6).toFixed(0) + ' MPa</span></div>' +
        '<div class="prop-row"><span class="prop-label">Lambda termica</span><span class="prop-value">' + mat.thermalConductivity + ' W/(m·K)</span></div>' +
        '<div class="prop-row"><span class="prop-label">Costo</span><span class="prop-value">EUR ' + mat.costPerKg + '/kg</span></div>' +
        '<div class="prop-row"><span class="prop-label">Riciclabile</span><span class="prop-value">' + (mat.recyclable ? 'Si' : 'No') + '</span></div>';
    }

    container.innerHTML = dimsHtml + matInfo;
  }

  _refreshProperties() {
    if (this.voxelEngine.selectedVoxel) {
      var vox = this.voxelEngine.getVoxelAt(
        this.voxelEngine.selectedVoxel.x,
        this.voxelEngine.selectedVoxel.y,
        this.voxelEngine.selectedVoxel.z
      );
      this._showVoxelProperties(vox);
    }
  }

  // Physics simulation
  async _runSimulation() {
    var physicsPanel = document.getElementById('physics-panel');
    var allVoxels = Array.from(this.voxelEngine.voxelsIterator());

    if (allVoxels.length === 0) {
      physicsPanel.innerHTML = '<p class="hint">Nessun voxel da simulare</p>';
      this._notify('Nessun voxel da simulare', 'warn');
      return;
    }

    var result = this.physics.calculateVehicle(this.voxelEngine);
    var html = '<div class="prop-row"><span class="prop-label">Voxel totali</span><span class="prop-value">' + result.voxelCount + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Massa totale</span><span class="prop-value" style="color: var(--orange);">' + result.totalMass.toFixed(4) + ' kg</span></div>' +
      '<div class="prop-row"><span class="prop-label">Volume totale</span><span class="prop-value">' + result.totalVolume.toFixed(2) + ' unit³</span></div>' +
      '<div class="prop-row"><span class="prop-label">Densita media</span><span class="prop-value">' + result.density.toFixed(2) + ' kg/unit³</span></div>' +
      '<div class="prop-row"><span class="prop-label">Peso totale</span><span class="prop-value" style="color: var(--accent);">' + result.weight.toFixed(4) + ' N</span></div>' +
      '<hr style="border-color: var(--border); margin: 8px 0;">' +
      '<div class="prop-row"><span class="prop-label">Centro di massa X</span><span class="prop-value">' + result.centerOfMass.x.toFixed(3) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Centro di massa Y</span><span class="prop-value">' + result.centerOfMass.y.toFixed(3) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Centro di massa Z</span><span class="prop-value">' + result.centerOfMass.z.toFixed(3) + '</span></div>' +
      '<hr style="border-color: var(--border); margin: 8px 0;">' +
      '<div class="prop-row"><span class="prop-label">Inerzia XX</span><span class="prop-value">' + result.inertia.xx.toFixed(2) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Inerzia YY</span><span class="prop-value">' + result.inertia.yy.toFixed(2) + '</span></div>' +
      '<div class="prop-row"><span class="prop-label">Inerzia ZZ</span><span class="prop-value">' + result.inertia.zz.toFixed(2) + '</span></div>';

    var matDist = result.materialDistribution;
    if (Object.keys(matDist).length > 0) {
      html += '<hr style="border-color: var(--border); margin: 8px 0;"><div style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px;">Materiali:</div>';
      for (var name in matDist) {
        var data = matDist[name];
        var mat = this.materialDB.get(name);
        html += '<div class="prop-row"><span class="prop-label">' + (mat ? mat.label : name) + '</span><span class="prop-value">' + data.count + ' voxel (' + data.mass.toFixed(3) + ' kg)</span></div>';
      }
    }

    if (allVoxels.length > 0) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (var k = 0; k < allVoxels.length; k++) {
        var v = allVoxels[k];
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
      }
      var dimsX = (maxX - minX + 1).toFixed(1);
      var dimsY = (maxY - minY + 1).toFixed(1);
      var dimsZ = (maxZ - minZ + 1).toFixed(1);
      html += '<hr style="border-color: var(--border); margin: 8px 0;">' +
        '<div style="font-size: 11px; color: var(--text-dim); margin-bottom: 4px;">Bounding Box:</div>' +
        '<div class="prop-row"><span class="prop-label">Dimensioni</span><span class="prop-value">' + dimsX + ' x ' + dimsY + ' x ' + dimsZ + '</span></div>';
    }

    // ── Stress Analysis ──────────────────────────────────────────
    try {
      const { StressAnalysis } = await import('./core/stress-analysis.js');
      const sa = new StressAnalysis(this.voxelEngine, this.materialDB);
      sa.analyze(allVoxels);
      const sf = sa.getSafetyFactor();
      const crit = sa.getCriticalZones();
      const maxS = crit.length > 0 ? crit[0].stress : 0;
      html += '<hr style="border-color:var(--border);margin:8px 0;">' +
        '<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">🔬 Stress Strutturale:</div>' +
        '<div class="prop-row"><span class="prop-label">Stress max</span><span class="prop-value" style="color:var(--orange);">' + (maxS / 1e6).toFixed(2) + ' MPa</span></div>' +
        '<div class="prop-row"><span class="prop-label">Zone critiche</span><span class="prop-value">' + crit.length + '</span></div>' +
        '<div class="prop-row"><span class="prop-label">Safety Factor</span><span class="prop-value" style="color:' + (sf >= 2 ? 'var(--accent)' : 'var(--orange)') + ';">' + sf.toFixed(2) + '</span></div>';
    } catch(e) { /* modulo non disponibile */ }

    // ── Aerodynamics ─────────────────────────────────────────────
    try {
      const { Aerodynamics } = await import('./core/aerodynamics.js');
      const aero = new Aerodynamics(this.meshExporter);
      const summary = aero.getSummary(allVoxels);
      const drag10 = summary.estimatedDragAt10ms;
      const drag30 = aero.calculateDrag(30, summary.estimatedFrontalArea).force;
      html += '<hr style="border-color:var(--border);margin:8px 0;">' +
        '<div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">💨 Aerodinamica (stima):</div>' +
        '<div class="prop-row"><span class="prop-label">Area frontale est.</span><span class="prop-value">' + summary.estimatedFrontalArea.toFixed(2) + ' m²</span></div>' +
        '<div class="prop-row"><span class="prop-label">Drag a 10 m/s</span><span class="prop-value">' + drag10.toFixed(2) + ' N</span></div>' +
        '<div class="prop-row"><span class="prop-label">Drag a 30 m/s</span><span class="prop-value">' + drag30.toFixed(2) + ' N</span></div>' +
        '<div class="prop-row"><span class="prop-label">Cd stimato</span><span class="prop-value">0.30</span></div>';
    } catch(e) { /* modulo non disponibile */ }

    physicsPanel.innerHTML = html;
    this._notify('Simulazione completata', 'success');
    console.log('[%s] Simulazione completata: %d voxel, massa = %s kg',
      new Date().toLocaleTimeString(), result.voxelCount, result.totalMass.toFixed(4));
  }

  // Fill layer
  _fillLayer() {
    var prompt = document.getElementById('fill-y-prompt');
    var y = prompt ? parseInt(prompt.value) || 0 : 0;
    var count = this.voxelEngine.fillLayer(y, this.voxelEngine.activeMaterial, this.voxelEngine.activeModule);
    this._notify('Livello Y=' + y + ' riempito con ' + count + ' voxel', 'success');
  }

  // Save / Load
  _saveProject() {
    var data = this.voxelEngine.toJSON();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'voxelcad_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._notify('Progetto salvato', 'success');
  }

  _loadProject() {
    var self = this;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var data = JSON.parse(ev.target.result);
          self.voxelEngine.fromJSON(data);
          self._refreshModules();
          self._refreshProperties();
          var physicsPanel = document.getElementById('physics-panel');
          if (self.voxelEngine.getVoxelCount() > 0) {
            physicsPanel.innerHTML = '<p class="hint">Clicca per calcolare</p>';
          } else {
            physicsPanel.innerHTML = '<p class="hint">Nessun voxel da simulare</p>';
          }
          self._notify('Progetto caricato con successo!', 'success');
        } catch (err) {
          self._notify('Errore nel caricamento: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  // Clear confirmation
  _confirmClear() {
    if (confirm('Eliminare tutti i voxel?')) {
      this.voxelEngine.clearAll();
      document.getElementById('properties-panel').innerHTML = '<p class="hint">Seleziona un voxel o un modulo</p>';
      document.getElementById('physics-panel').innerHTML = '<p class="hint">Clicca per calcolare</p>';
      this._renderModuleTree();
      this._notify('Tutto cancellato', 'info');
    }
  }

  // ── Export Mesh ───────────────────────────────────────────────
  _openExportModal() {
    const self = this;
    const allVoxels = Array.from(this.voxelEngine.voxelsIterator());
    if (allVoxels.length === 0) { this._notify('Nessun voxel da esportare', 'warn'); return; }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px;min-width:360px;box-shadow:0 24px 64px rgba(0,0,0,.6);">
        <h2 style="margin:0 0 18px;font-size:16px;">📦 Esporta Mesh</h2>
        <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Formato</label>
        <select id="ex-fmt" style="width:100%;padding:7px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;margin-bottom:14px;">
          <option value="stl-ascii">STL ASCII (.stl)</option>
          <option value="stl-binary">STL Binario (.stl)</option>
          <option value="obj">OBJ Wavefront (.obj)</option>
        </select>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:16px;font-size:12px;">
          <input type="checkbox" id="ex-smooth"> Smooth surface (Marching Cubes)
        </label>
        <div style="padding:10px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--text-dim);margin-bottom:18px;">
          Voxel: <strong style="color:var(--accent);">${allVoxels.length}</strong>
          <div id="ex-info" style="margin-top:4px;"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="ex-cancel" style="padding:8px 18px;background:var(--hover);color:var(--text);border:none;border-radius:6px;cursor:pointer;">Annulla</button>
          <button id="ex-ok" style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">⬇ Scarica</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const upd = () => {
      const s = document.getElementById('ex-smooth').checked;
      document.getElementById('ex-info').textContent = s
        ? 'Superficie: Marching Cubes (smooth)'
        : `Superficie: Cubi (~${allVoxels.length * 12} triangoli est.)`;
    };
    document.getElementById('ex-smooth').addEventListener('change', upd);
    upd();

    document.getElementById('ex-cancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('ex-ok').onclick = async () => {
      const fmt = document.getElementById('ex-fmt').value;
      const smooth = document.getElementById('ex-smooth').checked;
      const btn = document.getElementById('ex-ok');
      btn.textContent = '⏳ Generando...'; btn.disabled = true;
      try {
        const geom = self.meshExporter.voxelToGeometry(allVoxels, 1.0, smooth);
        let content, fn, mime;
        if (fmt === 'obj') {
          content = self.meshExporter.exportOBJ(geom);
          fn = 'voxelcad_' + new Date().toISOString().slice(0,10) + '.obj';
          mime = 'text/plain';
        } else if (fmt === 'stl-binary') {
          content = self.meshExporter.exportSTL(geom, false);
          fn = 'voxelcad_' + new Date().toISOString().slice(0,10) + '.stl';
          mime = 'application/octet-stream';
        } else {
          content = self.meshExporter.exportSTL(geom, true);
          fn = 'voxelcad_' + new Date().toISOString().slice(0,10) + '.stl';
          mime = 'text/plain';
        }
        self.meshExporter.download(fn, content, mime);
        overlay.remove();
        self._notify('Mesh esportata: ' + fn, 'success');
      } catch (err) {
        self._notify('Errore export: ' + err.message, 'error');
        btn.textContent = '⬇ Scarica'; btn.disabled = false;
      }
    };
  }

  // ── Import STL ────────────────────────────────────────────────
    _openImportModal() {
      var self = this;
      var input = document.createElement('input');
      input.id = 'import-file-input';
      input.type = 'file';
      input.accept = '.stl,.obj';
      input.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        self._runImport(file);
      });
      input.click();
    }

  async _runImport(file) {
    this._notify('Importazione ' + file.name + '...', 'info');
    try {
      const mod = await import('./core/stl-import.js');
      const STLImporter = mod.STLImporter;
      const QualityAnalyzer = mod.QualityAnalyzer;
      const importer = new STLImporter(this.scene, this.camera, this.renderer);
      const result = await importer.fitToScene(await importer.importFile(file));
      const analyzer = new QualityAnalyzer();
      const analysis = analyzer.analyzeGeometry(result.geometry);
      this._showImportResults(analysis, result);
      this._notify('Import completato: ' + file.name, 'success');
    } catch (err) {
      this._notify('Errore import: ' + err.message, 'error');
    }
  }

  _showImportResults(analysis, importInfo) {
    var panel = document.createElement('div');
    panel.className = 'app-notification notification-success';
    panel.style.zIndex = '10000';
    panel.style.maxWidth = '400px';
    panel.innerHTML = `
      <div style="padding: 16px;">
        <h3 style="margin:0 0 12px;">Risultati Importazione</h3>
        <div class="prop-row"><span class="prop-label">Vertici</span><span class="prop-value">${analysis.vertexCount}</span></div>
        <div class="prop-row"><span class="prop-label">Centroide</span><span class="prop-value">(${analysis.centroid.x}, ${analysis.centroid.y}, ${analysis.centroid.z}) mm</span></div>
        <div class="prop-row"><span class="prop-label">Raggio medio</span><span class="prop-value">${analysis.meanRadiusMm} mm</span></div>
        <div class="prop-row"><span class="prop-label">Ovalità</span><span class="prop-value">${analysis.ovalityMm} mm</span></div>
        <div class="prop-row"><span class="prop-label">Deviazione max</span><span class="prop-value">${analysis.maxDeviationMm} mm</span></div>
        <div class="prop-row"><span class="prop-label">Circolare</span><span class="prop-value">${analysis.isCircular ? 'Si' : 'No'}</span></div>
        <hr style="border-color:rgba(255,255,255,0.1); margin:8px 0;">
        <div class="prop-row"><span class="prop-label">Scala</span><span class="prop-value">${(importInfo.scaleFactor * 100).toFixed(1)}%</span></div>
        <div class="prop-row"><span class="prop-label">Dim. Originali</span><span class="prop-value">${importInfo.originalSize.x.toFixed(1)} × ${importInfo.originalSize.y.toFixed(1)} × ${importInfo.originalSize.z.toFixed(1)}</span></div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button id="import-close-btn" onclick="this.closest(&quot;.app-notification&quot;).remove()" style="flex:1;padding:6px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;">Chiudi</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    
    // Auto-remove after 15 seconds
    setTimeout(() => { if (panel.parentNode) panel.remove(); }, 15000);
  }

// Keyboard shortcuts
  _setupKeyboard() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        self.voxelEngine.selectedVoxel = null;
        self._showVoxelProperties(null);
      }
      // Ctrl+Z → Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        self.voxelEngine.undo();
        self._refreshProperties();
        self._notify('Undo', 'info');
      }
      // Ctrl+Y or Ctrl+Shift+Z → Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        self.voxelEngine.redo();
        self._refreshProperties();
        self._notify('Redo', 'info');
      }
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'a' || e.key === 'A') self.voxelEngine.setTool('add');
        if (e.key === 'r' || e.key === 'R') self.voxelEngine.setTool('remove');
        if (e.key === 'v' || e.key === 'V') self.voxelEngine.setTool('select');
      }
    });
  }

  // Event subscriptions
  _subscribeEvents() {
    var self = this;
    window.addEventListener('voxel-selected', function(e) {
      self._showVoxelProperties(e.detail);
    });

    window.addEventListener('tool-changed', function(e) {
      self._showVoxelProperties(self.voxelEngine.getVoxelAt(
        self.voxelEngine.selectedVoxel ? self.voxelEngine.selectedVoxel.x : undefined,
        self.voxelEngine.selectedVoxel ? self.voxelEngine.selectedVoxel.y : undefined,
        self.voxelEngine.selectedVoxel ? self.voxelEngine.selectedVoxel.z : undefined
      ));
    });
  }

  // Random color
  _randomColor() {
    var colors = [0xe94560, 0x00d2ff, 0x4caf50, 0xff9800, 0x9c27b0, 0x00bcd4, 0xff5722, 0x8bc34a, 0x3f51b5, 0xf44336];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Demo voxels
  _addDemoVoxels() {
    return; // Disabilitato per evitare confusione (il "grande cubo nero")
    var xe, ye, ze;
    for (xe = -2; xe <= 2; xe++) {
      for (ye = 0; ye < 5; ye++) {
        for (ze = -2; ze <= 2; ze++) {
          this.voxelEngine.addVoxel({ x: xe, y: ye, z: ze }, 'steel');
        }
      }
    }

    var telaioId = this.moduleSystem.createModule('Telaio', this.moduleSystem.rootId);
    this.moduleSystem.get(telaioId).metadata.icon = '';
    this.moduleSystem.get(telaioId).metadata.color = '#e94560';
    var telaioProps = this.moduleSystem.get(telaioId).properties;
    telaioProps.tolerance = 0.05;
    telaioProps.targetWeight = 50;

    for (xe = -2; xe <= 2; xe++) {
      for (ze = -2; ze <= 2; ze++) {
        for (ye = 0; ye < 2; ye++) {
          var key = xe + ',' + ye + ',' + ze;
          this.moduleSystem.assignVoxelToModule(key, telaioId);
        }
      }
    }

    var carId = this.moduleSystem.createModule('Carrozzeria', this.moduleSystem.rootId);
    this.moduleSystem.get(carId).metadata.icon = '';
    this.moduleSystem.get(carId).metadata.color = '#00d2ff';

    this._refreshModules();
    this.voxelEngine.clearHistory();
    this._refreshMaterials();

    console.log('%c◆ VoxelCAD UI pronto. Strumenti: V=Seleziona A=Aggiungi R=Rimuovi F=Fill', 'color: #4caf50');
    this._notify('VoxelCAD pronto - Demo caricato', 'success');
  }

  // ── Component Library ───────────────────────────────────────────────
  _setupLibrary() {
    const self = this;
    this.componentLibrary = new ComponentLibrary();
    this._currentEditingComponent = null;

    // Category filter
    document.getElementById('library-category').addEventListener('change', function() {
      self._populateComponentList(this.value);
    });

    this._populateComponentList('all');
  }

   _populateComponentList(category) {
     const listEl = document.getElementById('component-list');
     listEl.innerHTML = '';

     const components = category === 'all'
       ? this.componentLibrary.getAll()
       : this.componentLibrary.getByCategory(category);

     components.forEach(comp => {
       const item = document.createElement('div');
       item.className = 'component-item';

       const iconEl = document.createElement('span');
       iconEl.className = 'component-item-icon';
       iconEl.textContent = comp.icon;

       const infoEl = document.createElement('div');
       infoEl.className = 'component-item-info';
       infoEl.style.cssText = 'flex: 1; min-width: 0;';

       const nameEl = document.createElement('div');
       nameEl.className = 'component-item-name';
       nameEl.textContent = comp.name;

       const descEl = document.createElement('div');
       descEl.className = 'component-item-desc';
       descEl.textContent = comp.description || '';

       infoEl.appendChild(nameEl);
       infoEl.appendChild(descEl);
       item.appendChild(iconEl);
       item.appendChild(infoEl);

       item.addEventListener('click', () => this._showComponentEditor(comp));
       listEl.appendChild(item);
     });
   }

   _showComponentEditor(comp) {
     this._currentEditingComponent = comp;

     const editor  = document.getElementById('component-editor');
     const panel   = document.getElementById('panel-component-selected');

      // Header
      const headerEl = document.createElement('div');
      headerEl.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
      headerEl.innerHTML = '<div><div style="font-size:14px;font-weight:600;">' + comp.icon + ' ' + comp.name + '</div>' +
        '<div style="font-size:10px;color:var(--text-dim);margin-top:2px;">' + comp.description + '</div></div>' +
        '<button id="close-component-editor" class="btn-icon" aria-label="Chiudi editor componente" onclick="this.closest(\'.panel\').style.display=\'none\'">✕</button>';
      editor.appendChild(headerEl);

     // Parameters
     const paramsDiv = document.createElement('div');
     paramsDiv.id = 'component-params';
     for (const [key, spec] of Object.entries(comp.parameters)) {
       const row = document.createElement('div');
       row.style.marginBottom = '6px';

       const label = document.createElement('label');
       label.textContent = key;
       label.style.cssText = 'font-size:10px;color:var(--text-dim);display:block;margin-bottom:2px;';

       const sliderInput = document.createElement('input');
       sliderInput.type = 'range';
       sliderInput.min  = spec.min;
       sliderInput.max  = spec.max;
       sliderInput.step = '0.1';
       sliderInput.value = spec.value;
       sliderInput.id    = 'param-' + key;
       sliderInput.className = 'component-param-slider';
       sliderInput.oninput = function() {
         this.nextElementSibling.textContent = this.value + (spec.unit || '');
       };

       const valueDiv = document.createElement('div');
       valueDiv.className = 'component-param-label';
       const labelSpan = document.createElement('span');
       labelSpan.textContent = key + ':';
       const valueSpan = document.createElement('span');
       valueSpan.className = 'current-value';
       valueSpan.textContent = spec.value + (spec.unit || '');
       valueDiv.appendChild(labelSpan);
       valueDiv.appendChild(valueSpan);

       row.appendChild(label);
       row.appendChild(sliderInput);
       row.appendChild(valueDiv);
       paramsDiv.appendChild(row);
     }
     editor.appendChild(paramsDiv);

     // Divider
     const hr = document.createElement('hr');
     hr.style.cssText = 'border-color:var(--border);margin:8px 0;';
     editor.appendChild(hr);

     // Button row
     const btnRow = document.createElement('div');
     btnRow.style.cssText = 'display:flex;gap:4px;';

     const addBtn = document.createElement('button');
     addBtn.id    = 'btn-add-component';
     addBtn.className = 'btn-primary';
     addBtn.style.cssText = 'flex:1;padding:6px;font-size:11px;border:none;border-radius:4px;color:#fff;background:var(--accent);cursor:pointer;';
     addBtn.textContent = 'Aggiungi';
     btnRow.appendChild(addBtn);

     const resetBtn = document.createElement('button');
     resetBtn.id    = 'btn-reset-component';
     resetBtn.className = 'btn-secondary';
     resetBtn.style.cssText = 'flex:1;padding:6px;font-size:11px;border:none;border-radius:4px;color:var(--text);background:var(--hover);cursor:pointer;';
     resetBtn.textContent = 'Reset';
     btnRow.appendChild(resetBtn);

     editor.appendChild(btnRow);

     panel.style.display = 'block';

     // Handlers
     document.getElementById('btn-add-component').onclick = () => this._addComponentToScene(comp);
     document.getElementById('btn-reset-component').onclick = () => this._resetComponentEditor(comp);
   }

   _resetComponentEditor(comp) {
     const editor = document.getElementById('component-editor');
     editor.innerHTML = '';
     this._showComponentEditor(comp);
   }

  _addComponentToScene(comp) {
    // Read current parameter values from sliders
    const params = {};
    for (const key of Object.keys(comp.parameters)) {
      const input = document.getElementById(`param-${key}`);
      if (input) params[key] = parseFloat(input.value);
    }

    // Generate voxels based on component type
    let voxels = [];

    if (comp.type === 'wheel') {
      voxels = this._createWheelVoxels(params);
    } else if (comp.type === 'tube') {
      voxels = this._createTubeVoxels(params);
    } else {
      this._notify('Tipo componente non ancora supportato', 'warn');
      return;
    }

    // Add voxels to scene
    for (const v of voxels) {
      this.voxelEngine.addVoxel(v, comp.type === 'wheel' ? 'rubber' : 'aluminum');
    }

    this._notify(`Aggiunto ${comp.name} (${voxels.length} voxel)`, 'success');
    this.voxelEngine._onVoxelChanged();
  }

  _createWheelVoxels(params) {
    const rOuter = Math.round(params.outer_radius / 2);
    const rInner = Math.round(params.inner_radius / 2);
    const width = Math.round(params.width);
    const voxels = [];

    // Outer ring (pneumatico)
    for (let x = -rOuter; x <= rOuter; x++) {
      for (let z = -rOuter; z <= rOuter; z++) {
        const dist = Math.sqrt(x*x + z*z);
        if (dist <= rOuter && dist >= rOuter - 2) {
          for (let y = 0; y < width; y++) {
            voxels.push({ x, y, z });
          }
        }
      }
    }

    // Inner ring (cerchio)
    for (let x = -rInner; x <= rInner; x++) {
      for (let z = -rInner; z <= rInner; z++) {
        const dist = Math.sqrt(x*x + z*z);
        if (dist <= rInner && dist >= rInner - 2) {
          for (let y = 0; y < width; y++) {
            voxels.push({ x, y, z });
          }
        }
      }
    }

    return voxels;
  }

  _createTubeVoxels(params) {
    const length = Math.round(params.length);
    const radius = Math.round(params.diameter / 2);
    const thickness = Math.round(params.wall_thickness);
    const voxels = [];

    // Tubo orizzontale asse X
    for (let x = 0; x < length; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const dist = Math.sqrt(y*y + z*z);
          if (dist <= radius && dist >= radius - thickness) {
            voxels.push({ x, y, z });
          }
        }
      }
    }

    return voxels;
  }
}

export default UI;