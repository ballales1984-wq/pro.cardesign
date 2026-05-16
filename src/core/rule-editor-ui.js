/**
 * RuleEditorUI - Visual editor for procedural rules
 * Creates interactive UI for building parametric geometry
 */
export class RuleEditorUI {
  constructor(container, proceduralEngine) {
    this.container = container;
    this.engine = proceduralEngine;
    this.rules = [];
    this.selectedRule = null;
  }

  /**
   * Initialize the rule editor UI
   */
  init() {
    this.container.innerHTML = this._getTemplate();
    this._attachEventListeners();
    this._renderRuleList();
  }

  _getTemplate() {
    return `
      <div class="rule-editor">
        <h3>Procedural Rule Editor</h3>
        
        <div class="rule-list-section">
          <h4>Rules</h4>
          <ul id="rule-list" class="rule-list"></ul>
          <button id="add-rule-btn" class="btn-primary">+ New Rule</button>
        </div>
        
        <div class="rule-editor-section">
          <h4>Rule Editor</h4>
          <div id="rule-form"></div>
        </div>
        
        <div class="preview-section">
          <h4>Preview</h4>
          <button id="preview-btn" class="btn-secondary">Preview Geometry</button>
          <div id="preview-status"></div>
        </div>
      </div>
    `;
  }

  _attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'add-rule-btn') {
        this._createNewRule();
      }
      if (e.target.classList.contains('edit-rule')) {
        const ruleId = e.target.dataset.ruleId;
        this._editRule(ruleId);
      }
      if (e.target.classList.contains('delete-rule')) {
        const ruleId = e.target.dataset.ruleId;
        this._deleteRule(ruleId);
      }
      if (e.target.id === 'preview-btn') {
        this._previewRule();
      }
    });
  }

  _renderRuleList() {
    const listEl = this.container.querySelector('#rule-list');
    listEl.innerHTML = this.rules.map(rule => `
      <li class="rule-item" data-rule-id="${rule.id}">
        <span class="rule-name">${rule.name}</span>
        <span class="rule-type">${rule.type}</span>
        <button class="btn-small edit-rule" data-rule-id="${rule.id}">Edit</button>
        <button class="btn-small delete-rule" data-rule-id="${rule.id}">Del</button>
      </li>
    `).join('');
  }

  _createNewRule() {
    const ruleName = prompt('Rule name:', 'new_rule');
    if (!ruleName) return;
    
    const ruleType = prompt('Rule type (cube, line, extrude, symmetry, hole):', 'cube');
    if (!ruleType) return;
    
    const rule = {
      id: Date.now().toString(),
      name: ruleName,
      type: ruleType,
      params: {},
      enabled: true
    };
    
    this.rules.push(rule);
    this._renderRuleList();
    this._editRule(rule.id);
  }

  _editRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return;
    
    this.selectedRule = rule;
    this._renderRuleForm(rule);
  }

  _renderRuleForm(rule) {
    const formEl = this.container.querySelector('#rule-form');
    
    const paramInputs = this._getParamInputs(rule.type);
    
    formEl.innerHTML = `
      <div class="rule-form">
        <label>Name: <input type="text" id="rule-name" value="${rule.name}"></label>
        <label>Type: ${rule.type}</label>
        ${paramInputs}
        <button id="save-rule-btn" class="btn-primary">Save Rule</button>
      </div>
    `;
    
    formEl.querySelector('#save-rule-btn').onclick = () => this._saveRule(rule);
  }

  _getParamInputs(ruleType) {
    const params = {
      cube: `
        <label>Width: <input type="number" id="param-width" value="10"></label>
        <label>Height: <input type="number" id="param-height" value="10"></label>
        <label>Depth: <input type="number" id="param-depth" value="10"></label>
        <label>Material: <input type="text" id="param-material" value="steel"></label>
      `,
      line: `
        <label>Length: <input type="number" id="param-length" value="10"></label>
        <label>Axis: <select id="param-axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
        <label>Material: <input type="text" id="param-material" value="steel"></label>
      `,
      hole: `
        <label>Width: <input type="number" id="param-width" value="5"></label>
        <label>Height: <input type="number" id="param-height" value="5"></label>
        <label>Depth: <input type="number" id="param-depth" value="5"></label>
      `,
      extrude: `
        <label>Height: <input type="number" id="param-height" value="10"></label>
        <label>Direction: <select id="param-direction"><option value="y">Y</option><option value="x">X</option><option value="z">Z</option></select></label>
      `,
      symmetry: `
        <label>Axis: <select id="param-axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
        <label>Copies: <input type="number" id="param-copies" value="2" min="1"></label>
      `
    };
    
    return params[ruleType] || '';
  }

  _saveRule(rule) {
    rule.name = this.container.querySelector('#rule-name')?.value || rule.name;
    
    // Collect other params based on type
    if (rule.type === 'cube') {
      rule.params = {
        dimensions: [
          parseInt(this.container.querySelector('#param-width')?.value || 10),
          parseInt(this.container.querySelector('#param-height')?.value || 10),
          parseInt(this.container.querySelector('#param-depth')?.value || 10)
        ],
        material: this.container.querySelector('#param-material')?.value || 'steel'
      };
    }
    
    this.selectedRule = null;
    this._renderRuleList();
    this._showNotification('Rule saved', 'success');
  }

  _deleteRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this._renderRuleList();
  }

  _previewRule() {
    if (!this.selectedRule) {
      this._showNotification('Select a rule to preview', 'warn');
      return;
    }
    
    const statusEl = this.container.querySelector('#preview-status');
    statusEl.textContent = 'Generating preview...';
    
    try {
      // Execute the rule
      const voxels = this.engine.execute(this.selectedRule.name, this.selectedRule.params);
      statusEl.textContent = `Generated ${voxels.length} voxels`;
      statusEl.className = 'status-success';
    } catch (e) {
      statusEl.textContent = 'Error: ' + e.message;
      statusEl.className = 'status-error';
    }
  }

  _showNotification(message, level) {
    const el = this.container.querySelector('#preview-status');
    if (el) {
      el.textContent = message;
      el.className = `status-${level}`;
    }
  }

  /**
   * Load rules from JSON
   */
  loadFromJSON(data) {
    this.rules = data.rules || [];
    this._renderRuleList();
  }

  /**
   * Export rules to JSON
   */
  toJSON() {
    return { rules: this.rules };
  }
}