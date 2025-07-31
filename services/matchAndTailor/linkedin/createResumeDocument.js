import fsPromises from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os'; // Import the 'os' module
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import TailoredResume from '../../../models/TailoredResume.js';
import User from '../../../models/User.js'; 


/**
 * Sanitizes a string to be used as a file path component.
 * Converts to lowercase, replaces spaces with hyphens, and removes unsafe characters.
 * @param {string} str The string to sanitize.
 * @returns {string} The sanitized string.
 */
const sanitizeForPath = (str = '') => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove all non-alphanumeric characters except hyphens
};

dotenv.config();

export async function createResumeDocument(tailoredResume, userId, batchId) {
  const storage = new Storage({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: 'graphite-earth-467220-a9'
  });
  if (!storage) throw new Error(`Storage not defined: ${storage}`);

  const data = tailoredResume.tailoredSections;

  // --- LaTeX generation helpers (no changes here) ---
  const escapeLatex = (str = '') => str.replace(/([&%$#_{}~^\\])/g, '\\$1');
  const skillsLine = (arr = []) => arr.filter(Boolean).map(escapeLatex).join(', ');

  // --- LaTeX content generation (no changes here, your logic is good) ---
  const hasEducation = Array.isArray(data.Education) && data.Education.length > 0;
  const educationTex = hasEducation ? data.Education.map(ed => {
    const dates = `${escapeLatex(ed.dates.start)} - ${escapeLatex(ed.dates.end)}`;

    // Line 1: Institution (left) and Dates (right)
    const header = `{\\textbf{\\large ${escapeLatex(ed.institution)}}} \\hfill {\\color{secondarycolor}\\textit{${dates}}}`;

    // Line 2: Degree and Location
    const degreeLine = `{\\textit{${escapeLatex(ed.degree)}${ed.location ? `, ${escapeLatex(ed.location)}` : ''}}}`;

    const gpaLine = ed.gpa ? `\\\\ GPA: ${escapeLatex(ed.gpa)}` : '';
    const detailsLines = (Array.isArray(ed.details) && ed.details.length > 0)
      ? `\\begin{itemize}\\item ${ed.details.map(escapeLatex).join('\\item ')}\\end{itemize}`
      : '';

    return `${header} \\\\
    ${degreeLine}${gpaLine}
    ${detailsLines}`;
  }).join('\\vspace{1em}\n\n') : '';

  const hasExperience = Array.isArray(data.Experience) && data.Experience.length > 0;
  const experienceTex = hasExperience ? data.Experience.map(exp => {
    const dates = `${escapeLatex(exp.dates.start)} - ${escapeLatex(exp.dates.end)}`;

    // Line 1: Job Title and Company (left) and Dates (right)
    const header = `{\\textbf{\\large ${escapeLatex(exp.jobTitle)}}} at {\\textbf{\\large ${escapeLatex(exp.company)}}} \\hfill {\\color{secondarycolor}\\textit{${dates}}}`;

    // Line 2: Location (optional)
    const locationLine = exp.location ? `{\\color{secondarycolor}\\textit{${escapeLatex(exp.location)}}}` : '';

    const bullets = (Array.isArray(exp.responsibilities) && exp.responsibilities.length > 0)
      ? exp.responsibilities.map(b => `\\item ${escapeLatex(b)}`).join('\n')
      : '';

    return `${header} \\\\
    ${locationLine}
    \\vspace{0.5ex}
    \\begin{itemize}
        ${bullets}
    \\end{itemize}`;
  }).join('\\vspace{1em}\n\n') : '';

  const hasProjects = Array.isArray(data.Projects) && data.Projects.length > 0;
  const projectsTex = hasProjects ? data.Projects.map(proj => {
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
  }).join('\n\n') : '';

  const skills = data.Skills || {};
  const skillLines = [
    skills.programmingLanguages?.length ? `\\textbf{Languages}: ${skillsLine(skills.programmingLanguages)} \\\\` : '',
    skills.frontend?.length ? `\\textbf{Frontend}: ${skillsLine(skills.frontend)} \\\\` : '',
    skills.backend?.length ? `\\textbf{Backend}: ${skillsLine(skills.backend)} \\\\` : '',
    skills.databases?.length ? `\\textbf{Databases}: ${skillsLine(skills.databases)} \\\\` : '',
    skills.cloudDevOps?.length ? `\\textbf{Cloud/DevOps}: ${skillsLine(skills.cloudDevOps)} \\\\` : '',
    skills.uiux?.length ? `\\textbf{UI/UX}: ${skillsLine(skills.uiux)}` : ''
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

  const { github, linkedin, website, email, phone } = data.Header.contact;
  const contactEmail = email ? `\\href{mailto:${escapeLatex(email)}}{${escapeLatex(email)}}` : '';
  const contactPhone = phone ? escapeLatex(phone) : '';
  // Clean up the links to be more readable
  const githubLink = github ? `GitHub: \\href{${github}}{${github.replace('https://', '')}}` : '';
  const linkedinLink = linkedin ? `LinkedIn: \\href{${linkedin}}{${linkedin.replace('https://www.', '')}}` : '';
  const websiteLink = website ? `Website: \\href{${website}}{${website.replace('https://', '')}}` : '';

  const headerContactItems = [contactEmail, contactPhone, linkedinLink, githubLink, websiteLink].filter(Boolean);
  const headerContactLine = headerContactItems.join(' \\quad | \\quad ');


  const hasSummary = Array.isArray(data.Summary.paragraphs) && data.Summary.paragraphs.length > 0;
  const summaryTex = hasSummary ? escapeLatex(data.Summary.paragraphs.join(' ')) : '';

  const latexDoc = `\\documentclass[11pt, a4paper]{article}

% --- PACKAGES (Standard) ---
\\usepackage[T1]{fontenc}
\\usepackage{helvet} % A clean, standard sans-serif font
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{titlesec}
\\usepackage{enumitem}

% --- CONFIGURATION ---
\\renewcommand{\\familydefault}{\\sfdefault}

\\definecolor{primarycolor}{HTML}{202020}
\\definecolor{secondarycolor}{HTML}{555555}
\\definecolor{rulecolor}{HTML}{E0E0E0}
\\definecolor{linkcolor}{HTML}{0056b3}

\\hypersetup{colorlinks=true, urlcolor=linkcolor, linkcolor=linkcolor, pdfstartview=FitH}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}

\\titleformat{\\section}
  {\\Large\\bfseries\\color{primarycolor}}
  {}
  {0em}
  {}
  [\\color{rulecolor}\\titlerule\\vspace{0.8ex}]
\\titlespacing*{\\section}{0pt}{1.8em}{1.2em}

\\setlist[itemize]{
  leftmargin=*,
  label=\\textbullet,
  topsep=0.2ex,
  partopsep=0pt,
  itemsep=0.3ex
}

% --- DOCUMENT START ---
\\begin{document}

% --- HEADER ---
\\begin{center}
  {\\fontsize{26pt}{30pt}\\bfseries\\color{primarycolor} ${escapeLatex(data.Header.fullName)}}
  \\vspace{6pt}
  
  {\\color{secondarycolor} ${headerContactLine}}
\\end{center}

% --- SECTIONS ---
${hasSummary ? `\\section*{Summary}\\vspace{-0.5em}\n${summaryTex}` : ''}
${hasExperience ? `\\section*{Work Experience}\n${experienceTex}` : ''}
${hasProjects ? `\\section*{Projects}\n${projectsTex}` : ''}
${hasSkills ? `\\section*{Skills}\n${skillsTex}` : ''}
${hasEducation ? `\\section*{Education}\n${educationTex}` : ''}
${certsTex ? `${certsTex}` : ''}

\\end{document}
`;


  // --- NEW: Temporary file handling ---
  const baseFileName = `tailored_resume_${tailoredResume._id}`;
  const texFileName = `${baseFileName}.tex`;
  const pdfFileName = `${baseFileName}.pdf`;
  let tempDir;

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    // 3b. Create the components of the folder path.
    const userFolderName = `${sanitizeForPath(user.name)}-${user._id.toString()}`;
    const dateFolderName = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const batchFolderName = batchId;

    // 3c. Assemble the final destination path for GCS.
    // GCS uses forward slashes, so path.join is perfect for this.
    // Note: GCS doesn't have real "folders". This path is just part of the object's name.
    const gcsDestinationPath = path.join(
      userFolderName,
      dateFolderName,
      batchFolderName,
      pdfFileName
    ).replace(/\\/g, '/');


    // 1. Create a unique temporary directory in the OS's temp folder
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), `resume-${tailoredResume._id}-`));

    const texFilePath = path.join(tempDir, texFileName);
    const pdfFilePath = path.join(tempDir, pdfFileName);

    // 2. Write the .tex file to the temporary directory
    await fsPromises.writeFile(texFilePath, latexDoc, 'utf8');

    // 3. Run pdflatex compilation process
    await new Promise((resolve, reject) => {
      const command = 'pdflatex';
      const args = ['-interaction=nonstopmode', '-halt-on-error', `-output-directory=${tempDir}`, texFilePath];
      const child = spawn(command, args, { cwd: tempDir });

      child.on('error', (err) => reject(new Error(`Failed to start pdflatex. Is it installed? Error: ${err.message}`)));

      child.on('close', async (code) => {
        if (code === 0) {
          resolve(); // PDF compilation was successful
        } else {
          const logFilePath = path.join(tempDir, `${baseFileName}.log`);
          let logContent = 'Could not read log file.';
          try {
            logContent = await fsPromises.readFile(logFilePath, 'utf8');
          } catch (logError) { /* ignore */ }
          console.error('LaTeX compilation failed. Full log:\n', logContent);
          reject(new Error(`LaTeX compilation failed with code ${code}.`));
        }
      });
    });

    // 4. Upload the generated PDF from the temporary directory to GCS
    // 4. ✅ STEP 4: Upload the generated PDF using the NEW nested path.
    console.log(`Uploading PDF to GCS at: ${gcsDestinationPath}`);
    const publicUrl = await uploadToGCS(storage, pdfFilePath, gcsDestinationPath, process.env.BUCKET_NAME);7

    // 5. Update the database with the public URL
    await TailoredResume.findByIdAndUpdate(tailoredResume._id, { pdfPath: publicUrl });

    // 6. Return the public URL on success
    return publicUrl;

  } catch (error) {
    console.error("An error occurred during resume document creation:", error);
    // Re-throw the error to be handled by the caller
    throw error;
  } finally {
    // 7. IMPORTANT: Clean up the temporary directory and all its contents
    if (tempDir) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      console.log(`Successfully cleaned up temporary directory: ${tempDir}`);
    }
  }
}

// --- UPDATED uploadToGCS Function ---
async function uploadToGCS(storage, localFilePath, destinationFileName, bucketName) {
  const bucket = storage.bucket(bucketName);

  // Upload the file
  const [file] = await bucket.upload(localFilePath, {
    destination: destinationFileName,
    gzip: true,
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  // Return the public URL
  return `https://storage.googleapis.com/${bucketName}/${destinationFileName}`;
}