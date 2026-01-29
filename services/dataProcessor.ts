import { Officer, MissionType, UnitType, SelectionConfig, SelectionResult, AuditLog, SheetData } from '../types';
import { SPECIAL_GROUPS } from '../constants';

// --- Helpers de Utilidade ---

/**
 * Converte strings de data ou números do Excel para objetos Date.
 * Lida com o formato brasileiro DD/MM/YYYY.
 */
const safeDate = (dStr: string | number | undefined): Date | null => {
    if (dStr === undefined || dStr === null) return null;
    
    if (typeof dStr === 'number') {
        const d = new Date(Math.round((dStr - 25569) * 86400 * 1000));
        return isNaN(d.getTime()) ? null : d;
    }

    if (typeof dStr === 'string') {
        const cleanStr = dStr.trim();
        if (cleanStr === '') return null;
        
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
 * Limpa e converte valores numéricos da planilha para Float.
 * Lida com separadores de milhar e decimais (converte vírgula para ponto).
 */
const parsePFRNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanVal = String(val).replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleanVal);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Calcula a data mais recente entre várias colunas de data (Lógica da Visão 3).
 */
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
 * Normaliza as chaves das linhas para minúsculas e sem acentos.
 * Garante que 'Matrícula' e 'matricula' sejam lidas como o mesmo campo.
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
    // 1. Normalização das entradas
    const opsData = inputs.operacional.map(normalizeRow);
    const origemData = inputs.origem.map(normalizeRow);
    const externaData = inputs.externas.map(normalizeRow);
    const restricaoData = inputs.restricoes.map(normalizeRow);

    // 2. Indexação e Criação de Conjuntos de Busca (Map/Set)
    // CRÍTICO: String() e trim() garantem que a matrícula seja comparada corretamente.
    const origemMap = new Map(origemData.map(i => [String(i['matricula'] || '').trim(), i]));
    const missionMap = new Map(externaData.map(i => [String(i['matricula'] || '').trim(), i]));
    
    // CORREÇÃO PANE 1: Filtrar matrículas vazias para evitar restrições falsas em massa
    const restrictedMatriculas = restricaoData
        .map(i => String(i['matricula'] || '').trim())
        .filter(m => m.length > 0);
    const restrictionSet = new Set(restrictedMatriculas);

    const officers: Officer[] = [];

    // VIEW 1: Horas Operacionais (Base: Hrs Operacionais - Frequência)
    opsData.forEach((op, index) => {
        const mat = String(op['matricula'] || '').trim();
        if (!mat) return; 

        // VIEW 2 & 3: Dados de IFR e Recência (Fonte: Origem)
        const origem = origemMap.get(mat) || {};
        const chIfr = parsePFRNumber(origem['carga horaria ifr']);
        const qtd12h = parseInt(String(origem['qtd ifr - 12h'] || '0'), 10);

        const dateColumns = [origem['data1'], origem['data2'], origem['data3'], origem['data4']];
        const maxIfrDate = calculateRecency(dateColumns);

        // VIEW 4: Histórico (Fonte: Convocações Externas)
        const mission = missionMap.get(mat);
        const lastMissionDate = safeDate(mission?.['data fim']);
        
        let inQuarantine = false;
        if (lastMissionDate) {
            const daysSince = (new Date().getTime() - lastMissionDate.getTime()) / (1000 * 3600 * 24);
            if (daysSince < 180) inQuarantine = true;
        }

        // VIEW 5: Verificação de Restrição
        const isRestricted = restrictionSet.has(mat);

        // Identificação de Grupo e Unidade
        const rawLotacao = (op['lotacao'] || '').toUpperCase();
        let group = '';
        SPECIAL_GROUPS.forEach(g => {
            if (rawLotacao.includes(g)) group = g;
        });

        let type = UnitType.NUCLEO;
        if (rawLotacao.includes('DEL') || rawLotacao.includes('DELEGACIA')) {
            type = UnitType.DELEGACIA;
        }

        // CORREÇÃO PANE 2: Verificação robusta de nomes de colunas (singular/plural)
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
        // 1. Menor Horas Ops (Art. 12)
        if (a.horas_operacionais !== b.horas_operacionais) return a.horas_operacionais - b.horas_operacionais; 
        // 2. Maior IFR
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        // 3. Maior QTD 12h
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        // 4. Data mais recente
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

const sortNational = (candidates: Officer[]) => {
    candidates.sort((a, b) => {
        // 1. Maior IFR (Art. 4)
        if (b.carga_horaria_ifr !== a.carga_horaria_ifr) return b.carga_horaria_ifr - a.carga_horaria_ifr; 
        // 2. Maior QTD 12h
        if (b.qtd_ifr_12h !== a.qtd_ifr_12h) return b.qtd_ifr_12h - a.qtd_ifr_12h; 
        // 3. Data mais recente
        return compareDatesDesc(a.data_ultimo_ifr, b.data_ultimo_ifr);
    });
};

// --- Execução do Ranking e Restrições de Cota ---

export const runSelectionProcess = (
    allOfficers: Officer[], 
    config: SelectionConfig
): SelectionResult => {
    const logs: AuditLog[] = [];
    const selected: Officer[] = [];
    const selectedIds = new Set<string>();
    
    const unitCounts: Record<string, number> = {};
    const groupCounts: Record<string, number> = {};

    // 1. Filtragem Inicial de Disponibilidade
    let candidates = allOfficers.filter(o => {
        if (o.restricao) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Filtro: Servidor consta na aba de Restrições' });
            return false;
        }

        if (config.missionType === MissionType.NATIONAL && o.em_quarentena) {
            logs.push({ matricula: o.matricula, nome: o.nome, status: 'skipped', reason: 'Interstício: Convocado de ofício há menos de 180 dias (Art. 8º)' });
            return false;
        }
        return true;
    });

    // 2. Ordenação segundo o Modo de Missão
    if (config.missionType === MissionType.REGIONAL) {
        sortRegional(candidates);
    } else {
        sortNational(candidates);
    }

    // Helper para tentativa de adição
    const attemptAddOfficer = (off: Officer, method: 'ranking' | 'group_integrity', reason: string): boolean => {
        if (selectedIds.has(off.id)) return false;

        // Regra de Cotas (Art. 7º)
        const limit = off.tipo_unidade === UnitType.DELEGACIA ? 2 : 1;
        const current = unitCounts[off.unidade] || 0;

        if (current >= limit) {
             logs.push({ matricula: off.matricula, nome: off.nome, status: 'skipped', reason: `Limite de Unidade Atingido (${off.unidade}: ${limit} vaga(s))` });
             return false;
        }

        off.justificativa = reason;
        selected.push(off);
        selectedIds.add(off.id);
        
        unitCounts[off.unidade] = current + 1;
        if (off.grupo_especial && SPECIAL_GROUPS.includes(off.grupo_especial)) {
            groupCounts[off.grupo_especial] = (groupCounts[off.grupo_especial] || 0) + 1;
        }

        logs.push({ matricula: off.matricula, nome: off.nome, status: method === 'ranking' ? 'selected' : 'forced', reason });
        return true;
    };

    // 3. Processamento do Ranking
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

        attemptAddOfficer(candidate, 'ranking', reason);
    }

    return { selected, auditLogs: logs };
};
