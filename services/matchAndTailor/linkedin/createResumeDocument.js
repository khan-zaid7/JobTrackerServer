import fsPromises from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

export async function createResumeDocument(tailoredResume) {
  const data = tailoredResume.tailoredSections;

  const escapeLatex = (str = '') =>
    str.replace(/([&%$#_{}~^\\])/g, '\\$1');

  const skillsLine = (arr = []) =>
    arr.filter(Boolean).map(escapeLatex).join(', ');

  const hasEducation = Array.isArray(data.Education) && data.Education.length > 0;
  const educationTex = hasEducation ? data.Education.map(ed => {
    const gpaLine = ed.gpa ? `GPA: ${escapeLatex(ed.gpa)}\\\\` : '';
    const detailsLines = (Array.isArray(ed.details) && ed.details.length > 0)
      ? ed.details.map(line => `${escapeLatex(line)}\\\\`).join('\n')
      : '';
    const location = ed.location ? `, ${escapeLatex(ed.location)}` : '';

    return `\\textbf{${escapeLatex(ed.institution)}}, ${escapeLatex(ed.degree)}${location} \\\\ \\hfill \\textit{${escapeLatex(ed.dates.start)} - ${escapeLatex(ed.dates.end)}} \\\\
${gpaLine}
${detailsLines}
\\vspace{6pt}`;
  }).join('\n\n') : '';

  const hasExperience = Array.isArray(data.Experience) && data.Experience.length > 0;

  const experienceTex = hasExperience ? data.Experience.map(exp => {
    // Format the date range
    const dates = `${escapeLatex(exp.dates.start)} - ${escapeLatex(exp.dates.end)}`;

    // Build the header line, adding location if it exists
    let header = `\\textbf{${escapeLatex(exp.jobTitle)}, ${escapeLatex(exp.company)}}`;
    if (exp.location) {
      header += `, ${escapeLatex(exp.location)}`;
    }
    header += ` \\hfill \\textit{${dates}}`; // Add dates to the right

    // Build the bullet points
    const bullets = (Array.isArray(exp.responsibilities) && exp.responsibilities.length > 0)
      ? exp.responsibilities.map(b => `\\item ${escapeLatex(b)}`).join('\n')
      : '';

    // Combine header and bullets without a line break command
    return `${header}
            \\begin{itemize}
            ${bullets}
            \\end{itemize}`;
  }).join('\n\n') : ''; // Use a paragraph break to space out job entries


  const hasProjects = Array.isArray(data.Projects) && data.Projects.length > 0;
  const projectsTex = hasProjects
    ? data.Projects.map(proj => {
      const techs = (Array.isArray(proj.technologies) && proj.technologies.length > 0)
        ? proj.technologies.map(escapeLatex).join(', ')
        : '';
      const bullets = (Array.isArray(proj.details) && proj.details.length > 0)
        ? proj.details.map(b => `\\item ${escapeLatex(b)}`).join('\n')
        : '';
      return `\\textbf{${escapeLatex(proj.name)}} \\\\
${techs ? `\\textbf{Technologies}: ${techs}` : ''}%
\\begin{itemize}[topsep=2pt,itemsep=2pt,parsep=0pt,partopsep=0pt]
${bullets}
\\end{itemize}
\\vspace{6pt}`;
    }).join('\n\n')
    : '';

  const skills = data.Skills || {};
  const programmingLanguages = skillsLine(skills.programmingLanguages);
  const frontend = skillsLine(skills.frontend);
  const backend = skillsLine(skills.backend);
  const databases = skillsLine(skills.databases);
  const cloudDevOps = skillsLine(skills.cloudDevOps);
  const uiux = skillsLine(skills.uiux);

  const skillLines = [
    programmingLanguages ? `\\textbf{Languages}: ${programmingLanguages} \\\\` : '',
    frontend ? `\\textbf{Frontend}: ${frontend} \\\\` : '',
    backend ? `\\textbf{Backend}: ${backend} \\\\` : '',
    databases ? `\\textbf{Databases}: ${databases} \\\\` : '',
    cloudDevOps ? `\\textbf{Cloud/DevOps}: ${cloudDevOps} \\\\` : '',
    uiux ? `\\textbf{UI/UX}: ${uiux}` : ''
  ].filter(Boolean).join('\n');

  const hasSkills = skillLines.length > 0;
  const skillsTex = hasSkills ? skillLines.trim() : '';

  const hasCerts = Array.isArray(data.Certifications) && data.Certifications.length > 0;
  const certsTex = hasCerts ? `
\\section*{Certifications}
${data.Certifications.map(cert => {
    const name = escapeLatex(cert.name);
    const issuer = cert.issuer ? escapeLatex(cert.issuer) : '';
    const date = cert.date ? escapeLatex(cert.date) : '';
    return `\\textbf{${name}}${issuer ? ` \\\\ ${issuer}` : ''}${date ? ` \\hfill ${date}` : ''} \\\\
\\vspace{6pt}`;
  }).join('\n')}
` : '';

  const github = data.Header.contact.github || '';
  const linkedin = data.Header.contact.linkedin || 'https://www.linkedin.com/in/khan-zaid7/';
  const website = data.Header.contact.website || '';

  const contactEmail = data.Header.contact.email ? `\\href{mailto:${escapeLatex(data.Header.contact.email)}}{${escapeLatex(data.Header.contact.email)}}` : '';
  const contactPhone = data.Header.contact.phone ? escapeLatex(data.Header.contact.phone) : '';
  const githubLink = github ? `GitHub: \\href{${github}}{${github}}` : '';
  const linkedinLink = linkedin
    ? `LinkedIn: \\href{${linkedin}}{${linkedin}}`
    : `LinkedIn: \\href{https://www.linkedin.com/in/khan-zaid7/}{https://www.linkedin.com/in/khan-zaid7/}`;
  const websiteLink = website ? `Website: \\href{${website}}{${website}}` : '';

  const headerContactItems = [contactEmail, contactPhone, githubLink, linkedinLink, websiteLink].filter(Boolean);
  const headerContactLine = headerContactItems.join(' \\textbar{} ');

  const hasSummary = Array.isArray(data.Summary.paragraphs) && data.Summary.paragraphs.length > 0;
  const summaryTex = hasSummary ? escapeLatex(data.Summary.paragraphs.join(' ')) : '';

  const latexDoc = `\\documentclass[a4paper,11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
\\usepackage[margin=0.75in]{geometry}
\\usepackage[none]{hyphenat}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{parskip}
\\usepackage{multicol}
\\definecolor{darkblue}{HTML}{1A1A1A}
\\definecolor{linkcolor}{HTML}{0A66C2}
\\hypersetup{colorlinks=true, urlcolor=linkcolor}
\\titleformat{\\section}{\\color{darkblue}\\large\\bfseries}{}{0em}{}[\\titlerule]
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{4pt}
\\setlist[itemize]{leftmargin=1.5em, topsep=2pt}
\\pagenumbering{gobble}
\\sloppy

\\begin{document}
\\begin{center}
  {\\LARGE \\textbf{${escapeLatex(data.Header.fullName)}}}\\\\
  \\vspace{4pt}
  ${headerContactLine}
\\end{center}
\\vspace{10pt}

${hasSummary ? `\\section*{Summary}\n${summaryTex}` : ''}
${hasExperience ? `\\section*{Work Experience}\n${experienceTex}` : ''}
${hasEducation ? `\\section*{Education}${educationTex}` : ''}
${hasProjects ? `\\section*{Projects}\n${projectsTex}` : ''}
${hasSkills ? `\\section*{Skills}\n${skillsTex}` : ''}
${certsTex}
\\end{document}
`;

  const baseFileName = `tailored_resume_${tailoredResume._id}`;
  const texFileName = `${baseFileName}.tex`;
  const pdfFileName = `${baseFileName}.pdf`;
  const storageDir = path.resolve('storage');
  const texFilePath = path.join(storageDir, texFileName);
  const pdfFilePath = path.join(storageDir, pdfFileName);

  await fsPromises.mkdir(storageDir, { recursive: true });
  await fsPromises.writeFile(texFilePath, latexDoc, 'utf8');

  return new Promise((resolve, reject) => {
    const command = 'pdflatex';
    const args = ['-interaction=nonstopmode', '-halt-on-error', `-output-directory=${storageDir}`, texFilePath];
    const child = spawn(command, args, { cwd: storageDir, env: process.env });

    let stdout = '', stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('error', (err) => {
      reject(new Error(`Failed to start pdflatex process: ${err.message}`));
    });

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          await fsPromises.unlink(texFilePath);
          await fsPromises.unlink(path.join(storageDir, `${baseFileName}.log`)).catch(() => { });
          await fsPromises.unlink(path.join(storageDir, `${baseFileName}.aux`)).catch(() => { });
          await fsPromises.unlink(path.join(storageDir, `${baseFileName}.out`)).catch(() => { });
        } catch { }
        resolve(pdfFilePath);
      } else {
        try {
          const log = await fsPromises.readFile(path.join(storageDir, `${baseFileName}.log`), 'utf8');
          console.error('LaTeX log:', log);
        } catch { }
        reject(new Error(`LaTeX compilation failed with code ${code}`));
      }
    });
  });
}
