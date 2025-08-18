import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

import User from './models/User.js'; // Adjust path if needed
import Resume from './models/Resume.js';
import ScrapedJob from './models/ScrapedJob.js';
import MatchedPair from './models/MatchedPair.js';
import TailoredResume from './models/TailoredResume.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected.');

    console.log('Clearing old User, Resume, and related data...');
    await User.deleteMany({});
    await Resume.deleteMany({});
    await ScrapedJob.deleteMany({});
    await MatchedPair.deleteMany({});
    await TailoredResume.deleteMany({});

    console.log('Creating a new test user...');

    // Hash password before saving
    const plainPassword = 'Test@1234#';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await User.create({
      name: 'Mohd Zaid Khan',
      email: 'khan.mohd.zaid@protonmail.com',
      password: hashedPassword, // ✅ stored hashed
    });

    console.log(`User created with ID: ${user._id}`);

    console.log('Creating a master resume for the user...');
    const resume = await Resume.create({
      originalName: 'master-resume.txt',
      filePath: `uploads/11ec45df12b32f1e574df1e41dcfbc6c`,
      textContent: `ZAID KHAN 
khan.mohd.zaid@protonmail.com | 416-826-5259 | linkedin.com/in/khan
zaid7 | github.com/khan-zaid7 
SUMMARY 
Process Automation Engineer specializing in building scalable, AI-driven platforms to 
eliminate manual work and optimize complex business operations. Adept at transforming 
high-level requirements into robust, full-stack applications with a focus on API integration 
and backend system architecture. 
PROJECTS 
Full-Stack Resume Tailoring & Job Application Pipeline  
• Architected a distributed, multi-worker system using JavaScript on Backend, TypeScript on client side and Node.js and RabbitMQ to 
automate the entire job application lifecycle, from scraping job boards to generating 
tailored resumes. 
• Engineered a sophisticated two-pass AI prompting strategy with DeepSeek/OpenAI 
to analyze job descriptions, identify skill gaps, and rewrite resume content to align 
with specific roles. 
• Containerized the entire application stack (Scraper, Matcher, Tailor workers) 
using Docker and orchestrated the local development environment with Docker 
Compose, including services for MongoDB and RabbitMQ. 
• Implemented a PDF generation module using LaTeX, automatically compiling and 
uploading the final, tailored documents to Google Cloud Storage. 
Ember Core – Offline-First Mobile Data Synchronization Platform 
• Developed a resilient mobile application architecture using React 
Native and SQLite that guarantees full functionality during network outages. 
• Engineered a bidirectional data synchronization system with Firebase 
Firestore and Node.js and TypeScript, featuring robust conflict resolution to ensure data integrity 
between local devices and the cloud. 
EXPERIENCE 
Software Developer | Cybertron Technologies | Chandigarh, IN | Dec 2021 - Nov 2023 
• Productized a suite of internal process automation tools using React, Django, and 
Node.js, saving an estimated 20 man-hours per week by eliminating manual data 
entry and report generation. 
• Architected and deployed secure RESTful APIs that served as the backbone for real
time data integration across multiple business-critical applications. 
• Led the optimization of PostgreSQL databases, improving query performance by 
over 35% and enhancing system reliability for data-intensive applications. 
• Engineered the CI/CD pipeline using GitHub Actions, reducing deployment time by 
40% and enabling faster iteration cycles for the development team. 
• Managed cloud infrastructure on AWS using Terraform and Docker, ensuring 
scalable and repeatable deployments. 
SKILLS 
• Languages: JavaScript (Node.js), Python, Java, C# 
• Backend: Express, Django, REST API Design, Microservices Architecture, RabbitMQ 
• Frontend: React.js, Next.js, Vue, Tailwind CSS 
• Databases: PostgreSQL, MongoDB, MySQL, DynamoDB, SQLite 
• Cloud & DevOps: AWS (EC2, S3, Lambda), Docker, Terraform, CI/CD, GitHub Actions 
• AI & Automation: AI Prompt Engineering, Playwright, LaTeX
• Operating System: Linux, Terminal, Bash, Windows 
EDUCATION 
Lambton College | Postgraduate Diploma, Full Stack Software Development | Jan 2024 – 
Aug 2025 (Expected) 
• Relevant Coursework: DevOps, Cloud Computing, Advanced Java 
I.K. Gujral Punjab Technical University | Bachelor of Science, Information Technology | Aug 
2019 – Apr 2022 
• Relevant Coursework: Data Structures & Algorithms, Object-Oriented Programming, 
SQL Databases `,
      isMaster: true,
      createdBy: user._id,
    });

    console.log(`Master resume created with ID: ${resume._id}`);
    console.log('Seed complete!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
};

seedDatabase();
