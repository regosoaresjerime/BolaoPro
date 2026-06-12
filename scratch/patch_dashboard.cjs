const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'AdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore the lost states and add new pool configuration states
const oldStateAnchor = `  // Tabs for the Admin Workspace: 'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'\n  const [activeAdminTab, setActiveAdminTab] = useState<'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'>('kpis');\n\n\n  const [selectedTeamsForPool, setSelectedTeamsForPool] = useState<string[]>([]);`;

const newStateContent = `  // Tabs for the Admin Workspace: 'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'\n  const [activeAdminTab, setActiveAdminTab] = useState<'kpis' | 'comissoes' | 'partidas' | 'notificacoes' | 'boloes' | 'times'>('kpis');\n\n  // Create Pool State\n  const [poolName, setPoolName] = useState('');\n  const [poolCode, setPoolCode] = useState('');\n  const [poolFee, setPoolFee] = useState('50');\n  const [poolDesc, setPoolDesc] = useState('');\n  const [poolFeeType, setPoolFeeType] = useState<'percent' | 'fixed'>('percent');\n  const [poolFeeValue, setPoolFeeValue] = useState<number>(20);\n  const [poolMaxParticipants, setPoolMaxParticipants] = useState<number>(100);\n\n  const [selectedTeamsForPool, setSelectedTeamsForPool] = useState<string[]>([]);`;

if (content.includes(oldStateAnchor)) {
  content = content.replace(oldStateAnchor, newStateContent);
  console.log('1. States added successfully.');
} else {
  console.log('1. Anchor for states not found or already changed.');
}

// 2. Update handleAdminCreatePool to save new fields
const oldCreatePoolAnchor = `    const newPool: Pool = {
      id: \`p-\${Date.now()}\`,
      name: poolName.trim(),
      creator: user.fullName || 'Organizador',
      entryFee: parseFloat(poolFee) || 50,
      accumulatedPrize: 0,
      inviteCode: poolCode.toUpperCase().trim(),
      memberCount: 0,
      description: poolDesc.trim() || 'Bolão personalizado de apostas esportivas.',
      selectedTeams: selectedTeamsForPool,
      selectedMatchIds: selectedMatchIdsForPool
    };`;

const newCreatePoolContent = `    const newPool: Pool = {
      id: \`p-\${Date.now()}\`,
      name: poolName.trim(),
      creator: user.fullName || 'Organizador',
      entryFee: parseFloat(poolFee) || 50,
      accumulatedPrize: 0,
      inviteCode: poolCode.toUpperCase().trim(),
      memberCount: 0,
      description: poolDesc.trim() || 'Bolão personalizado de apostas esportivas.',
      selectedTeams: selectedTeamsForPool,
      selectedMatchIds: selectedMatchIdsForPool,
      feeType: poolFeeType,
      feeValue: poolFeeValue,
      maxParticipants: poolMaxParticipants
    };`;

if (content.includes(oldCreatePoolAnchor)) {
  content = content.replace(oldCreatePoolAnchor, newCreatePoolContent);
  console.log('2. handleAdminCreatePool newPool object updated.');
} else {
  // Try another spacing variant
  const oldCreatePoolAnchor2 = `    const newPool: Pool = {
      id: \`p-\${Date.now()}\`,\n      name: poolName.trim(),\n      creator: user.fullName || 'Organizador',\n      entryFee: parseFloat(poolFee) || 50,\n      accumulatedPrize: 0,\n      inviteCode: poolCode.toUpperCase().trim(),\n      memberCount: 0,\n      description: poolDesc.trim() || 'Bolão personalizado de apostas esportivas.',\n      selectedTeams: selectedTeamsForPool,\n      selectedMatchIds: selectedMatchIdsForPool\n    };`;
  if (content.includes(oldCreatePoolAnchor2)) {
    content = content.replace(oldCreatePoolAnchor2, newCreatePoolContent);
    console.log('2. handleAdminCreatePool newPool object updated (spacing 2).');
  } else {
    console.log('2. handleAdminCreatePool newPool anchor not found.');
  }
}

// Update state reset in handleAdminCreatePool
const oldResets = `    setSelectedTeamsForPool([]);
    setSelectedMatchIdsForPool([]);`;

const newResets = `    setSelectedTeamsForPool([]);
    setSelectedMatchIdsForPool([]);
    setPoolFeeType('percent');
    setPoolFeeValue(20);
    setPoolMaxParticipants(100);`;

if (content.includes(oldResets)) {
  content = content.replace(oldResets, newResets);
  console.log('2b. State resets updated.');
} else {
  console.log('2b. State resets anchor not found.');
}

// 3. Update activeAdminTab === 'comissoes' title/subtitle and remove save button
const oldComissoesText = `            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Configuração Tributária</h2>
              <p className="text-xs text-on-surface-variant mt-1">Defina as taxas retidas por novos inscritos e projete arrecadações.</p>
            </div>`;

