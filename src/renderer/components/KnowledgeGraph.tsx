import { useState, useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { FileText, Folder } from 'lucide-react'
import type { FileInfo } from '../types'

interface KnowledgeGraphProps {
  files: FileInfo[]
  selectedFile: string | null
  onSelect: (path: string) => void
  onClose: () => void
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  path: string
  isDirectory: boolean
  tags: string[]
  folder: string
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  type: 'link' | 'folder'
}

const COLORS = {
  node: '#515154',
  nodeActive: '#007aff',
  link: '#dcdcde',
  linkFolder: '#a1a1a6',
  text: '#6e6e73',
  bg: '#ffffff'
}

export function KnowledgeGraph({ files, selectedFile, onSelect, onClose }: KnowledgeGraphProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)

  const flatFiles = useMemo(() => {
    const result: FileInfo[] = []
    const flatten = (items: FileInfo[]) => {
      for (const item of items) {
        if (!item.isDirectory) result.push(item)
        if (item.children) flatten(item.children)
      }
    }
    flatten(files)
    return result
  }, [files])

  // Load file contents and build graph data
  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      if (flatFiles.length === 0) {
        if (!cancelled) { setGraphData({ nodes: [], links: [] }); setLoading(false) }
        return
      }

      const nodes: GraphNode[] = []
      const links: GraphLink[] = []
      const nodeMap = new Map<string, GraphNode>()
      const titleToPath = new Map<string, string>()

      // Build nodes
      for (const file of flatFiles) {
        const parts = file.path.split('/')
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
        const node: GraphNode = {
          id: file.path,
          name: file.name,
          path: file.path,
          isDirectory: file.isDirectory,
          tags: file.tags ? file.tags.split(',').map((t: string) => t.trim()) : [],
          folder
        }
        nodes.push(node)
        nodeMap.set(file.path, node)
        // Also index by name (for wiki link resolution)
        titleToPath.set(file.name.replace(/\.md$/, ''), file.path)
      }

      // Async: read file contents to extract Wiki links + tags
      const wikiLinksFound: Array<{ source: string; target: string }> = []
      for (const file of flatFiles) {
        if (cancelled) return
        try {
          const content = await window.api.readFile(file.path)
          
          // Extract Wiki links [[...]]
          const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || []
          for (const link of wikiLinks) {
            const targetName = link.slice(2, -2).trim()
            // Resolve target: try exact path, then name match
            let targetPath = nodeMap.get(targetName)?.id
              || nodeMap.get(targetName + '.md')?.id
              || titleToPath.get(targetName)
            if (targetPath && targetPath !== file.path) {
              wikiLinksFound.push({ source: file.path, target: targetPath })
            }
          }

          // Extract tags from frontmatter
          const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const tagsMatch = fmMatch[1].match(/^tags:\s*\[(.+)\]/m)
            if (tagsMatch) {
              const fmTags = tagsMatch[1].split(',').map((t: string) => t.trim().replace(/['"]/g, ''))
              const node = nodeMap.get(file.path)
              if (node && fmTags.length > node.tags.length) {
                node.tags = fmTags
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Build Wiki link edges
      for (const { source, target } of wikiLinksFound) {
        links.push({ source, target, type: 'link' })
      }

      // Build folder co-occurrence links
      const folderGroups = new Map<string, GraphNode[]>()
      for (const node of nodes) {
        if (!node.folder) continue
        if (!folderGroups.has(node.folder)) folderGroups.set(node.folder, [])
        folderGroups.get(node.folder)!.push(node)
      }
      for (const group of folderGroups.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            links.push({ source: group[i].id, target: group[j].id, type: 'folder' })
          }
        }
      }

      if (!cancelled) {
        setGraphData({ nodes, links })
        setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [flatFiles])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return
    if (graphData.nodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    // Create groups for layering
    const g = svg.append('g')

    // Zoom & pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    // Links
    const linkGroup = g.append('g').attr('class', 'links')
    const linkElements = linkGroup
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', d => d.type === 'link' ? COLORS.link : COLORS.linkFolder)
      .attr('stroke-width', d => d.type === 'link' ? 1.5 : 0.8)
      .attr('stroke-opacity', d => d.type === 'link' ? 0.8 : 0.4)

    // Nodes
    const nodeGroup = g.append('g').attr('class', 'nodes')
    const nodeElements = nodeGroup
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => onSelect(d.path))
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x; d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    // Node circles
    nodeElements
      .append('circle')
      .attr('r', d => d.tags.length > 0 ? 8 : 6)
      .attr('fill', d => selectedFile === d.path ? COLORS.nodeActive : COLORS.node)
      .attr('fill-opacity', 0.85)

    // Node labels
    nodeElements
      .append('text')
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('font-size', '11px')
      .attr('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
      .attr('fill', COLORS.text)
      .text(d => d.name.replace(/\.md$/, ''))

    // Labels on hover
    nodeElements.append('title').text(d => d.path)

    // Force simulation — cluster by folder
    const folderIndex = new Map<string, number>()
    let clusterId = 0
    for (const node of graphData.nodes) {
      if (!folderIndex.has(node.folder)) folderIndex.set(node.folder, clusterId++)
    }

    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links).id(d => d.id).distance(80).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('cluster', forceCluster(folderIndex))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20))

    simulation.on('tick', () => {
      linkElements
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)

      nodeElements.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Center view on start
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1))

    return () => simulation.stop()
  }, [graphData, selectedFile, onSelect])

  return (
    <div ref={containerRef} className="knowledge-graph">
      <div className="kg-header">
        <span className="kg-title">知识图谱</span>
        <span className="kg-stats">{graphData.nodes.length} 个节点 · {graphData.links.length} 条连线</span>
        <button className="btn btn-icon" onClick={onClose} title="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {loading ? (
        <div className="kg-empty">
          <FileText size={32} style={{ color: 'var(--color-text-tertiary)' }} />
          <span>正在分析文件关系...</span>
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div className="kg-empty">
          <FileText size={32} style={{ color: 'var(--color-text-tertiary)' }} />
          <span>没有可显示的文件</span>
        </div>
      ) : (
        <svg ref={svgRef} className="kg-svg" />
      )}
      <div className="kg-legend">
        <span className="kg-legend-item"><span className="kg-legend-dot" style={{ background: COLORS.link }} />引用链接</span>
        <span className="kg-legend-item"><span className="kg-legend-dot" style={{ background: COLORS.linkFolder }} />同文件夹</span>
        <span className="kg-legend-hint">🖱 滚轮缩放 · 拖拽移动</span>
      </div>
    </div>
  )
}

// Custom force to cluster nodes by folder
function forceCluster(folderIndex: Map<string, number>) {
  const clusters = new Map<string, { cx: number; cy: number }>()
  const CLUSTER_RADIUS = 200
  let radius = CLUSTER_RADIUS

  for (const [, idx] of folderIndex) {
    const angle = (2 * Math.PI * idx) / folderIndex.size
    const cx = Math.cos(angle) * radius
    const cy = Math.sin(angle) * radius
    clusters.set(idx.toString(), { cx, cy })
  }

  return function force(alpha: number) {
    for (const node of arguments.length && typeof arguments[0]?.nodes === 'function' ? arguments[0].nodes() : []) {
      const cluster = clusters.get(folderIndex.get((node as GraphNode).folder)?.toString() ?? '0')
      if (!cluster) continue
      const k = alpha * 0.1
      ;(node as GraphNode).vx = ((node as GraphNode).vx ?? 0) + (cluster.cx - ((node as GraphNode).x ?? 0)) * k
      ;(node as GraphNode).vy = ((node as GraphNode).vy ?? 0) + (cluster.cy - ((node as GraphNode).y ?? 0)) * k
    }
  }
}
