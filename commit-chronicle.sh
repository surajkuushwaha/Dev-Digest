#!/usr/bin/env zsh

# Monthly Development Report Generator
# Cross-platform script for Windows (Git Bash/WSL), Linux, and macOS
# Uses only git and gh commands to generate markdown report
# Optimized for zsh shell

set -e

# Enable zsh array compatibility
setopt KSH_ARRAYS  # Use 0-based array indexing like bash
setopt POSIX_ARGZERO  # Set $0 to script name like bash

# ==========================================
# ⚙️ DEFAULT CONFIGURATION
# ==========================================
# Set your default values here to skip interactive prompts
DEFAULT_AUTHOR="Suraj Kushwaha"
DEFAULT_GITHUB_USERNAME="cx-suraj"

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        CYGWIN*|MINGW*|MSYS*)
            echo "windows"
            ;;
        Linux*)
            echo "linux" 
            ;;
        Darwin*)
            echo "macos"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

OS_TYPE=$(detect_os)

# Cross-platform absolute path resolution
get_absolute_path() {
    local path="$1"
    if [ "$OS_TYPE" = "windows" ]; then
        # Handle Windows paths in Git Bash/MSYS2
        if [[ "$path" =~ ^[A-Za-z]: ]]; then
            # Already absolute Windows path
            echo "$path"
        elif [[ "$path" = /* ]]; then
            # Unix-style absolute path in Git Bash
            echo "$path"
        else
            # Relative path
            echo "$(cd "$path" 2>/dev/null && pwd)" || echo ""
        fi
    else
        # Linux/macOS
        if [[ "$path" = /* ]]; then
            echo "$path"
        else
            echo "$(cd "$path" 2>/dev/null && pwd)" || echo ""
        fi
    fi
}

# Cross-platform line count (handle different wc implementations)
count_lines() {
    if [ "$OS_TYPE" = "linux" ]; then
        wc -l | sed 's/^[ \t]*//' | cut -d' ' -f1
    else
        wc -l | tr -d ' '
    fi
}

echo "📋 Monthly Development Report Generator"
echo "========================================"
echo "🖥️  Platform: $OS_TYPE ($(uname -s))"
echo ""

# Interactive input collection
echo -n "📅 Enter month (YYYY-MM) [$(date +"%Y-%m")]: "
read MONTH_INPUT
MONTH=${MONTH_INPUT:-$(date +"%Y-%m")}

echo -n "👤 Enter your full name [$DEFAULT_AUTHOR]: "
read AUTHOR_INPUT
AUTHOR=${AUTHOR_INPUT:-"$DEFAULT_AUTHOR"}

echo -n "🐙 Enter GitHub username [$DEFAULT_GITHUB_USERNAME]: "
read GITHUB_USERNAME_INPUT
GITHUB_USERNAME=${GITHUB_USERNAME_INPUT:-"$DEFAULT_GITHUB_USERNAME"}

# Create comprehensive author patterns for git log matching
# This handles various name/email combinations and case variations
create_author_pattern() {
    local author_name="$1"
    local github_username="$2"
    
    # Build a regex pattern that matches common author variations
    # Include: exact name, email patterns with username, case variations
    echo "($author_name|${github_username}@|${github_username}.*@|.*${github_username}.*)"
}

# ==========================================
# 📁 REPOSITORY CONFIGURATION
# ==========================================
# Configure your repository paths here. Edit this section to add your repositories.
# Use absolute paths for best results, or relative paths from where you run the script.

# Example configurations:
# REPO_PATHS=(
#     "/Users/username/projects/repo1"
#     "/Users/username/projects/repo2" 
#     "../other-project"
# )

# Configured repositories - edit these paths as needed

REPO_PATHS=(
    "/Users/suraj/CultureX/repos/cx-analytics-backend"
    "/Users/suraj/CultureX/repos/cx-creator-services"
    "/Users/suraj/CultureX/repos/cx-saas-server"
    "/Users/suraj/CultureX/repos/cx-worker"
    "/Users/suraj/CultureX/repos/cx-saas-dashboard"
    "/Users/suraj/CultureX/repos/saas-super-admin"
)

# If no repositories configured, use current working directory
if [ ${#REPO_PATHS[@]} -eq 0 ]; then
    CURRENT_ABS_PATH=$(get_absolute_path ".")
    if [ -d "$CURRENT_ABS_PATH/.git" ]; then
        REPO_PATHS+=("$CURRENT_ABS_PATH")
        echo "📂 Using current directory: $CURRENT_ABS_PATH"
    else
        echo "❌ Current directory is not a git repository"
        echo "💡 Either run this script from a git repository or configure REPO_PATHS in the script"
        exit 1
    fi
else
    # Validate configured repositories
    VALID_REPOS=()
    for REPO_PATH in "${REPO_PATHS[@]}"; do
        ABS_PATH=$(get_absolute_path "$REPO_PATH")
        if [ -z "$ABS_PATH" ]; then
            echo "⚠️  Invalid path: $REPO_PATH (skipping)"
            continue
        fi
        
        if [ ! -d "$ABS_PATH/.git" ]; then
            echo "⚠️  Not a git repository: $ABS_PATH (skipping)"
            continue
        fi
        
        VALID_REPOS+=("$ABS_PATH")
        echo "✅ Found repository: $ABS_PATH"
    done
    
    if [ ${#VALID_REPOS[@]} -eq 0 ]; then
        echo "❌ No valid git repositories found in configuration"
        exit 1
    fi
    
    REPO_PATHS=("${VALID_REPOS[@]}")
fi

# Validate month format
if [[ ! $MONTH =~ ^[0-9]{4}-[0-9]{2}$ ]]; then
    echo "❌ Invalid month format. Use YYYY-MM (e.g., 2025-07)"
    exit 1
fi

# Parse month for date range
YEAR=$(echo $MONTH | cut -d'-' -f1)
MONTH_NUMBER=$(echo $MONTH | cut -d'-' -f2)
START_DATE="${YEAR}-${MONTH_NUMBER}-01"
END_DATE="${YEAR}-${MONTH_NUMBER}-31"

# Get month name
case $MONTH_NUMBER in
    01) MONTH_NAME="January" ;;
    02) MONTH_NAME="February" ;;
    03) MONTH_NAME="March" ;;
    04) MONTH_NAME="April" ;;
    05) MONTH_NAME="May" ;;
    06) MONTH_NAME="June" ;;  
    07) MONTH_NAME="July" ;;
    08) MONTH_NAME="August" ;;
    09) MONTH_NAME="September" ;;
    10) MONTH_NAME="October" ;;
    11) MONTH_NAME="November" ;;
    12) MONTH_NAME="December" ;;
