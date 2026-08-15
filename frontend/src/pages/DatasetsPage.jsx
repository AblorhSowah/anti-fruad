import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDatasets, deleteDataset, previewColumns, uploadDataset, friendlyError } from '../api'

export default function DatasetsPage() {
    const [datasets, setDatasets] = useState([])
    const [datasetsError, setDatasetsError] = useState('')
    const [file, setFile] = useState(null)
    const [columns, setColumns] = useState([])
    const [mapping, setMapping] = useState({ sender: '', receiver: '', amount: '', step: '', type_col: '' })
    const [name, setName] = useState('')
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [currentStep, setCurrentStep] = useState('')
    const [log, setLog] = useState([])
    const [step, setStep] = useState('idle') // idle | mapping | uploading | done
    const [uploadError, setUploadError] = useState('')
    const [result, setResult] = useState(null) // { dataset_id, transactions, flagged } after a successful import
    const [serverProcessing, setServerProcessing] = useState(false) // true once bytes are uploaded and we're waiting on scoring/DB writes with no progress signal
    const navigate = useNavigate()

    useEffect(() => { fetchDatasets() }, [])

    const fetchDatasets = async () => {
        try {
            const res = await getDatasets()
            setDatasets(res.data)
            setDatasetsError('')
        } catch (e) {
            setDatasetsError(friendlyError(e))
        }
    }

    const addLog = (msg) => setLog(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 20))

    const handleFile = async (e) => {
        const f = e.target.files[0]
        if (!f) return
        setFile(f)
        setResult(null)
        setUploadError('')
        setName(f.name.replace('.csv', ''))
        addLog(`Reading file: ${f.name}`)
        try {
            const res = await previewColumns(f)
            setColumns(res.data.columns)
            setMapping({ sender: '', receiver: '', amount: '', step: '', type_col: '' })
            setStep('mapping')
            addLog(`Detected ${res.data.columns.length} columns. Please map them.`)
        } catch (err) {
            const msg = friendlyError(err)
            addLog(`✗ Could not read file: ${msg}`)
            setUploadError(msg)
            setFile(null)
            e.target.value = ''
        }
    }

    const handleUpload = async () => {
        for (const k of ['sender', 'receiver', 'amount', 'step']) {
            if (!mapping[k]) return alert(`Please map the "${k}" column`)
        }
        setStep('uploading')
        setUploading(true)
        setUploadError('')
        setResult(null)
        setServerProcessing(false)
        setProgress(0)

        // Pre-flight stages give immediate feedback while the request is being
        // prepared; the real progress bar takes over once bytes start moving.
        const stages = [
            { step: 'Initializing graph pipeline...', progress: 3 },
            { step: 'Validating CSV structure...', progress: 6 },
        ]
        for (const s of stages) {
            await new Promise(r => setTimeout(r, 200))
            setCurrentStep(s.step)
            setProgress(s.progress)
            addLog(s.step)
        }

        try {
            addLog(`Uploading file (${(file.size / 1024 / 1024).toFixed(2)} MB)...`)
            let sawUploadComplete = false
            const res = await uploadDataset(file, mapping, name, (evt) => {
                if (!evt.total) return
                // Uploading the file itself is 10-70% of the bar; the remainder is
                // server-side scoring + writing to Neo4j, which has no progress
                // events, so it gets a clear "still working" indeterminate state.
                const pct = Math.round((evt.loaded / evt.total) * 100)
                setProgress(10 + Math.round(pct * 0.6))
                setCurrentStep(`Uploading file... ${pct}%`)
                if (pct >= 100 && !sawUploadComplete) {
                    sawUploadComplete = true
                    setServerProcessing(true)
                    setCurrentStep('Running GNN inference & writing to database... this can take a while for large files')
                    addLog('File received by server. Scoring transactions with the GNN and writing to Neo4j...')
                }
            })

            setServerProcessing(false)
            setProgress(95)
            addLog(`✓ Successfully ingested ${res.data.transactions.toLocaleString()} transactions`)
            addLog(`✓ Identified ${res.data.flagged.toLocaleString()} suspicious transactions`)
            addLog(`✓ Dataset ready for analysis — ID: ${res.data.dataset_id}`)

            setProgress(100)
            setCurrentStep('✓ IMPORT COMPLETE')
            setStep('done')
            setResult({ ...res.data, name: name || file.name })

            fetchDatasets()
        } catch (e) {
            const msg = friendlyError(e)
            setProgress(0)
            addLog(`✗ Error: ${msg}`)
            setCurrentStep('✗ Import failed')
            setUploadError(msg)
            setStep('mapping')
        }
        setServerProcessing(false)
        setUploading(false)
    }

    const handleDelete = async (id) => {
        try {
            await deleteDataset(id)
            if (result?.dataset_id === id) setResult(null)
            fetchDatasets()
        } catch (e) {
            setDatasetsError(friendlyError(e))
        }
    }

    const goToAnalysis = (id) => {
        sessionStorage.setItem('dataset_id', id)
        navigate(`/app/dashboard?dataset_id=${id}`)
    }

    const REQUIRED = ['sender', 'receiver', 'amount', 'step']
    const LABELS = { sender: 'Sender Account', receiver: 'Receiver Account', amount: 'Amount', step: 'Timestamp/Step', type_col: 'Transaction Type (optional)' }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 32, minHeight: 'calc(100vh - 64px)', maxWidth: '2000px', margin: '0 auto' }}>

            {/* LEFT — Upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  <div className="tag" style={{ color: 'var(--green)', marginBottom: 4, fontSize: 12, letterSpacing: 1 }}>◆ DATA INGESTION SYSTEM</div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8, letterSpacing: '-0.5px' }}>Upload Dataset</h1>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Import transaction data for AML analysis</p>
                </div>

                {/* Error banner — surfaces failures that used to be silent (backend down, bad CSV, etc.) */}
                {uploadError && (
                    <div className="card" style={{ borderLeft: '3px solid var(--accent)', background: 'rgba(255, 59, 94, 0.08)', borderRadius: '8px', animation: 'fadeIn 0.3s ease', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 20, lineHeight: 1 }}>⚠</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>IMPORT FAILED</div>
                            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{uploadError}</div>
                        </div>
                        <button className="btn" style={{ fontSize: 10, padding: '6px 10px' }} onClick={() => setUploadError('')}>DISMISS</button>
                    </div>
                )}

                {/* Success CTA — replaces the old "quietly refresh the list and hope they notice" flow */}
                {step === 'done' && result && (
                    <div className="card" style={{ borderLeft: '3px solid var(--green)', background: 'rgba(0, 255, 136, 0.08)', borderRadius: '8px', animation: 'fadeIn 0.3s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{ fontSize: 22 }}>✅</div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--green)', fontWeight: 700, letterSpacing: 1 }}>DATASET READY FOR ANALYSIS</div>
                        </div>
                        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>
                            <strong style={{ color: 'var(--text)' }}>{result.name}</strong> — {result.transactions.toLocaleString()} transactions ingested,{' '}
                            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{result.flagged.toLocaleString()} flagged</span> as suspicious.
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-green" style={{ flex: 1, fontSize: 14, padding: '12px 16px', fontWeight: 700 }}
                                onClick={() => goToAnalysis(result.dataset_id)}>
                                📊 VIEW ANALYSIS DASHBOARD →
                            </button>
                            <button className="btn" style={{ fontSize: 14, padding: '12px 16px', fontWeight: 700 }}
                                onClick={() => navigate(`/app/investigate?dataset_id=${result.dataset_id}`)}>
                                🔎 INVESTIGATE
                            </button>
                        </div>
                    </div>
                )}

                {/* File Drop */}
                <div className="card" style={{ 
                  border: file ? '2px solid var(--green)' : '2px dashed rgba(0, 255, 136, 0.3)', 
                  textAlign: 'center', 
                  padding: 48, 
                  cursor: 'pointer', 
                  position: 'relative',
                  background: file ? 'rgba(0, 255, 136, 0.05)' : 'transparent',
                  transition: 'all 0.3s ease',
                  borderRadius: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!file) e.currentTarget.style.borderColor = 'var(--green)'
                }}
                onMouseLeave={(e) => {
                  if (!file) e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.3)'
                }}
                    onClick={() => document.getElementById('fileInput').click()}>
                    <input id="fileInput" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 48, background: 'linear-gradient(135deg, var(--green) 0%, var(--cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>📊</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: file ? 'var(--green)' : 'var(--text)', fontWeight: 700, marginBottom: 8 }}>
                        {file ? `✓ ${file.name}` : 'DROP CSV FILE HERE'}
                    </div>
                    <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text2)' }}>
                      {file ? 'Ready to import' : 'or click to browse your computer'}
                    </div>
                    {file && <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)', marginTop: 12, fontWeight: 600 }}>
                        📦 {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>}
                </div>

                {/* Expected Format */}
                {!file && (
                    <div className="card" style={{ background: 'rgba(0, 255, 136, 0.05)', borderLeft: '3px solid var(--green)', borderRadius: '8px' }}>
                        <div className="tag" style={{ marginBottom: 12, fontSize: 11, color: 'var(--green)' }}>📋 EXPECTED CSV FORMAT</div>
                        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text2)', marginBottom: 12, fontWeight: 500 }}>
                            Your CSV file should contain these columns:
                        </div>
                        <div style={{ background: 'rgba(0, 0, 0, 0.85)', padding: 12, borderRadius: 4, marginBottom: 12, overflow: 'auto', fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.8, border: '1px solid rgba(0, 255, 136, 0.25)' }}>
                            <div style={{ color: 'var(--green)', marginBottom: 6, fontWeight: 600 }}>Account,Account.1,Amount,Timestamp,Payment Format</div>
                            <div style={{ color: 'var(--dark-chrome-text2)' }}>8001A2B0D,8002C3D4E,5000,1,Transfer</div>
                            <div style={{ color: 'var(--dark-chrome-text2)' }}>8002C3D4E,8003E5F6G,7500,2,Wire</div>
                            <div style={{ color: 'var(--dark-chrome-text2)' }}>8003E5F6G,8004H7I8J,3200,3,ACH</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--green)' }}>Required columns:</strong><br/>
                            • Sender Account (source of transfer)<br/>
                            • Receiver Account (destination)<br/>
                            • Amount (transaction value)<br/>
                            • Timestamp/Step (time or sequence)<br/>
                            <br/>
                            <strong style={{ color: 'var(--text2)' }}>Optional:</strong> Transaction Type, Currencies
                        </div>
                    </div>
                )}

                {/* Column Mapping */}
                {step !== 'idle' && (
                    <div className="card" style={{ animation: 'fadeIn 0.3s ease', borderRadius: '8px' }}>
                        <div className="tag" style={{ marginBottom: 16, fontSize: 11, color: 'var(--cyan)' }}>⚙ COLUMN MAPPING</div>
                        <input value={name} onChange={e => setName(e.target.value)}
                            placeholder="Dataset name..."
                            disabled={uploading}
                            style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 14, padding: '12px 14px', marginBottom: 16, fontWeight: 500, borderRadius: '4px' }} />
                        {Object.keys(mapping).map(key => (
                            <div key={key} style={{ marginBottom: 14 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: REQUIRED.includes(key) ? 'var(--accent)' : 'var(--text2)', marginBottom: 6, letterSpacing: 1, fontWeight: 600 }}>
                                    {LABELS[key]} {REQUIRED.includes(key) && '*'}
                                </div>
                                <select value={mapping[key]} onChange={e => setMapping(p => ({ ...p, [key]: e.target.value }))}
                                    disabled={uploading}
                                    style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: `1.5px solid ${mapping[key] ? 'var(--green)' : 'var(--border)'}`, color: 'var(--text)', fontFamily: 'var(--sans)', fontSize: 13, padding: '10px 12px', borderRadius: '4px' }}>
                                    <option value="">-- select column --</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        ))}
                        
                        {/* Progress Bar */}
                        {uploading && (
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--green)', marginBottom: 10, fontWeight: 700, letterSpacing: 1 }}>
                                    PROGRESS: <span style={{ fontSize: 16 }}>{progress}%</span>
                                </div>
                                <div style={{ width: '100%', height: 12, background: 'rgba(0, 0, 0, 0.3)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                                    <div style={{
                                        width: `${progress}%`, height: '100%',
                                        background: serverProcessing
                                          ? 'linear-gradient(90deg, var(--green) 25%, var(--cyan) 50%, var(--green) 75%)'
                                          : 'linear-gradient(90deg, var(--green) 0%, var(--cyan) 100%)',
                                        backgroundSize: serverProcessing ? '200% 100%' : '100% 100%',
                                        animation: serverProcessing ? 'shimmer 1.4s linear infinite' : 'none',
                                        transition: 'width 0.3s ease', boxShadow: '0 0 10px rgba(0, 255, 136, 0.5)'
                                    }}></div>
                                </div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--cyan)', marginTop: 12, fontWeight: 500, animation: 'pulse 1s infinite' }}>
                                    ⚙ {currentStep || 'Processing...'}
                                </div>
                            </div>
                        )}
                        
                        <button className="btn btn-green" style={{ width: '100%', fontSize: 15, padding: '14px 18px', fontWeight: 700, letterSpacing: 1 }}
                            onClick={handleUpload} disabled={uploading}>
                            {uploading ? `📥 IMPORTING... ${progress}%` : '📥 IMPORT DATASET'}
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT — Log + Datasets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Header */}
                <div style={{ marginBottom: 4 }}>
                  <div className="tag" style={{ color: 'var(--cyan)', marginBottom: 4, fontSize: 12, letterSpacing: 1 }}>◆ SYSTEM MONITOR</div>
                  <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', marginTop: 8, letterSpacing: '-0.5px' }}>Operations</h1>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Real-time system activity and dataset management</p>
                </div>

                {/* Terminal Log */}
                <div className="card" style={{ fontFamily: 'var(--mono)', fontSize: 12, minHeight: 240, background: 'rgba(0, 0, 0, 0.85)', overflow: 'auto', borderLeft: '3px solid var(--green)', borderRadius: '8px' }}>
                    <div className="tag" style={{ marginBottom: 12, fontSize: 11, color: 'var(--green)', letterSpacing: 1 }}>▶ SYSTEM LOG</div>
                    {log.length === 0
                        ? <div style={{ color: 'var(--dark-chrome-text2)', fontSize: 12, opacity: 0.7 }}>{'>'} Awaiting input...</div>
                        : log.map((l, i) => (
                            <div key={i} style={{ color: l.includes('✓') ? 'var(--green)' : l.includes('✗') ? 'var(--accent)' : l.includes('⚙') ? 'var(--cyan)' : 'var(--dark-chrome-text2)', marginBottom: 7, fontSize: 12, fontWeight: l.includes('✓') || l.includes('✗') ? 600 : 400, animation: i === 0 && uploading ? 'slideInLeft 0.3s ease' : 'none' }}>
                                {'>'} {l}
                            </div>
                        ))}
                    {uploading && <div style={{ color: 'var(--cyan)', animation: 'pulse 1s infinite', fontSize: 12, fontWeight: 600, marginTop: 8 }}>{'>'} Processing...</div>}
                </div>

                {/* Dataset List */}
                <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                        <div className="tag" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 1 }}>📦 LOADED DATASETS ({datasets.length})</div>
                        {datasetsError && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                ⚠ {datasetsError}
                                <button className="btn" style={{ fontSize: 10, padding: '4px 8px' }} onClick={fetchDatasets}>RETRY</button>
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      {datasets.length === 0
                        ? <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text2)', padding: '20px', textAlign: 'center', opacity: 0.6 }}>No datasets loaded yet</div>
                        : datasets.map((d, idx) => (
                            <div key={d.id} style={{ 
                              padding: '16px', 
                              borderBottom: idx < datasets.length - 1 ? '1px solid rgba(42, 63, 95, 0.4)' : 'none',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 12,
                              transition: 'all 0.3s ease',
                              background: 'rgba(0, 255, 136, 0.02)',
                              borderLeft: '3px solid var(--green)',
                              borderRadius: '4px',
                              marginBottom: 8
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 15, marginBottom: 6, color: 'var(--text)', letterSpacing: '-0.3px' }}>📊 {d.name}</div>
                                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                                        <div>ID: <span style={{ color: 'var(--cyan)' }}>{d.id}</span></div>
                                        <div>{d.transaction_count?.toLocaleString()} transactions | <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🚩 {d.flagged_count} flagged</span></div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button className="btn btn-green" style={{ fontSize: 11, padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}
                                      onClick={() => goToAnalysis(d.id)}>ANALYZE</button>
                                  <button className="btn" style={{ fontSize: 11, padding: '8px 12px', fontWeight: 600 }}
                                      onClick={() => { if (confirm(`Delete dataset "${d.name}"? This cannot be undone.`)) handleDelete(d.id) }}>DEL</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}