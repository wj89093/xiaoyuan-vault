/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Search, FolderOpen, FolderPlus, Moon, Sun, Trash2 } from 'lucide-react'
import { FileTree } from './FileTree'
import { SearchResults } from './SearchResults'
import { Toolbar } from './Toolbar'
import type { FileInfo } from '../types'

interface SidebarProps {
  vaultPath: string | null
  files: FileInfo[]
  displayFiles: FileInfo[]
  selectedFile: string | null
  showSearchResults: boolean
  searchQuery: string
  searchResults: FileInfo[]
  showVaultMenu: boolean
  onToggleVaultMenu: () => void
  onNewVault: () => Promise<void>
  onOpenVault: () => Promise<void>
  onCloseVault: () => void
  onSearch: (query: string) => void
  onCloseSearch: () => void
  onSelectFile: (path: string) => void
  onNewFile: (folderPath: string, fileName: string) => Promise<void>
  onNewFolder: (parentPath: string, folderName: string) => Promise<void>
  onRefresh: () => Promise<void>
  onOpenGraph: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  onToggleTrash: () => void
}

export function Sidebar({
  vaultPath, files, displayFiles, selectedFile,
  showSearchResults, searchQuery, searchResults, showVaultMenu,
  onToggleVaultMenu, onNewVault, onOpenVault, onCloseVault,
  onSearch, onCloseSearch, onSelectFile,
  onNewFile, onNewFolder, onRefresh, onOpenGraph,
  darkMode, onToggleDarkMode, onToggleTrash,
}: SidebarProps): JSX.Element {
  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <FolderOpen size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        <span
          className="sidebar-title sidebar-title-btn"
          onClick={onToggleVaultMenu}
          title="点击切换知识库"
        >
          {vaultPath?.split('/').pop()}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, opacity: 0.5 }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
        <button
          onClick={onToggleDarkMode}
          style={{ marginLeft: 'auto', cursor: 'pointer', padding: '4px', borderRadius: '4px', background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
          title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Vault Menu */}
      {showVaultMenu && (
        <div className="vault-menu">
          <div className="vault-menu-header">知识库操作</div>
          <div className="vault-menu-item" onClick={() => { onToggleVaultMenu(); void onNewVault() }}>
            <FolderPlus size={13} />
            新建知识库
          </div>
          <div className="vault-menu-item" onClick={() => { onToggleVaultMenu(); void onOpenVault() }}>
            <FolderOpen size={13} />
            打开其他知识库
          </div>
          <div className="vault-menu-item" onClick={() => { onToggleVaultMenu(); onToggleTrash() }}>
            <Trash2 size={13} />
            查看回收站
          </div>
          <div className="vault-menu-item danger" onClick={() => { onToggleVaultMenu(); onCloseVault() }}>
            <span>✕</span>
            关闭当前知识库
          </div>
        </div>
      )}

      {/* Search */}
      <div className="search-container">
        <div className="search-wrapper">
          <Search className="search-icon" size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={e => { void onSearch(e.target.value) }}
          />
        </div>
      </div>

      {/* File List */}
      {showSearchResults ? (
        <SearchResults
          results={searchResults}
          query={searchQuery}
          onSelect={onSelectFile}
          onClose={onCloseSearch}
        />
      ) : (
        <>
          <Toolbar
            onNewFile={onNewFile}
            onNewFolder={onNewFolder}
            onOpenGraph={onOpenGraph}
            onOpenSettings={() => {}}
            onRefresh={onRefresh}
            vaultPath={vaultPath}
            files={files}
          />
          <div className="file-tree">
            <FileTree
              files={displayFiles}
              selectedFile={selectedFile}
              onSelect={onSelectFile}
              onNewFile={(folderPath) => {
                const base = (folderPath === vaultPath || !folderPath) ? '' : folderPath
                void onNewFile(base, 'Untitled').catch?.(() => {})
              }}
              onNewFolder={(parentPath) => {
                const base = (parentPath === vaultPath || !parentPath) ? '' : parentPath
                void onNewFolder(base, 'Untitled').catch?.(() => {})
              }}
              vaultPath={vaultPath}
            />
          </div>
        </>
      )}
    </div>
  )
}