const newComissoesText = `            <div>
              <h2 className="text-2xl font-bold tracking-tight text-on-surface">Simulador de Custos e Premiação</h2>
              <p className="text-xs text-on-surface-variant mt-1">Defina valores fictícios para simular e planejar a arrecadação dos seus bolões. Os parâmetros contábeis oficiais são definidos individualmente na criação de cada bolão.</p>
            </div>`;

if (content.includes(oldComissoesText)) {
  content = content.replace(oldComissoesText, newComissoesText);
  console.log('3. comissoes subtitle updated.');
}

const oldSaveButton = `                {/* Action save CTA */}
                <button 
                  onClick={handleSaveCommissions}
                  className="mt-2 h-11 bg-[#00E676] hover:bg-[#62ff96] text-[#00210b] font-label-bold text-label-bold uppercase rounded-lg font-bold tracking-wider transition-colors active:scale-95 cursor-pointer"
                >
                  Salvar Parâmetros
                </button>`;

const newSaveButton = `                {/* Action save CTA */}
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs leading-relaxed text-center">
                  💡 <strong>Painel de Prospecção Ativo:</strong> Use os campos acima e o slider ao lado para projetar faturamentos. As regras reais de comissão e taxa são definidas no menu <strong>Criação de Bolões</strong>.
                </div>`;

if (content.includes(oldSaveButton)) {
  content = content.replace(oldSaveButton, newSaveButton);
  console.log('3b. Save parameters button replaced with simulation notice.');
} else {
  // Try with slightly different spacing/newlines
  const regexSaveButton = /\{\/\* Action save CTA \*\/\}\s*<button[\s\S]*?onClick=\{handleSaveCommissions\}[\s\S]*?>\s*Salvar Parâmetros\s*<\/button>/;
  if (regexSaveButton.test(content)) {
    content = content.replace(regexSaveButton, newSaveButton);
    console.log('3b. Save parameters button replaced (regex).');
  } else {
    console.log('3b. Save parameters button not found.');
  }
}

// 4. Add new inputs and projection card to Create Pool form
const oldDescField = `              {/* Pool description */}
              <div className="flex flex-col gap-1.5 font-bold">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Descrição / Regras Especiais</label>
                <textarea 
                  rows={2}
                  value={poolDesc}
                  onChange={(e) => setPoolDesc(e.target.value)}
                  placeholder="Defina o destino das fatias, prazos limite para envio dos palpites, etc."
                  className="bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold p-3 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>`;

// Calculate values inline in JS to inject
const newFieldsAndCalculator = `              {/* Pool description */}
              <div className="flex flex-col gap-1.5 font-bold">
                <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Descrição / Regras Especiais</label>
                <textarea 
                  rows={2}
                  value={poolDesc}
                  onChange={(e) => setPoolDesc(e.target.value)}
                  placeholder="Defina o destino das fatias, prazos limite para envio dos palpites, etc."
                  className="bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold p-3 rounded-lg text-xs focus:outline-none resize-none"
                />
              </div>

              {/* SECTION: Configurações Contábeis do Bolão (Nova Seção) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#1f2937]/40 pt-4 mt-2">
                {/* Commission Type Toggle */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Cobrança da Banca</span>
                  <div className="grid grid-cols-2 bg-[#090D14] p-1 rounded-lg border border-[#1f2937]">
                    <button 
                      type="button"
                      onClick={() => setPoolFeeType('percent')}
                      className={\`py-1 rounded font-bold text-xs transition-all cursor-pointer \${
                        poolFeeType === 'percent' 
                          ? 'bg-primary text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }\`}
                    >
                      Porcentagem (%)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPoolFeeType('fixed')}
                      className={\`py-1 rounded font-bold text-xs transition-all cursor-pointer \${
                        poolFeeType === 'fixed' 
                          ? 'bg-primary text-[#00210b]' 
                          : 'text-on-surface-variant hover:text-on-surface'
                      }\`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                {/* Commission Value Input */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                    {poolFeeType === 'percent' ? 'Comissão da Banca (%)' : 'Comissão da Banca (R$)'}
                  </label>
                  <input 
                    type="number" 
                    value={poolFeeValue} 
                    onChange={(e) => setPoolFeeValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none focus:border-[#00e676]"
                    required
                  />
                </div>

                {/* Max Participants Input */}
                <div className="flex flex-col gap-1.5 font-bold">
                  <label className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Nº Máximo de Participantes</label>
                  <input 
                    type="number" 
                    value={poolMaxParticipants} 
                    onChange={(e) => setPoolMaxParticipants(Math.max(2, parseInt(e.target.value) || 0))}
                    className="h-10 bg-[#090D14] border border-[#1f2937] text-on-surface font-semibold px-3 rounded-lg text-xs focus:outline-none focus:border-[#00e676]"
                    min="2"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Projection Preview Card */}
              {(() => {
                const maxGrossPrize = poolMaxParticipants * (parseFloat(poolFee) || 0);
                const maxCommission = poolFeeType === 'percent'
                  ? maxGrossPrize * (poolFeeValue / 100)
                  : poolMaxParticipants * poolFeeValue;
                const maxNetPrize = Math.max(0, maxGrossPrize - maxCommission);

                const maxFirstPlace = maxNetPrize * (tenantSettings.firstPlacePct / 100);
                const maxSecondPlace = maxNetPrize * (tenantSettings.secondPlacePct / 100);
                const maxThirdPlace = maxNetPrize * (tenantSettings.thirdPlacePct / 100);

                return (
                  <div className="bg-[#181C22] border border-[#1f2937] p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                    <span className="text-xs font-bold text-[#ffd33c] uppercase tracking-wide flex items-center gap-1.5">
                      <CircleDollarSign className="w-4 h-4 text-[#ffd33c]" /> Projeção de Premiação Máxima (Simulada)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/30 border border-outline-variant/20 p-3 rounded-lg text-xs">
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface-variant">Faturamento Máx. Bruto:</span>
                        <span className="font-mono text-white font-bold">R$ {maxGrossPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface-variant">Comissão Máx. Banca:</span>
                        <span className="font-mono text-[#ffe16d] font-bold">R$ {maxCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between md:flex-col md:gap-1">
                        <span className="text-on-surface font-semibold">Prêmio Máx. Líquido:</span>
                        <span className="font-mono text-[#00e676] font-bold">R$ {maxNetPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] text-on-surface-variant border-t border-[#1f2937]/50 pt-2">
                      <div className="flex flex-col">
                        <span>1º Colocado ({tenantSettings.firstPlacePct}%)</span>
                        <span className="font-bold text-white">R$ {maxFirstPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex flex-col">
                        <span>2º Colocado ({tenantSettings.secondPlacePct}%)</span>
                        <span className="font-bold text-white">R$ {maxSecondPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex flex-col">
                        <span>3º Colocado ({tenantSettings.thirdPlacePct}%)</span>
                        <span className="font-bold text-white">R$ {maxThirdPlace.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}`;