esac

echo ""
echo "📊 Generating report for:"
echo "   Month: $MONTH_NAME $YEAR ($START_DATE to $END_DATE)"
echo "   Author: $AUTHOR"
echo "   GitHub: $GITHUB_USERNAME"
echo "   Repositories: ${#REPO_PATHS[@]} repo(s)"
for repo in "${REPO_PATHS[@]}"; do
    echo "     - $(basename "$repo") ($repo)"
done
echo "----------------------------------------"

# Output markdown file - create in project repository with year/month structure
get_script_dir() {
    local script_path="$0"
    if [ "$OS_TYPE" = "windows" ]; then
        dirname "$(readlink -f "$script_path" 2>/dev/null || echo "$script_path")"
    else
        dirname "$(readlink -f "$script_path" 2>/dev/null || echo "$script_path")"
    fi
}

# Sanitize filename components
sanitize_filename() {
    local input="$1"
    # Remove/replace invalid characters: < > : " | ? * \ / and control chars
    echo "$input" | sed 's/[<>:"|?*\\\/[:cntrl:]]\+/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g'
}

# Get the directory where the script is located
SCRIPT_DIR=$(get_script_dir)

# Create year/month directory structure
REPORT_DIR="$SCRIPT_DIR/$YEAR/$START_DATE-$END_DATE"
if ! mkdir -p "$REPORT_DIR" 2>/dev/null; then
    echo "⚠️  Cannot create report directory, using current directory"
    REPORT_DIR="."
