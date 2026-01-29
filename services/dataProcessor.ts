import { Officer, MissionType, UnitType, SelectionConfig, SelectionResult, AuditLog, SheetData } from '../types';
import { SPECIAL_GROUPS } from '../constants';

// --- Helpers de Utilidade ---

/**
 * Converte valores de data da planilha (string ou número Excel) para objetos Date.
 * Suporta o formato brasileiro DD/MM/YYYY.
 */
const safeDate = (dStr: string | number | undefined): Date | null => {
    if (dStr === undefined || dStr === null) return null;
    
    if (typeof dStr === 'number') {
        // Conversão de data serial do Excel (dias desde 1900)
        const d = new Date(Math.round((dStr - 25569) * 86400 * 1000));
        return isNaN(d.getTime()) ? null : d;
    }

    if (typeof dStr === 'string') {
        const cleanStr = dStr.trim();
        if (cleanStr === '') return null;
        
        // Trata formato DD/MM/YYYY
        if (cleanStr.includes('/')) {
            const parts = cleanStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; 
                const year = parseInt(parts[2], 10);
                const d = new Date(year, month, day);
                return isNaN(d.getTime()) ? null : d;
            }
        }
        const d = new Date(cleanStr);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

/**
 * Limpa e converte valores numéricos da planilha, tratando vírgulas como pontos decimais.
 */
const parsePFRNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanVal = String(val).replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleanVal);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Identifica o plantão mais recente (Art. 4, III e Art. 12, § 2º) entre várias colunas.
 */
const calculateRecency = (dates: (string | number | undefined)[]): Date | null => {
    let maxDate: Date | null = null;
    dates.forEach(dVal => {
        const d = safeDate(dVal);
        if (d) {
            if (!maxDate || d > maxDate) maxDate = d;
        }
    });
    return maxDate;
};

/**
 * Normaliza os nomes das colunas (chaves) para minúsculas, sem espaços e sem acentos.
 * Isso remove a sensibilidade a Case Sensitive (Maiúsculas/Minúsculas).
 */
const normalizeRow = (row: Record<string, any>): Record<string, any> => {
    const newRow: Record<string, any> = {};
    Object.keys(row).forEach(key => {
        const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let value = row[key];
        if (typeof value === 'string') {
            value = value.trim();
        }
        newRow[cleanKey] = value;
    });
    return newRow;
};

// --- Pipeline Principal de Dados ---

export const mergeData = (inputs: SheetData): Officer[] => {
    // 1. Normalização dos Dataframes (Ignora Case Sensitive e Acentos)
    const opsData = inputs.operacional.map(normalizeRow);
    const origemData = inputs.origem.map(normalizeRow);
    const externaData = inputs.externas.map(normalizeRow);
    const restricaoData = inputs.restricoes.map(normalizeRow);

    // 2. Indexação para Cruzamento Rápido (Merge) pela Matrícula
    const origemMap = new Map(origemData.map(i => [String(i['matricula'] || '').trim(), i]));
    const missionMap = new Map(externaData.map(i => [String(i['matricula'] || '').trim(), i]));
    
    // Filtragem de restrições (remove entradas vazias para evitar falsos positivos)
    const restrictedMatriculas = restricaoData
        .map(i => String(i['matricula'] || '').trim())
        .filter(m => m.length > 0);
    const restrictionSet = new Set(restrictedMatriculas);

    const officers: Officer[] = [];

    // VISÃO 1: Horas Operacionais (Base: Aba 'Hrs Operacionais - Frequência')
    opsData.forEach((op, index) => {
        const mat = String(op['matricula'] || '').trim();
        if (!mat) return; 

        // VISÃO 2 & 3: Dados de IFR e Recência (Fonte: Aba 'Origem')
        const origem = origemMap.get(mat) || {};
        const chIfr = parsePFRNumber(origem['carga horaria ifr']);
        const qtd12h = parseInt(String(origem['qtd ifr - 12h'] || '0'), 10);

        // Identifica automaticamente o plantão mais recente (Data1 a Data4)
        const dateColumns = [origem['data1'], origem['data2'], origem['data3'], origem['data4']];
        const maxIfrDate = calculateRecency(dateColumns);

        // VISÃO 4: Convocações Externas (Fonte: Aba 'Convocações Externas')
        const mission = missionMap.get(mat);
        const lastMissionDate = safeDate(mission?.['data fim']);
        
        let inQuarantine = false;
        if (lastMissionDate) {
            // Regra dos 180 dias (Art. 8º da IS 16/2026)
            const daysSince = (new Date().getTime() - lastMissionDate.getTime()) / (1000 * 3600 * 24);
            if (daysSince < 180) inQuarantine = true;
        }

        // VISÃO 5: Restrições (Fonte: Aba 'Restrições')
        const isRestricted = restrictionSet.has(mat);

        // Lógica de Lotação e Grupos
        const rawLotacao = (op['lotacao'] || '').toUpperCase();
        let group = '';
        SPECIAL_GROUPS.forEach(g => {
            if (rawLotacao.includes(g)) group = g;
        });

        let type = UnitType.NUCLEO;
        if (rawLotacao.includes('DEL') || rawLotacao.includes('DELEGACIA')) {
            type = UnitType.DELEGACIA;
        }

        // Captura o valor de Horas Operacionais (Normalizado)
        const hOps = parsePFRNumber(op['horas operacional'] || op['horas operacionais']);

        officers.push({
            id: `off-${index}`,
            matricula: mat,
            nome: op['servidor'] || op['nome'] || 'Desconhecido', 
            unidade: rawLotacao,
            tipo_unidade: type,
            grupo_especial: group,
            horas_operacionais: hOps,
            carga_horaria_ifr: chIfr,
            qtd_ifr_12h: qtd12h,
            data_ultimo_ifr: maxIfrDate, 
            tempo_cargo_dias: 0,
            idade_anos: 0,
            restricao: isRestricted,
            data_fim_ultima_missao: lastMissionDate,
            em_quarentena: inQuarantine,
            justificativa: ''
        });
    });

    return officers;
};

