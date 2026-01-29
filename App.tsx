import React, { useState } from 'react';
import { MissionType, SelectionResult, SheetData, SheetConfig } from './types';
import { DEMO_DATA } from './constants';
import { mergeData, runSelectionProcess } from './services/dataProcessor';
import { OfficerTable } from './components/OfficerTable';
import { generatePDF } from './utils/pdfExport';

// Declaration for SheetJS on window
declare const window: any;

const App: React.FC = () => {
  // Config State for Sheet connection (Only ID needed now)
  const [config, setConfig] = useState<SheetConfig>({
      sheetId: ''
  });
  
  // Raw Data State (Arrays of Objects)
  const [data, setData] = useState<SheetData>({
      operacional: [],
      origem: [],
      externas: [],
      restricoes: []
  });

  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'sheet' | 'demo'>('sheet');
  
  // Algorithm Config
  const [missionType, setMissionType] = useState<MissionType>(MissionType.REGIONAL);
  const [numVagas, setNumVagas] = useState(15);
  
  const [result, setResult] = useState<SelectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = (value: string) => {
      let id = value;
      // Extract ID if full URL is pasted
      const match = value.match(/\/d\/(.*?)(\/|$)/);
      if (match) id = match[1];
      setConfig({ sheetId: id });
  };

  const loadDemoData = () => {
      setInputMode('demo');
      setData(DEMO_DATA);
      setResult(null);
      setError(null);
  };

  // Helper: Normalize string for comparison (trim, lowercase, remove accents)
  const normalizeStr = (str: string) => {
      return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Helper: Find tab name in workbook ignoring case/accents
  const findTabByName = (workbook: any, targetName: string): string | null => {
      const target = normalizeStr(targetName);
      const found = workbook.SheetNames.find((sheetName: string) => 
          normalizeStr(sheetName) === target
      );
      return found || null;
  };

  const fetchSheetData = async () => {
      if (!config.sheetId) {
          setError("ID da Planilha é obrigatório.");
          return;
      }
      
      if (!window.XLSX) {
          setError("Biblioteca XLSX não carregada. Verifique sua conexão com a internet.");
          return;
      }

      setLoading(true);
      setError(null);
      setResult(null);

      try {
          // 1. Fetch the Excel file as a binary blob/buffer
          const url = `https://docs.google.com/spreadsheets/d/${config.sheetId}/export?format=xlsx`;
          const response = await fetch(url);
          
          if (!response.ok) {
             throw new Error(`Erro ao baixar planilha (Status ${response.status}). Verifique se a planilha está 'Publicada na Web' ou acessível.`);
          }

          const arrayBuffer = await response.arrayBuffer();

          // 2. Parse workbook using SheetJS
          const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });

          // 3. Extract Tabs using Fuzzy Match (Case Insensitive)
          const extractTab = (targetName: string): any[] => {
              const realName = findTabByName(workbook, targetName);
              if (!realName) {
                  console.warn(`Aba não encontrada: ${targetName} (verificado de forma insensível a maiúsculas)`);
                  return [];
              }
              const sheet = workbook.Sheets[realName];
              // Convert sheet to JSON array
              return window.XLSX.utils.sheet_to_json(sheet);
          };

          // Define Target Names (Logic will match 'origem', 'ORIGEM', ' Origem ')
          const opData = extractTab('Hrs Operacionais - Frequência');
          const origemData = extractTab('Origem');
          const externaData = extractTab('Convocações Externas');
          const restricaoData = extractTab('Restrições');

          if (opData.length === 0) {
              throw new Error("Aba 'Hrs Operacionais - Frequência' não encontrada ou vazia. Verifique os nomes das abas.");
          }

          setData({
              operacional: opData,
              origem: origemData,
              externas: externaData,
              restricoes: restricaoData
          });
          setInputMode('sheet');

      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleRun = () => {
      try {
          setError(null);
          if (data.operacional.length === 0) throw new Error("Dados operacionais não carregados.");
          
          // 1. Ingest and Merge
          const mergedOfficers = mergeData(data);
          
          if (mergedOfficers.length === 0) throw new Error("Nenhum policial encontrado nos dados.");

          // 2. Run Algorithm
          const res = runSelectionProcess(mergedOfficers, {
              missionType,
              numVagas
          });
          
          setResult(res);
      } catch (err: any) {
          setError(err.message);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Header */}
      <header className="bg-prf-blue text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-prf-yellow rounded-full flex items-center justify-center text-prf-blue font-bold text-xl border-2 border-white">
                PRF
             </div>
             <div>
                 <h1 className="text-xl font-bold leading-tight">Convocação IS 16/2026</h1>
                 <p className="text-xs text-blue-200">Engenharia de Dados & Gestão de Efetivo</p>
             </div>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={loadDemoData}
                className="text-sm bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold px-3 py-1 rounded transition"
            >
                Usar Dados Demo
            </button>
            <button 
                onClick={() => window.location.reload()}
                className="text-sm bg-blue-800 hover:bg-blue-700 px-3 py-1 rounded transition"
            >
                Reiniciar
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar: Data Connection */}
        <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-100 border-b">
                    <h2 className="text-lg font-bold text-gray-700">1. Conexão Google Planilha</h2>
                    <p className="text-xs text-gray-500">Conexão Automática via Exportação Excel (.xlsx)</p>
                </div>
                
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">ID da Planilha (ou Link Completo)</label>
                        <input 
                            type="text"
                            placeholder="ex: docs.google.com/spreadsheets/d/1A2b3C..."
                            className="w-full border p-2 rounded text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={config.sheetId}
                            onChange={(e) => handleConfigChange(e.target.value)}
                        />
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-100">
                        <strong>Abas Obrigatórias (Case Insensitive):</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-[10px]">
                            <li>Hrs Operacionais - Frequência</li>
                            <li>Origem</li>
                            <li>Convocações Externas</li>
                            <li>Restrições</li>
                        </ul>
                    </div>

                    <button
                        onClick={fetchSheetData}
                        disabled={loading}
                        className={`w-full py-3 rounded text-white font-bold shadow transition flex justify-center items-center gap-2
                            ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processando Excel...
                            </>
                        ) : 'Importar Dados da Planilha'}
                    </button>
                    
                    <div className="text-[10px] text-gray-400 border-t pt-2 mt-2">
                        <strong>Nota:</strong> O sistema buscará as abas ignorando maiúsculas/minúsculas.
                    </div>
                </div>
            </div>

            {/* Processing Config */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">2. Configuração do Algoritmo</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Regime de Convocação</label>
                        <select 
                            value={missionType}
                            onChange={(e) => setMissionType(e.target.value as MissionType)}
                            className="w-full border p-2 rounded bg-white"
                        >
                            <option value={MissionType.REGIONAL}>MODO REGIONAL (Art. 12 - Menor Ops)</option>
                            <option value={MissionType.NATIONAL}>MODO NACIONAL (Art. 4 - Maior IFR)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {missionType === MissionType.REGIONAL 
                                ? "Critério 1: Menor Ops | Critério 2: Maior IFR (Desempate)"
                                : "Critério 1: Maior IFR | Critério 2: Recência (Data)"}
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">Vagas Disponíveis</label>
                        <input 
                            type="number" 
                            min="1" max="100"
                            value={numVagas}
                            onChange={(e) => setNumVagas(parseInt(e.target.value))}
                            className="w-24 border p-1 rounded text-center"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleRun}
                    disabled={data.operacional.length === 0}
                    className={`w-full mt-6 text-white font-bold py-3 rounded shadow transition transform active:scale-95
                        ${data.operacional.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                    `}
                >
                    EXECUTAR RANKING
                </button>
                {error && <div className="bg-red-100 text-red-700 p-3 rounded mt-4 text-xs font-mono border-l-4 border-red-500">{error}</div>}
            </div>
        </div>

        {/* Right Content: Results */}
        <div className="lg:col-span-7 space-y-6">
            {result ? (
                <>
                    <div className="flex justify-between items-end">
                        <div className='flex flex-col'>
                            <h2 className="text-2xl font-bold text-gray-800">Classificação Final</h2>
                            <span className="text-xs text-gray-500">Fonte: {inputMode === 'demo' ? 'Dados de Demonstração' : `Planilha ${config.sheetId}`}</span>
                        </div>
                        <button 
                            onClick={() => generatePDF(result.selected, result.auditLogs, missionType)}
                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700 text-sm font-bold"
                        >
                            <span>📄</span> PDF Oficial
                        </button>
                    </div>

                    <OfficerTable 
                        title="Lista de Convocados" 
                        officers={result.selected} 
                        className="border-t-4 border-t-green-600"
                    />

                    {/* Audit Logs */}
                    <div className="bg-white rounded shadow p-4 border border-gray-200">
                        <h3 className="font-bold text-md text-gray-700 mb-3 border-b pb-2">Log de Processamento (Restrições & Cotas)</h3>
                        <div className="max-h-64 overflow-y-auto space-y-2 text-xs border p-2 bg-gray-50 rounded font-mono">
                            {result.auditLogs.map((log, idx) => (
                                <div key={idx} className={`flex gap-2 items-start p-1.5 rounded border-b ${log.status === 'skipped' ? 'bg-red-50' : log.status === 'forced' ? 'bg-yellow-50' : 'bg-white'}`}>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase w-24 text-center shrink-0 
                                        ${log.status === 'selected' ? 'bg-green-100 text-green-700' : 
                                          log.status === 'skipped' ? 'bg-red-100 text-red-700' : 'bg-yellow-200 text-yellow-800'}`}>
                                        {log.status}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800">{log.matricula} - {log.nome}</span>
                                        <span className="text-gray-500">{log.reason}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg p-10 bg-white">
                    <svg className="w-20 h-20 mb-4 opacity-20 text-blue-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xl font-medium text-gray-500">Aguardando Dados...</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm text-center">
                        Insira o ID da Planilha Google ao lado para baixar e processar todas as abas automaticamente.
                    </p>
                </div>
            )}
        </div>

      </main>
    </div>
  );
};

export default App;