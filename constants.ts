import { SheetData } from './types';

export const SPECIAL_GROUPS = ['NOE', 'GOC', 'GMP', 'GPT', 'GFT'];

// Updated to match the specific Google Sheets mappings (4 tabs)
// Converted to JSON objects to match new dataProcessor logic
export const DEMO_DATA: SheetData = {
    // Tab: Hrs Operacionais - Frequência
    operacional: [
        { 'Servidor': 'João Silva', 'Matrícula': '1001', 'Lotação': 'DEL01', 'Horas operacional': 200 },
        { 'Servidor': 'Maria Santos', 'Matrícula': '1002', 'Lotação': 'DEL01', 'Horas operacional': 150 },
        { 'Servidor': 'Pedro Costa', 'Matrícula': '1003', 'Lotação': 'DEL01', 'Horas operacional': 100 },
        { 'Servidor': 'Ana Oliveira', 'Matrícula': '1004', 'Lotação': 'DEL01 (NOE)', 'Horas operacional': 300 },
        { 'Servidor': 'Carlos Souza', 'Matrícula': '1005', 'Lotação': 'NUC_OPS (GOC)', 'Horas operacional': 50 },
        { 'Servidor': 'Fernanda Lima', 'Matrícula': '1006', 'Lotação': 'SEC_ADM', 'Horas operacional': 400 },
        { 'Servidor': 'Roberto Alves', 'Matrícula': '1007', 'Lotação': 'DEL02', 'Horas operacional': 0 },
        { 'Servidor': 'Ricardo Pereira', 'Matrícula': '1008', 'Lotação': 'DEL02 (NOE)', 'Horas operacional': 180 },
        { 'Servidor': 'Lucas Mendes', 'Matrícula': '1009', 'Lotação': 'DEL02 (GOC)', 'Horas operacional': 210 },
        { 'Servidor': 'Juliana Costa', 'Matrícula': '1010', 'Lotação': 'DEL03', 'Horas operacional': 500 },
        { 'Servidor': 'Marcos Rocha', 'Matrícula': '1011', 'Lotação': 'DEL03', 'Horas operacional': 450 },
        { 'Servidor': 'Tiago Silva', 'Matrícula': '1012', 'Lotação': 'DEL03 (NOE)', 'Horas operacional': 80 },
        { 'Servidor': 'Bruna Dias', 'Matrícula': '1013', 'Lotação': 'DEL04', 'Horas operacional': 120 },
        { 'Servidor': 'Rafael Martins', 'Matrícula': '1014', 'Lotação': 'DEL04', 'Horas operacional': 140 },
        { 'Servidor': 'Gabriel Nunes', 'Matrícula': '1015', 'Lotação': 'DEL04', 'Horas operacional': 220 },
    ],

    // Tab: Origem
    origem: [
        { 'Servidor': 'João Silva', 'Matrícula': '1001', 'Lotação': 'DEL01', 'Carga Horária IFR': 100, 'QTD IFR - 12h': 10, 'Data1': '01/11/2023', 'Data2': '01/12/2023' },
        { 'Servidor': 'Maria Santos', 'Matrícula': '1002', 'Lotação': 'DEL01', 'Carga Horária IFR': 50, 'QTD IFR - 12h': 5, 'Data1': '10/01/2024' },
        { 'Servidor': 'Ana Oliveira', 'Matrícula': '1004', 'Lotação': 'DEL01', 'Carga Horária IFR': 120, 'QTD IFR - 12h': 12, 'Data1': '01/10/2023', 'Data2': '01/11/2023', 'Data3': '01/01/2024', 'Data4': '01/02/2024' },
        { 'Servidor': 'Fernanda Lima', 'Matrícula': '1006', 'Lotação': 'SEC_ADM', 'Carga Horária IFR': 200, 'QTD IFR - 12h': 20, 'Data1': '01/01/2024', 'Data2': '15/02/2024' },
        { 'Servidor': 'Ricardo Pereira', 'Matrícula': '1008', 'Lotação': 'DEL02', 'Carga Horária IFR': 80, 'QTD IFR - 12h': 8, 'Data1': '20/12/2023' },
        { 'Servidor': 'Lucas Mendes', 'Matrícula': '1009', 'Lotação': 'DEL02', 'Carga Horária IFR': 90, 'QTD IFR - 12h': 9, 'Data1': '05/11/2023', 'Data2': '05/01/2024' },
        { 'Servidor': 'Juliana Costa', 'Matrícula': '1010', 'Lotação': 'DEL03', 'Carga Horária IFR': 300, 'QTD IFR - 12h': 30, 'Data1': '20/02/2024' },
        { 'Servidor': 'Marcos Rocha', 'Matrícula': '1011', 'Lotação': 'DEL03', 'Carga Horária IFR': 250, 'QTD IFR - 12h': 25, 'Data1': '10/02/2024' },
        { 'Servidor': 'Gabriel Nunes', 'Matrícula': '1015', 'Lotação': 'DEL04', 'Carga Horária IFR': 110, 'QTD IFR - 12h': 11, 'Data1': '05/01/2024', 'Data2': '05/02/2024' },
    ],

    // Tab: Convocações Externas
    externas: [
        { 'Nome': 'João Silva', 'Matrícula': '1001', 'Convocante': 'DOP', 'Data Fim': '15/08/2023' },
        { 'Nome': 'Maria Santos', 'Matrícula': '1002', 'Convocante': 'COE', 'Data Fim': '20/01/2023' },
        { 'Nome': 'Ana Oliveira', 'Matrícula': '1004', 'Convocante': 'DOP', 'Data Fim': '01/09/2023' },
        { 'Nome': 'Tiago Silva', 'Matrícula': '1012', 'Convocante': 'DOP', 'Data Fim': '01/03/2024', 'Observações': 'Recent Mission' },
    ],

    // Tab: Restrições
    restricoes: [
        { 'NOME': 'Roberto Alves', 'MATRÍCULA': '1007', 'LOTAÇÃO': 'DEL02', 'OBS': 'Licença Médica' },
        { 'NOME': 'Pedro Costa', 'MATRÍCULA': '1003', 'LOTAÇÃO': 'DEL01', 'OBS': 'Férias' }
    ]
};