// --- Algoritmos de Ordenação ---

const compareDatesDesc = (a: Date | null, b: Date | null) => {
    if (!a && !b) return 0;
    if (!a) return 1; 
    if (!b) return -1;
    return b.getTime() - a.getTime();
};

const sortRegional = (candidates: Officer[]) => {
    candidates.sort((a, b) => {
        // 1. Menor Horas Operacionais (Art. 12)
        if (a.horas_operacionais !== b.horas_operacionais) return a.horas_operacionais - b.horas_operacionais; 
        // 2. Maior IFR (Desempate)
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        // 3. Maior QTD 12h
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        // 4. Data de IFR mais recente
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

const sortNational = (candidates: Officer[]) => {
    candidates.sort((a, b) => {
        // 1. Maior IFR (Art. 4)
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        // 2. Maior QTD 12h
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        // 3. Data de IFR mais recente (Recência Automática)
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

// --- Ranking e Restrições de Cota ---

export const runSelectionProcess = (
    allOfficers: Officer[], 
    config: SelectionConfig
): SelectionResult => {
    const logs: AuditLog[] = [];
    const selected: Officer[] = [];
    const selectedIds = new Set<string>();
    
    const unitCounts: Record<string, number> = {};
    const groupCounts: Record<string, number> = {};

    // 1. Filtragem Inicial (Restrições e Quarentena)
    let candidates = allOfficers.filter(o => {
        if (o.restricao) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Impedido: Consta na aba de Restrições' });
            return false;
        }

        if (config.missionType === MissionType.NATIONAL && o.em_quarentena) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Impedido: Interstício < 180 dias (Art. 8º)' });
            return false;
        }
        return true;
    });

    // 2. Ordenação
    if (config.missionType === MissionType.REGIONAL) {
        sortRegional(candidates);
    } else {
        sortNational(candidates);
    }

    const attemptAddOfficer = (off: Officer, method: 'ranking' | 'group_integrity', reason: string): boolean => {
        if (selectedIds.has(off.id)) return false;

        // Regra de Cotas (Art. 7º § 1º: Não se aplica a grupos especializados)
        const isSpecialized = off.grupo_especial && SPECIAL_GROUPS.includes(off.grupo_especial);
        
        if (!isSpecialized) {
            const limit = off.tipo_unidade === UnitType.DELEGACIA ? 2 : 1;
            const current = unitCounts[off.unidade] || 0;

            if (current >= limit) {
                 logs.push({ matricula: off.matricula, nome: off.nome, status: 'skipped', reason: `Limite Unidade (${off.unidade}): ${limit} vaga(s) preenchida(s)` });
                 return false;
            }
            unitCounts[off.unidade] = current + 1;
        }

        off.justificativa = reason;
        selected.push(off);
        selectedIds.add(off.id);
        
        if (isSpecialized) {
            groupCounts[off.grupo_especial] = (groupCounts[off.grupo_especial] || 0) + 1;
        }

        logs.push({ 
            matricula: off.matricula, 
            nome: off.nome, 
            status: method === 'ranking' ? 'selected' : 'forced', 
            reason: isSpecialized && method === 'ranking' ? `${reason} (Isento de Cota)` : reason 
        });
        return true;
    };

    // 3. Loop de Seleção
    for (const candidate of candidates) {
        if (selected.length >= config.numVagas) break;
        if (selectedIds.has(candidate.id)) continue;

        let reason = "";
        const dataFmt = candidate.data_ultimo_ifr ? candidate.data_ultimo_ifr.toLocaleDateString() : 'N/A';
        
        if (config.missionType === MissionType.REGIONAL) {
            reason = `Menor Ops (${candidate.horas_operacionais}h) | IFR: ${candidate.carga_horaria_ifr}h | Plantão: ${dataFmt}`;
        } else {
            reason = `Maior IFR (${candidate.carga_horaria_ifr}h) | Turnos 12h: ${candidate.qtd_ifr_12h} | Plantão: ${dataFmt}`;
        }

        const added = attemptAddOfficer(candidate, 'ranking', reason);

        // ART. 5º: Integridade das Equipes Especializadas (NOE, GOC, GMP, GPT, GFT)
        if (added && candidate.grupo_especial && SPECIAL_GROUPS.includes(candidate.grupo_especial)) {
            const grp = candidate.grupo_especial;
            
            // Se o sistema selecionar 2 membros, puxa automaticamente o restante da equipe (até 4 membros)
            if (groupCounts[grp] === 2) {
                const teamMates = candidates.filter(c => 
                    c.grupo_especial === grp && 
                    !selectedIds.has(c.id)
                );

                for (const mate of teamMates) {
                    if (groupCounts[grp] >= 4) break; 
                    if (selected.length >= config.numVagas) break; 

                    attemptAddOfficer(mate, 'group_integrity', `Mobilização Coletiva ${grp} (Art. 5º)`);
                }
            }
        }
    }

    return { selected, auditLogs: logs };
};
