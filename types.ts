export enum MissionType {
    NATIONAL = 'NATIONAL',
    REGIONAL = 'REGIONAL'
}

export enum UnitType {
    DELEGACIA = 'Delegacia',
    NUCLEO = 'Núcleo',
    SECAO = 'Seção'
}

export interface Officer {
    id: string; // Used for React keys
    matricula: string; // Primary Key
    nome: string;
    unidade: string;
    tipo_unidade: UnitType;
    grupo_especial: string; // From Lotação or specific list
    
    // Metrics
    horas_operacionais: number;
    carga_horaria_ifr: number;
    qtd_ifr_12h: number;
    data_ultimo_ifr: Date | null; // Calculated max(Data1...Data4)
    
    // Tenure/Age for Tie-breaking
    tempo_cargo_dias: number;
    idade_anos: number;

    // Restrictions & Status
    restricao: boolean;
    data_fim_ultima_missao: Date | null;
    em_quarentena: boolean; // Derived from data_fim_ultima_missao
    
    // Output
    justificativa: string;
}

export interface AuditLog {
    matricula: string;
    nome: string;
    status: 'selected' | 'skipped' | 'forced';
    reason: string;
}

export interface SelectionResult {
    selected: Officer[];
    auditLogs: AuditLog[];
}

export interface SelectionConfig {
    missionType: MissionType;
    numVagas: number;
}

// Data is now Arrays of Key-Value Objects (JSON), not CSV Strings
export interface SheetData {
    operacional: Record<string, any>[]; 
    origem: Record<string, any>[];      
    externas: Record<string, any>[];    
    restricoes: Record<string, any>[];  
}

// Configuration only requires the main Sheet ID
export interface SheetConfig {
    sheetId: string;
}