import { writeFile, mkdir, unlink } from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function wrapLatexDocument(bodyContent) {
  return `
\\documentclass[10pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
\\pagenumbering{gobble}

\\titleformat{\\section}{\\bfseries\\uppercase}{\\thesection}{1em}{}
\\renewcommand{\\labelitemi}{--}
\\setlist[itemize]{left=0pt,labelsep=1em}

\\begin{document}

${bodyContent}

\\end{document}
  `.trim();
}

export async function generatePdfFromLatex(latexContent, filenameWithoutExt) {
  const outputDir = path.join(__dirname, '../uploads');
  const texFile = path.join(outputDir, `${filenameWithoutExt}.tex`);
  const pdfFile = path.join(outputDir, `${filenameWithoutExt}.pdf`);

  try {
    await mkdir(outputDir, { recursive: true });

    const fullLatex = latexContent;
    await writeFile(texFile, fullLatex, 'utf-8');

    await new Promise((resolve, reject) => {
      exec(`pdflatex -interaction=nonstopmode -output-directory="${outputDir}" "${texFile}"`, (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      });
    });

    // Clean up aux/log files
    try {
      await unlink(texFile.replace('.tex', '.aux'));
      await unlink(texFile.replace('.tex', '.log'));
    } catch (_) {}

    return pdfFile;
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('PDF generation failed');
  }
}
