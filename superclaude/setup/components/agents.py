"""
Agents component for SuperClaude specialized AI agents installation
"""

from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path

from ..core.base import Component
from setup import __version__


class AgentsComponent(Component):
    """SuperClaude specialized AI agents component"""
    
    def __init__(self, install_dir: Optional[Path] = None):
        """Initialize agents component"""
        super().__init__(install_dir, Path("agents"))
    
    def get_metadata(self) -> Dict[str, str]:
        """Get component metadata"""
        return {
            "name": "agents",
            "version": __version__,
            "description": "15 specialized AI agents with domain expertise and intelligent routing",
            "category": "agents"
        }
    
    def get_metadata_modifications(self) -> Dict[str, Any]:
        """Get metadata modifications for agents"""
        return {
            "components": {
                "agents": {
                    "version": __version__,
                    "installed": True,
                    "agents_count": len(self.component_files),
                    "install_directory": str(self.install_component_subdir)
                }
            }
        }
    
    def _install(self, config: Dict[str, Any]) -> bool:
        """Install agents component"""
        self.logger.info("Installing SuperClaude specialized agents...")
        
        # Call parent install method
        success = super()._install(config)
        
        if success:
            # Run post-install setup
            success = self._post_install()
        
        if success:
            self.logger.success(f"Successfully installed {len(self.component_files)} specialized agents")
        
        return success
    
    def _post_install(self) -> bool:
        """Post-install setup for agents"""
        try:
            # Update metadata with agents registration
            metadata_mods = self.get_metadata_modifications()
            self.settings_manager.update_metadata(metadata_mods)
            self.logger.info("Updated metadata with agents configuration")
            
            # Add component registration
            self.settings_manager.add_component_registration("agents", {
                "version": __version__,
                "category": "agents",
                "agents_count": len(self.component_files),
                "agents_list": self.component_files
            })
            
            self.logger.info("Registered agents component in metadata")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to complete agents post-install: {e}")
            return False
    
    def uninstall(self) -> bool:
        """Uninstall agents component"""
        try:
            self.logger.info("Uninstalling SuperClaude agents component...")
            
            # Remove agent files
            removed_count = 0
            for filename in self.component_files:
                file_path = self.install_component_subdir / filename
                if self.file_manager.remove_file(file_path):
                    removed_count += 1
                    self.logger.debug(f"Removed agent: {filename}")
                else:
                    self.logger.warning(f"Could not remove agent: {filename}")
            
            # Remove agents directory if empty
            try:
                if self.install_component_subdir.exists() and not any(self.install_component_subdir.iterdir()):
                    self.install_component_subdir.rmdir()
                    self.logger.debug("Removed empty agents directory")
            except Exception as e:
                self.logger.warning(f"Could not remove agents directory: {e}")
            
            # Update metadata to remove agents component
            try:
                if self.settings_manager.is_component_installed("agents"):
                    self.settings_manager.remove_component_registration("agents")
                    self.logger.info("Removed agents component from metadata")
            except Exception as e:
                self.logger.warning(f"Could not update metadata: {e}")
            
            self.logger.success(f"Agents component uninstalled ({removed_count} agents removed)")
            return True
            
        except Exception as e:
            self.logger.exception(f"Unexpected error during agents uninstallation: {e}")
            return False
    
    def get_dependencies(self) -> List[str]:
        """Get component dependencies"""
        return ["core"]
    
    def update(self, config: Dict[str, Any]) -> bool:
        """Update agents component"""
        try:
            self.logger.info("Updating SuperClaude agents component...")
            
            # Check current version
            current_version = self.settings_manager.get_component_version("agents")
            target_version = self.get_metadata()["version"]
            
            if current_version == target_version:
                self.logger.info(f"Agents component already at version {target_version}")
                return True
            
            self.logger.info(f"Updating agents component from {current_version} to {target_version}")
            
            # Create backup of existing agents
            backup_files = []
            for filename in self.component_files:
                file_path = self.install_component_subdir / filename
                if file_path.exists():
                    backup_path = self.file_manager.backup_file(file_path)
                    if backup_path:
                        backup_files.append(backup_path)
                        self.logger.debug(f"Backed up agent: {filename}")
            
            # Perform installation (will overwrite existing files)
            if self._install(config):
                self.logger.success(f"Agents component updated to version {target_version}")
                return True
            else:
                # Restore backups on failure
                self.logger.error("Agents update failed, restoring backups...")
                for backup_path in backup_files:
                    try:
                        original_path = self.install_component_subdir / backup_path.name.replace('.backup', '')
                        self.file_manager.copy_file(backup_path, original_path)
                        self.logger.debug(f"Restored {original_path.name}")
                    except Exception as e:
                        self.logger.warning(f"Could not restore {backup_path}: {e}")
                return False
                
        except Exception as e:
            self.logger.exception(f"Unexpected error during agents update: {e}")
            return False
    
    def _get_source_dir(self) -> Path:
        """Get source directory for agent files"""
        # Assume we're in SuperClaude/setup/components/agents.py
        # and agent files are in SuperClaude/SuperClaude/Agents/
        project_root = Path(__file__).parent.parent.parent
        return project_root / "SuperClaude" / "Agents"
    
    def get_size_estimate(self) -> int:
        """Get estimated installation size"""
        total_size = 0
        source_dir = self._get_source_dir()
        
        for filename in self.component_files:
            file_path = source_dir / filename
            if file_path.exists():
                total_size += file_path.stat().st_size
        
        # Add overhead for directories and metadata
        total_size += 5120  # ~5KB overhead
        
        return total_size
    
    def get_installation_summary(self) -> Dict[str, Any]:
        """Get installation summary"""
        return {
            "component": self.get_metadata()["name"],
            "version": self.get_metadata()["version"],
            "agents_installed": len(self.component_files),
            "agent_files": self.component_files,
            "estimated_size": self.get_size_estimate(),
            "install_directory": str(self.install_component_subdir),
            "dependencies": self.get_dependencies()
        }
    
    def validate_installation(self) -> Tuple[bool, List[str]]:
        """Validate that agents component is correctly installed"""
        errors = []
        
        # Check if agents directory exists
        if not self.install_component_subdir.exists():
            errors.append(f"Agents directory not found: {self.install_component_subdir}")
            return False, errors
        
        # Check if all agent files exist
        missing_agents = []
        for filename in self.component_files:
            agent_path = self.install_component_subdir / filename
            if not agent_path.exists():
                missing_agents.append(filename)
        
        if missing_agents:
            errors.append(f"Missing agent files: {missing_agents}")
        
        # Check version in metadata
        if not self.get_installed_version():
            errors.append("Agents component not registered in metadata")
        
        # Check if at least some standard agents are present
        expected_agents = [
            "system-architect.md",
            "frontend-architect.md", 
            "backend-architect.md",
            "security-engineer.md"
        ]
        
        missing_core_agents = []
        for agent in expected_agents:
            if agent not in self.component_files:
                missing_core_agents.append(agent)
        
        if missing_core_agents:
            errors.append(f"Missing core agent files: {missing_core_agents}")
        
        return len(errors) == 0, errors