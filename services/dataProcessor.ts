import { Officer, MissionType, UnitType, SelectionConfig, SelectionResult, AuditLog, SheetData } from '../types';
import { SPECIAL_GROUPS } from '../constants';

// --- Helpers ---

const safeDate = (dStr: string | number | undefined): Date | null => {
    if (dStr === undefined || dStr === null) return null;
    
    // Excel might return a number (days since 1900)
    if (typeof dStr === 'number') {
        const d = new Date(Math.round((dStr - 25569) * 86400 * 1000));
        return isNaN(d.getTime()) ? null : d;
    }

    if (typeof dStr === 'string') {
        if (dStr.trim() === '') return null;
        // Handle DD/MM/YYYY format
        if (dStr.includes('/')) {
            const parts = dStr.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; 
                const year = parseInt(parts[2], 10);
                const d = new Date(year, month, day);
                return isNaN(d.getTime()) ? null : d;
            }
        }
        // Handle ISO
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

// Returns the max date from a list of values (Logic for View 3)
const calculateRecency = (dates: (string | number | undefined)[]): Date | null => {
    let max: Date | null = null;
    dates.forEach(dVal => {
        const d = safeDate(dVal);
        if (d) {
            if (!max || d > max) max = d;
        }
    });
    return max;
};

/**
 * Normalizes an object's keys to lowercase to ensure case-insensitive column matching.
 * Also trims values if they are strings.
 */
const normalizeRow = (row: Record<string, any>): Record<string, any> => {
    const newRow: Record<string, any> = {};
    Object.keys(row).forEach(key => {
        const cleanKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let value = row[key];
        // Trim string values to avoid matching issues
        if (typeof value === 'string') {
            value = value.trim();
        }
        newRow[cleanKey] = value;
    });
    return newRow;
};

// --- Core Data Pipeline ---

export const mergeData = (inputs: SheetData): Officer[] => {
    // 1. Normalize all inputs for case-insensitive column access
    const opsData = inputs.operacional.map(normalizeRow);
    const origemData = inputs.origem.map(normalizeRow);
    const externaData = inputs.externas.map(normalizeRow);
    const restricaoData = inputs.restricoes.map(normalizeRow);

    // 2. Index auxiliary tables by 'Matrícula' (Primary Key)
    const origemMap = new Map(origemData.map(i => [String(i['matricula'] || '').trim(), i]));
    const missionMap = new Map(externaData.map(i => [String(i['matricula'] || '').trim(), i]));
    const restrictionSet = new Set(restricaoData.map(i => String(i['matricula'] || '').trim()));

    // 3. Merge Strategy - Processing the 5 Logical Views
    const officers: Officer[] = [];

    // VIEW 1: Horas Operacionais (Base List)
    // Source: Aba 'Hrs Operacionais - Frequência'
    // Columns: Servidor, Matrícula, Lotação, Horas operacional
    opsData.forEach((op, index) => {
        const mat = String(op['matricula'] || '').trim();
        if (!mat) return; // Skip empty rows

        // VIEW 2: Horas de IFR (Stats)
        // Source: Aba 'Origem'
        // Columns: Carga Horária IFR, QTD IFR - 12h, QTD IFR - 6h
        const origem = origemMap.get(mat) || {};
        const chIfr = parseFloat(origem['carga horaria ifr'] || '0');
        const qtd12h = parseInt(origem['qtd ifr - 12h'] || '0');

        // VIEW 3: Detalhes dos IFRs (Recency)
        // Source: Aba 'Origem'
        // Columns: Data1, Data2, Data3, Data4
        // Logic: Calculate max date
        const dateColumns = [origem['data1'], origem['data2'], origem['data3'], origem['data4']];
        const maxIfrDate = calculateRecency(dateColumns);

        // VIEW 4: Convocações Externas (Quarantine)
        // Source: Aba 'Convocações Externas'
        // Columns: Data Fim
        const mission = missionMap.get(mat);
        const lastMissionDate = safeDate(mission?.['data fim']);
        
        let inQuarantine = false;
        if (lastMissionDate) {
            // Check 6 months (180 days) - Art. 8 da IS 16/2026
            const daysSince = (new Date().getTime() - lastMissionDate.getTime()) / (1000 * 3600 * 24);
            if (daysSince < 180) inQuarantine = true;
        }

        // VIEW 5: Restrições (Exclusion)
        // Source: Aba 'Restrições'
        // Logic: Existence in the list implies restriction
        const isRestricted = restrictionSet.has(mat);

        // --- Metadata Parsing ---
        const rawLotacao = (op['lotacao'] || '').toUpperCase();
        let group = '';
        SPECIAL_GROUPS.forEach(g => {
            if (rawLotacao.includes(g)) group = g;
        });

        let type = UnitType.NUCLEO;
        if (rawLotacao.includes('DEL') || rawLotacao.includes('DELEGACIA')) {
            type = UnitType.DELEGACIA;
        }

        officers.push({
            id: `off-${index}`,
            matricula: mat,
            nome: op['servidor'] || op['nome'], 
            unidade: rawLotacao,
            tipo_unidade: type,
            grupo_especial: group,
            
            // View 1 Data
            horas_operacionais: parseFloat(op['horas operacional'] || '0'),
            
            // View 2 Data
            carga_horaria_ifr: chIfr,
            qtd_ifr_12h: qtd12h,

            // View 3 Data
            data_ultimo_ifr: maxIfrDate, 
            
            // Defaulting tie-breakers (Tempo/Idade not in current scope)
            tempo_cargo_dias: 0,
            idade_anos: 0,
            
            // View 5 Data
            restricao: isRestricted,

            // View 4 Data
            data_fim_ultima_missao: lastMissionDate,
            em_quarentena: inQuarantine,
            
            justificativa: ''
        });
    });

    return officers;
};

// --- Sorting Algorithms ---

const compareDatesDesc = (a: Date | null, b: Date | null) => {
    if (!a && !b) return 0;
    if (!a) return 1; 
    if (!b) return -1;
    return b.getTime() - a.getTime();
};

const sortRegional = (candidates: Officer[]) => {
    // 1. Min Ops Hours (ASC)
    // 2. Max IFR Hours (DESC) (Tie breaker)
    // 3. Max IFR Shifts (DESC) (Tie breaker)
    // 4. Max IFR Date (DESC) (Recency - Data_Recente_IFR)
    candidates.sort((a, b) => {
        if (a.horas_operacionais !== b.horas_operacionais) return a.horas_operacionais - b.horas_operacionais; 
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

const sortNational = (candidates: Officer[]) => {
    // 1. Max IFR Hours (DESC)
    // 2. Max IFR Shifts (DESC)
    // 3. Max IFR Date (DESC) (Recency)
    candidates.sort((a, b) => {
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

// --- Ranking & Constraints ---

export const runSelectionProcess = (
    allOfficers: Officer[], 
    config: SelectionConfig
): SelectionResult => {
    const logs: AuditLog[] = [];
    const selected: Officer[] = [];
    const selectedIds = new Set<string>();
    
    // Constraint Trackers
    const unitCounts: Record<string, number> = {};
    const groupCounts: Record<string, number> = {};

    // 1. Initial Filtering
    let candidates = allOfficers.filter(o => {
        if (o.restricao) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Restrição Administrativa/Médica (Visão 5)' });
            return false;
        }

        if (config.missionType === MissionType.NATIONAL && o.em_quarentena) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Quarentena (< 180 dias da última missão) (Visão 4)' });
            return false;
        }
        return true;
    });

    // 2. Sorting
    if (config.missionType === MissionType.REGIONAL) {
        sortRegional(candidates);
    } else {
        sortNational(candidates);
    }

    // Helper to add officer
    const attemptAddOfficer = (off: Officer, method: 'ranking' | 'group_integrity', reason: string): boolean => {
        if (selectedIds.has(off.id)) return false;

        // Unit Quota Check (2 per Delegacia, 1 per Nucleo/Secao)
        const limit = off.tipo_unidade === UnitType.DELEGACIA ? 2 : 1;
        const current = unitCounts[off.unidade] || 0;

        if (current >= limit) {
             logs.push({ matricula: off.matricula, nome: off.nome, status: 'skipped', reason: `Cota Unidade (${off.unidade}) Excedida` });
             return false;
        }

        // Add
        off.justificativa = reason;
        selected.push(off);
        selectedIds.add(off.id);
        
        // Update Trackers
        unitCounts[off.unidade] = current + 1;
        if (off.grupo_especial && SPECIAL_GROUPS.includes(off.grupo_especial)) {
            groupCounts[off.grupo_especial] = (groupCounts[off.grupo_especial] || 0) + 1;
        }

        logs.push({ matricula: off.matricula, nome: off.nome, status: method === 'ranking' ? 'selected' : 'forced', reason });
        return true;
    };

    // 3. Selection Loop
    for (const candidate of candidates) {
        if (selected.length >= config.numVagas) break;
        if (selectedIds.has(candidate.id)) continue;

        let reason = "";
        const dataFmt = candidate.data_ultimo_ifr ? candidate.data_ultimo_ifr.toLocaleDateString() : 'N/A';
        
        if (config.missionType === MissionType.REGIONAL) {
            reason = `Menor Ops (${candidate.horas_operacionais}h) | IFR: ${candidate.carga_horaria_ifr}h | Último: ${dataFmt}`;
        } else {
            reason = `Maior IFR (${candidate.carga_horaria_ifr}h) | Último: ${dataFmt}`;
        }

        const added = attemptAddOfficer(candidate, 'ranking', reason);

        if (added) {
            // Group Integrity Logic Check
            const grp = candidate.grupo_especial;
            if (grp && SPECIAL_GROUPS.includes(grp) && groupCounts[grp] === 2) {
                const teamMates = candidates.filter(c => 
                    c.grupo_especial === grp && 
                    !selectedIds.has(c.id)
                );

                let addedMates = 0;
                for (const mate of teamMates) {
                    if (addedMates >= 2) break; 
                    if (selected.length >= config.numVagas) break; 

                    const forced = attemptAddOfficer(mate, 'group_integrity', `Integridade de Equipe ${grp} (Art. 5º)`);
                    if (forced) addedMates++;
                }
            }
        }
    }

    return { selected, auditLogs: logs };
};