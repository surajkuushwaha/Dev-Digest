#!/usr/bin/env node

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

// Default configuration
const DEFAULT_AUTHOR = "Suraj Kushwaha";
const DEFAULT_GITHUB_USERNAME = "cx-suraj";
const DEFAULT_PROVIDER = "openai";

interface UserInputs {
  month: string;
  author: string;
  githubUsername: string;
  provider: 'anthropic' | 'openai';
}

async function promptUser(question: string, defaultValue: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [${defaultValue}]: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function collectUserInputs(): Promise<UserInputs> {
  console.log('📋 Monthly Development Report Generator');
  console.log('========================================\n');

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const month = await promptUser('📅 Enter month (YYYY-MM)', defaultMonth);
  const author = await promptUser('👤 Enter your full name', DEFAULT_AUTHOR);
  const githubUsername = await promptUser('🐙 Enter GitHub username', DEFAULT_GITHUB_USERNAME);
  const provider = await promptUser('🤖 Choose AI provider (openai/anthropic)', DEFAULT_PROVIDER) as 'anthropic' | 'openai';

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('❌ Invalid month format. Use YYYY-MM (e.g., 2025-07)');
  }

  // Validate provider
  if (provider !== 'anthropic' && provider !== 'openai') {
    throw new Error('❌ Invalid provider. Choose either "anthropic" or "openai"');
  }

  console.log('\n📊 Generating report for:');
  console.log(`   Month: ${month}`);
  console.log(`   Author: ${author}`);
  console.log(`   GitHub: ${githubUsername}`);
  console.log(`   Provider: ${provider}`);
  console.log('----------------------------------------\n');

  return { month, author, githubUsername, provider };
}

async function generateReport(commitData: string, provider: 'anthropic' | 'openai') {
  // Read the system prompt
  const systemPromptPath = path.join(process.cwd(), 'report-generation-prompt.md');
  const systemPromptRaw = fs.readFileSync(systemPromptPath, 'utf-8');

  // Extract the system prompt content between <system_prompt> tags
  const systemPromptMatch = systemPromptRaw.match(/<system_prompt>([\s\S]*?)<\/system_prompt>/);
  const systemPrompt = systemPromptMatch ? systemPromptMatch[1].trim() : systemPromptRaw;

  console.log('Generating report...\n');

  // Select model based on provider
  let model;
  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    model = anthropic('claude-3-5-sonnet-20241022');
  } else if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    model = openai('gpt-4o');
  } else {
    throw new Error('Invalid provider');
  }

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: `Here are the commits to analyze:\n\n${commitData}`,
  });

  return text;
}

async function runCommitChronicle(userInputs: UserInputs): Promise<string> {
  console.log('🔄 Running commit-chronicle.sh to fetch commits...\n');

  const scriptPath = path.join(process.cwd(), 'commit-chronicle.sh');

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`commit-chronicle.sh not found at: ${scriptPath}`);
  }

  // Prepare the input for the script (simulate user input)
  const input = `${userInputs.month}\n${userInputs.author}\n${userInputs.githubUsername}\n`;

  try {
    // Run the script with input piped in
    execSync(`echo "${input}" | zsh "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    // Parse the month to get the date range for the report file path
    const [year, monthNumber] = userInputs.month.split('-');
    const startDate = `${year}-${monthNumber}-01`;
    const endDate = `${year}-${monthNumber}-31`;

    // Construct the expected report file path
    const reportDir = path.join(process.cwd(), year, `${startDate}-${endDate}`);
    const reportFile = path.join(reportDir, `${userInputs.githubUsername}_report.md`);

    if (!fs.existsSync(reportFile)) {
      throw new Error(`Generated report not found at: ${reportFile}`);
    }

    console.log(`\n✅ Commit chronicle generated at: ${reportFile}\n`);

    // Read and return the generated report
    return fs.readFileSync(reportFile, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to run commit-chronicle.sh: ${error}`);
  }
}

async function saveAIReport(report: string, userInputs: UserInputs): Promise<string> {
  // Parse the month to get the date range
  const [year, monthNumber] = userInputs.month.split('-');
  const startDate = `${year}-${monthNumber}-01`;
  const endDate = `${year}-${monthNumber}-31`;

  // Create the same directory structure as commit-chronicle.sh
  const reportDir = path.join(process.cwd(), year, `${startDate}-${endDate}`);

  // Ensure directory exists
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Save AI-generated report with a different suffix
  const aiReportFile = path.join(reportDir, `${userInputs.githubUsername}_ai_report.md`);

  fs.writeFileSync(aiReportFile, report, 'utf-8');

  return aiReportFile;
}

async function main() {
  try {
    // Collect user inputs interactively
    const userInputs = await collectUserInputs();

    // Run commit-chronicle.sh to generate the raw commit report
    const commitChronicleReport = await runCommitChronicle(userInputs);

    // Add metadata context to the prompt with detailed instructions
    const contextualPrompt = `You are analyzing commits for a monthly development report. Please provide a COMPREHENSIVE and DETAILED analysis.

**Report Metadata:**
- Month: ${userInputs.month}
- Author: ${userInputs.author}
- GitHub Username: ${userInputs.githubUsername}

**Instructions for Analysis:**
1. Carefully analyze ALL commits in the report below
2. Group related commits by feature/workstream
3. For each major task, provide:
   - Detailed technical description (what was built/fixed/improved)
   - Technologies and approaches used
   - Specific files/modules affected (extract from commit messages)
   - Challenges that may have been faced and solutions
   - Business/technical impact
4. Create a detailed time breakdown by workstream
5. Provide deep technical insights in the learnings section
6. Be specific - use actual file names, technologies, and metrics from the commits
7. Infer technical details from file paths and commit patterns when needed

**Commit Chronicle Report to Analyze:**
${commitChronicleReport}

Please generate a comprehensive, detailed monthly report following the structure in your system prompt. Make it thorough and insightful.`;

    const aiReport = await generateReport(contextualPrompt, userInputs.provider);

    // Save the AI-enhanced report
    const aiReportPath = await saveAIReport(aiReport, userInputs);

    console.log('\n✅ AI-enhanced report generated successfully!\n');
    console.log(`📄 Saved to: ${aiReportPath}\n`);
    console.log('='.repeat(80));
    console.log(aiReport);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
