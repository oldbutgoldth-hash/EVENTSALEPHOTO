import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('KOAKE_APP_RENDER_ERROR', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main style={{ minHeight: '100vh', padding: 24, fontFamily: 'sans-serif', background: '#fdfbf7', color: '#2d2d2d' }}>
        <section style={{ maxWidth: 720, margin: '60px auto', border: '3px solid #2d2d2d', padding: 24, boxShadow: '6px 6px 0 #2d2d2d', background: '#fff9c4' }}>
          <h1 style={{ marginTop: 0 }}>เปิดหน้าเว็บไม่สำเร็จ</h1>
          <p>กรุณาเปิด Developer Tools → Console แล้วส่งข้อความสีแดงให้ตรวจสอบ</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#fff', padding: 12, border: '2px dashed #2d2d2d' }}>
            {this.state.error.message}
          </pre>
          <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 48, padding: '8px 18px', border: '3px solid #2d2d2d', background: '#ff4d4d', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            โหลดหน้าใหม่
          </button>
        </section>
      </main>
    )
  }
}
