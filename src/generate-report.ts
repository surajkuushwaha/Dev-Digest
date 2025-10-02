#!/usr/bin/env node

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default configuration
const DEFAULT_AUTHOR = "Suraj Kushwaha";
const DEFAULT_GITHUB_USERNAME = "cx-suraj";
const DEFAULT_PROVIDER = "anthropic";

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
  const provider = await promptUser('🤖 Choose AI provider (anthropic/openai)', DEFAULT_PROVIDER) as 'anthropic' | 'openai';

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

async function main() {
  try {
    // Collect user inputs interactively
    const userInputs = await collectUserInputs();

    // Check if commit file path was provided
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Usage: npm run generate <commit-file-path>');
      console.error('Example: npm run generate ./commits.txt');
      process.exit(1);
    }

    const commitFilePath = path.resolve(args[0]);

    if (!fs.existsSync(commitFilePath)) {
      console.error(`Error: File not found: ${commitFilePath}`);
      process.exit(1);
    }

    const commitData = fs.readFileSync(commitFilePath, 'utf-8');

    // Add metadata context to the prompt
    const contextualPrompt = `Here are the commits to analyze:

**Report Metadata:**
- Month: ${userInputs.month}
- Author: ${userInputs.author}
- GitHub Username: ${userInputs.githubUsername}

**Commits:**
${commitData}`;

    const report = await generateReport(contextualPrompt, userInputs.provider);

    console.log('\n✅ Report generated successfully!\n');
    console.log('='.repeat(80));
    console.log(report);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
  }
}

main();
