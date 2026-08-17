import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const root=new URL('../../src/',import.meta.url)
const read=(path)=>readFileSync(new URL(path,root),'utf8')

test('Professor Felix launcher replaces the PNG avatar and remains accessible',()=>{
  const launcher=read('components/felix/FelixLauncher.tsx')
  const bridge=read('FelixAssistant.tsx')
  assert.match(launcher,/aria-label="Ask Felix"/)
  assert.match(launcher,/FelixCharacter/)
  assert.doesNotMatch(bridge,/felix-avatar\.png/)
})

test('visual states and operation mappings cover the required lifecycle',()=>{
  const states=read('components/felix/animations/felixStates.ts')
  const controller=read('components/felix/animations/FelixAnimationController.ts')
  for(const name of ['idle','thinking','searching','reading','auditing','found_issue','suggesting','success','insufficient_evidence','presenting','error'])assert.match(states,new RegExp(`'${name}'`))
  assert.match(controller,/beginOperation/)
  assert.match(controller,/completeOperation/)
  assert.match(controller,/failOperation/)
})

test('chat request lifecycle drives success, evidence, issue and error states without another request',()=>{
  const chat=read('AIResearchChat.tsx')
  assert.match(chat,/inferFelixOperation/)
  assert.match(chat,/completeFelixOperation\('insufficient_evidence'\)/)
  assert.match(chat,/completeFelixOperation\('found_issue'\)/)
  assert.match(chat,/failFelixOperation\(\)/)
  assert.equal((chat.match(/await onAsk\(/g)||[]).length,1)
})

test('motion is restrained, responsive and reduced-motion safe',()=>{
  const css=read('felix.css')
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/)
  assert.match(css,/@media\(max-width:760px\)/)
  assert.match(css,/z-index:55/)
  assert.doesNotMatch(css,/bounce|confetti|dance/)
})

test('final character replacement location and adapter fallbacks are documented',()=>{
  const readme=read('components/felix/assets/professor-felix/README.md')
  const controller=read('components/felix/animations/FelixAnimationController.ts')
  assert.match(readme,/professor-felix\.riv/)
  assert.match(controller,/'rive'\|'lottie'\|'svg'\|'static'/)
})
