import fs from 'node:fs'
import path from 'node:path'

const projectRoot=path.resolve(import.meta.dirname,'..')
const sourceRoot=path.join(projectRoot,'src')
const supportedExtensions=['.ts','.tsx','.js','.jsx','.css']

const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const target=path.join(directory,entry.name)
  return entry.isDirectory()?walk(target):supportedExtensions.includes(path.extname(entry.name))?[target]:[]
})

const files=walk(sourceRoot).map(file=>path.normalize(file))
const fileSet=new Set(files.map(file=>file.toLowerCase()))
const resolveImport=(fromFile,specifier)=>{
  if(!specifier.startsWith('.'))return null
  const base=path.resolve(path.dirname(fromFile),specifier)
  const candidates=[base,...supportedExtensions.map(extension=>`${base}${extension}`),...supportedExtensions.map(extension=>path.join(base,`index${extension}`))]
  return candidates.find(candidate=>fileSet.has(path.normalize(candidate).toLowerCase()))||null
}

const importPatterns=[
  /\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']/g,
]
const graph=new Map(files.map(file=>[file,[]]))
for(const file of files){
  if(path.extname(file)==='.css')continue
  const source=fs.readFileSync(file,'utf8')
  for(const pattern of importPatterns){
    for(const match of source.matchAll(pattern)){
      const dependency=resolveImport(file,match[1])
      if(dependency)graph.get(file).push(path.normalize(dependency))
    }
  }
}

const entry=path.join(sourceRoot,'main.tsx')
const reachable=new Set()
const visit=file=>{
  const key=path.normalize(file)
  if(reachable.has(key))return
  reachable.add(key)
  for(const dependency of graph.get(key)||[])visit(dependency)
}
visit(entry)

const relative=file=>path.relative(projectRoot,file).replaceAll('\\','/')
const unreachable=files.filter(file=>!reachable.has(file)).map(relative).sort()
console.log(JSON.stringify({entry:relative(entry),totalFiles:files.length,reachableFiles:reachable.size,unreachableFiles:unreachable.length,unreachable},null,2))
