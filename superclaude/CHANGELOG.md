# Changelog

All notable changes to SuperClaude will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.2.0] - 2025-09-18
### Added
- **Deep Research System** - Complete implementation of autonomous web research capabilities
  - New `/sc:research` command for intelligent web research with DR Agent architecture
  - `deep-research-agent` - 15th specialized agent for research orchestration
  - `MODE_DeepResearch` - 7th behavioral mode for research workflows
  - Tavily MCP integration (7th MCP server) for real-time web search
  - Research configuration system (`RESEARCH_CONFIG.md`)
  - Comprehensive workflow examples (`deep_research_workflows.md`)
  - Three planning strategies: Planning-Only, Intent-to-Planning, Unified Intent-Planning
  - Multi-hop reasoning with genealogy tracking for complex queries
  - Case-based reasoning for learning from past research patterns

### Changed
- Updated agent count from 14 to 15 (added deep-research-agent)
- Updated mode count from 6 to 7 (added MODE_DeepResearch)
- Updated MCP server count from 6 to 7 (added Tavily)
- Updated command count from 24 to 25 (added /sc:research)
- Enhanced MCP component with remote server support for Tavily
- Added `_install_remote_mcp_server` method to handle remote MCP configurations

### Technical
- Added Tavily to `server_docs_map` in `setup/components/mcp_docs.py`
- Implemented remote MCP server handler in `setup/components/mcp.py`
- Added `check_research_prerequisites()` function in `setup/utils/environment.py`
- Created verification script `scripts/verify_research_integration.sh`

### Requirements
- `TAVILY_API_KEY` environment variable for web search functionality
- Node.js and npm for Tavily MCP execution

## [4.1.4] - 2025-09-20
### Added
- Comprehensive flag documentation integrated into `/sc:help` command
- All 25 SuperClaude framework flags now discoverable from help system
- Practical usage examples and flag priority rules

### Fixed
- MCP incremental installation and auto-detection system
- Auto-detection of existing MCP servers from .claude.json and claude_desktop_config.json
- Smart server merging (existing + selected + previously installed)
- Documentation cleanup: removed non-existent commands (sc:fix, sc:simple-pix, sc:update, sc:develop, sc:modernize, sc:simple-fix)
- CLI logic to allow mcp_docs installation without server selection
### Changed
- MCP component now supports true incremental installation
- mcp_docs component auto-detects and installs documentation for all detected servers
- Improved error handling and graceful fallback for corrupted config files
- Enhanced user experience with single-source reference for all SuperClaude capabilities

## [4.1.0] - 2025-09-13
### Added
- Display author names and emails in the installer UI header.
- `is_reinstallable` flag for components to allow re-running installation.

### Fixed
- Installer now correctly installs only selected MCP servers on subsequent runs.
- Corrected validation logic for `mcp` and `mcp_docs` components to prevent incorrect failures.
- Ensured empty backup archives are created as valid tar files.
- Addressed an issue where only selected MCPs were being installed.
- Added Mithun Gowda B as an author.
- **MCP Installer:** Addressed several critical bugs in the MCP installation and update process to improve reliability.
  - Corrected the npm package name for the `morphllm` server in `setup/components/mcp.py`.
  - Implemented a custom installation method for the `serena` server using `uv`, as it is not an npm package.
  - Resolved a `NameError` in the `update` command within `setup/cli/commands/install.py`.
  - Patched a recurring "Unknown component: core" error by ensuring the component registry is initialized only once.
  - Added the `claude` CLI as a formal prerequisite for MCP server management, which was previously undocumented.

### Changed

### Technical
- Prepared package for PyPI distribution
- Validated package structure and dependencies

## [4.0.7] - 2025-01-23

### Added
- Automatic update checking for PyPI and NPM packages
- `--no-update-check` flag to skip update checks
- `--auto-update` flag for automatic updates without prompting
- Environment variable `SUPERCLAUDE_AUTO_UPDATE` support
- Update notifications with colored banners showing available version
- Rate limiting to check updates once per 24 hours
- Smart installation method detection (pip/pipx/npm/yarn)
- Cache files for update check timestamps (~/.claude/.update_check and .npm_update_check)

### Fixed
- Component validation now correctly uses pipx-installed version instead of source code

### Technical
- Added `setup/utils/updater.py` for PyPI update checking logic
- Added `bin/checkUpdate.js` for NPM update checking logic
- Integrated update checks into main entry points (SuperClaude/__main__.py and bin/cli.js)
- Non-blocking update checks with 2-second timeout to avoid delays