elif ! touch "$REPORT_DIR/.test_write" 2>/dev/null; then
    echo "⚠️  No write permission to report directory, using current directory"
    REPORT_DIR="."
else
    rm -f "$REPORT_DIR/.test_write" 2>/dev/null
fi

# Sanitize filename components and create report path
CLEAN_USERNAME=$(sanitize_filename "$GITHUB_USERNAME")
REPORT_FILENAME="${CLEAN_USERNAME}_report.md"

# Handle existing file with backup
REPORT_FILE="$REPORT_DIR/$REPORT_FILENAME"
if [ -f "$REPORT_FILE" ]; then
    BACKUP_FILE="$REPORT_FILE.backup.$(date +%s)"
    cp "$REPORT_FILE" "$BACKUP_FILE" 2>/dev/null && echo "📋 Existing report backed up to: $BACKUP_FILE"
fi

# Start building the markdown report
cat > "$REPORT_FILE" << EOF
# 📊 Monthly Development Report - $MONTH_NAME $YEAR

> **Developer:** $AUTHOR  
> **GitHub Username:** \`$GITHUB_USERNAME\`  
> **Reporting Period:** \`$START_DATE\` to \`$END_DATE\`  
> **Generated:** $(date +"%B %d, %Y at %H:%M")

---

## 📝 Commits Summary

EOF

# Step 1: Extract commits from all repositories
echo "📝 Extracting commits from ${#REPO_PATHS[@]} repositories..."

# Initialize counters
TOTAL_COMMIT_COUNT=0

# Cross-platform temporary file creation
create_temp_file() {
    local suffix="$1"
    if [ "$OS_TYPE" = "windows" ]; then
        # Windows temp directory handling
        local temp_dir="${TEMP:-${TMP:-/tmp}}"
        local temp_file="$temp_dir/commit_chronicle_$$_$(date +%s)_${suffix}"
        touch "$temp_file" 2>/dev/null || {
            echo "❌ Failed to create temp file: $temp_file" >&2
            exit 1
        }
        echo "$temp_file"
    else
        # Use zsh-compatible mktemp
        mktemp -t "commit_chronicle_${suffix}.XXXXXX" 2>/dev/null || {
            # Fallback for systems without mktemp
            local temp_file="/tmp/commit_chronicle_$$_$(date +%s)_${suffix}"
            touch "$temp_file"
            echo "$temp_file"
        }
    fi
}

TEMP_COMMITS=$(create_temp_file "commits")
TEMP_COMMIT_STATS=$(create_temp_file "stats")
TEMP_DAY_STATS=$(create_temp_file "days")

# Create author pattern for enhanced matching
AUTHOR_PATTERN=$(create_author_pattern "$AUTHOR" "$GITHUB_USERNAME")

# Process each repository
for REPO_PATH in "${REPO_PATHS[@]}"; do
    echo "  🔍 Processing: $(basename "$REPO_PATH")"
    
    cd "$REPO_PATH"
    git fetch --all >/dev/null 2>&1 || true
    
    # Get commit count using multiple author patterns (case-insensitive)
    REPO_COMMIT_COUNT_NAME=$(git log --all --author="$AUTHOR" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" --oneline --no-merges 2>/dev/null | count_lines)
    REPO_COMMIT_COUNT_USERNAME=$(git log --all --author="$GITHUB_USERNAME" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" --oneline --no-merges 2>/dev/null | count_lines)
    
    # Use the higher count (some commits might be under name, others under username)
    if [ "$REPO_COMMIT_COUNT_USERNAME" -gt "$REPO_COMMIT_COUNT_NAME" ]; then
        REPO_COMMIT_COUNT=$REPO_COMMIT_COUNT_USERNAME
        PRIMARY_AUTHOR="$GITHUB_USERNAME"
    else
        REPO_COMMIT_COUNT=$REPO_COMMIT_COUNT_NAME
        PRIMARY_AUTHOR="$AUTHOR"
    fi
    TOTAL_COMMIT_COUNT=$((TOTAL_COMMIT_COUNT + REPO_COMMIT_COUNT))
    
    if [ "$REPO_COMMIT_COUNT" -gt 0 ]; then
        # Add repository header with better formatting
        echo "## 📁 Repository: $(basename "$REPO_PATH")" >> "$TEMP_COMMITS"
        echo "" >> "$TEMP_COMMITS"
        echo "**Path:** \`$REPO_PATH\`" >> "$TEMP_COMMITS"
        echo "**Commits Found:** $REPO_COMMIT_COUNT" >> "$TEMP_COMMITS"
        echo "**Primary Author Pattern:** $PRIMARY_AUTHOR" >> "$TEMP_COMMITS"
        echo "" >> "$TEMP_COMMITS"
        
        # Start code block for commits
        echo "\`\`\`" >> "$TEMP_COMMITS"
        
        # Get detailed commit information using the primary author (case-insensitive)
        git log --all --author="$PRIMARY_AUTHOR" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" \
            --pretty=format:"Commit: %h%nDate: %ai%nMessage: %s%nAuthor: %an <%ae>%n%b%n%n-------------------------------------------" --no-merges >> "$TEMP_COMMITS" 2>/dev/null
        
        # End code block
        echo "" >> "$TEMP_COMMITS"
        echo "\`\`\`" >> "$TEMP_COMMITS"
        echo "" >> "$TEMP_COMMITS"
        echo "" >> "$TEMP_COMMITS"
        
        # Collect commit statistics using primary author (case-insensitive)
        git log --all --author="$PRIMARY_AUTHOR" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" \
            --pretty=format:"%ad" --date=short --no-merges 2>/dev/null >> "$TEMP_COMMIT_STATS"
        git log --all --author="$PRIMARY_AUTHOR" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" \
            --pretty=format:"%ad" --date=format:"%A" --no-merges 2>/dev/null >> "$TEMP_DAY_STATS"
    fi
done

# Return to original directory
if [ "$OS_TYPE" = "windows" ]; then
    # Windows Git Bash sometimes has issues with cd -
    cd "$(dirname "$0")" 2>/dev/null || true
else
    cd - >/dev/null 2>&1 || true
fi

# Add executive summary with better formatting
cat >> "$REPORT_FILE" << EOF
### 🎯 Executive Summary

| Metric | Value |
|--------|-------|
| **Total Commits** | $TOTAL_COMMIT_COUNT |
| **Repositories Analyzed** | ${#REPO_PATHS[@]} |
| **Period** | $START_DATE to $END_DATE |
| **Active Days** | $([ -s "$TEMP_COMMIT_STATS" ] && sort "$TEMP_COMMIT_STATS" | uniq | wc -l | tr -d ' ' || echo "0") |

EOF

if [ "$TOTAL_COMMIT_COUNT" -gt 0 ]; then
    echo "### Detailed Commits by Repository" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    cat "$TEMP_COMMITS" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Add commit statistics with proper markdown formatting
    echo "### 📊 Commit Statistics" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Daily commit breakdown
    echo "#### Commits by Date" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    if [ -s "$TEMP_COMMIT_STATS" ]; then
        echo "| Date | Commits |" >> "$REPORT_FILE"
        echo "|------|---------|" >> "$REPORT_FILE"
        sort "$TEMP_COMMIT_STATS" | uniq -c | sort -rn | while read -r count date; do
            echo "| $date | $count |" >> "$REPORT_FILE"
        done
    else
        echo "No commit data available." >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
    
    # Weekly activity breakdown
    echo "#### Most Active Days of Week" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    if [ -s "$TEMP_DAY_STATS" ]; then
        echo "| Day | Commits |" >> "$REPORT_FILE"
        echo "|-----|---------|" >> "$REPORT_FILE"
        sort "$TEMP_DAY_STATS" | uniq -c | sort -rn | while read -r count day; do
            echo "| $day | $count |" >> "$REPORT_FILE"
        done
    else
        echo "No day activity data available." >> "$REPORT_FILE"
    fi
    echo "" >> "$REPORT_FILE"
else
    echo "### ℹ️ No Commits Found" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "> No commits were found for this period across all configured repositories." >> "$REPORT_FILE"
    echo "> This could mean:" >> "$REPORT_FILE"
    echo "> - No development activity during this period" >> "$REPORT_FILE"
    echo "> - Author name/username mismatch in git configuration" >> "$REPORT_FILE"
    echo "> - Repository paths need to be updated" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Clean up temp files
rm -f "$TEMP_COMMITS" "$TEMP_COMMIT_STATS" "$TEMP_DAY_STATS"

# Step 2: Extract PR reviews
echo "🔄 Extracting PR reviews..."

cat >> "$REPORT_FILE" << EOF

---

## 🔄 Pull Request Reviews

EOF

if command -v gh &> /dev/null; then
    echo "### PRs Reviewed by Me" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Get PRs reviewed by user with detailed formatting
    TEMP_REVIEWED=$(create_temp_file "reviewed")
    gh pr list --search "reviewed-by:$GITHUB_USERNAME created:$START_DATE..$END_DATE" \
        --limit 100 --state all --json number,title,state,repository \
        --template '{{range .}}{{.number}}{{\"\\t\"}}{{.title}}{{\"\\t\"}}{{.state}}{{\"\\t\"}}{{.repository.name}}{{\"\\n\"}}{{end}}' \
        2>/dev/null > "$TEMP_REVIEWED" || echo "" > "$TEMP_REVIEWED"
    
    if [ -s "$TEMP_REVIEWED" ]; then
        # Count reviewed PRs first
        REVIEWED_COUNT=$(cat "$TEMP_REVIEWED" | count_lines)
        echo "**Total PRs Reviewed:** $REVIEWED_COUNT" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        # Create markdown table for better formatting
        echo "| PR # | Title | Status | Repository |" >> "$REPORT_FILE"
        echo "|------|-------|--------|------------|" >> "$REPORT_FILE"
        
        # Format PR data as a markdown table
        while IFS=$'\t' read -r number title state repo; do
            # Clean up the data and format it properly
            clean_title=$(echo "$title" | sed 's/|/ /g')  # Remove pipes that would break table
            clean_repo=$(echo "$repo" | sed 's/.*\///') # Extract just repo name from full path
            echo "| #$number | $clean_title | $state | $clean_repo |" >> "$REPORT_FILE"
        done < "$TEMP_REVIEWED"
        echo "" >> "$REPORT_FILE"
    else
        echo "> No PRs reviewed during this period." >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
    
    echo "### PRs Authored by Me" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # Get PRs authored by user with detailed formatting
    TEMP_AUTHORED=$(create_temp_file "authored")
    gh pr list --search "author:$GITHUB_USERNAME created:$START_DATE..$END_DATE" \
        --limit 100 --state all --json number,title,state,repository \
        --template '{{range .}}{{.number}}{{\"\\t\"}}{{.title}}{{\"\\t\"}}{{.state}}{{\"\\t\"}}{{.repository.name}}{{\"\\n\"}}{{end}}' \
        2>/dev/null > "$TEMP_AUTHORED" || echo "" > "$TEMP_AUTHORED"
    
    if [ -s "$TEMP_AUTHORED" ]; then
        # Count authored PRs first
        AUTHORED_COUNT=$(cat "$TEMP_AUTHORED" | count_lines)
        echo "**Total PRs Authored:** $AUTHORED_COUNT" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        
        # Create markdown table for better formatting
        echo "| PR # | Title | Status | Repository |" >> "$REPORT_FILE"
        echo "|------|-------|--------|------------|" >> "$REPORT_FILE"
        
        # Format PR data as a markdown table
        while IFS=$'\t' read -r number title state repo; do
            # Clean up the data and format it properly
            clean_title=$(echo "$title" | sed 's/|/ /g')  # Remove pipes that would break table
            clean_repo=$(echo "$repo" | sed 's/.*\///') # Extract just repo name from full path
            echo "| #$number | $clean_title | $state | $clean_repo |" >> "$REPORT_FILE"
        done < "$TEMP_AUTHORED"
        echo "" >> "$REPORT_FILE"
    else
        echo "> No PRs authored during this period." >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
    
    # Clean up temp files
    rm -f "$TEMP_REVIEWED" "$TEMP_AUTHORED"
    
else
    echo "### ⚠️ GitHub CLI Not Available" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "> GitHub CLI (\`gh\`) is not installed. PR review data cannot be extracted." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "#### Installation Instructions" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    case "$OS_TYPE" in
        "windows")
            echo "- **Windows:** \`winget install GitHub.cli\` or \`choco install gh\`" >> "$REPORT_FILE"
            ;;
        "linux")
            echo "- **Linux:** \`sudo apt install gh\` or \`sudo snap install gh\`" >> "$REPORT_FILE"
            ;;
        "macos")
            echo "- **macOS:** \`brew install gh\`" >> "$REPORT_FILE"
            ;;
        *)
            echo "- Visit [GitHub CLI](https://cli.github.com/) for installation instructions" >> "$REPORT_FILE"
            ;;
    esac
    echo "- **All platforms:** Visit [https://cli.github.com/](https://cli.github.com/)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

# Add comprehensive footer section
cat >> "$REPORT_FILE" << EOF

---

## 📈 Final Summary & Metrics

### 🎯 Key Performance Indicators

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Commits** | $TOTAL_COMMIT_COUNT | Across all repositories |
| **Repositories Analyzed** | ${#REPO_PATHS[@]} | Active repositories |
| **Reporting Period** | \`$START_DATE\` to \`$END_DATE\` | $(echo "$MONTH_NAME $YEAR") |
| **Report Generated** | $(date +"%Y-%m-%d %H:%M:%S") | Automated extraction |

### 📁 Repository Breakdown

| Repository | Commits | Path |
|------------|---------|------|
EOF

# Add repository summary with better formatting
for REPO_PATH in "${REPO_PATHS[@]}"; do
    cd "$REPO_PATH"
    # Check both name and username patterns for accurate count
    REPO_COUNT_NAME=$(git log --all --author="$AUTHOR" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" --oneline --no-merges 2>/dev/null | count_lines)
    REPO_COUNT_USERNAME=$(git log --all --author="$GITHUB_USERNAME" --regexp-ignore-case --since="$START_DATE" --until="$END_DATE" --oneline --no-merges 2>/dev/null | count_lines)
    REPO_COMMIT_COUNT=$([ "$REPO_COUNT_USERNAME" -gt "$REPO_COUNT_NAME" ] && echo "$REPO_COUNT_USERNAME" || echo "$REPO_COUNT_NAME")
    echo "| **$(basename "$REPO_PATH")** | $REPO_COMMIT_COUNT | \`$REPO_PATH\` |" >> "$REPORT_FILE"
done
cd - >/dev/null 2>&1 || true

cat >> "$REPORT_FILE" << 'EOF'

---

### 🔧 Technical Notes

- **Data Source:** Git commit history and GitHub CLI
- **Author Matching:** Case-insensitive pattern matching for both name and username
- **Date Range:** Inclusive of start and end dates
- **Merge Commits:** Excluded from analysis
- **Branches:** All branches analyzed (`--all` flag)

### 📋 Report Information

> This report was automatically generated using:
> - **Git** for commit extraction and analysis
> - **GitHub CLI** for pull request data
> - **Cross-platform compatibility** for Windows, macOS, and Linux

*Generated by [Commit Chronicle](https://github.com/your-username/commit-chronicle) - Monthly Development Report Generator*
EOF

echo "✅ Report generated: $REPORT_FILE"
echo ""
echo "📄 View your report:"
echo "   cat $REPORT_FILE"