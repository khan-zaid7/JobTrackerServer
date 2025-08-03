import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js'; // Adjust path if needed
import Resume from './models/Resume.js'; // Adjust path if needed
import ScrapedJob from './models/ScrapedJob.js';
import MatchedPair from './models/MatchedPair.js';
import TailoredResume from './models/TailoredResume.js';


dotenv.config();

const seedDatabase = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Database connected.');

        console.log('Clearing old User and Resume data...');
        await User.deleteMany({});
        await Resume.deleteMany({});
        await ScrapedJob.deleteMany({});
        await MatchedPair.deleteMany({});
        await TailoredResume.deleteMany({});
        console.log('Creating a new test user...');
        const user = await User.create({
            name: 'Mohd Zaid Khan',
            email: 'khan.mohd.zaid@protonmail.com',
            password: 'password123' // In a real app, this would be hashed
        });
        console.log(`User created with ID: ${user._id}`);

        console.log('Creating a master resume for the user...');
        const resume = await Resume.create({
            originalName: 'master-resume.txt',
            filePath: `uploads"\"11ec45df12b32f1e574df1e41dcfbc6c`,
            textContent: `Zaid Khan
khan.mohd.zaid@protonmail.com | 416 - 826 - 5259 | https://github.com/khan-
            zaid7 | https://www.linkedin.com/in/khan-zaid7/


            SUMMARY
Software Developer with expertise in React, Node.js, and AWS.Strong problem
solver with experience building scalable applications.Passionate about creative
tech solutions and collaborative engineering.


            EDUCATION
Lambton College | Jan 2024 – Aug 2025(Expected)
Postgraduate Diploma in Full Stack Software Development
        3.40 GPA
        Courses: DevOps, Cloud Computing, Java, C#.Net
        I.K.Gujral Punjab Technical University | Aug 2019 – Apr 2022
Bachelor of Science in Information Technology
        3.82 GPA
        Courses: Data Structures, Algorithms, OOP, SQL Databases, Computer
        Networking


        EXPERIENCE
Software Developer | Dec 2022 - Nov 2023
Cybertron Technologies | Chandigarh, IN
 • Developed 5 + full - stack apps using React.js, Django, and Node.js, serving
100K + users
 • Built REST APIs and SPAs with real - time data integration for enhanced
  user engagement
 • Optimized PostgreSQL databases, improving query performance by 35 %
 • Implemented Stripe / PayPal payments processing $500K + transactions

securely
 • Deployed apps on AWS using Docker/Terraform, cutting deployment
  time by 40 %
 • Automated CI / CD with GitHub Actions, boosting team productivity


PROJECTS
Ember Core – Offline - First Mobile Platform
   • Built using React Native (Expo), SQLite for local storage, Node.js, and
     Firebase Firestore
   • Implemented a bidirectional data synchronization system with offline -
first architecture
   • Developed automatic conflict detection and resolution mechanisms
     during data merges
   • Ensures reliable data persistence locally and seamless synchronization
with the cloud when connectivity is restored
Full - Stack Automation Platform
   • Engineered with Node.js, Express, MongoDB, and Playwright for
     intelligent browser automation
   • Integrated AI - driven processing using DeepSeek API, OpenAI, and custom
     filtering pipelines
   • Includes modular scraping workflows, asynchronous job execution, and
LaTeX - based document generation
   • Designed for scalability and automation across data - rich, dynamic
environments


SKILLS
Languages: JavaScript, Python, Java, C#, PHP, Bash
Frontend: React.js, Next.js, Vue, Tailwind CSS
Backend: Node.js, Django, Express, Laravel
Mobile: React Native(coursework exposure)
Databases: PostgreSQL, MySQL, MongoDB, DynamoDB
Cloud / DevOps: AWS(EC2, Lambda, S3, RDS), Docker, Terraform, CI / CD
`,
            isMaster: true,
            createdBy: user._id
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