if (content.includes(oldDescField)) {
  content = content.replace(oldDescField, newFieldsAndCalculator);
  console.log('4. Create Pool form fields and real-time calculator injected.');
} else {
  console.log('4. Create Pool description field anchor not found.');
}

// 5. Update active pools list item cards in "boloes" tab
const oldPoolListFooter = `                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/35 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-on-surface-variant font-medium">Inscrição</span>
                        <span className="font-bold text-on-surface">R$ {p.entryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-on-surface-variant font-medium">Acumulado ({p.memberCount || 0} integrantes)</span>
                        <span className="font-bold text-[#00E676]">R$ {(p.accumulatedPrize || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>`;

const newPoolListFooter = `                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/35 text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-on-surface-variant font-medium">Inscrição</span>
                        <span className="font-bold text-on-surface">R$ {p.entryFee.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-on-surface-variant font-medium">Acumulado ({p.memberCount || 0} integrantes)</span>
                        <span className="font-bold text-[#00E676]">R$ {(p.accumulatedPrize || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {/* Financial details specific to this pool */}
                    <div className="bg-[#090D14]/80 p-2.5 rounded-lg border border-[#1f2937] flex flex-col gap-1.5 mt-2 text-[10px]">
                      <div className="flex justify-between items-center text-on-surface-variant">
                        <span>Limite Participantes:</span>
                        <span className="font-bold text-white">{p.maxParticipants || 100} apostadores</span>
                      </div>
                      <div className="flex justify-between items-center text-on-surface-variant">
                        <span>Comissão da Banca:</span>
                        <span className="font-bold text-[#ffe16d]">
                          {p.feeType === 'fixed' 
                            ? \`R$ \${(p.feeValue || 0).toFixed(2)} fixo\` 
                            : \`\${p.feeValue || 20}%\`
                          }
                        </span>
                      </div>
                      
                      {/* Calculate pool specific maximum prize values */}
                      {(() => {
                        const fee = p.entryFee;
                        const maxP = p.maxParticipants || 100;
                        const fType = p.feeType || 'percent';
                        const fVal = p.feeValue || 20;
                        const pPool = maxP * fee;
                        const pComm = fType === 'percent' ? pPool * (fVal / 100) : maxP * fVal;
                        const netP = Math.max(0, pPool - pComm);
                        
                        return (
                          <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-[#1f2937]/50 mt-1 text-[9px] text-on-surface-variant">
                            <div>
                              <span className="block opacity-75">1º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.firstPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div>
                              <span className="block opacity-75">2º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.secondPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div>
                              <span className="block opacity-75">3º Lugar:</span>
                              <span className="font-semibold text-white">R$ {(netP * (tenantSettings.thirdPlacePct / 100)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>`;

if (content.includes(oldPoolListFooter)) {
  content = content.replace(oldPoolListFooter, newPoolListFooter);
  console.log('5. Pools list card display updated with max prizes.');
} else {
  console.log('5. Pools list card anchor not found.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminDashboard.tsx patch completed.');
