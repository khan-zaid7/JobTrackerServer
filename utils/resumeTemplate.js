export const generateResumeHTML = (tailoredText) => {
    const lines = tailoredText.split('\n').filter(line => line.trim() !== '');
  
    let htmlBlocks = '';
    let isListOpen = false;
  
    lines.forEach(line => {
      const trimmed = line.trim();
      const isHeader = /^[A-Z][A-Z ]+$/.test(trimmed); // e.g. "EXPERIENCE"
      const isBullet = trimmed.startsWith('•');
  
      if (isHeader) {
        if (isListOpen) {
          htmlBlocks += '</ul>';
          isListOpen = false;
        }
        htmlBlocks += `<h2>${trimmed}</h2>`;
      } else if (isBullet) {
        if (!isListOpen) {
          htmlBlocks += '<ul>';
          isListOpen = true;
        }
        htmlBlocks += `<li>${trimmed.slice(1).trim()}</li>`;
      } else {
        if (isListOpen) {
          htmlBlocks += '</ul>';
          isListOpen = false;
        }
        htmlBlocks += `<p>${trimmed}</p>`;
      }
    });
  
    if (isListOpen) htmlBlocks += '</ul>';
  
    return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Resume</title>
      <style>
        @page {
          margin: 25mm;
        }
        body {
          font-family: 'Arial', sans-serif;
          font-size: 11pt;
          color: #000;
          padding: 0;
          margin: 0;
          line-height: 1.6;
        }
        .container {
          width: 100%;
          max-width: 750px;
          margin: 0 auto;
          padding: 10px 0;
        }
        h2 {
          font-size: 12pt;
          font-weight: bold;
          margin-top: 24px;
          margin-bottom: 6px;
          border-bottom: 1px solid #ccc;
          padding-bottom: 2px;
        }
        p {
          margin: 4px 0;
        }
        ul {
          margin: 0;
          padding-left: 20px;
        }
        li {
          margin-bottom: 6px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${htmlBlocks}
      </div>
    </body>
  </html>
  `;
  };
  