#!/usr/bin/env node

import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Default configuration
const DEFAULT_AUTHOR = "Suraj Kushwaha";
const DEFAULT_GITHUB_USERNAME = "cx-suraj";

// Repository paths configuration
const REPO_PATHS = [
  "/Users/suraj/CultureX/repos/cx-analytics-backend",
  "/Users/suraj/CultureX/repos/cx-creator-services",
  "/Users/suraj/CultureX/repos/cx-saas-server",
  "/Users/suraj/CultureX/repos/cx-worker",
  "/Users/suraj/CultureX/repos/cx-saas-dashboard",
  "/Users/suraj/CultureX/repos/saas-super-admin"
];

// Type definitions
type OSType = 'windows' | 'macos' | 'linux' | 'unknown';

interface RepoStat {
  name: string;
  path: string;
  commits: number;
}

interface PRData {
  number: number;
  title: string;
  state: string;
  repository: {
    name: string;
  };
}

interface CommitChronicleOptions {
  month: string;
  author?: string;
  githubUsername?: string;
  repoPaths?: string[];
  outputDir?: string;
}

interface CommitChronicleResult {
  reportFile: string;
  reportContent: string;
  stats: {
    totalCommitCount: number;
    activeDays: number;
    repositories: number;
    repoStats: RepoStat[];
  };
}

interface ExtractCommitsResult {
  totalCommitCount: number;
  allCommits: string;
  allDates: string[];
  allDays: string[];
  repoStats: RepoStat[];
}

/**
 * Detect the operating system
 */
function detectOS(): OSType {
  const platform = os.platform();
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

/**
 * Get absolute path for a given path
 */
function getAbsolutePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(process.cwd(), inputPath);
}

/**
 * Execute a shell command and return the output
 */
function execCommand(command: string, options: ExecSyncOptions = {}): string {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Get month name from month number
 */
function getMonthName(monthNumber: string): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[parseInt(monthNumber) - 1];
}

/**
 * Create author pattern for git log matching
 */
function createAuthorPattern(authorName: string, githubUsername: string): string {
  return `(${authorName}|${githubUsername}@|${githubUsername}.*@|.*${githubUsername}.*)`;
}

/**
 * Validate and get repository paths
 */
function getValidRepositories(repoPaths: string[]): string[] {
  const validRepos: string[] = [];

  for (const repoPath of repoPaths) {
    const absPath = getAbsolutePath(repoPath);

    if (!fs.existsSync(absPath)) {
      console.log(`⚠️  Invalid path: ${repoPath} (skipping)`);
      continue;
    }

    const gitPath = path.join(absPath, '.git');
    if (!fs.existsSync(gitPath)) {
      console.log(`⚠️  Not a git repository: ${absPath} (skipping)`);
      continue;
    }

    validRepos.push(absPath);
    console.log(`✅ Found repository: ${absPath}`);
  }

  return validRepos;
}

/**
 * Get commit count for a repository
 */
function getCommitCount(repoPath: string, author: string, startDate: string, endDate: string): number {
  const command = `git log --all --author="${author}" --regexp-ignore-case --since="${startDate}" --until="${endDate}" --oneline --no-merges`;
  const output = execCommand(command, { cwd: repoPath });
  return output ? output.split('\n').length : 0;
}

/**
 * Get detailed commits for a repository
 */
function getDetailedCommits(repoPath: string, author: string, startDate: string, endDate: string): string {
  const command = `git log --all --author="${author}" --regexp-ignore-case --since="${startDate}" --until="${endDate}" --pretty=format:"Commit: %h%nDate: %ai%nMessage: %s%nAuthor: %an <%ae>%n%b%n%n-------------------------------------------" --no-merges`;
  return execCommand(command, { cwd: repoPath });
}

/**
 * Get commit dates for statistics
 */
function getCommitDates(repoPath: string, author: string, startDate: string, endDate: string): string {
  const command = `git log --all --author="${author}" --regexp-ignore-case --since="${startDate}" --until="${endDate}" --pretty=format:"%ad" --date=short --no-merges`;
  return execCommand(command, { cwd: repoPath });
}

/**
 * Get commit days of week for statistics
 */
function getCommitDays(repoPath: string, author: string, startDate: string, endDate: string): string {
  const command = `git log --all --author="${author}" --regexp-ignore-case --since="${startDate}" --until="${endDate}" --pretty=format:"%ad" --date=format:"%A" --no-merges`;
  return execCommand(command, { cwd: repoPath });
}

