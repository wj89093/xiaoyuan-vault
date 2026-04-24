export interface FileInfo {
  path: string
  name: string
  isDirectory: boolean
  modified: number
  children?: FileInfo[]
}
