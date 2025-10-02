# Dev Digest - Contribution Report Generator

A TypeScript tool that generates professional developer contribution reports from commit data using Claude AI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your Anthropic API key:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Usage

Run the report generator with a file containing your commit data:

```bash
npm run generate <path-to-commits-file>
```

### Example

```bash
npm run generate ./commits.txt
```

The tool will:
1. Read the system prompt from `report-generation-prompt.md`
2. Analyze the commits from your provided file
3. Generate a structured report with:
   - Impact Summary
   - Task Overview
   - Time/Effort Breakdown
   - Learnings & Observations

## Project Structure

```
.
├── src/
│   └── generate-report.ts    # Main CLI script
├── report-generation-prompt.md # System prompt for Claude
├── .env.example               # Example environment config
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
```

## Requirements

- Node.js 18+
- Anthropic API key
