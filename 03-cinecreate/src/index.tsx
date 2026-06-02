import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: Error|null}> {
  state = { error: null as Error|null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{color:'#ff6b6b',padding:40,background:'var(--card)',height:'100vh'}}>
        <h2 style={{color:'var(--text)'}}>应用崩溃</h2>
        <pre style={{fontSize:12,marginTop:16,whiteSpace:'pre-wrap',color:'var(--text3)'}}>{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
        <button style={{marginTop:16,padding:'8px 20px',background:'var(--accent-text)',color:'#fff',border:'none',borderRadius:8,cursor:'pointer'}}
          onClick={() => this.setState({error:null})}>重试</button>
      </div>;
    }
    return this.props.children;
  }
}

const el = document.getElementById('root');
if (!el) {
  document.body.innerHTML = '<div style="color:red;padding:40px">ERROR: #root not found</div>';
} else {
  const root = createRoot(el);
  root.render(<ErrorBoundary><App /></ErrorBoundary>);
}
