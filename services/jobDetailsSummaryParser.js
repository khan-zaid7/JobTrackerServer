import fs from 'fs/promises'; // use promises-based API


export const ParseJobDetailsSummary = async (jobDetails, iterator) => {
  const file = 'JobsSummary.txt';

  const responsibilities = jobDetails.description?.responsibilities || 'N/A';
  const qualifications = jobDetails.description?.qualifications || 'N/A';
  const benefits = jobDetails.description?.benefits || 'N/A';

  const job = `
-------------------------------------------------

JOB NO: ${iterator} DETAILED SUMMARY:
JOB URL: ${jobDetails.url}
COMPANY NAME: ${jobDetails.companyName}
JOB TITLE: ${jobDetails.title}
JOB LOCATION: ${jobDetails.location}
JOB POSTED AT: ${jobDetails.postedAt}
IS PROFILE QUALIFIED: ${jobDetails.isProfileQualified.percentage}

JOB DESCRIPTION:
    JOB RESPONSIBILITIES: ${responsibilities}\n
    JOB QUALIFICATIONS: ${qualifications}
    JOB PERKS: ${benefits}
`;

  try {
    await fs.appendFile(file, job);
  } catch (err) {
    console.error("❌ Failed to write job summary:", err);
  }
};
