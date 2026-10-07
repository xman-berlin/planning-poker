import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Room from './pages/Room.jsx'

export default function App() {
  return (
    <>
      <a className="skip" href="#inhalt">
        Zum Inhalt
      </a>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:sessionId" element={<Room />} />
        <Route path="*" element={<Missing />} />
      </Routes>
    </>
  )
}

function Missing() {
  return (
    <main id="inhalt" className="wrap" style={{ padding: '3rem 0' }}>
      <section className="panel stack">
        <p className="kicker">Planungspoker</p>
        <h1 className="display" style={{ fontSize: '2.4rem' }}>
          Diese Seite gibt es nicht.
        </h1>
        <Link className="btn btn-primary" to="/">
          Zur Startseite
        </Link>
      </section>
    </main>
  )
}
