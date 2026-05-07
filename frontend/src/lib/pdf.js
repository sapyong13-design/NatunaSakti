// ============================================
// PDF GENERATOR - Akurasi Kepaniteraan
// Format sesuai template PN Natuna
// ============================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Nama bulan dalam Bahasa Indonesia
const BULAN_INDONESIA = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const JENIS_PERKARA_LABEL = {
    'Perdata': 'PERDATA',
    'Pidana': 'PIDANA',
    'Perikanan': 'PERIKANAN'
};

/**
 * Generate PDF untuk laporan bulanan
 */
export const generateBulananPDF = (data, options = {}) => {
    const { bulan, tahun, jenisPerkara = 'Perdata' } = options;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // HEADER
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AKURASI KEPANITERAAN', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text(JENIS_PERKARA_LABEL[jenisPerkara] || jenisPerkara.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(12);
    doc.text('PENGADILAN NEGERI NATUNA KELAS IB', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const periodeText = `BULAN ${BULAN_INDONESIA[bulan - 1].toUpperCase()} TAHUN ${tahun}`;
    doc.text(periodeText, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // TABEL DATA
    const tableData = data.map((item, index) => [
        index + 1,
        item.nama_perkara || '-',
        item.nomor_perkara || '-',
        item.para_pihak || '-',
        item.tahun_masuk || '-',
        item.tanggal_putus ? formatDate(item.tanggal_putus) : '-',
        item.keterangan || '-'
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [['No', 'Nama Perkara', 'Nomor Perkara', 'Para Pihak', 'Tahun Masuk', 'Tgl Putus', 'Keterangan']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            font: 'helvetica'
        },
        headStyles: {
            fillColor: [200, 200, 200],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 45 },
            3: { cellWidth: 50 },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 30, halign: 'center' },
            6: { cellWidth: 25, halign: 'center' }
        },
        margin: { top: 10, left: margin, right: margin }
    });

    // FOOTER
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak: ${formatDate(new Date())}`, margin, pageHeight - 15);

    const totalText = `Total: ${data.length} perkara`;
    doc.text(totalText, pageWidth - margin, pageHeight - 15, { align: 'right' });

    return doc;
};

/**
 * Generate PDF untuk laporan mingguan
 */
export const generateMingguanPDF = (data, options = {}) => {
    const { startDate, endDate, jenisPerkara = 'Perdata', mingguKe } = options;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // HEADER
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AKURASI KEPANITERAAN', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text(JENIS_PERKARA_LABEL[jenisPerkara] || jenisPerkara.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(12);
    doc.text('PENGADILAN NEGERI NATUNA KELAS IB', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const periodeText = mingguKe
        ? `MINGGU KE-${mingguKe} (${formatDate(startDate)} - ${formatDate(endDate)})`
        : `(${formatDate(startDate)} - ${formatDate(endDate)})`;
    doc.text(periodeText, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // TABEL DATA
    const tableData = data.map((item, index) => [
        index + 1,
        item.nama_perkara || '-',
        item.nomor_perkara || '-',
        item.para_pihak || '-',
        item.tahun_masuk || '-',
        item.tanggal_putus ? formatDate(item.tanggal_putus) : '-',
        item.keterangan || '-'
    ]);

    autoTable(doc, {
        startY: yPos,
        head: [['No', 'Nama Perkara', 'Nomor Perkara', 'Para Pihak', 'Tahun Masuk', 'Tgl Putus', 'Keterangan']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            font: 'helvetica'
        },
        headStyles: {
            fillColor: [200, 200, 200],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 40 },
            2: { cellWidth: 45 },
            3: { cellWidth: 50 },
            4: { cellWidth: 20, halign: 'center' },
            5: { cellWidth: 30, halign: 'center' },
            6: { cellWidth: 25, halign: 'center' }
        },
        margin: { top: 10, left: margin, right: margin }
    });

    // FOOTER
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Dicetak: ${formatDate(new Date())}`, margin, pageHeight - 15);

    const totalText = `Total: ${data.length} perkara`;
    doc.text(totalText, pageWidth - margin, pageHeight - 15, { align: 'right' });

    return doc;
};

/**
 * Format date ke DD-MM-YYYY
 */
const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Download PDF
 */
export const downloadPDF = (doc, filename) => {
    doc.save(filename);
};
