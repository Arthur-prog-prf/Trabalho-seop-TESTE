import React from 'react';
import { Officer } from '../types';

interface Props {
  officers: Officer[];
  title: string;
  className?: string;
  emptyMessage?: string;
}

export const OfficerTable: React.FC<Props> = ({ officers, title, className, emptyMessage = "Nenhum policial listado." }) => {
  if (officers.length === 0) {
    return (
      <div className={`p-4 bg-white rounded shadow ${className}`}>
        <h3 className="font-bold text-lg mb-2 text-prf-blue">{title}</h3>
        <p className="text-gray-500 italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded shadow overflow-hidden ${className}`}>
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-bold text-lg text-prf-blue">{title} <span className="text-sm font-normal text-gray-500">({officers.length})</span></h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-gray-100 text-gray-700 font-medium">
            <tr>
              <th className="px-3 py-2">Matrícula</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Grupo</th>
              <th className="px-3 py-2 text-right">H. Ops</th>
              <th className="px-3 py-2 text-right">IFR</th>
              <th className="px-3 py-2 w-1/3">Justificativa Técnica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {officers.map((off) => (
              <tr key={off.id} className="hover:bg-blue-50">
                <td className="px-3 py-2 font-mono text-gray-500">{off.matricula}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{off.nome}</td>
                <td className="px-3 py-2">{off.unidade}</td>
                <td className="px-3 py-2">
                   {off.grupo_especial ? (
                       <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                           {off.grupo_especial}
                       </span>
                   ) : '-'}
                </td>
                <td className="px-3 py-2 text-right">{off.horas_operacionais}</td>
                <td className="px-3 py-2 text-right">{off.carga_horaria_ifr}</td>
                <td className="px-3 py-2 text-gray-600 italic">{off.justificativa || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};