/**
 * Count occurrences in an array
 */
function countOccurrences(arr: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  arr.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return counts;
}

/**
 * Sort object by values in descending order
 */
function sortByValue(obj: Record<string, number>): Record<string, number> {
  return Object.entries(obj)
    .sort(([, a], [, b]) => b - a)
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
}

/**
 * Extract commits from all repositories
 */
function extractCommits(
  validRepos: string[],
  author: string,
  githubUsername: string,
  startDate: string,
  endDate: string
): ExtractCommitsResult {
  console.log(`📝 Extracting commits from ${validRepos.length} repositories...`);

  let totalCommitCount = 0;
  let allCommits = '';
  const allDates: string[] = [];
  const allDays: string[] = [];
  const repoStats: RepoStat[] = [];

  for (const repoPath of validRepos) {
    console.log(`  🔍 Processing: ${path.basename(repoPath)}`);

    // Fetch latest changes
    execCommand('git fetch --all', { cwd: repoPath });

    // Get commit counts with different author patterns
    const countByName = getCommitCount(repoPath, author, startDate, endDate);
    const countByUsername = getCommitCount(repoPath, githubUsername, startDate, endDate);

    // Use the pattern that gives more results
    const repoCommitCount = Math.max(countByName, countByUsername);
    const primaryAuthor = countByUsername > countByName ? githubUsername : author;

    totalCommitCount += repoCommitCount;

    if (repoCommitCount > 0) {
      // Add repository header
      allCommits += `## 📁 Repository: ${path.basename(repoPath)}\n\n`;
      allCommits += `**Path:** \`${repoPath}\`\n`;
      allCommits += `**Commits Found:** ${repoCommitCount}\n`;
      allCommits += `**Primary Author Pattern:** ${primaryAuthor}\n\n`;
      allCommits += '```\n';

      // Get detailed commits
      const commits = getDetailedCommits(repoPath, primaryAuthor, startDate, endDate);
      allCommits += commits;
      allCommits += '\n```\n\n';

      // Collect statistics
      const dates = getCommitDates(repoPath, primaryAuthor, startDate, endDate);
      if (dates) allDates.push(...dates.split('\n'));

      const days = getCommitDays(repoPath, primaryAuthor, startDate, endDate);
      if (days) allDays.push(...days.split('\n'));

      repoStats.push({
        name: path.basename(repoPath),
        path: repoPath,
        commits: repoCommitCount
      });
    }
  }

  return {
    totalCommitCount,
    allCommits,
    allDates: allDates.filter(d => d),
    allDays: allDays.filter(d => d),
    repoStats
  };
}

/**
 * Get PR data using GitHub CLI
 */
function getPRData(githubUsername: string, startDate: string, endDate: string): { reviewed: PRData[]; authored: PRData[] } | null {
  // Check if gh is installed
  const ghInstalled = execCommand('command -v gh');

  if (!ghInstalled) {
    return null;
  }

  try {
    // Get reviewed PRs
    const reviewedCmd = `gh pr list --search "reviewed-by:${githubUsername} created:${startDate}..${endDate}" --limit 100 --state all --json number,title,state,repository`;
    const reviewedOutput = execCommand(reviewedCmd);
    const reviewed: PRData[] = reviewedOutput ? JSON.parse(reviewedOutput) : [];

    // Get authored PRs
    const authoredCmd = `gh pr list --search "author:${githubUsername} created:${startDate}..${endDate}" --limit 100 --state all --json number,title,state,repository`;
    const authoredOutput = execCommand(authoredCmd);
    const authored: PRData[] = authoredOutput ? JSON.parse(authoredOutput) : [];

    return { reviewed, authored };
  } catch (error: any) {
    console.log('⚠️  Failed to fetch PR data:', error.message);
    return null;
  }
}

/**
 * Generate the markdown report
 */