### Changed
- **BREAKING**: Agent system restructured to 14 specialized agents
- **BREAKING**: Commands now use `/sc:` namespace to avoid conflicts with user custom commands
- Commands are now installed in `~/.claude/commands/sc/` subdirectory
- All 21 commands updated: `/analyze` → `/sc:analyze`, `/build` → `/sc:build`, etc.
- Automatic migration from old command locations to new `sc/` subdirectory
- **BREAKING**: Documentation reorganization - Docs/ directory renamed to Guides/

### Added
- **NEW AGENTS**: 14 specialized domain agents with enhanced capabilities
  - backend-architect.md, devops-architect.md, frontend-architect.md
  - learning-guide.md, performance-engineer.md, python-expert.md
  - quality-engineer.md, refactoring-expert.md, requirements-analyst.md
  - root-cause-analyst.md, security-engineer.md, socratic-mentor.md
- **NEW MODE**: MODE_Orchestration.md for intelligent tool selection mindset (5 total behavioral modes)
- **NEW COMMAND**: `/sc:implement` for feature and code implementation (addresses v2 user feedback)
- **NEW FILE**: CLAUDE.md for project-specific Claude Code instructions
- Migration logic to move existing commands to new namespace automatically
- Enhanced uninstaller to handle both old and new command locations
- Improved command conflict prevention
- Better command organization and discoverability
- Comprehensive PyPI publishing infrastructure
- API key management during SuperClaude MCP setup

### Removed
- **BREAKING**: Removed Templates/ directory (legacy templates no longer needed)
- **BREAKING**: Removed legacy agents and replaced with enhanced 14-agent system

### Improved
- Refactored Modes and MCP documentation for concise behavioral guidance
- Enhanced project cleanup and gitignore for PyPI publishing
- Implemented uninstall and update safety enhancements
- Better agent specialization and domain expertise focus

### Technical Details
- Commands now accessible as `/sc:analyze`, `/sc:build`, `/sc:improve`, etc.
- Migration preserves existing functionality while preventing naming conflicts
- Installation process detects and migrates existing commands automatically
- Tab completion support for `/sc:` prefix to discover all SuperClaude commands
- Guides/ directory replaces Docs/ for improved organization

## [4.0.6] - 2025-08-23

### Fixed
- Component validation now correctly checks .superclaude-metadata.json instead of settings.json (#291)
- Standardized version numbers across all components to 4.0.6
- Fixed agent validation to check for correct filenames (architect vs specialist/engineer)
- Fixed package.json version inconsistency (was 4.0.5)

### Changed  
- Bumped version from 4.0.4 to 4.0.6 across entire project
- All component versions now synchronized at 4.0.6
- Cleaned up metadata file structure for consistency

## [4.0.4] - 2025-08-22

### Added
- **Agent System**: 13 specialized domain experts replacing personas
- **Behavioral Modes**: 4 intelligent modes for different workflows (Brainstorming, Introspection, Task Management, Token Efficiency)
- **Session Lifecycle**: /sc:load and /sc:save for cross-session persistence with Serena MCP
- **New Commands**: /sc:brainstorm, /sc:reflect, /sc:save, /sc:select-tool (21 total commands)
- **Serena MCP**: Semantic code analysis and memory management
- **Morphllm MCP**: Intelligent file editing with Fast Apply capability
- **Core Components**: Python-based framework integration (completely redesigned and implemented)
- **Templates**: Comprehensive templates for creating new components
- **Python-Ultimate-Expert Agent**: Master Python architect for production-ready code

### Changed
- Commands expanded from 16 to 21 specialized commands
- Personas replaced with 13 specialized Agents
- Enhanced MCP integration (6 servers total)
- Improved token efficiency (30-50% reduction with Token Efficiency Mode)
- Session management now uses Serena integration for persistence
- Framework structure reorganized for better modularity

### Improved
- Task management with multi-layer orchestration (TodoWrite, /task, /spawn, /loop)
- Quality gates with 8-step validation cycle
- Performance monitoring and optimization
- Cross-session context preservation
- Intelligent routing with ORCHESTRATOR.md enhancements

## [3.0.0] - 2025-07-14

### Added
- Initial release of SuperClaude v3.0
- 15 specialized slash commands for development tasks
- Smart persona auto-activation system
- MCP server integration (Context7, Sequential, Magic, Playwright)
- Unified CLI installer with multiple installation profiles
- Comprehensive documentation and user guides
- Token optimization framework
- Task management system

### Features
- **Commands**: analyze, build, cleanup, design, document, estimate, explain, git, improve, index, load, spawn, task, test, troubleshoot
- **Personas**: architect, frontend, backend, analyzer, security, mentor, refactorer, performance, qa, devops, scribe
- **MCP Servers**: Official library documentation, complex analysis, UI components, browser automation
- **Installation**: Quick, minimal, and developer profiles with component selection
