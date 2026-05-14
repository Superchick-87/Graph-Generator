window.ExportModule = {
  async exportToPDF(svgElement, config) {
    const { jsPDF } = window.jspdf;

    const formats = {
      "1x2": { w: 48.9, h: 75.1 },
      "2x2": { w: 101.8, h: 75.1 },
    };
    const fmt = formats[config.formatId] || formats["2x2"];

    // Création du PDF aux dimensions exactes en mm
    const doc = new jsPDF({
      orientation: fmt.w > fmt.h ? "landscape" : "portrait",
      unit: "mm",
      format: [fmt.w, fmt.h],
    });

    const svgClone = svgElement.cloneNode(true);
    svgClone.style.backgroundColor = "#ffffff";

    // svg2pdf va adapter le viewBox du SVG aux dimensions du PDF
    await doc.svg(svgClone, {
      x: 0,
      y: 0,
      width: fmt.w,
      height: fmt.h,
    });

    doc.save(`graphique_${config.formatId}.pdf`);
  },
};