export function generateCommitChronicle(options: CommitChronicleOptions): CommitChronicleResult {
  const {
    month,
    author = DEFAULT_AUTHOR,
    githubUsername = DEFAULT_GITHUB_USERNAME,
    repoPaths = REPO_PATHS,
    outputDir = process.cwd()
  } = options;

  const osType = detectOS();

  console.log('📋 Monthly Development Report Generator');
  console.log('========================================');
  console.log(`🖥️  Platform: ${osType} (${os.platform()})`);
  console.log('');

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('❌ Invalid month format. Use YYYY-MM (e.g., 2025-07)');
  }

  // Parse month
  const [year, monthNumber] = month.split('-');
  const monthName = getMonthName(monthNumber);
  const startDate = `${year}-${monthNumber}-01`;
  const endDate = `${year}-${monthNumber}-31`;

  // Validate repositories
  let validRepos = getValidRepositories(repoPaths);

  if (validRepos.length === 0) {
    // Try current directory
    const currentPath = process.cwd();
    const gitPath = path.join(currentPath, '.git');
    if (fs.existsSync(gitPath)) {
      validRepos = [currentPath];
      console.log(`📂 Using current directory: ${currentPath}`);
    } else {
      throw new Error('❌ No valid git repositories found');
    }
  }

  console.log('');
  console.log('📊 Generating report for:');
  console.log(`   Month: ${monthName} ${year} (${startDate} to ${endDate})`);
  console.log(`   Author: ${author}`);
  console.log(`   GitHub: ${githubUsername}`);
  console.log(`   Repositories: ${validRepos.length} repo(s)`);
  validRepos.forEach(repo => {
    console.log(`     - ${path.basename(repo)} (${repo})`);
  });
  console.log('----------------------------------------');
  console.log('');

  // Extract commits
  const { totalCommitCount, allCommits, allDates, allDays, repoStats } =
    extractCommits(validRepos, author, githubUsername, startDate, endDate);

  // Create report directory
  const reportDir = path.join(outputDir, year, `${startDate}-${endDate}`);
  fs.mkdirSync(reportDir, { recursive: true });

  const reportFile = path.join(reportDir, `${githubUsername}_report.md`);

  // Backup existing file
  if (fs.existsSync(reportFile)) {
    const backupFile = `${reportFile}.backup.${Date.now()}`;
    fs.copyFileSync(reportFile, backupFile);
    console.log(`📋 Existing report backed up to: ${backupFile}`);
  }

  // Start building the report
  let report = `# 📊 Monthly Development Report - ${monthName} ${year}\n\n`;
  report += `> **Developer:** ${author}  \n`;
  report += `> **GitHub Username:** \`${githubUsername}\`  \n`;
  report += `> **Reporting Period:** \`${startDate}\` to \`${endDate}\`  \n`;
  report += `> **Generated:** ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}\n\n`;
  report += '---\n\n';
  report += '## 📝 Commits Summary\n\n';

  // Executive summary
  const activeDays = new Set(allDates).size;
  report += '### 🎯 Executive Summary\n\n';
  report += '| Metric | Value |\n';
  report += '|--------|-------|\n';
  report += `| **Total Commits** | ${totalCommitCount} |\n`;
  report += `| **Repositories Analyzed** | ${validRepos.length} |\n`;
  report += `| **Period** | ${startDate} to ${endDate} |\n`;
  report += `| **Active Days** | ${activeDays} |\n\n`;

  // Detailed commits
  if (totalCommitCount > 0) {
    report += '### Detailed Commits by Repository\n\n';
    report += allCommits;
    report += '\n';

    // Commit statistics
    report += '### 📊 Commit Statistics\n\n';

    // Daily breakdown
    report += '#### Commits by Date\n\n';
    if (allDates.length > 0) {
      report += '| Date | Commits |\n';
      report += '|------|---------|';
      const dateCounts = sortByValue(countOccurrences(allDates));
      for (const [date, count] of Object.entries(dateCounts)) {
        report += `\n| ${date} | ${count} |`;
      }
      report += '\n';
    } else {
      report += 'No commit data available.\n';
    }
    report += '\n';

    // Weekly activity
    report += '#### Most Active Days of Week\n\n';
    if (allDays.length > 0) {
      report += '| Day | Commits |\n';
      report += '|-----|---------|';
      const dayCounts = sortByValue(countOccurrences(allDays));
      for (const [day, count] of Object.entries(dayCounts)) {
        report += `\n| ${day} | ${count} |`;
      }
      report += '\n';
    } else {
      report += 'No day activity data available.\n';
    }
    report += '\n';
  } else {
    report += '### ℹ️ No Commits Found\n\n';
    report += '> No commits were found for this period across all configured repositories.\n';
    report += '> This could mean:\n';
    report += '> - No development activity during this period\n';
    report += '> - Author name/username mismatch in git configuration\n';
    report += '> - Repository paths need to be updated\n\n';
  }

  // PR Reviews section
  report += '---\n\n';
  report += '## 🔄 Pull Request Reviews\n\n';

  console.log('🔄 Extracting PR reviews...');
  const prData = getPRData(githubUsername, startDate, endDate);

  if (prData) {
    // Reviewed PRs
    report += '### PRs Reviewed by Me\n\n';
    if (prData.reviewed.length > 0) {
      report += `**Total PRs Reviewed:** ${prData.reviewed.length}\n\n`;
      report += '| PR # | Title | Status | Repository |\n';
      report += '|------|-------|--------|------------|\n';
      prData.reviewed.forEach(pr => {
        const title = pr.title.replace(/\|/g, ' ');
        const repo = pr.repository.name;
        report += `| #${pr.number} | ${title} | ${pr.state} | ${repo} |\n`;
      });
      report += '\n';
    } else {
      report += '> No PRs reviewed during this period.\n\n';
    }

    // Authored PRs
    report += '### PRs Authored by Me\n\n';
    if (prData.authored.length > 0) {
      report += `**Total PRs Authored:** ${prData.authored.length}\n\n`;
      report += '| PR # | Title | Status | Repository |\n';
      report += '|------|-------|--------|------------|\n';
      prData.authored.forEach(pr => {
        const title = pr.title.replace(/\|/g, ' ');
        const repo = pr.repository.name;
        report += `| #${pr.number} | ${title} | ${pr.state} | ${repo} |\n`;
      });
      report += '\n';
    } else {
      report += '> No PRs authored during this period.\n\n';
    }
  } else {
    report += '### ⚠️ GitHub CLI Not Available\n\n';
    report += '> GitHub CLI (`gh`) is not installed. PR review data cannot be extracted.\n\n';
    report += '#### Installation Instructions\n\n';
    if (osType === 'windows') {
      report += '- **Windows:** `winget install GitHub.cli` or `choco install gh`\n';
    } else if (osType === 'linux') {
      report += '- **Linux:** `sudo apt install gh` or `sudo snap install gh`\n';
    } else if (osType === 'macos') {
      report += '- **macOS:** `brew install gh`\n';
    }
    report += '- **All platforms:** Visit [https://cli.github.com/](https://cli.github.com/)\n\n';
  }

  // Final summary
  report += '---\n\n';
  report += '## 📈 Final Summary & Metrics\n\n';
  report += '### 🎯 Key Performance Indicators\n\n';
  report += '| Metric | Value | Notes |\n';
  report += '|--------|-------|-------|\n';
  report += `| **Total Commits** | ${totalCommitCount} | Across all repositories |\n`;
  report += `| **Repositories Analyzed** | ${validRepos.length} | Active repositories |\n`;
  report += `| **Reporting Period** | \`${startDate}\` to \`${endDate}\` | ${monthName} ${year} |\n`;
  report += `| **Report Generated** | ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'medium' })} | Automated extraction |\n\n`;

  // Repository breakdown
  report += '### 📁 Repository Breakdown\n\n';
  report += '| Repository | Commits | Path |\n';
  report += '|------------|---------|------|\n';
  repoStats.forEach(repo => {
    report += `| **${repo.name}** | ${repo.commits} | \`${repo.path}\` |\n`;
  });
  report += '\n';

  // Technical notes
  report += '---\n\n';
  report += '### 🔧 Technical Notes\n\n';
  report += '- **Data Source:** Git commit history and GitHub CLI\n';
  report += '- **Author Matching:** Case-insensitive pattern matching for both name and username\n';
  report += '- **Date Range:** Inclusive of start and end dates\n';
  report += '- **Merge Commits:** Excluded from analysis\n';
  report += '- **Branches:** All branches analyzed (`--all` flag)\n\n';

  // Report information
  report += '### 📋 Report Information\n\n';
  report += '> This report was automatically generated using:\n';
  report += '> - **Git** for commit extraction and analysis\n';
  report += '> - **GitHub CLI** for pull request data\n';
  report += '> - **Cross-platform compatibility** for Windows, macOS, and Linux\n\n';
  report += '*Generated by Commit Chronicle (JavaScript) - Monthly Development Report Generator*\n';

  // Write report to file
  fs.writeFileSync(reportFile, report, 'utf-8');

  console.log(`✅ Report generated: ${reportFile}`);
  console.log('');
  console.log('📄 View your report:');
  console.log(`   cat ${reportFile}`);

  return {
    reportFile,
    reportContent: report,
    stats: {
      totalCommitCount,
      activeDays,
      repositories: validRepos.length,
      repoStats
    }
  };
}
