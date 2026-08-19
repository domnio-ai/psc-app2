import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props={children:ReactNode}
type State={failed:boolean}

export default class AppErrorBoundary extends Component<Props,State>{
  state:State={failed:false}
  static getDerivedStateFromError():State{return{failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('App2 rendering error',error,info)}
  render(){
    if(this.state.failed)return <main className="app-recovery" role="alert"><section><h1>App2 could not display this section</h1><p>Your session and records are safe. Reload the page to restore the workspace.</p><button onClick={()=>window.location.reload()}>Reload App2</button></section></main>
    return this.props.children
  }
}
