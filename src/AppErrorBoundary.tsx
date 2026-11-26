import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props={children:ReactNode}
type State={failed:boolean;errorMessage:string;componentStack:string}

export default class AppErrorBoundary extends Component<Props,State>{
  state:State={failed:false,errorMessage:'',componentStack:''}
  static getDerivedStateFromError(error:Error):Partial<State>{return{failed:true,errorMessage:`${error.name}: ${error.message}`.slice(0,1200)}}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('APP2 rendering error',error,info);this.setState({componentStack:info.componentStack||''})}
  render(){
    if(this.state.failed)return <main className="app-recovery" role="alert"><section><h1>APP2 could not display this section</h1><p>Your session and records are safe. Reload the page to restore the workspace.</p><button onClick={()=>window.location.reload()}>Reload APP2</button>{(this.state.errorMessage||this.state.componentStack)&&<details className="app-recovery-details" open><summary>Technical details</summary>{this.state.errorMessage&&<pre>{this.state.errorMessage}</pre>}{this.state.componentStack&&<pre>{this.state.componentStack}</pre>}</details>}</section></main>
    return this.props.children
  }
}
