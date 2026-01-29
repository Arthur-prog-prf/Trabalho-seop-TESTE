import { Officer, AuditLog } from '../types';

declare const window: any;

export const generatePDF = (selected: Officer[], logs: AuditLog[], missionType: string) => {
    if (!window.jspdf) {
        alert("Erro: Biblioteca PDF não carregada.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
    
    // Header
    doc.setFillColor(0, 51, 153); // PRF Blue
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 204, 0); // PRF Yellow
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("PRF/ES - Relatório de Convocação (IS 16/2026)", 148, 12, { align: 'center' });

    // Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Critério de Aplicação: ${missionType}`, 14, 30);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString()}`, 14, 35);
    doc.text(`Total Convocados: ${selected.length}`, 14, 40);

    // Table
    const tableColumn = ["Matrícula", "Nome", "Unidade", "Grupo", "H. Ops", "H. IFR", "Justificativa Técnica"];
    const tableRows = selected.map(off => [
        off.matricula,
        off.nome,
        off.unidade,
        off.grupo_especial || '-',
        off.horas_operacionais,
        off.carga_horaria_ifr,
        off.justificativa
    ]);

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [0, 51, 153] },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 40 },
            6: { cellWidth: 80 }
        },
        styles: { fontSize: 9 }
    });

    // Audit Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Relatório de Exclusões e Cotas", 14, finalY);

    const auditRows = logs.filter(l => l.status === 'skipped').map(l => [
        l.matricula,
        l.nome,
        l.reason
    ]);

    (doc as any).autoTable({
        head: [["Matrícula", "Policial", "Motivo da Exclusão/Pulo"]],
        body: auditRows,
        startY: finalY + 5,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [150, 50, 50] }, // Red for exclusions
    });

    doc.save('convocacao_prf_es_is16_2026.pdf');
};